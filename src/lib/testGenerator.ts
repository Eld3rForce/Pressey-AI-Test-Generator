import { generateTest } from './api';
import type { Test, TestConfig, Question } from './types';

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
    throw new Error(
      `Question count mismatch: expected ${config.questionCount}, got ${test.questions.length}`
    );
  }

  // Validate MCQ percentage distribution
  const expectedMcqCount = Math.round((config.mcqPercentage / 100) * config.questionCount);
  const actualMcqCount = test.questions.filter((q) => q.type === 'mcq').length;
  if (actualMcqCount !== expectedMcqCount) {
    throw new Error(
      `MCQ count mismatch: expected ${expectedMcqCount} (${config.mcqPercentage}%), got ${actualMcqCount}`
    );
  }

  // Validate each question
  for (let i = 0; i < test.questions.length; i++) {
    const q = test.questions[i];

    // Required fields must be present
    if (!q.type || !q.text || !q.correctAnswer) {
      throw new Error(
        `Question ${i + 1} is missing required fields (type, text, or correctAnswer)`
      );
    }

    // Type must be 'mcq' or 'text'
    if (q.type !== 'mcq' && q.type !== 'text') {
      throw new Error(`Question ${i + 1} has invalid type: "${q.type}"`);
    }

    // MCQ-specific validation
    if (q.type === 'mcq') {
      if (!q.options || q.options.length !== 4) {
        throw new Error(
          `MCQ question ${i + 1} must have exactly 4 options, got ${q.options?.length ?? 0}`
        );
      }

      // Verify correctAnswer is one of the options
      if (!q.options.includes(q.correctAnswer)) {
        throw new Error(
          `MCQ question ${i + 1}: correctAnswer "${q.correctAnswer}" is not among the provided options`
        );
      }
    }

    // Explanation must be present for learning value
    if (!q.explanation) {
      throw new Error(`Question ${i + 1} is missing an explanation`);
    }
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
 * @returns The generated and validated Test.
 */
export async function generateFromPrompt(
  prompt: string,
  config: TestConfig,
  apiKey: string
): Promise<Test> {
  // Compose full prompt: base system-like instructions + user's additional context
  const fullPrompt = `${buildRichPrompt(config)}\n\nADDITIONAL CONTEXT / INSTRUCTIONS:\n${prompt}`;

  // Call the API (retries and JSON parsing handled internally)
  const test = await generateTest(fullPrompt, config, apiKey);

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
 * @returns The generated and validated Test.
 */
export async function generateFromFile(
  fileContent: string,
  fileName: string,
  config: TestConfig,
  apiKey: string
): Promise<Test> {
  const contextPrompt =
    `Generate a test based on the following content from file "${fileName}":\n\n` +
    `${fileContent}\n\n` +
    `Create questions that test understanding of the key concepts, facts, and ideas ` +
    `presented in this content. Ensure questions cover the most important material ` +
    `from the document.`;

  return generateFromPrompt(contextPrompt, config, apiKey);
}
