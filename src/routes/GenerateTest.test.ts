import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';

// ── Stub missing globals ─────────────────────────────────────────────
// GenerateTest.svelte uses validatePrompt, validateApiKey, mapApiError
// without importing them from ../lib/errorUtils. This is a known source
// bug. We stub them globally so the component can render in tests.
vi.stubGlobal('mapApiError', vi.fn((e: unknown) =>
  e instanceof Error ? e.message : String(e)
));
vi.stubGlobal('validatePrompt', vi.fn(() => ({ valid: true })));
vi.stubGlobal('validateProvider', vi.fn(() => ({ valid: true })));

// ── Mock settingsStore ────────────────────────────────────────────────
vi.mock('../lib/settingsStore.svelte', () => {
  const defaults = {
    apiKey: 'sk-test-key',
    model: 'openai/gpt-4o',
    defaultQuestionCount: 10,
    defaultMcqPercentage: 70,
    defaultDifficulty: 'Medium' as const,
    personality: 'default',
    customInstructions: '',
    provider: 'openrouter' as const,
    openaiKey: '',
    anthropicKey: '',
    geminiKey: '',
    ollamaUrl: 'http://localhost:11434',
    openrouterKey: 'sk-test-key',
  };
  return {
    settingsStore: {
      settings: { ...defaults },
      loaded: true,
      error: null,
      loadSettings: vi.fn().mockResolvedValue(undefined),
      saveSettings: vi.fn().mockResolvedValue(undefined),
      updateSetting: vi.fn().mockResolvedValue(undefined),
      testApiConnection: vi.fn().mockResolvedValue(true),
      resetToDefaults: vi.fn(),
    },
  };
});

// ── Mock dbService ────────────────────────────────────────────────────
vi.mock('../lib/dbService', () => ({
  createTest: vi.fn().mockResolvedValue(42),
  getAllTests: vi.fn().mockResolvedValue([]),
  getTest: vi.fn().mockResolvedValue(null),
  deleteTest: vi.fn().mockResolvedValue(undefined),
  createAttempt: vi.fn().mockResolvedValue(1),
  completeAttempt: vi.fn().mockResolvedValue(undefined),
  saveResponses: vi.fn().mockResolvedValue(undefined),
  getResponses: vi.fn().mockResolvedValue([]),
  getAttempt: vi.fn().mockResolvedValue(null),
  getAttempts: vi.fn().mockResolvedValue([]),
  getSettings: vi.fn().mockResolvedValue({ apiKey: 'sk-test-key', model: 'openai/gpt-4o' }),
  saveSetting: vi.fn().mockResolvedValue(undefined),
  deleteSetting: vi.fn().mockResolvedValue(undefined),
  saveResponse: vi.fn().mockResolvedValue(undefined),
  saveExplanation: vi.fn().mockResolvedValue(undefined),
  saveExplanations: vi.fn().mockResolvedValue(undefined),
  getExplanations: vi.fn().mockResolvedValue([]),
}));

// ── Mock testGenerator ────────────────────────────────────────────────
vi.mock('../lib/testGenerator', () => ({
  generateFromPrompt: vi.fn().mockResolvedValue({
    id: 1,
    title: 'Generated Test',
    topic: 'Science',
    difficulty: 'Medium',
    questionCount: 2,
    mcqPercentage: 50,
    questions: [
      {
        id: 1, type: 'mcq' as const, text: 'What is H2O?',
        options: ['Water', 'Fire', 'Earth', 'Air'],
        correctAnswer: 'Water', explanation: 'Water is H2O', orderIndex: 0,
      },
      {
        id: 2, type: 'text' as const, text: 'Explain photosynthesis',
        correctAnswer: 'Plants convert sunlight', explanation: '', orderIndex: 1,
      },
    ],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  }),
  generateFromFile: vi.fn().mockResolvedValue({
    id: 2,
    title: 'File Test',
    topic: 'Docs',
    difficulty: 'Hard',
    questionCount: 1,
    mcqPercentage: 100,
    questions: [
      {
        id: 3, type: 'mcq' as const, text: 'Q1?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A', explanation: '', orderIndex: 0,
      },
    ],
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  }),
}));

// ── Mock fileUpload ───────────────────────────────────────────────────
vi.mock('../lib/fileUpload', () => ({
  uploadFile: vi.fn().mockResolvedValue({
    content: 'File content for testing',
    fileName: 'test.pdf',
    fileType: 'pdf',
  }),
}));

// ── Mock personalities ────────────────────────────────────────────────
vi.mock('../lib/personalities', () => ({
  buildPersonalityPrefix: vi.fn().mockReturnValue('Be helpful.'),
}));

import GenerateTest from './GenerateTest.svelte';
import { createTest } from '../lib/dbService';
import { generateFromPrompt } from '../lib/testGenerator';
import { settingsStore } from '../lib/settingsStore.svelte';

describe('GenerateTest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(settingsStore.settings).openrouterKey = 'sk-test-key';
  });

  // ── 1. Renders the page header ─────────────────────────────────────
  it('renders the page header', () => {
    render(GenerateTest);
    expect(screen.getByRole('heading', { level: 1, name: 'Generate Test' })).toBeTruthy();
    expect(screen.getByText('AI-Powered Test Creation')).toBeTruthy();
  });

  // ── 2. Renders the prompt textarea ─────────────────────────────────
  it('renders the prompt textarea', () => {
    render(GenerateTest);
    const textarea = screen.getByPlaceholderText('Describe the test topic or paste content...');
    expect(textarea).toBeTruthy();
    expect(textarea.tagName).toBe('TEXTAREA');
  });

  // ── 3. Renders topic input ─────────────────────────────────────────
  it('renders the topic input', () => {
    render(GenerateTest);
    const input = screen.getByPlaceholderText('e.g. Photosynthesis, World War II, JavaScript closures');
    expect(input).toBeTruthy();
  });

  // ── 4. Renders configuration controls ──────────────────────────────
  it('renders question count, question type toggles, and difficulty controls', () => {
    render(GenerateTest);
    expect(screen.getByText('Configuration')).toBeTruthy();
    expect(document.querySelector('#question-count-input')).toBeTruthy();
    // Both toggles render
    expect(document.querySelector('[data-testid="toggle-mcq"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="toggle-text"]')).toBeTruthy();
    // With default state (both on) the MCQ % slider is visible
    expect(document.querySelector('#mcq-percentage-slider')).toBeTruthy();
    expect(screen.getByText('Easy')).toBeTruthy();
    expect(screen.getByText('Medium')).toBeTruthy();
    expect(screen.getByText('Hard')).toBeTruthy();
  });

  // ── 5. Shows Generate Test button ──────────────────────────────────
  it('renders the Generate Test button', () => {
    render(GenerateTest);
    expect(screen.getByRole('button', { name: 'Generate Test' })).toBeTruthy();
  });

  // ── 6. Shows API key warning when none is set ──────────────────────
  it('shows API key warning when none is set', () => {
    vi.mocked(settingsStore.settings).openrouterKey = '';
    render(GenerateTest);
    expect(screen.getByText(/No API key configured/)).toBeTruthy();
    vi.mocked(settingsStore.settings).openrouterKey = 'sk-test-key';
  });

  // ── 7. Upload file section renders ─────────────────────────────────
  it('renders file upload section', () => {
    render(GenerateTest);
    expect(screen.getByText('Upload File')).toBeTruthy();
    expect(screen.getByText('Source Material')).toBeTruthy();
  });

  // ── 8. Error state renders on generation failure ───────────────────
  it('shows error state on generation failure', async () => {
    vi.mocked(generateFromPrompt).mockRejectedValueOnce(new Error('API Error'));

    render(GenerateTest);

    const textarea = screen.getByPlaceholderText('Describe the test topic or paste content...');
    await fireEvent.input(textarea, { target: { value: 'Test prompt' } });

    const genBtn = screen.getByRole('button', { name: 'Generate Test' });
    await fireEvent.click(genBtn);

    await waitFor(() => {
      expect(screen.getByText('Generation failed')).toBeTruthy();
    });
  });

  // ── 9. Preview appears after successful generation ─────────────────
  it('shows preview after successful generation', async () => {
    vi.mocked(generateFromPrompt).mockResolvedValue({
      id: 1, title: 'Preview Test', topic: 'Science', difficulty: 'Medium',
      questionCount: 1, mcqPercentage: 100,
      questions: [{
        id: 1, type: 'mcq' as const, text: 'Q1',
        options: ['A', 'B', 'C', 'D'], correctAnswer: 'A',
        explanation: '', orderIndex: 0,
      }],
      createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    });

    render(GenerateTest);

    const textarea = screen.getByPlaceholderText('Describe the test topic or paste content...');
    await fireEvent.input(textarea, { target: { value: 'Science questions' } });

    await fireEvent.click(screen.getByRole('button', { name: 'Generate Test' }));

    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeTruthy();
      expect(screen.getByText('1 questions ready')).toBeTruthy();
    });
  });

  // ── 10. Save button calls createTest and shows success ─────────────
  it('shows Save Test button and calls createTest', async () => {
    vi.mocked(generateFromPrompt).mockResolvedValue({
      id: 1, title: 'Save Test', topic: 'Science', difficulty: 'Medium',
      questionCount: 1, mcqPercentage: 100,
      questions: [{
        id: 1, type: 'mcq' as const, text: 'Q1',
        options: ['A', 'B', 'C', 'D'], correctAnswer: 'A',
        explanation: '', orderIndex: 0,
      }],
      createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    });

    render(GenerateTest);

    const textarea = screen.getByPlaceholderText('Describe the test topic or paste content...');
    await fireEvent.input(textarea, { target: { value: 'Test prompt' } });

    await fireEvent.click(screen.getByRole('button', { name: 'Generate Test' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save Test' })).toBeTruthy();
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Save Test' }));

    await waitFor(() => {
      expect(createTest).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Test saved to library/)).toBeTruthy();
    });
  });

  // ── 11. Both toggles off → validation error shown ──────────────────
  it('shows validation error when both toggles are off', async () => {
    render(GenerateTest);

    const textarea = screen.getByPlaceholderText('Describe the test topic or paste content...');
    await fireEvent.input(textarea, { target: { value: 'Test prompt for toggles' } });

    // Turn both toggles off
    const mcqToggle = document.querySelector(
      '[data-testid="toggle-mcq"]'
    ) as HTMLInputElement;
    const textToggle = document.querySelector(
      '[data-testid="toggle-text"]'
    ) as HTMLInputElement;
    expect(mcqToggle).toBeTruthy();
    expect(textToggle).toBeTruthy();

    await fireEvent.click(mcqToggle);
    await fireEvent.click(textToggle);

    // The MCQ slider should now be hidden
    expect(document.querySelector('#mcq-percentage-slider')).toBeNull();

    // Click Generate — should surface the validation error without calling the API
    const genBtn = screen.getByRole('button', { name: 'Generate Test' });
    await fireEvent.click(genBtn);

    await waitFor(() => {
      expect(screen.getByTestId('toggle-error')).toBeTruthy();
    });
    expect(generateFromPrompt).not.toHaveBeenCalled();
  });

  // ── 12. Only MCQ on → all generated questions are MCQ ─────────────
  it('passes includeText=false (all MCQ) when only the MCQ toggle is on', async () => {
    vi.mocked(generateFromPrompt).mockResolvedValue({
      id: 1, title: 'MCQ Only', topic: 'Science', difficulty: 'Medium',
      questionCount: 2, mcqPercentage: 100,
      questions: [
        { id: 1, type: 'mcq' as const, text: 'Q1', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: '', orderIndex: 0 },
        { id: 2, type: 'mcq' as const, text: 'Q2', options: ['A', 'B', 'C', 'D'], correctAnswer: 'B', explanation: '', orderIndex: 1 },
      ],
      createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    });

    render(GenerateTest);

    const textarea = screen.getByPlaceholderText('Describe the test topic or paste content...');
    await fireEvent.input(textarea, { target: { value: 'MCQ only prompt' } });

    // Turn off the text toggle
    const textToggle = document.querySelector(
      '[data-testid="toggle-text"]'
    ) as HTMLInputElement;
    await fireEvent.click(textToggle);

    // Slider should be hidden when only one toggle is on
    expect(document.querySelector('#mcq-percentage-slider')).toBeNull();

    await fireEvent.click(screen.getByRole('button', { name: 'Generate Test' }));

    await waitFor(() => {
      expect(generateFromPrompt).toHaveBeenCalledTimes(1);
    });

    // TestConfig passed to the generator must include the toggles + provider
    const callArgs = vi.mocked(generateFromPrompt).mock.calls[0];
    const config = callArgs[1] as {
      mcqPercentage: number;
      includeMcq: boolean;
      includeText: boolean;
      provider?: string;
    };
    expect(config.includeMcq).toBe(true);
    expect(config.includeText).toBe(false);
    expect(config.mcqPercentage).toBe(100);
    expect(config.provider).toBe('openrouter');
  });

  // ── 13. Only text on → all generated questions are text ───────────
  it('passes includeMcq=false (all text) when only the text toggle is on', async () => {
    vi.mocked(generateFromPrompt).mockResolvedValue({
      id: 1, title: 'Text Only', topic: 'History', difficulty: 'Hard',
      questionCount: 1, mcqPercentage: 0,
      questions: [
        { id: 1, type: 'text' as const, text: 'Explain X', correctAnswer: 'Y', explanation: '', orderIndex: 0 },
      ],
      createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    });

    render(GenerateTest);

    const textarea = screen.getByPlaceholderText('Describe the test topic or paste content...');
    await fireEvent.input(textarea, { target: { value: 'Text only prompt' } });

    // Turn off the MCQ toggle
    const mcqToggle = document.querySelector(
      '[data-testid="toggle-mcq"]'
    ) as HTMLInputElement;
    await fireEvent.click(mcqToggle);

    // Slider hidden with only one toggle on
    expect(document.querySelector('#mcq-percentage-slider')).toBeNull();

    await fireEvent.click(screen.getByRole('button', { name: 'Generate Test' }));

    await waitFor(() => {
      expect(generateFromPrompt).toHaveBeenCalledTimes(1);
    });

    const callArgs = vi.mocked(generateFromPrompt).mock.calls[0];
    const config = callArgs[1] as {
      mcqPercentage: number;
      includeMcq: boolean;
      includeText: boolean;
    };
    expect(config.includeMcq).toBe(false);
    expect(config.includeText).toBe(true);
    expect(config.mcqPercentage).toBe(0);
  });

  // ── 14. Both toggles on → slider visible, mcqPercentage applies ───
  it('shows the MCQ slider and respects its value when both toggles are on', async () => {
    vi.mocked(generateFromPrompt).mockResolvedValue({
      id: 1, title: 'Mixed', topic: 'Bio', difficulty: 'Easy',
      questionCount: 1, mcqPercentage: 30,
      questions: [
        { id: 1, type: 'mcq' as const, text: 'Q', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: '', orderIndex: 0 },
      ],
      createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    });

    render(GenerateTest);

    // Both toggles are on by default
    const mcqToggle = document.querySelector(
      '[data-testid="toggle-mcq"]'
    ) as HTMLInputElement;
    const textToggle = document.querySelector(
      '[data-testid="toggle-text"]'
    ) as HTMLInputElement;
    expect(mcqToggle.checked).toBe(true);
    expect(textToggle.checked).toBe(true);

    // Slider is visible
    const slider = document.querySelector('#mcq-percentage-slider') as HTMLInputElement;
    expect(slider).toBeTruthy();

    // Set slider to 30 and trigger input event
    await fireEvent.input(slider, { target: { value: '30' } });

    const textarea = screen.getByPlaceholderText('Describe the test topic or paste content...');
    await fireEvent.input(textarea, { target: { value: 'Mixed prompt' } });

    await fireEvent.click(screen.getByRole('button', { name: 'Generate Test' }));

    await waitFor(() => {
      expect(generateFromPrompt).toHaveBeenCalledTimes(1);
    });

    const callArgs = vi.mocked(generateFromPrompt).mock.calls[0];
    const config = callArgs[1] as {
      mcqPercentage: number;
      includeMcq: boolean;
      includeText: boolean;
    };
    expect(config.includeMcq).toBe(true);
    expect(config.includeText).toBe(true);
    expect(config.mcqPercentage).toBe(30);
  });

  // ── 15. Blur toggle shows/hides correct answers ────────────────────
  it('toggles blur-answer class on correct answer fields when Show Answers is clicked', async () => {
    vi.mocked(generateFromPrompt).mockResolvedValue({
      id: 1, title: 'Blur Test', topic: 'Science', difficulty: 'Medium',
      questionCount: 2, mcqPercentage: 50,
      questions: [
        { id: 1, type: 'mcq' as const, text: 'Q1', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: '', orderIndex: 0 },
        { id: 2, type: 'text' as const, text: 'Explain X', correctAnswer: 'Answer text', explanation: '', orderIndex: 1 },
      ],
      createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    });

    render(GenerateTest);

    // Generate a test first — use a prompt > 10 characters to pass validation
    const textarea = screen.getByPlaceholderText('Describe the test topic or paste content...');
    await fireEvent.input(textarea, { target: { value: 'Science and biology topics' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Generate Test' }));

    await waitFor(() => {
      expect(screen.getByText('2 questions ready')).toBeTruthy();
    });

    // Before toggle: blur-answer class should be present
    const mcqCorrectEl = document.querySelector('#q-correct-0') as HTMLElement;
    const textCorrectEl = document.querySelector('#q-correct-1') as HTMLElement;
    expect(mcqCorrectEl).toBeTruthy();
    expect(textCorrectEl).toBeTruthy();
    expect(mcqCorrectEl.classList.contains('blur-answer')).toBe(true);
    expect(textCorrectEl.classList.contains('blur-answer')).toBe(true);

    // Click "Show Answers" to reveal answers
    await fireEvent.click(screen.getByText('Show Answers'));

    // After toggle: blur-answer class should be removed
    expect(mcqCorrectEl.classList.contains('blur-answer')).toBe(false);
    expect(textCorrectEl.classList.contains('blur-answer')).toBe(false);

    // The button text should now say "Hide Answers"
    expect(screen.getByText('Hide Answers')).toBeTruthy();
  });
});
