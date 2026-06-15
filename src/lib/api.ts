import type {
  Test,
  TestConfig,
  OpenRouterMessage,
  OpenRouterRequest,
  OpenRouterResponse,
  ApiError,
} from './types';
import { TestResponseSchema } from './schemas';
import { sleep } from './utils';
import type { ValidatedTestResponse } from './schemas';

// ============================================================
// Constants
// ============================================================

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4o';
const MAX_RETRIES = 3;
const BACKOFF_DELAYS = [1000, 2000, 4000]; // 1s, 2s, 4s

// ============================================================
// Helpers
// ============================================================

function createApiError(
  code: string,
  message: string,
  status?: number
): ApiError {
  return { code, message, status };
}

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}

function shouldRetry(error: ApiError): boolean {
  const retryable = [
    'RATE_LIMITED',
    'SERVER_ERROR',
    'MALFORMED_JSON',
    'EMPTY_RESPONSE',
    'VALIDATION_ERROR',
    'NETWORK_ERROR',
  ];
  return retryable.includes(error.code);
}

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
  model: string
): OpenRouterRequest {
  const systemMessage: OpenRouterMessage = {
    role: 'system',
    content: buildSystemPrompt(config),
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
// Validation
// ============================================================

function validateApiResponse(
  parsed: unknown
): ValidatedTestResponse {
  const result = TestResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw createApiError(
      'VALIDATION_ERROR',
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
  model: string = DEFAULT_MODEL
): Promise<Test> {
  const requestBody = buildRequest(prompt, config, model);
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
        if (errorCode === 'AUTH_INVALID_KEY' || errorCode === 'BAD_REQUEST') {
          throw createApiError(errorCode, getHttpErrorMessage(response.status), response.status);
        }

        // Retry on 429 and 5xx
        const error = createApiError(errorCode, getHttpErrorMessage(response.status), response.status);
        if (attempt < MAX_RETRIES) {
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
        throw createApiError('API_ERROR', data.error.message, data.error.code);
      }

      // Extract content from response
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        const error = createApiError('EMPTY_RESPONSE', 'No content in API response');
        if (attempt < MAX_RETRIES) {
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
        const error = createApiError('MALFORMED_JSON', 'Failed to parse API response content as JSON');
        if (attempt < MAX_RETRIES) {
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
      // Rethrow ApiErrors (they may have already triggered retry above)
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
        'NETWORK_ERROR',
        error instanceof Error ? error.message : 'Unknown network error'
      );
      lastError = networkError;

      if (attempt < MAX_RETRIES) {
        await sleep(BACKOFF_DELAYS[attempt]);
        continue;
      }
      throw networkError;
    }
  }

  // Should never reach here
  throw lastError || createApiError('UNKNOWN_ERROR', 'Unexpected error after retries');
}

// ============================================================
// HTTP error classification
// ============================================================

function classifyHttpError(status: number): string {
  switch (status) {
    case 401:
      return 'AUTH_INVALID_KEY';
    case 429:
      return 'RATE_LIMITED';
    case 400:
      return 'BAD_REQUEST';
    default:
      if (status >= 500) return 'SERVER_ERROR';
      return 'API_ERROR';
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
