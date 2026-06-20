// ============================================================
// AI Semantic Marking — batch evaluation of text answers
// ============================================================

import type { Test, ProviderType, Settings, ApiError } from './types';
import type { OpenRouterMessage, OpenRouterResponse } from './types';
import {
  MarkingResponseSchema,
  type ValidatedMarkingResponse,
} from './schemas';
import {
  createApiError,
  isApiError,
  shouldRetry,
  ErrorCodes,
  MAX_RETRIES,
  BACKOFF_DELAYS,
} from './errorUtils';
import { sleep } from './utils';
import { getProviderConfig, getProviderKey } from './providers/registry';

// ============================================================
// Constants
// ============================================================

const OLLAMA_CHAT_PATH = '/v1/chat/completions';
const REQUEST_TEMPERATURE = 0.5;

// ============================================================
// Private helpers (mirror providers/client.ts — not exported)
// ============================================================

function resolveEndpoint(provider: ProviderType, settings: Settings): string {
  if (provider === 'ollama') {
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

  if (provider !== 'ollama') {
    const key = getProviderKey(settings, provider);
    if (key) {
      headers['Authorization'] = `Bearer ${key}`;
    }
  }

  if (config.headers) {
    Object.assign(headers, config.headers);
  }

  return headers;
}

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
// Prompt builders
// ============================================================

/** A text question ready to be sent to the LLM for evaluation. */
interface TextQuestionForMarking {
  questionId: number;
  questionText: string;
  correctAnswer: string;
  userAnswer: string;
}

function buildMarkingPrompt(textQuestions: TextQuestionForMarking[]): string {
  const lines = textQuestions.map(
    (q, i) =>
      `Question ${i + 1} (ID: ${q.questionId}):
Text: ${q.questionText}
Correct Answer: ${q.correctAnswer}
User's Answer: ${q.userAnswer}`,
  );

  return `Grade the following student answers. For each question, determine if the user's answer is conceptually correct, even if worded differently from the correct answer.

${lines.join('\n\n')}

Respond with valid JSON in this exact format:
{
  "markings": [
    { "questionId": <number>, "isCorrect": true/false }
  ]
}`;
}

// ============================================================
// Core LLM call — same retry/error pattern as generateExplanationWithProvider
// ============================================================

/**
 * Call the configured provider to semantically mark text answers.
 * Validates the response against MarkingResponseSchema.
 *
 * @param provider      Provider identifier
 * @param prompt        Batch prompt containing all text questions
 * @param systemMessage System instruction for the tutor role
 * @param settings      User settings (provider keys, model, ollamaUrl)
 * @param model         Optional model override
 */
async function generateMarkingWithProvider(
  provider: ProviderType,
  prompt: string,
  systemMessage: string,
  settings: Settings,
  model?: string,
): Promise<ValidatedMarkingResponse> {
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

  const requestBody = {
    model: effectiveModel,
    messages: [systemMsg, userMsg],
    response_format: { type: 'json_object' },
    temperature: REQUEST_TEMPERATURE,
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

      // Validate with MarkingResponseSchema
      const result = MarkingResponseSchema.safeParse(parsedJson);
      if (!result.success) {
        const error = createApiError(
          ErrorCodes.VALIDATION_ERROR,
          `Marking validation failed: ${result.error.message}`,
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

// ============================================================
// Public API
// ============================================================

/**
 * AI semantic marking of text answers in a single LLM call.
 *
 * - MCQ questions → `null` (caller handles exact-match).
 * - Text questions with no user answer → `false` (skipped, not sent to LLM).
 * - Text questions with a user answer → evaluated in one batch LLM call.
 *
 * On failure throws the error — the caller handles retry / error UX.
 *
 * @param test     The test with questions to mark
 * @param answers  Map of questionId → userAnswer
 * @param settings User settings (provider keys, model, ollamaUrl)
 * @param provider Optional provider override (default: 'openrouter')
 * @param model    Optional model override
 * @returns        Map<questionId, boolean | null>
 *                   null = MCQ (not evaluated by AI)
 *                   true/false = text question marking result
 */
export async function generateMarking(
  test: Test,
  answers: Map<number, string>,
  settings: Settings,
  provider?: ProviderType,
  model?: string,
): Promise<Map<number, boolean | null>> {
  const effectiveProvider = provider ?? 'openrouter';
  const result = new Map<number, boolean | null>();

  // Separate questions into MCQ (null) and text (needs AI marking)
  const textQuestions: TextQuestionForMarking[] = [];

  for (const question of test.questions) {
    const qid = question.id;
    if (qid === undefined) continue;

    if (question.type === 'mcq') {
      // MCQ — not evaluated by AI; caller handles exact-match
      result.set(qid, null);
      continue;
    }

    // Text question
    const userAnswer = answers.get(qid);
    if (!userAnswer || userAnswer.trim().length === 0) {
      // Empty/skipped → false; don't waste tokens on the LLM
      result.set(qid, false);
      continue;
    }

    textQuestions.push({
      questionId: qid,
      questionText: question.text,
      correctAnswer: question.correctAnswer,
      userAnswer,
    });
  }

  // No text questions to evaluate — return early
  if (textQuestions.length === 0) {
    return result;
  }

  // Single batch LLM call for all text questions
  const prompt = buildMarkingPrompt(textQuestions);
  const systemMessage =
    'You are an expert tutor. For each question, decide if the user\'s answer is conceptually correct, even if worded differently. Always respond with valid JSON matching {"markings": [{"questionId": <id>, "isCorrect": true/false}]}.';

  const validated = await generateMarkingWithProvider(
    effectiveProvider,
    prompt,
    systemMessage,
    settings,
    model,
  );

  // Merge LLM results into the map
  for (const marking of validated.markings) {
    if (result.has(marking.questionId)) {
      // Already set (mcq → null or skipped → false) — never overwrite
      continue;
    }
    result.set(marking.questionId, marking.isCorrect);
  }

  // Any text question not returned by the LLM defaults to false
  for (const tq of textQuestions) {
    if (!result.has(tq.questionId)) {
      result.set(tq.questionId, false);
    }
  }

  return result;
}
