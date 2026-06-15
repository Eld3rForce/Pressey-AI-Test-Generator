import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';

// ── Fixtures (hoisted for vi.mock) ────────────────────────────────────
const mockTest = vi.hoisted(() => ({
  id: 1,
  title: 'Science Quiz',
  topic: 'Biology',
  difficulty: 'Medium',
  questionCount: 3,
  mcqPercentage: 67,
  questions: [
    {
      id: 101, type: 'mcq' as const, text: 'What is the powerhouse of the cell?',
      options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi'],
      correctAnswer: 'Mitochondria', explanation: 'Mitochondria produce ATP', orderIndex: 0,
    },
    {
      id: 102, type: 'mcq' as const, text: 'What gas do plants absorb?',
      options: ['Oxygen', 'Nitrogen', 'CO2', 'Helium'],
      correctAnswer: 'CO2', explanation: 'Photosynthesis uses CO2', orderIndex: 1,
    },
    {
      id: 103, type: 'text' as const, text: 'Explain the water cycle',
      correctAnswer: 'Evaporation, condensation, precipitation', explanation: '', orderIndex: 2,
    },
  ],
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
}));

// ── Mock dbService ────────────────────────────────────────────────────
vi.mock('../lib/dbService', () => ({
  getTest: vi.fn().mockResolvedValue(mockTest),
  createAttempt: vi.fn().mockResolvedValue(1),
  completeAttempt: vi.fn().mockResolvedValue(undefined),
  saveResponses: vi.fn().mockResolvedValue(undefined),
  getResponses: vi.fn().mockResolvedValue([]),
  getAttempt: vi.fn().mockResolvedValue({ id: 1, testId: 1 }),
  getAttempts: vi.fn().mockResolvedValue([{ id: 1, testId: 1 }]),
  getAllTests: vi.fn().mockResolvedValue([mockTest]),
  deleteTest: vi.fn().mockResolvedValue(undefined),
  getSettings: vi.fn().mockResolvedValue({ apiKey: 'sk-test', model: 'openai/gpt-4o' }),
  saveSetting: vi.fn().mockResolvedValue(undefined),
  deleteSetting: vi.fn().mockResolvedValue(undefined),
  saveResponse: vi.fn().mockResolvedValue(undefined),
  saveExplanation: vi.fn().mockResolvedValue(undefined),
  saveExplanations: vi.fn().mockResolvedValue(undefined),
  getExplanations: vi.fn().mockResolvedValue([]),
}));

import TakeTest from './TakeTest.svelte';
import { getTest, createAttempt, completeAttempt, saveResponses } from '../lib/dbService';

describe('TakeTest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTest).mockResolvedValue(mockTest);
    vi.mocked(createAttempt).mockResolvedValue(1);
    vi.mocked(saveResponses).mockResolvedValue(undefined);
    vi.mocked(completeAttempt).mockResolvedValue(undefined);
  });

  // ── 1. Shows loading state initially ───────────────────────────────
  it('shows loading state initially', () => {
    render(TakeTest, { testId: 1 });
    expect(screen.getByText('Preparing your test…')).toBeTruthy();
  });

  // ── 2. Renders test title after loading ────────────────────────────
  it('renders test title after loading', async () => {
    render(TakeTest, { testId: 1 });
    await waitFor(() => {
      expect(screen.getByText('Science Quiz')).toBeTruthy();
    });
  });

  // ── 3. Shows question progress ─────────────────────────────────────
  it('shows question progress after loading', async () => {
    render(TakeTest, { testId: 1 });
    await waitFor(() => {
      expect(screen.getByText('Question 1 of 3')).toBeTruthy();
    });
  });

  // ── 4. Renders question navigation dots ────────────────────────────
  it('renders question navigation dots', async () => {
    render(TakeTest, { testId: 1 });
    await waitFor(() => {
      expect(screen.getByLabelText('Go to question 1')).toBeTruthy();
      expect(screen.getByLabelText('Go to question 2')).toBeTruthy();
      expect(screen.getByLabelText('Go to question 3')).toBeTruthy();
    });
  });

  // ── 5. Navigates to next question ──────────────────────────────────
  it('navigates to next question on Next click', async () => {
    render(TakeTest, { testId: 1 });
    await waitFor(() => {
      expect(screen.getByText('Question 1 of 3')).toBeTruthy();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Next →' }));
    await waitFor(() => {
      expect(screen.getByText('Question 2 of 3')).toBeTruthy();
    });
  });

  // ── 6. Previous button disabled on first question ──────────────────
  it('disables Previous button on first question', async () => {
    render(TakeTest, { testId: 1 });
    await waitFor(() => {
      const prevBtn = screen.getByRole('button', { name: '← Previous' }) as HTMLButtonElement;
      expect(prevBtn.disabled).toBe(true);
    });
  });

  // ── 7. Shows Finish Test button on last question ───────────────────
  it('shows Finish Test button on last question', async () => {
    render(TakeTest, { testId: 1 });
    await waitFor(() => {
      expect(screen.getByText('Question 1 of 3')).toBeTruthy();
    });
    await fireEvent.click(screen.getByLabelText('Go to question 3'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Finish Test' })).toBeTruthy();
    });
  });

  // ── 8. MCQ options are rendered ────────────────────────────────────
  it('renders MCQ options for multiple choice questions', async () => {
    render(TakeTest, { testId: 1 });
    await waitFor(() => {
      expect(screen.getByText('Mitochondria')).toBeTruthy();
      expect(screen.getByText('Nucleus')).toBeTruthy();
    });
  });

  // ── 9. Text answer input renders for written questions ─────────────
  it('renders textarea for written questions', async () => {
    render(TakeTest, { testId: 1 });
    await waitFor(() => {
      expect(screen.getByText('Science Quiz')).toBeTruthy();
    });
    await fireEvent.click(screen.getByLabelText('Go to question 3'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Type your answer here…')).toBeTruthy();
    });
  });

  // ── 10. Shows confirmation modal on Finish ─────────────────────────
  it('shows confirmation modal when Finish Test clicked', async () => {
    render(TakeTest, { testId: 1 });
    await waitFor(() => {
      expect(screen.getByText('Science Quiz')).toBeTruthy();
    });
    await fireEvent.click(screen.getByLabelText('Go to question 3'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Finish Test' })).toBeTruthy();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Finish Test' }));
    await waitFor(() => {
      expect(screen.getByText('Submit test?')).toBeTruthy();
    });
  });

  // ── 11. Submits test and shows results ─────────────────────────────
  it('submits test and shows score', async () => {
    render(TakeTest, { testId: 1, onComplete: vi.fn() });
    await waitFor(() => {
      expect(screen.getByText('Science Quiz')).toBeTruthy();
    });
    await fireEvent.click(screen.getByLabelText('Go to question 3'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Finish Test' })).toBeTruthy();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Finish Test' }));
    await waitFor(() => {
      expect(screen.getByText('Submit test?')).toBeTruthy();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Submit test' }));
    await waitFor(() => {
      expect(screen.getByText('Test complete')).toBeTruthy();
    });
  });

  // ── 12. Shows error when test not found ────────────────────────────
  it('shows error when test load fails', async () => {
    vi.mocked(getTest).mockRejectedValueOnce(new Error('Not found'));
    render(TakeTest, { testId: 999 });
    await waitFor(() => {
      expect(screen.getByText('Failed to load test')).toBeTruthy();
    });
  });
});
