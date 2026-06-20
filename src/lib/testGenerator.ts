import { generateTest } from './api';
import type { Test, TestConfig, Settings } from './types';
import { createApiError, ErrorCodes } from './errorUtils';
import { settingsStore } from './settingsStore.svelte';
import { searchWeb, searchDocument, buildResearchContext } from './research';

// ============================================================
// Rich prompt construction
// ============================================================

function buildRichPrompt(config: TestConfig): string {
  const mcqCount = Math.round((config.mcqPercentage / 100) * config.questionCount);
  const textCount = config.questionCount - mcqCount;
  const topic = config.topic || 'general knowledge';

  return `Generate a test on the topic of "${topic}" with the following specifications:

REQUIREMENTS:
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
// Core functions
// ============================================================

/**
 * Generate a test from a prompt string.
 *
 * Composes a rich instructional prompt, calls the OpenRouter API via
 * {@link generateTest}, validates the returned structure, and optionally
 * persists the test to SQLite if dbService is available.
 *
 * @param prompt  Additional instructions to append to the base prompt.
 * @param config  Test configuration (question count, difficulty, etc.).
 * @param apiKey  OpenRouter API key.
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
  // Compose full prompt: base system-like instructions + user's additional context
  let fullPrompt = `${buildRichPrompt(config)}\n\nADDITIONAL CONTEXT / INSTRUCTIONS:\n${prompt}`;

  const researchContext = await gatherResearchContext(
    config.topic || '',
    uploadedText,
    settingsStore.settings
  );
  if (researchContext) {
    fullPrompt = `${fullPrompt}\n\n${researchContext}`;
  }

  // Call the API (retries and JSON parsing handled internally)
  const provider = settingsStore.settings.provider || 'openrouter';
  const test = await generateTest(fullPrompt, config, apiKey, undefined, personalityPrompt, provider);

  // Validate the returned test structure against the config
  validateTestStructure(test, config);

  // Conditionally save to database if dbService is available (Task 8, parallel)
  try {
    const { createTest } = await import('./dbService');
    await createTest(test);
  } catch {
    // dbService not yet available — continue without persisting
  }

  return test;
}

/**
 * Generate a test from file content.
 *
 * Prepends the file content as study material context, then delegates to
 * {@link generateFromPrompt} to produce the test.
 *
 * @param fileContent  The extracted text content of the source file.
 * @param fileName     Name of the source file (for context in the prompt).
 * @param config       Test configuration.
 * @param apiKey       OpenRouter API key.
 * @param personalityPrompt  Optional personality system prefix to influence tone.
 * @param userPrompt        Optional user-provided instructions appended as additional context.
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
  let contextPrompt =
    `Generate a test based on the following content from file "${fileName}":\n\n` +
    `${fileContent}\n\n` +
    `Create questions that test understanding of the key concepts, facts, and ideas ` +
    `presented in this content. Ensure questions cover the most important material ` +
    `from the document.`;

  if (userPrompt && userPrompt.trim() !== '') {
    contextPrompt += `\n\nADDITIONAL USER INSTRUCTIONS:\n${userPrompt}`;
  }

  return generateFromPrompt(contextPrompt, config, apiKey, personalityPrompt, fileContent);
}
