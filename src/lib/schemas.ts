import { z } from 'zod';

// ============================================================
// Zod schemas for OpenRouter API response validation
// ============================================================

export const QuestionSchema = z.object({
  type: z.enum(['mcq', 'text']),
  text: z.string().min(1),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string(),
  explanation: z.string().optional(),
});

export const TestResponseSchema = z.object({
  title: z.string(),
  topic: z.string().optional(),
  questions: z.array(QuestionSchema),
});

// Inferred TypeScript types from Zod schemas
export type ValidatedQuestion = z.infer<typeof QuestionSchema>;
export type ValidatedTestResponse = z.infer<typeof TestResponseSchema>;
