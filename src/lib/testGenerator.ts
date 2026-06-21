import { generateTest } from './api';
import type { Test, TestConfig, Settings } from './types';
import { createApiError, ErrorCodes } from './errorUtils';
import { settingsStore } from './settingsStore.svelte';
import { searchWeb, searchDocument, buildResearchContext } from './research';
import { extractUrls, isPdfUrl } from './urlExtractor';
import { fetchAndExtractUrls, buildUrlFetchContext, type UrlFetchResult } from './urlFetch';
import { invoke } from '@tauri-apps/api/core';

// ============================================================
// Formatting requirements (shared between prompt builders)
// ============================================================

/**
 * Build the formatting requirements block (question count, MCQ/text split,
 * difficulty, JSON schema). Shared by both prompt-only and file-based paths.
 */
function buildFormattingRequirements(config: TestConfig): string {
  const mcqCount = Math.round((config.mcqPercentage / 100) * config.questionCount);
  const textCount = config.questionCount - mcqCount;
  const topic = config.topic || '<derived from user prompt>';

  return `REQUIREMENTS:
- Exactly ${config.questionCount} total questions
- ${mcqCount} multiple choice questions (${config.mcqPercentage}% of total)
- ${textCount} text response / free-form questions
- Difficulty level: ${config.difficulty}

MULTIPLE CHOICE QUESTIONS:
- Each must have exactly 4 options labeled as A, B, C, D
- Only one option should be correct
- Options should be plausible but clearly distinguishable
- Include a detailed explanation of why the correct answer is right and why the distractors are wrong

TEXT RESPONSE QUESTIONS:
- Should require thoughtful, multi-sentence answers
- Include a model answer as the correctAnswer
- Include an explanation of key points the answer should cover

ALL QUESTIONS MUST HAVE:
- A clear, unambiguous question text
- The correct answer clearly specified
- A helpful explanation that reinforces learning

Return the response as a JSON object with this exact structure:
{
  "title": "A descriptive title for the test",
  "topic": "${topic}",
  "questions": [
    {
      "type": "mcq",
      "text": "Question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "The correct option text exactly as written in options",
      "explanation": "Detailed explanation of the answer"
    },
    {
      "type": "text",
      "text": "Question text here",
      "correctAnswer": "Model answer",
      "explanation": "Explanation of key points the answer should cover"
    }
  ]
}`;
}

// ============================================================
// Rich prompt construction
// ============================================================

/**
 * Build a rich instructional prompt for test generation.
 *
 * When a non-empty `userPrompt` is provided, it becomes the primary
 * instruction (placed first), followed by formatting requirements.
 * When `userPrompt` is empty or undefined, the original template
 * ("Generate a test on the topic of...") is used verbatim.
 *
 * @param config      Test configuration (question count, difficulty, etc.).
 * @param userPrompt  Optional user-provided prompt placed as the primary
 *                    instruction when non-empty.
 * @returns The composed prompt string.
 */
function buildRichPrompt(config: TestConfig, userPrompt?: string): string {
  if (userPrompt && userPrompt.trim() !== '') {
    // User prompt drives output — placed first, template follows
    return `${userPrompt}\n\n---\n\nNow generate a test with the following formatting requirements:\n\n${buildFormattingRequirements(config)}`;
  }

  // No user prompt — original template behavior
  const topic = config.topic || 'general knowledge';
  return `Generate a test on the topic of "${topic}" with the following specifications:\n\n${buildFormattingRequirements(config)}`;
}

// ============================================================
// Validation
// ============================================================

function validateTestStructure(test: Test, config: TestConfig): void {
  // Validate question count matches config
  if (test.questions.length !== config.questionCount) {
    throw createApiError(
      ErrorCodes.TEST_QUESTION_COUNT_MISMATCH,
      `Question count mismatch: expected ${config.questionCount}, got ${test.questions.length}`
    );
  }

  // Validate MCQ percentage distribution
  const expectedMcqCount = Math.round((config.mcqPercentage / 100) * config.questionCount);
  const actualMcqCount = test.questions.filter((q) => q.type === 'mcq').length;
  if (actualMcqCount !== expectedMcqCount) {
    throw createApiError(
      ErrorCodes.TEST_MCQ_COUNT_MISMATCH,
      `MCQ count mismatch: expected ${expectedMcqCount} (${config.mcqPercentage}%), got ${actualMcqCount}`
    );
  }

  // Validate each question
  for (let i = 0; i < test.questions.length; i++) {
    const q = test.questions[i];

    // Required fields must be present
    if (!q.type || !q.text || !q.correctAnswer) {
      throw createApiError(
        ErrorCodes.TEST_MISSING_FIELDS,
        `Question ${i + 1} is missing required fields (type, text, or correctAnswer)`
      );
    }

    // Type must be 'mcq' or 'text'
    if (q.type !== 'mcq' && q.type !== 'text') {
      throw createApiError(
        ErrorCodes.TEST_INVALID_TYPE,
        `Question ${i + 1} has invalid type: "${q.type}"`
      );
    }

    // MCQ-specific validation
    if (q.type === 'mcq') {
      if (!q.options || q.options.length !== 4) {
        throw createApiError(
          ErrorCodes.TEST_OPTIONS_COUNT,
          `MCQ question ${i + 1} must have exactly 4 options, got ${q.options?.length ?? 0}`
        );
      }

      // Verify correctAnswer is one of the options
      if (!q.options.includes(q.correctAnswer)) {
        throw createApiError(
          ErrorCodes.TEST_ANSWER_NOT_IN_OPTIONS,
          `MCQ question ${i + 1}: correctAnswer "${q.correctAnswer}" is not among the provided options`
        );
      }
    }

    // Explanation must be present for learning value
    if (!q.explanation) {
      throw createApiError(
        ErrorCodes.TEST_MISSING_EXPLANATION,
        `Question ${i + 1} is missing an explanation`
      );
    }
  }
}

// ============================================================
// Research context (opt-in)
// ============================================================

async function gatherResearchContext(
  topic: string,
  uploadedText: string | undefined,
  settings: Settings
): Promise<string> {
  if (!settings.enableResearch) return '';
  const maxResults = settings.researchMaxResults ?? 5;
  const snippetChars = settings.researchMaxSnippetChars ?? 800;
  const trimmedTopic = (topic || '').trim();

  try {
    const webPromise = trimmedTopic
      ? searchWeb(trimmedTopic, maxResults, snippetChars)
      : Promise.resolve([]);
    const docPromise =
      uploadedText && uploadedText.trim() && trimmedTopic
        ? searchDocument(uploadedText, trimmedTopic, snippetChars)
        : Promise.resolve([]);

    const [web, docs] = await Promise.all([webPromise, docPromise]);
    return buildResearchContext(web, docs);
  } catch {
    return '';
  }
}

// ============================================================
// URL fetch context (opt-in)
// ============================================================

/**
 * Extract URLs from `prompt`, fetch their content (HTML via
 * `fetchAndExtractUrls`, PDF via the `fetch_and_extract_pdf_url` Tauri
 * command), and return a serialized `URL CONTEXT:` block.
 *
 * Returns `''` when `enableUrlFetch` is off, the prompt has no URLs, or
 * any fetch/parse error occurs (graceful degradation — never throws).
 *
 * For file-based generation, pass the `userPrompt` argument (not the
 * file content) so we only extract URLs the user explicitly typed.
 */
async function gatherUrlContext(prompt: string, settings: Settings): Promise<string> {
  if (settings.enableUrlFetch !== true) {
    return '';
  }

  try {
    const urls = extractUrls(prompt);
    if (urls.length === 0) return '';

    const htmlUrls = urls.filter((u) => !isPdfUrl(u));
    const pdfUrls = urls.filter(isPdfUrl);

    const htmlResults: UrlFetchResult[] = await fetchAndExtractUrls(htmlUrls, settings);

    const pdfResults: UrlFetchResult[] = [];
    for (const url of pdfUrls) {
      try {
        const pdfText = await invoke<string>('fetch_and_extract_pdf_url', { url });
        pdfResults.push({
          url,
          title: url.split('/').pop() || url,
          content: pdfText,
          contentLength: pdfText.length,
        });
      } catch (err) {
        console.warn(`[urlFetch] PDF_FETCH_FAILED: ${url}`, err);
      }
    }

    return buildUrlFetchContext([...htmlResults, ...pdfResults]);
  } catch (err) {
    console.warn('[urlFetch] URL_FETCH_FAILED: gatherUrlContext error', err);
    return '';
  }
}

// ============================================================
// Core generation pipeline (shared between prompt and file paths)
// ============================================================

/**
 * Core generation pipeline: research context, URL context, API call,
 * validation, persistence.
 *
 * Shared by both {@link generateFromPrompt} and {@link generateFromFile} to
 * avoid duplicating the generation/validation/persist logic.
 *
 * @param fullPrompt        The fully composed prompt to send to the API.
 * @param config            Test configuration.
 * @param apiKey            OpenRouter API key.
 * @param personalityPrompt Optional personality system prefix.
 * @param uploadedText      Optional study-material text for research context.
 * @param urlSourcePrompt   Optional text to scan for URLs (the user's typed
 *                          instruction — NOT file content). When omitted,
 *                          no URL fetch is performed.
 * @returns The generated and validated Test.
 */
async function generateCore(
  fullPrompt: string,
  config: TestConfig,
  apiKey: string,
  personalityPrompt?: string,
  uploadedText?: string,
  urlSourcePrompt?: string
): Promise<Test> {
  const settings = settingsStore.settings;
  const researchContext = await gatherResearchContext(
    config.topic || '',
    uploadedText,
    settings
  );
  const urlContext = urlSourcePrompt
    ? await gatherUrlContext(urlSourcePrompt, settings)
    : '';

  const contextBlocks = [researchContext, urlContext].filter(Boolean);
  const prompt =
    contextBlocks.length > 0 ? `${fullPrompt}\n\n${contextBlocks.join('\n\n')}` : fullPrompt;

  const provider = settings.provider || 'openrouter';
  const test = await generateTest(prompt, config, apiKey, undefined, personalityPrompt, provider);

  validateTestStructure(test, config);

  try {
    const { createTest } = await import('./dbService');
    await createTest(test);
  } catch {
    // dbService not yet available — continue without persisting
  }

  return test;
}

// ============================================================
// Public API
// ============================================================

/**
 * Generate a test from a user-provided prompt string.
 *
 * Composes a rich instructional prompt (user prompt first when non-empty,
 * then formatting requirements), calls the OpenRouter API via
 * {@link generateTest}, validates the returned structure, and optionally
 * persists the test to SQLite if dbService is available.
 *
 * @param prompt   User prompt text placed as the primary instruction
 *                 when non-empty; otherwise the template-only prompt is used.
 * @param config   Test configuration (question count, difficulty, etc.).
 * @param apiKey   OpenRouter API key.
 * @param personalityPrompt  Optional personality system prefix (e.g. from
 *   {@link buildPersonalityPrefix}) to prepend to the system message.
 * @param uploadedText  Optional study-material text to make searchable
 *   when research is enabled (e.g. file content from {@link generateFromFile}).
 * @returns The generated and validated Test.
 */
export async function generateFromPrompt(
  prompt: string,
  config: TestConfig,
  apiKey: string,
  personalityPrompt?: string,
  uploadedText?: string
): Promise<Test> {
  const fullPrompt = buildRichPrompt(config, prompt);
  return generateCore(fullPrompt, config, apiKey, personalityPrompt, uploadedText, prompt);
}

/**
 * Generate a test from file content.
 *
 * Builds a file-centric prompt where the file content (and optional user
 * instructions) come first, followed by formatting requirements. This
 * avoids the double-wrapping that occurred when delegating to
 * {@link generateFromPrompt}.
 *
 * The file content serves as the primary context for test generation.
 * Any user-provided instructions are appended within the file context,
 * not nested inside a second template.
 *
 * @param fileContent  The extracted text content of the source file.
 * @param fileName     Name of the source file (for context in the prompt).
 * @param config       Test configuration.
 * @param apiKey       OpenRouter API key.
 * @param personalityPrompt  Optional personality system prefix to influence tone.
 * @param userPrompt        Optional user-provided instructions appended within
 *                          the file context prompt.
 * @returns The generated and validated Test.
 */
export async function generateFromFile(
  fileContent: string,
  fileName: string,
  config: TestConfig,
  apiKey: string,
  personalityPrompt?: string,
  userPrompt?: string
): Promise<Test> {
  // Build file-context prompt: file content is primary, formatting follows
  let fullPrompt =
    `Generate a test based on the following content from file "${fileName}":\n\n` +
    `${fileContent}\n\n` +
    `Create questions that test understanding of the key concepts, facts, and ideas ` +
    `presented in this content. Ensure questions cover the most important material ` +
    `from the document.`;

  if (userPrompt && userPrompt.trim() !== '') {
    fullPrompt += `\n\nADDITIONAL USER INSTRUCTIONS:\n${userPrompt}`;
  }

  // Append formatting requirements (not wrapped again — this is the only template pass)
  fullPrompt += `\n\n---\n\nNow generate a test with the following formatting requirements:\n\n${buildFormattingRequirements(config)}`;

  return generateCore(fullPrompt, config, apiKey, personalityPrompt, fileContent, userPrompt);
}
