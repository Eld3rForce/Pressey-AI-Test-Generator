import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';

// ── Fixtures (hoisted) ────────────────────────────────────────────────
const mockTest = vi.hoisted(() => ({
  id: 1, title: 'Science Quiz', topic: 'Biology', difficulty: 'Medium',
  questionCount: 3, mcqPercentage: 67,
  questions: [
    {
      id: 101, type: 'mcq' as const, text: 'What is H2O?',
      options: ['Water', 'Fire', 'Earth', 'Air'],
      correctAnswer: 'Water', explanation: 'Water is a molecule', orderIndex: 0,
    },
    {
      id: 102, type: 'mcq' as const, text: 'What gas do plants use?',
      options: ['Oxygen', 'CO2', 'Nitrogen', 'Helium'],
      correctAnswer: 'CO2', explanation: 'Photosynthesis', orderIndex: 1,
    },
    {
      id: 103, type: 'text' as const, text: 'Define gravity',
      correctAnswer: 'A force of attraction', explanation: '', orderIndex: 2,
    },
  ],
  createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
}));

const mockAttempt = vi.hoisted(() => ({
  id: 1, testId: 1,
  startedAt: '2025-06-01T10:00:00Z', completedAt: '2025-06-01T10:30:00Z',
  score: 2, totalQuestions: 3,
}));

const mockResponses = vi.hoisted(() => [
  { id: 1, attemptId: 1, questionId: 101, userAnswer: 'Water', isCorrect: true },
  { id: 2, attemptId: 1, questionId: 102, userAnswer: 'Oxygen', isCorrect: false },
  { id: 3, attemptId: 1, questionId: 103, userAnswer: 'A force of attraction', isCorrect: true },
]);

// ── Mock dbService ────────────────────────────────────────────────────
vi.mock('../lib/dbService', () => ({
  getTest: vi.fn().mockResolvedValue(mockTest),
  getAttempt: vi.fn().mockResolvedValue(mockAttempt),
  getResponses: vi.fn().mockResolvedValue(mockResponses),
  getAttempts: vi.fn().mockResolvedValue([mockAttempt]),
  getAllTests: vi.fn().mockResolvedValue([mockTest]),
  deleteTest: vi.fn().mockResolvedValue(undefined),
  createAttempt: vi.fn().mockResolvedValue(1),
  completeAttempt: vi.fn().mockResolvedValue(undefined),
  saveResponses: vi.fn().mockResolvedValue(undefined),
  getSettings: vi.fn().mockResolvedValue({ apiKey: 'sk-test', model: 'openai/gpt-4o' }),
  saveSetting: vi.fn().mockResolvedValue(undefined),
  deleteSetting: vi.fn().mockResolvedValue(undefined),
  saveResponse: vi.fn().mockResolvedValue(undefined),
  saveExplanation: vi.fn().mockResolvedValue(undefined),
  saveExplanations: vi.fn().mockResolvedValue(undefined),
  getExplanations: vi.fn().mockResolvedValue([]),
}));

// ── Mock pdfExport ────────────────────────────────────────────────────
vi.mock('../lib/pdfExport', () => ({
  exportTestToPdf: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
}));

// ── Mock explanations ────────────────────────────────────────────────
vi.mock('../lib/explanations', () => ({
  generateExplanations: vi.fn().mockResolvedValue([]),
}));

import TestReview from './TestReview.svelte';
import { getTest, getAttempt, getResponses } from '../lib/dbService';

describe('TestReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTest).mockResolvedValue(mockTest);
    vi.mocked(getAttempt).mockResolvedValue(mockAttempt);
    vi.mocked(getResponses).mockResolvedValue(mockResponses);
  });

  // ── 1. Shows loading state initially ───────────────────────────────
  it('shows loading state initially', () => {
    render(TestReview, { testId: 1, attemptId: 1 });
    expect(screen.getByText('Preparing your review…')).toBeTruthy();
  });

  // ── 2. Renders test title after loading ────────────────────────────
  it('renders test title after loading', async () => {
    render(TestReview, { testId: 1, attemptId: 1 });
    await waitFor(() => {
      expect(screen.getByText('Science Quiz')).toBeTruthy();
    });
  });

  // ── 3. Displays score percentage ───────────────────────────────────
  it('displays the score percentage', async () => {
    render(TestReview, { testId: 1, attemptId: 1 });
    await waitFor(() => {
      // "67%" is rendered as 67<span>%</span> — check for "67" text
      expect(screen.getByText('67')).toBeTruthy();
    });
  });

  // ── 4. Shows correct count label ───────────────────────────────────
  it('shows correct count', async () => {
    render(TestReview, { testId: 1, attemptId: 1 });
    await waitFor(() => {
      expect(screen.getByText('2/3 correct')).toBeTruthy();
    });
  });

  // ── 5. Renders filter tabs ─────────────────────────────────────────
  it('renders All, Correct, Incorrect filter tabs', async () => {
    render(TestReview, { testId: 1, attemptId: 1 });
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /All/ })).toBeTruthy();
      expect(screen.getByRole('tab', { name: /Correct/ })).toBeTruthy();
      expect(screen.getByRole('tab', { name: /Incorrect/ })).toBeTruthy();
    });
  });

  // ── 6. All tab shows all questions ─────────────────────────────────
  it('shows all questions on All tab', async () => {
    render(TestReview, { testId: 1, attemptId: 1 });
    await waitFor(() => {
      expect(screen.getByText('What is H2O?')).toBeTruthy();
      expect(screen.getByText('What gas do plants use?')).toBeTruthy();
      expect(screen.getByText('Define gravity')).toBeTruthy();
    });
  });

  // ── 7. Filter to Correct shows only correct ────────────────────────
  it('filters to correct answers only', async () => {
    render(TestReview, { testId: 1, attemptId: 1 });
    await waitFor(() => {
      expect(screen.getByText('Science Quiz')).toBeTruthy();
    });
    await fireEvent.click(screen.getByRole('tab', { name: /Correct/ }));
    await waitFor(() => {
      expect(screen.getByText('What is H2O?')).toBeTruthy();
      expect(screen.getByText('Define gravity')).toBeTruthy();
      expect(screen.queryByText('What gas do plants use?')).toBeNull();
    });
  });

  // ── 8. Filter to Incorrect shows only wrong ────────────────────────
  it('filters to incorrect answers only', async () => {
    render(TestReview, { testId: 1, attemptId: 1 });
    await waitFor(() => {
      expect(screen.getByText('Science Quiz')).toBeTruthy();
    });
    await fireEvent.click(screen.getByRole('tab', { name: /Incorrect/ }));
    await waitFor(() => {
      expect(screen.getByText('What gas do plants use?')).toBeTruthy();
      expect(screen.queryByText('What is H2O?')).toBeNull();
    });
  });

  // ── 9. Shows Correct/Incorrect badges ──────────────────────────────
  it('shows Correct and Incorrect badges', async () => {
    render(TestReview, { testId: 1, attemptId: 1 });
    await waitFor(() => {
      expect(screen.getAllByText('Correct').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Incorrect').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 10. Retake Test calls onRetake ─────────────────────────────────
  it('calls onRetake when Retake Test clicked', async () => {
    const onRetake = vi.fn();
    render(TestReview, { testId: 1, attemptId: 1, onRetake });
    await waitFor(() => {
      expect(screen.getByText('Science Quiz')).toBeTruthy();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Retake Test' }));
    expect(onRetake).toHaveBeenCalledWith(1);
  });

  // ── 11. Export to PDF button exists ────────────────────────────────
  it('renders Export to PDF button', async () => {
    render(TestReview, { testId: 1, attemptId: 1 });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Export to PDF' })).toBeTruthy();
    });
  });

  // ── 12. Close button calls onClose ─────────────────────────────────
  it('calls onClose when Close clicked', async () => {
    const onClose = vi.fn();
    render(TestReview, { testId: 1, attemptId: 1, onClose });
    await waitFor(() => {
      expect(screen.getByText('Science Quiz')).toBeTruthy();
    });
    await fireEvent.click(screen.getByLabelText('Close review'));
    expect(onClose).toHaveBeenCalled();
  });

  // ── 13. Shows error when data fails to load ────────────────────────
  it('shows error on load failure', async () => {
    vi.mocked(getTest).mockRejectedValueOnce(new Error('Load failed'));
    render(TestReview, { testId: 999, attemptId: 1 });
    await waitFor(() => {
      expect(screen.getByText('Load failed')).toBeTruthy();
    });
  });

  // ── 14. Shows user answer and correct answer ───────────────────────
  it('displays user answer and correct answer sections', async () => {
    render(TestReview, { testId: 1, attemptId: 1 });
    await waitFor(() => {
      expect(screen.getAllByText('Your answer').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Correct answer').length).toBeGreaterThanOrEqual(1);
    });
  });
});
