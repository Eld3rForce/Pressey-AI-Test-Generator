import type {
  Test,
  TestConfig,
  Settings,
  ProviderType,
  OpenRouterMessage,
  OpenRouterRequest,
  OpenRouterResponse,
  ApiError,
} from '../types';
import {
  TestResponseSchema,
  ExplanationResponseSchema,
  type ValidatedTestResponse,
  type ValidatedExplanationResponse,
} from '../schemas';
import {
  createApiError,
  isApiError,
  shouldRetry,
  ErrorCodes,
  MAX_RETRIES,
  BACKOFF_DELAYS,
} from '../errorUtils';
import { sleep } from '../utils';
import { getProviderConfig, getProviderKey } from './registry';

// ============================================================
// Constants
// ============================================================

const OLLAMA_CHAT_PATH = '/v1/chat/completions';
const REQUEST_TEMPERATURE = 0.7;

// ============================================================
// Prompt construction (mirrors src/lib/api.ts)
// ============================================================

function buildSystemPrompt(config: TestConfig): string {
  const mcqCount = Math.round((config.mcqPercentage / 100) * config.questionCount);
  const textCount = config.questionCount - mcqCount;
  const topicClause = config.topic ? ` on ${config.topic}` : '';

  return `You are an expert tutor creating a ${config.questionCount}-question test${topicClause} at ${config.difficulty} difficulty. ${mcqCount} questions (${config.mcqPercentage}%) must be multiple choice with exactly 4 options each, and ${textCount} must be text response questions. Return valid JSON conforming to this structure: { "title": string, "topic": string, "questions": [{ "type": "mcq" | "text", "text": string, "options": [string, string, string, string] (for mcq only), "correctAnswer": string, "explanation": string }] }`;
}

function buildRequestBody(
  prompt: string,
  config: TestConfig,
  model: string,
  systemPrefix?: string,
): OpenRouterRequest {
  const baseSystem = buildSystemPrompt(config);
  const systemContent = systemPrefix
    ? `${systemPrefix}\n\n${baseSystem}`
    : baseSystem;

  const systemMessage: OpenRouterMessage = { role: 'system', content: systemContent };
  const userMessage: OpenRouterMessage = { role: 'user', content: prompt };

  return {
    model,
    messages: [systemMessage, userMessage],
    response_format: { type: 'json_object' },
    temperature: REQUEST_TEMPERATURE,
  };
}

// ============================================================
// URL + Header construction per provider
// ============================================================

function resolveEndpoint(provider: ProviderType, settings: Settings): string {
  if (provider === 'ollama') {
    // settings.ollamaUrl is the user-configured base; append chat path
    const base = (settings.ollamaUrl ?? 'http://localhost:11434').replace(/\/+$/, '');
    return `${base}${OLLAMA_CHAT_PATH}`;
  }
  return getProviderConfig(provider).url;
}

function buildHeaders(
  provider: ProviderType,
  settings: Settings,
): Record<string, string> {
  const config = getProviderConfig(provider);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Ollama: no Authorization header
  if (provider !== 'ollama') {
    const key = getProviderKey(settings, provider);
    if (key) {
      headers['Authorization'] = `Bearer ${key}`;
    }
  }

  // Provider-specific extra headers (HTTP-Referer/X-Title for OpenRouter/Anthropic)
  if (config.headers) {
    Object.assign(headers, config.headers);
  }

  return headers;
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

function getHttpErrorMessage(provider: ProviderType, status: number): string {
  switch (status) {
    case 401:
      return `Invalid API key. Please check your ${provider} API key.`;
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

function validateApiResponse(parsed: unknown): ValidatedTestResponse {
  const result = TestResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw createApiError(
      ErrorCodes.VALIDATION_ERROR,
      `Response validation failed: ${result.error.message}`,
    );
  }
  return result.data;
}

// ============================================================
// Core API function — unified across providers
// ============================================================

/**
 * Generate a test using the configured provider.
 *
 * All providers use the OpenAI-compatible request shape. Ollama is the only
 * provider that omits the Authorization header and resolves its endpoint from
 * `settings.ollamaUrl` at call time.
 *
 * @param provider    Provider identifier (openai | anthropic | gemini | ollama | openrouter)
 * @param prompt      User prompt
 * @param config      Test configuration
 * @param settings    User settings (provider keys, model, ollamaUrl)
 * @param systemPrefix Optional prefix prepended to the system message
 */
export async function generateWithProvider(
  provider: ProviderType,
  prompt: string,
  config: TestConfig,
  settings: Settings,
  systemPrefix?: string,
): Promise<Test> {
  const providerConfig = getProviderConfig(provider);
  const model = settings.model && settings.model.length > 0
    ? settings.model
    : providerConfig.defaultModel;

  const endpoint = resolveEndpoint(provider, settings);
  const headers = buildHeaders(provider, settings);
  const requestBody = buildRequestBody(prompt, config, model, systemPrefix);

  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      // HTTP-level errors
      if (!response.ok) {
        const errorCode = classifyHttpError(response.status);

        // No retry on auth or bad request
        if (
          errorCode === ErrorCodes.AUTH_INVALID_KEY ||
          errorCode === ErrorCodes.BAD_REQUEST
        ) {
          throw createApiError(
            errorCode,
            getHttpErrorMessage(provider, response.status),
            response.status,
          );
        }

        // Retryable HTTP error
        const error = createApiError(
          errorCode,
          getHttpErrorMessage(provider, response.status),
          response.status,
        );
        if (attempt < MAX_RETRIES && shouldRetry(error)) {
          lastError = error;
          await sleep(BACKOFF_DELAYS[attempt]);
          continue;
        }
        throw error;
      }

      // Parse the response body
      const data: OpenRouterResponse = await response.json();

      // API-level error in body
      if (data.error) {
        throw createApiError(
          ErrorCodes.API_ERROR,
          `${data.error.message} (code: ${data.error.code})`,
        );
      }

      // Extract content
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        const error = createApiError(
          ErrorCodes.EMPTY_RESPONSE,
          'No content in API response',
        );
        if (attempt < MAX_RETRIES && shouldRetry(error)) {
          lastError = error;
          await sleep(BACKOFF_DELAYS[attempt]);
          continue;
        }
        throw error;
      }

      // Parse JSON
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(content);
      } catch {
        const error = createApiError(
          ErrorCodes.MALFORMED_JSON,
          'Failed to parse API response content as JSON',
        );
        if (attempt < MAX_RETRIES && shouldRetry(error)) {
          lastError = error;
          await sleep(BACKOFF_DELAYS[attempt]);
          continue;
        }
        throw error;
      }

      // Validate with Zod
      const validated = validateApiResponse(parsedJson);

      // Build and return the Test
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
      // Already-typed ApiError: respect retry policy
      if (isApiError(error)) {
        lastError = error;
        if (shouldRetry(error) && attempt < MAX_RETRIES) {
          await sleep(BACKOFF_DELAYS[attempt]);
          continue;
        }
        throw error;
      }

      // Wrap unexpected errors (network failures, etc.) as NETWORK_ERROR
      const networkError = createApiError(
        ErrorCodes.NETWORK_ERROR,
        error instanceof Error ? error.message : 'Unknown network error',
      );
      lastError = networkError;

      if (attempt < MAX_RETRIES && shouldRetry(networkError)) {
        await sleep(BACKOFF_DELAYS[attempt]);
        continue;
      }
      throw networkError;
    }
  }

  // Unreachable: loop always either returns or throws
  throw (
    lastError || createApiError(ErrorCodes.UNKNOWN_ERROR, 'Unexpected error after retries')
  );
}

// ============================================================
// Explanation generation — unified across providers
// ============================================================

/**
 * Generate an explanation for a wrong answer using the configured provider.
 *
 * Shares the same retry/error-handling logic as `generateWithProvider` but
 * validates against `ExplanationResponseSchema` instead of `TestResponseSchema`.
 *
 * @param provider      Provider identifier (openai | anthropic | gemini | ollama | openrouter)
 * @param prompt        User prompt (the explanation prompt with question details)
 * @param systemMessage System message (tutor context instruction)
 * @param settings      User settings (provider keys, model, ollamaUrl)
 * @param model         Optional model override (defaults to settings.model or provider default)
 */
export async function generateExplanationWithProvider(
  provider: ProviderType,
  prompt: string,
  systemMessage: string,
  settings: Settings,
  model?: string,
): Promise<ValidatedExplanationResponse> {
  const providerConfig = getProviderConfig(provider);
  const effectiveModel =
    model && model.length > 0
      ? model
      : settings.model && settings.model.length > 0
        ? settings.model
        : providerConfig.defaultModel;

  const endpoint = resolveEndpoint(provider, settings);
  const headers = buildHeaders(provider, settings);

  const systemMsg: OpenRouterMessage = { role: 'system', content: systemMessage };
  const userMsg: OpenRouterMessage = { role: 'user', content: prompt };

  const requestBody: OpenRouterRequest = {
    model: effectiveModel,
    messages: [systemMsg, userMsg],
    response_format: { type: 'json_object' },
    temperature: 0.5,
  };

  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      // HTTP-level errors
      if (!response.ok) {
        const errorCode = classifyHttpError(response.status);

        // No retry on auth or bad request
        if (
          errorCode === ErrorCodes.AUTH_INVALID_KEY ||
          errorCode === ErrorCodes.BAD_REQUEST
        ) {
          throw createApiError(
            errorCode,
            getHttpErrorMessage(provider, response.status),
            response.status,
          );
        }

        // Retryable HTTP error
        const error = createApiError(
          errorCode,
          getHttpErrorMessage(provider, response.status),
          response.status,
        );
        if (attempt < MAX_RETRIES && shouldRetry(error)) {
          lastError = error;
          await sleep(BACKOFF_DELAYS[attempt]);
          continue;
        }
        throw error;
      }

      // Parse the response body
      const data: OpenRouterResponse = await response.json();

      // API-level error in body
      if (data.error) {
        throw createApiError(
          ErrorCodes.API_ERROR,
          `${data.error.message} (code: ${data.error.code})`,
        );
      }

      // Extract content
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        const error = createApiError(
          ErrorCodes.EMPTY_RESPONSE,
          'No content in API response',
        );
        if (attempt < MAX_RETRIES && shouldRetry(error)) {
          lastError = error;
          await sleep(BACKOFF_DELAYS[attempt]);
          continue;
        }
        throw error;
      }

      // Parse JSON
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(content);
      } catch {
        const error = createApiError(
          ErrorCodes.MALFORMED_JSON,
          'Failed to parse API response content as JSON',
        );
        if (attempt < MAX_RETRIES && shouldRetry(error)) {
          lastError = error;
          await sleep(BACKOFF_DELAYS[attempt]);
          continue;
        }
        throw error;
      }

      // Validate with ExplanationResponseSchema
      const result = ExplanationResponseSchema.safeParse(parsedJson);
      if (!result.success) {
        const error = createApiError(
          ErrorCodes.VALIDATION_ERROR,
          `Explanation validation failed: ${result.error.message}`,
        );
        if (attempt < MAX_RETRIES && shouldRetry(error)) {
          lastError = error;
          await sleep(BACKOFF_DELAYS[attempt]);
          continue;
        }
        throw error;
      }

      return result.data;
    } catch (error: unknown) {
      // Already-typed ApiError: respect retry policy
      if (isApiError(error)) {
        lastError = error;
        if (shouldRetry(error) && attempt < MAX_RETRIES) {
          await sleep(BACKOFF_DELAYS[attempt]);
          continue;
        }
        throw error;
      }

      // Wrap unexpected errors (network failures, etc.) as NETWORK_ERROR
      const networkError = createApiError(
        ErrorCodes.NETWORK_ERROR,
        error instanceof Error ? error.message : 'Unknown network error',
      );
      lastError = networkError;

      if (attempt < MAX_RETRIES && shouldRetry(networkError)) {
        await sleep(BACKOFF_DELAYS[attempt]);
        continue;
      }
      throw networkError;
    }
  }

  // Unreachable: loop always either returns or throws
  throw (
    lastError || createApiError(ErrorCodes.UNKNOWN_ERROR, 'Unexpected error after retries')
  );
}

// Re-export for consumers
export { isApiError, shouldRetry, ErrorCodes };
