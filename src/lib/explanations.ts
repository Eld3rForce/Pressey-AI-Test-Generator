import type {
  Test,
  Attempt,
  Explanation,
  OpenRouterRequest,
} from './types';
import { ExplanationResponseSchema } from './schemas';
import type { ValidatedExplanationResponse } from './schemas';
import { getResponses } from './dbService';
import { createApiError, ErrorCodes } from './errorUtils';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4o';

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

function buildExplanationPrompt(
  questionText: string,
  correctAnswer: string,
  userAnswer: string,
  questionType: string,
  options: string[] | undefined
): string {
  const optionsText = options?.length
    ? `\nOptions: ${options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(', ')}`
    : '';

  return `Question: ${questionText}${optionsText}
Correct answer: ${correctAnswer}
User's wrong answer: ${userAnswer}
Question type: ${questionType}

Explain why the correct answer is right and why the user's answer was wrong. Provide 2-3 learning resources (articles, videos, documentation, or books) that would help the user understand this topic better. Each resource must include a title, a full URL, and a type.

Respond with valid JSON in this exact format:
{
  "explanation": "Clear explanation of why the correct answer is right and why the user's answer is wrong",
  "userMistake": "Specific analysis of what the user likely misunderstood",
  "resources": [
    { "title": "Resource Title", "url": "https://...", "type": "article" }
  ]
}`;
}

function validateExplanationResponse(parsed: unknown): ValidatedExplanationResponse {
  const result = ExplanationResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw createApiError(
      'VALIDATION_ERROR',
      `Explanation validation failed: ${result.error.message}`
    );
  }
  return result.data;
}

export async function generateExplanations(
  attempt: Attempt,
  test: Test,
  apiKey: string,
  model: string = DEFAULT_MODEL
): Promise<Explanation[]> {
  if (!attempt.id) throw new Error('Attempt must have an id');

  const responses = await getResponses(attempt.id);
  const wrongResponses = responses.filter((r) => !r.isCorrect);

  if (wrongResponses.length === 0) return [];

  const questionMap = new Map(test.questions.map((q) => [q.id, q]));

  const explanations: Explanation[] = [];

  for (const response of wrongResponses) {
    const question = questionMap.get(response.questionId);
    if (!question) continue;

    const prompt = buildExplanationPrompt(
      question.text,
      question.correctAnswer,
      response.userAnswer || '(no answer)',
      question.type,
      question.options
    );

    const systemMessage = {
      role: 'system' as const,
      content: 'You are an expert tutor. Explain test answers clearly and provide helpful learning resources. Always respond with valid JSON.',
    };

    const userMessage = {
      role: 'user' as const,
      content: prompt,
    };

    const requestBody: OpenRouterRequest = {
      model,
      messages: [systemMessage, userMessage],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    };

    try {
      const fetchResponse = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://pressey.app',
          'X-Title': 'Pressey AI Explanation Generator',
        },
        body: JSON.stringify(requestBody),
      });

      if (!fetchResponse.ok) {
        throw createApiError(
          classifyHttpError(fetchResponse.status),
          getHttpErrorMessage(fetchResponse.status),
          fetchResponse.status
        );
      }

      const data = await fetchResponse.json();

      if (data.error) {
        throw createApiError(ErrorCodes.API_ERROR, data.error.message, data.error.code);
      }

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw createApiError(ErrorCodes.EMPTY_RESPONSE, 'No content in API response');
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(content);
      } catch {
        throw createApiError(ErrorCodes.MALFORMED_JSON, 'Failed to parse explanation response as JSON');
      }

      const validated = validateExplanationResponse(parsedJson);

      explanations.push({
        attemptId: attempt.id,
        questionId: response.questionId,
        explanation: validated.explanation,
        userMistake: validated.userMistake,
        resources: validated.resources,
      });
    } catch (error) {
      console.error(`Failed to generate explanation for question ${response.questionId}:`, error);
      throw error;
    }
  }

  return explanations;
}
