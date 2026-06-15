import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';

// ── Fixtures (hoisted) ────────────────────────────────────────────────
const mockTests = vi.hoisted(() => [
  {
    id: 1, title: 'Science Quiz', topic: 'Biology', difficulty: 'Medium',
    questionCount: 10, mcqPercentage: 70, questions: [],
    createdAt: '2025-06-10 10:00:00', updatedAt: '2025-06-10 10:00:00',
  },
  {
    id: 2, title: 'Math Exam', topic: 'Algebra', difficulty: 'Hard',
    questionCount: 20, mcqPercentage: 50, questions: [],
    createdAt: '2025-06-09 09:00:00', updatedAt: '2025-06-09 09:00:00',
  },
  {
    id: 3, title: 'History Review', topic: undefined, difficulty: 'Easy',
    questionCount: 5, mcqPercentage: 100, questions: [],
    createdAt: '2025-06-08 08:00:00', updatedAt: '2025-06-08 08:00:00',
  },
]);

// ── Mock dbService ────────────────────────────────────────────────────
vi.mock('../lib/dbService', () => ({
  getAllTests: vi.fn().mockResolvedValue(mockTests),
  deleteTest: vi.fn().mockResolvedValue(undefined),
  getAttempts: vi.fn().mockResolvedValue([{ id: 1, testId: 1 }]),
  getTest: vi.fn().mockResolvedValue(null),
  createAttempt: vi.fn().mockResolvedValue(1),
  completeAttempt: vi.fn().mockResolvedValue(undefined),
  saveResponses: vi.fn().mockResolvedValue(undefined),
  getResponses: vi.fn().mockResolvedValue([]),
  getAttempt: vi.fn().mockResolvedValue(null),
  getSettings: vi.fn().mockResolvedValue({ apiKey: '', model: 'openai/gpt-4o' }),
  saveSetting: vi.fn().mockResolvedValue(undefined),
  deleteSetting: vi.fn().mockResolvedValue(undefined),
  saveResponse: vi.fn().mockResolvedValue(undefined),
  saveExplanation: vi.fn().mockResolvedValue(undefined),
  saveExplanations: vi.fn().mockResolvedValue(undefined),
  getExplanations: vi.fn().mockResolvedValue([]),
}));

import TestHistory from './TestHistory.svelte';
import { getAllTests, deleteTest, getAttempts } from '../lib/dbService';

describe('TestHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAllTests).mockResolvedValue(mockTests);
    vi.mocked(deleteTest).mockResolvedValue(undefined);
    vi.mocked(getAttempts).mockResolvedValue([{ id: 1, testId: 1 }]);
  });

  // ── 1. Renders the page header ─────────────────────────────────────
  it('renders the page header', async () => {
    render(TestHistory);
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Test History' })).toBeTruthy();
    });
  });

  // ── 2. Renders test cards after loading ────────────────────────────
  it('renders test cards after loading', async () => {
    render(TestHistory);
    await waitFor(() => {
      expect(screen.getByText('Science Quiz')).toBeTruthy();
      expect(screen.getByText('Math Exam')).toBeTruthy();
      expect(screen.getByText('History Review')).toBeTruthy();
    });
  });

  // ── 3. Displays difficulty on cards ────────────────────────────────
  it('displays difficulty on test cards', async () => {
    render(TestHistory);
    await waitFor(() => {
      expect(screen.getByText('Medium')).toBeTruthy();
      expect(screen.getByText('Hard')).toBeTruthy();
      expect(screen.getByText('Easy')).toBeTruthy();
    });
  });

  // ── 4. Shows question counts ───────────────────────────────────────
  it('displays question counts', async () => {
    render(TestHistory);
    await waitFor(() => {
      expect(screen.getByText('10 questions')).toBeTruthy();
      expect(screen.getByText('20 questions')).toBeTruthy();
      expect(screen.getByText('5 questions')).toBeTruthy();
    });
  });

  // ── 5. Search filters by title ─────────────────────────────────────
  it('filters tests by search query', async () => {
    render(TestHistory);
    await waitFor(() => {
      expect(screen.getByText('Science Quiz')).toBeTruthy();
    });
    const searchInput = screen.getByPlaceholderText('Search by title or topic…');
    await fireEvent.input(searchInput, { target: { value: 'math' } });
    await waitFor(() => {
      expect(screen.getByText('Math Exam')).toBeTruthy();
      expect(screen.queryByText('Science Quiz')).toBeNull();
    });
  });

  // ── 6. Shows "no matches" for empty search ─────────────────────────
  it('shows no matches message for empty search', async () => {
    render(TestHistory);
    await waitFor(() => {
      expect(screen.getByText('Science Quiz')).toBeTruthy();
    });
    const searchInput = screen.getByPlaceholderText('Search by title or topic…');
    await fireEvent.input(searchInput, { target: { value: 'zzzznonexistent' } });
    await waitFor(() => {
      expect(screen.getByText('No matches')).toBeTruthy();
    });
  });

  // ── 7. Sort dropdown is present ────────────────────────────────────
  it('renders sort dropdown', async () => {
    render(TestHistory);
    await waitFor(() => {
      expect(screen.getByLabelText('Sort tests')).toBeTruthy();
    });
  });

  // ── 8. Delete button opens confirmation modal ──────────────────────
  it('opens delete confirmation modal', async () => {
    render(TestHistory);
    await waitFor(() => {
      expect(screen.getByText('Science Quiz')).toBeTruthy();
    });
    const deleteButtons = screen.getAllByRole('button', { name: /Delete/ });
    await fireEvent.click(deleteButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('Delete this test?')).toBeTruthy();
    });
  });

  // ── 9. Confirm delete removes the test ─────────────────────────────
  it('confirm delete removes test from list', async () => {
    render(TestHistory);
    await waitFor(() => {
      expect(screen.getByText('Science Quiz')).toBeTruthy();
    });
    const deleteButtons = screen.getAllByRole('button', { name: /Delete/ });
    await fireEvent.click(deleteButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('Delete this test?')).toBeTruthy();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(screen.queryByText('Science Quiz')).toBeNull();
      expect(deleteTest).toHaveBeenCalledWith(1);
    });
  });

  // ── 10. Cancel delete keeps the test ───────────────────────────────
  it('cancel delete keeps the test', async () => {
    render(TestHistory);
    await waitFor(() => {
      expect(screen.getByText('Science Quiz')).toBeTruthy();
    });
    const deleteButtons = screen.getAllByRole('button', { name: /Delete/ });
    await fireEvent.click(deleteButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('Delete this test?')).toBeTruthy();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.getByText('Science Quiz')).toBeTruthy();
      expect(deleteTest).not.toHaveBeenCalled();
    });
  });

  // ── 11. Shows empty state when no tests ────────────────────────────
  it('shows empty state when no tests exist', async () => {
    vi.mocked(getAllTests).mockResolvedValue([]);
    render(TestHistory);
    await waitFor(() => {
      expect(screen.getByText('No tests yet')).toBeTruthy();
    });
  });

  // ── 12. Shows error state when loading fails ───────────────────────
  it('shows error state on load failure', async () => {
    vi.mocked(getAllTests).mockRejectedValueOnce(new Error('DB error'));
    render(TestHistory);
    await waitFor(() => {
      expect(screen.getByText('DB error')).toBeTruthy();
    });
  });

  // ── 13. Calls onNavigate for Take Test ─────────────────────────────
  it('calls onNavigate when Take Test clicked', async () => {
    const onNavigate = vi.fn();
    render(TestHistory, { onNavigate });
    await waitFor(() => {
      expect(screen.getByText('Science Quiz')).toBeTruthy();
    });
    const takeButtons = screen.getAllByRole('button', { name: /Take Test/ });
    await fireEvent.click(takeButtons[0]);
    expect(onNavigate).toHaveBeenCalledWith('take', expect.objectContaining({ selectedTestId: 1 }));
  });
});
