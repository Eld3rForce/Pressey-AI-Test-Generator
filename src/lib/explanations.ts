import type {
  Test,
  Attempt,
  Explanation,
  ProviderType,
  Settings,
} from './types';
import { getResponses } from './dbService';
import { generateExplanationWithProvider } from './providers/client';

const DEFAULT_MODEL = 'openai/gpt-4o';

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

/**
 * Build a minimal Settings object from the legacy (apiKey, model) parameters
 * for backward compatibility when no full Settings object is provided.
 */
function buildSettings(apiKey: string, model: string, provider: ProviderType): Settings {
  const settings: Settings = {
    apiKey,
    model,
    defaultQuestionCount: 10,
    defaultMcqPercentage: 50,
    defaultDifficulty: 'Medium',
  };
  switch (provider) {
    case 'openai':
      settings.openaiKey = apiKey;
      break;
    case 'anthropic':
      // Anthropic uses OpenRouter routing
      settings.openrouterKey = apiKey;
      break;
    case 'gemini':
      settings.geminiKey = apiKey;
      break;
    case 'ollama':
      settings.ollamaUrl = settings.ollamaUrl || 'http://localhost:11434';
      break;
    case 'openrouter':
      settings.openrouterKey = apiKey;
      break;
  }
  return settings;
}

export async function generateExplanations(
  attempt: Attempt,
  test: Test,
  apiKey: string,
  model: string = DEFAULT_MODEL,
  provider: ProviderType = 'openrouter',
  settings?: Settings,
): Promise<Explanation[]> {
  if (!attempt.id) throw new Error('Attempt must have an id');

  const responses = await getResponses(attempt.id);
  const wrongResponses = responses.filter((r) => !r.isCorrect);

  if (wrongResponses.length === 0) return [];

  const questionMap = new Map(test.questions.map((q) => [q.id, q]));
  const effectiveSettings = settings ?? buildSettings(apiKey, model, provider);
  const systemContent = 'You are an expert tutor. Explain test answers clearly and provide helpful learning resources. Always respond with valid JSON.';

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

    try {
      const validated = await generateExplanationWithProvider(
        provider,
        prompt,
        systemContent,
        effectiveSettings,
        model,
      );

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
