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

const mockTest2 = vi.hoisted(() => ({
  id: 2,
  title: 'History Quiz',
  topic: 'World History',
  difficulty: 'Easy',
  questionCount: 5,
  mcqPercentage: 80,
  questions: [],
  createdAt: '2025-01-02T00:00:00Z',
  updatedAt: '2025-01-02T00:00:00Z',
}));

const mockEmptyTest = vi.hoisted(() => ({
  id: 3,
  title: 'Empty Quiz',
  topic: 'Nothing',
  difficulty: 'Easy',
  questionCount: 0,
  mcqPercentage: 0,
  questions: [],
  createdAt: '2025-01-03T00:00:00Z',
  updatedAt: '2025-01-03T00:00:00Z',
}));

// ── Mock appStore ─────────────────────────────────────────────────────
const mockAppStore = vi.hoisted(() => ({
  activeRoute: 'take' as const,
  selectedTestId: null as number | null,
  selectedAttemptId: null as number | null,
  isLoading: false,
  error: null as string | null,
  navigateTo: vi.fn(),
}));
vi.mock('../lib/appStore.svelte', () => ({
  appStore: mockAppStore,
}));

// ── Mock dbService ────────────────────────────────────────────────────
vi.mock('../lib/dbService', () => ({
  getTest: vi.fn().mockResolvedValue(mockTest),
  createAttempt: vi.fn().mockResolvedValue(1),
  completeAttempt: vi.fn().mockResolvedValue(undefined),
  saveResponses: vi.fn().mockResolvedValue(undefined),
  getResponses: vi.fn().mockResolvedValue([]),
  getAttempt: vi.fn().mockResolvedValue({ id: 1, testId: 1 }),
  getAttempts: vi.fn().mockResolvedValue([]),
  getAllTests: vi.fn().mockResolvedValue([]),
  deleteTest: vi.fn().mockResolvedValue(undefined),
  getSettings: vi.fn().mockResolvedValue({ apiKey: 'sk-test', model: 'openai/gpt-4o' }),
  saveSetting: vi.fn().mockResolvedValue(undefined),
  deleteSetting: vi.fn().mockResolvedValue(undefined),
  saveResponse: vi.fn().mockResolvedValue(undefined),
  saveExplanation: vi.fn().mockResolvedValue(undefined),
  saveExplanations: vi.fn().mockResolvedValue(undefined),
  getExplanations: vi.fn().mockResolvedValue([]),
  createPartialAttempt: vi.fn().mockResolvedValue(99),
}));

// ── Mock marking module ────────────────────────────────────────────────
vi.mock('../lib/marking', () => ({
  generateMarking: vi.fn().mockImplementation(
    async (
      _test: { questions: Array<{ id?: number; type: 'mcq' | 'text' }> },
      _answers: Map<number, string>,
      _settings: unknown,
      _provider?: string,
    ) => {
      // Reproduce the real logic: MCQ → null, text without answer → false
      const result = new Map<number, boolean | null>();
      for (const q of _test.questions) {
        if (q.id == null) continue;
        if (q.type === 'mcq') {
          result.set(q.id, null);
        } else {
          const ua = _answers.get(q.id);
          result.set(q.id, !!(ua && ua.trim().length > 0));
        }
      }
      return result;
    },
  ),
}));

import TakeTest from './TakeTest.svelte';
import {
  getTest,
  createAttempt,
  completeAttempt,
  saveResponses,
  createPartialAttempt,
  getAllTests,
  getAttempts,
} from '../lib/dbService';
import { appStore } from '../lib/appStore.svelte';

describe('TakeTest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTest).mockResolvedValue(mockTest);
    vi.mocked(createAttempt).mockResolvedValue(1);
    vi.mocked(saveResponses).mockResolvedValue(undefined);
    vi.mocked(completeAttempt).mockResolvedValue(undefined);
    vi.mocked(createPartialAttempt).mockResolvedValue(99);
    // Defaults: empty test list, no attempts
    vi.mocked(getAllTests).mockResolvedValue([]);
    vi.mocked(getAttempts).mockResolvedValue([]);
    // Reset appStore mock
    mockAppStore.activeRoute = 'take';
    mockAppStore.selectedTestId = null;
    mockAppStore.selectedAttemptId = null;
    mockAppStore.navigateTo.mockReset();
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

  // ── Cancel flow ──────────────────────────────────────────────────────
  describe('Cancel flow', () => {
    // 1. Cancel button is visible in header during in-progress test
    it('Cancel button is visible in header during in-progress test', async () => {
      render(TakeTest, { testId: 1 });
      await waitFor(() => {
        expect(screen.getByText('Science Quiz')).toBeTruthy();
      });
      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      expect(cancelBtn).toBeTruthy();
    });

    // 2. Clicking Cancel opens the 3-option modal
    it('Clicking Cancel opens the 3-option modal', async () => {
      render(TakeTest, { testId: 1 });
      await waitFor(() => {
        expect(screen.getByText('Science Quiz')).toBeTruthy();
      });
      await fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      await waitFor(() => {
        expect(screen.getByText('Cancel test?')).toBeTruthy();
      });
      expect(screen.getByRole('button', { name: 'Save & exit' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Discard & exit' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Keep working' })).toBeTruthy();
    });

    // 3. Save & exit calls createPartialAttempt and onExit
    it('Save & exit calls createPartialAttempt and onExit', async () => {
      const onExit = vi.fn();
      render(TakeTest, { testId: 1, onExit });
      await waitFor(() => {
        expect(screen.getByText('Science Quiz')).toBeTruthy();
      });
      await fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      await waitFor(() => {
        expect(screen.getByText('Cancel test?')).toBeTruthy();
      });
      await fireEvent.click(screen.getByRole('button', { name: 'Save & exit' }));
      await waitFor(() => {
        expect(createPartialAttempt).toHaveBeenCalledWith(1, 0);
        expect(onExit).toHaveBeenCalledTimes(1);
      });
    });

    // 4. Discard & exit calls onExit without createPartialAttempt
    it('Discard & exit calls onExit without createPartialAttempt', async () => {
      const onExit = vi.fn();
      render(TakeTest, { testId: 1, onExit });
      await waitFor(() => {
        expect(screen.getByText('Science Quiz')).toBeTruthy();
      });
      await fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      await waitFor(() => {
        expect(screen.getByText('Cancel test?')).toBeTruthy();
      });
      await fireEvent.click(screen.getByRole('button', { name: 'Discard & exit' }));
      await waitFor(() => {
        expect(onExit).toHaveBeenCalledTimes(1);
      });
      expect(createPartialAttempt).not.toHaveBeenCalled();
    });

    // 5. Keep working closes the modal without state change
    it('Keep working closes the modal without state change', async () => {
      const onExit = vi.fn();
      render(TakeTest, { testId: 1, onExit });
      await waitFor(() => {
        expect(screen.getByText('Science Quiz')).toBeTruthy();
      });
      await fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      await waitFor(() => {
        expect(screen.getByText('Cancel test?')).toBeTruthy();
      });
      await fireEvent.click(screen.getByRole('button', { name: 'Keep working' }));
      await waitFor(() => {
        expect(screen.queryByText('Cancel test?')).toBeNull();
      });
      expect(createPartialAttempt).not.toHaveBeenCalled();
      expect(onExit).not.toHaveBeenCalled();
    });

    // 6. Cancel button is disabled when submitting === true
    it('Cancel button is disabled when submitting is true', async () => {
      const onExit = vi.fn();
      render(TakeTest, { testId: 1, onExit });
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
      fireEvent.click(screen.getByRole('button', { name: /submit test/i }));
      const cancelBtn = screen.getByRole('button', { name: /cancel/i }) as HTMLButtonElement;
      expect(cancelBtn.disabled).toBe(true);
    });
  });

  // ── Landing (Bug 4) ─────────────────────────────────────────────────
  describe('Landing', () => {
    it('Landing renders when testId is null', async () => {
      vi.mocked(getAllTests).mockResolvedValue([mockTest, mockTest2]);
      render(TakeTest, { testId: null });
      await waitFor(() => {
        expect(screen.getByText('Choose a test')).toBeTruthy();
      });
    });

    it('Landing fetches and displays all non-zero-question tests', async () => {
      vi.mocked(getAllTests).mockResolvedValue([mockTest, mockTest2]);
      render(TakeTest, { testId: null });
      await waitFor(() => {
        expect(screen.getByText('Science Quiz')).toBeTruthy();
        expect(screen.getByText('History Quiz')).toBeTruthy();
      });
    });

    it('Landing filters out 0-question tests', async () => {
      vi.mocked(getAllTests).mockResolvedValue([mockTest, mockTest2, mockEmptyTest]);
      render(TakeTest, { testId: null });
      await waitFor(() => {
        expect(screen.getByText('Science Quiz')).toBeTruthy();
        expect(screen.getByText('History Quiz')).toBeTruthy();
      });
      expect(screen.queryByText('Empty Quiz')).toBeNull();
    });

    it("Landing shows 'No tests yet' empty state when 0 tests", async () => {
      vi.mocked(getAllTests).mockResolvedValue([]);
      render(TakeTest, { testId: null });
      await waitFor(() => {
        expect(screen.getByText('No tests yet')).toBeTruthy();
      });
      expect(screen.getByText('Generate a test to get started.')).toBeTruthy();
    });

    it("Status badge is 'new' for tests with 0 attempts", async () => {
      vi.mocked(getAllTests).mockResolvedValue([mockTest]);
      vi.mocked(getAttempts).mockResolvedValue([]);
      render(TakeTest, { testId: null });
      await waitFor(() => {
        expect(screen.getByText('Science Quiz')).toBeTruthy();
      });
      const card = screen.getByTestId('landing-card');
      expect(card.getAttribute('data-testid-status')).toBe('new');
      expect(screen.getByText('Not started')).toBeTruthy();
    });

    it("Status badge is 'in-progress' for tests with partial attempts", async () => {
      vi.mocked(getAllTests).mockResolvedValue([mockTest]);
      vi.mocked(getAttempts).mockResolvedValue([
        { id: 10, testId: 1 /* completedAt undefined → in-progress */ },
      ]);
      render(TakeTest, { testId: null });
      await waitFor(() => {
        expect(screen.getByText('Science Quiz')).toBeTruthy();
      });
      const card = screen.getByTestId('landing-card');
      expect(card.getAttribute('data-testid-status')).toBe('in-progress');
      expect(screen.getByText('In progress')).toBeTruthy();
    });

    it("Status badge is 'completed' for tests with completed attempts (no in-progress)", async () => {
      vi.mocked(getAllTests).mockResolvedValue([mockTest]);
      vi.mocked(getAttempts).mockResolvedValue([
        { id: 10, testId: 1, completedAt: '2025-01-01T00:00:00Z' },
      ]);
      render(TakeTest, { testId: null });
      await waitFor(() => {
        expect(screen.getByText('Science Quiz')).toBeTruthy();
      });
      const card = screen.getByTestId('landing-card');
      expect(card.getAttribute('data-testid-status')).toBe('completed');
      expect(screen.getByText('Completed')).toBeTruthy();
    });

    it("Clicking 'Start Test' navigates to 'take' with selectedTestId", async () => {
      vi.mocked(getAllTests).mockResolvedValue([mockTest]);
      vi.mocked(getAttempts).mockResolvedValue([]);
      render(TakeTest, { testId: null });
      await waitFor(() => {
        expect(screen.getByText('Science Quiz')).toBeTruthy();
      });
      await fireEvent.click(screen.getByTestId('start-test'));
      expect(appStore.navigateTo).toHaveBeenCalledWith('take', { selectedTestId: 1 });
    });

    it("Clicking 'View all history' link navigates to 'history' route", async () => {
      vi.mocked(getAllTests).mockResolvedValue([mockTest]);
      render(TakeTest, { testId: null });
      await waitFor(() => {
        expect(screen.getByText('Choose a test')).toBeTruthy();
      });
      await fireEvent.click(screen.getByRole('button', { name: /view all history/i }));
      expect(appStore.navigateTo).toHaveBeenCalledWith('history');
    });
  });

  // ── Completed test re-entry (Bug 2) ─────────────────────────────────
  describe('Completed test re-entry', () => {
    it("Re-entering TakeTest for a completed test shows the 'Test already completed' panel, NOT the in-progress UI", async () => {
      vi.mocked(getTest).mockResolvedValue(mockTest);
      vi.mocked(getAttempts).mockResolvedValue([
        { id: 42, testId: 1, completedAt: '2025-01-01T00:00:00Z' },
      ]);
      render(TakeTest, { testId: 1 });
      await waitFor(() => {
        expect(screen.getByText("You've already completed this test.")).toBeTruthy();
      });
      // The in-progress UI should NOT render
      expect(screen.queryByText('Question 1 of 3')).toBeNull();
      // The completed panel should render
      expect(screen.getByText('Already completed')).toBeTruthy();
    });

    it("Clicking 'View Results' from the completed panel navigates to 'review' with selectedAttemptId", async () => {
      vi.mocked(getTest).mockResolvedValue(mockTest);
      vi.mocked(getAttempts).mockResolvedValue([
        { id: 42, testId: 1, completedAt: '2025-01-01T00:00:00Z' },
      ]);
      render(TakeTest, { testId: 1 });
      await waitFor(() => {
        expect(screen.getByText("You've already completed this test.")).toBeTruthy();
      });
      // The completed panel renders a "View Results →" button.
      // Use role+name (button is matched by visible text only; the leading test title is in a <p>).
      const viewResultsBtn = screen.getAllByRole('button', { name: /view results/i })
        .find((b) => b.textContent?.includes('→'));
      expect(viewResultsBtn).toBeTruthy();
      await fireEvent.click(viewResultsBtn!);
      expect(appStore.navigateTo).toHaveBeenCalledWith('review', {
        selectedTestId: 1,
        selectedAttemptId: 42,
      });
    });
  });
});
