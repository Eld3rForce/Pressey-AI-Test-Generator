import type {
  Test,
  TestConfig,
  OpenRouterMessage,
  OpenRouterRequest,
  OpenRouterResponse,
  ApiError,
} from './types';
import { TestResponseSchema } from './schemas';
import {
  createApiError,
  isApiError,
  shouldRetry,
  ErrorCodes,
  MAX_RETRIES,
  BACKOFF_DELAYS,
} from './errorUtils';
import { sleep } from './utils';
import type { ValidatedTestResponse } from './schemas';

// ============================================================
// Constants
// ============================================================

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4o';

// ============================================================
// Prompt construction
// ============================================================

function buildSystemPrompt(config: TestConfig): string {
  const mcqCount = Math.round((config.mcqPercentage / 100) * config.questionCount);
  const textCount = config.questionCount - mcqCount;

  const topicStr = config.topic || 'general knowledge';

  return `You are an expert test creator. Generate a test with exactly ${config.questionCount} questions on the topic of ${topicStr}. Difficulty: ${config.difficulty}. ${mcqCount} questions (${config.mcqPercentage}%) should be multiple choice (with 4 options each), ${textCount} should be text response questions. Return valid JSON with this structure: { "title": string, "topic": string, "questions": [{ "type": "mcq" | "text", "text": string, "options": [string, string, string, string] (for mcq only), "correctAnswer": string, "explanation": string }] }`;
}

function buildRequest(
  prompt: string,
  config: TestConfig,
  model: string,
  systemPrefix?: string
): OpenRouterRequest {
  const baseSystemContent = buildSystemPrompt(config);

  const systemContent = systemPrefix
    ? `${systemPrefix}\n\n${baseSystemContent}`
    : baseSystemContent;

  const systemMessage: OpenRouterMessage = {
    role: 'system',
    content: systemContent,
  };

  const userMessage: OpenRouterMessage = {
    role: 'user',
    content: prompt,
  };

  return {
    model,
    messages: [systemMessage, userMessage],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  };
}

// ============================================================
// HTTP error classification
// ============================================================

function classifyHttpError(status: number): string {
  switch (status) {
    case 401:
      return ErrorCodes.AUTH_INVALID_KEY;
    case 429:
      return ErrorCodes.RATE_LIMITED;
    case 400:
      return ErrorCodes.BAD_REQUEST;
    default:
      if (status >= 500) return ErrorCodes.SERVER_ERROR;
      return ErrorCodes.API_ERROR;
  }
}

function getHttpErrorMessage(status: number): string {
  switch (status) {
    case 401:
      return 'Invalid API key. Please check your OpenRouter API key.';
    case 429:
      return 'Rate limit exceeded. Please try again later.';
    case 400:
      return 'Bad request. Please check the request parameters.';
    default:
      return `HTTP error ${status}`;
  }
}

// ============================================================
// Validation
// ============================================================

function validateApiResponse(
  parsed: unknown
): ValidatedTestResponse {
  const result = TestResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw createApiError(
      ErrorCodes.VALIDATION_ERROR,
      `Response validation failed: ${result.error.message}`
    );
  }

  return result.data;
}

// ============================================================
// Core API function
// ============================================================

export async function generateTest(
  prompt: string,
  config: TestConfig,
  apiKey: string,
  model: string = DEFAULT_MODEL,
  systemPrefix?: string
): Promise<Test> {
  const requestBody = buildRequest(prompt, config, model, systemPrefix);
  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://pressey.app',
          'X-Title': 'Pressey AI Test Generator',
        },
        body: JSON.stringify(requestBody),
      });

      // Handle HTTP-level errors
      if (!response.ok) {
        const errorCode = classifyHttpError(response.status);

        // Do not retry on 401 (auth) or 400 (bad request)
        if (errorCode === ErrorCodes.AUTH_INVALID_KEY || errorCode === ErrorCodes.BAD_REQUEST) {
          throw createApiError(errorCode, getHttpErrorMessage(response.status), response.status);
        }

        // Retry on 429 and 5xx
        const error = createApiError(errorCode, getHttpErrorMessage(response.status), response.status);
        if (attempt < MAX_RETRIES && shouldRetry(error)) {
          lastError = error;
          await sleep(BACKOFF_DELAYS[attempt]);
          continue;
        }
        throw error;
      }

      // Parse the response body
      const data: OpenRouterResponse = await response.json();

      // Check for API-level errors in the response
      if (data.error) {
        throw createApiError(ErrorCodes.API_ERROR, `${data.error.message} (code: ${data.error.code})`);
      }

      // Extract content from response
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        const error = createApiError(ErrorCodes.EMPTY_RESPONSE, 'No content in API response');
        if (attempt < MAX_RETRIES && shouldRetry(error)) {
          lastError = error;
          await sleep(BACKOFF_DELAYS[attempt]);
          continue;
        }
        throw error;
      }

      // Parse JSON from content
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(content);
      } catch {
        const error = createApiError(ErrorCodes.MALFORMED_JSON, 'Failed to parse API response content as JSON');
        if (attempt < MAX_RETRIES && shouldRetry(error)) {
          lastError = error;
          await sleep(BACKOFF_DELAYS[attempt]);
          continue;
        }
        throw error;
      }

      // Validate with Zod schema
      const validated = validateApiResponse(parsedJson);

      // Build and return the Test object
      return {
        title: validated.title,
        topic: validated.topic || config.topic,
        difficulty: config.difficulty,
        questionCount: config.questionCount,
        mcqPercentage: config.mcqPercentage,
        questions: validated.questions.map((q, index) => ({
          type: q.type,
          text: q.text,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          orderIndex: index,
        })),
      };
    } catch (error: unknown) {
      // Rethrow ApiErrors that should not be retried
      if (isApiError(error)) {
        lastError = error;
        if (shouldRetry(error) && attempt < MAX_RETRIES) {
          await sleep(BACKOFF_DELAYS[attempt]);
          continue;
        }
        throw error;
      }

      // Wrap unexpected errors (network errors, etc.)
      const networkError = createApiError(
        ErrorCodes.NETWORK_ERROR,
        error instanceof Error ? error.message : 'Unknown network error'
      );
      lastError = networkError;

      if (attempt < MAX_RETRIES && shouldRetry(networkError)) {
        await sleep(BACKOFF_DELAYS[attempt]);
        continue;
      }
      throw networkError;
    }
  }

  // Should never reach here
  throw lastError || createApiError(ErrorCodes.UNKNOWN_ERROR, 'Unexpected error after retries');
}

// Re-export key utilities for consumers
export { isApiError, shouldRetry, ErrorCodes };
