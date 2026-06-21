// ============================================================
// Shared TypeScript types for Pressey AI Test Generator
// ============================================================

// --- Provider Types ---

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'openrouter';

export interface ProviderConfig {
  url: string;
  keyField: string;
  defaultModel: string;
  headers?: Record<string, string>;
}

// --- Test Configuration ---

export interface TestConfig {
  questionCount: number;       // 1-50
  mcqPercentage: number;       // 0-100
  includeMcq?: boolean;
  includeText?: boolean;
  provider?: ProviderType;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topic?: string;
}

// --- Question Types ---

export type QuestionType = 'mcq' | 'text';

export interface Question {
  id?: number;
  testId?: number;
  type: QuestionType;
  text: string;
  options?: string[];          // 4 options for MCQ
  correctAnswer: string;
  explanation?: string;
  orderIndex: number;
}

// --- Test ---

export interface Test {
  id?: number;
  title: string;
  topic?: string;
  difficulty: string;
  questionCount: number;
  mcqPercentage: number;
  questions: Question[];
  createdAt?: string;
  updatedAt?: string;
}

// --- Attempt ---

export interface Attempt {
  id?: number;
  testId: number;
  startedAt?: string;
  completedAt?: string;
  score?: number;
  totalQuestions?: number;
  currentIndex?: number;
}

// --- Response ---

export interface Response {
  id?: number;
  attemptId: number;
  questionId: number;
  userAnswer: string;
  isCorrect: boolean;
}

// --- Settings ---

export interface Settings {
  apiKey: string;
  model: string;
  defaultQuestionCount: number;
  defaultMcqPercentage: number;
  defaultDifficulty: 'Easy' | 'Medium' | 'Hard';
  personality?: string;
  customInstructions?: string;
  provider?: ProviderType;
  openaiKey?: string;
  anthropicKey?: string;
  geminiKey?: string;
  ollamaUrl?: string;
  openrouterKey?: string;
  includeMcq?: boolean;
  includeText?: boolean;
  enableResearch?: boolean;
  researchMaxResults?: number;
  researchMaxSnippetChars?: number;
  enableUrlFetch?: boolean;
  urlFetchMaxResults?: number;
  urlFetchMaxBytesPerUrl?: number;
}

// --- OpenRouter API Types ---

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  response_format?: { type: 'json_object' };
  temperature?: number;
  max_tokens?: number;
}

export interface OpenRouterChoice {
  message: {
    content: string;
  };
  finish_reason: string;
}

export interface OpenRouterResponse {
  id: string;
  choices: OpenRouterChoice[];
  error?: {
    message: string;
    code: number;
  };
}

// --- API Error ---

export interface ApiError {
  code: string;
  message: string;
  status?: number;
}

// --- Explanation & Resources ---

export interface Explanation {
  id?: number;
  attemptId: number;
  questionId: number;
  explanation: string;
  userMistake: string;
  resources: LearningResource[];
}

export interface LearningResource {
  title: string;
  url: string;
  type: 'article' | 'video' | 'documentation' | 'book';
}
