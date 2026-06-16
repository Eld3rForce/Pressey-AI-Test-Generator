import type { Test, TestConfig, Settings, ProviderType } from './types';
import { generateWithProvider } from './providers/client';

// ============================================================
// Constants
// ============================================================

const DEFAULT_MODEL = 'openai/gpt-4o';

// ============================================================
// Core API function
// ============================================================

/**
 * Generate a test using the configured provider.
 *
 * Delegates to {@link generateWithProvider} with a minimal Settings object
 * built from the provided parameters. Accepts an optional `provider` parameter
 * that defaults to `'openrouter'` for backward compatibility.
 *
 * @param prompt       User prompt / instructions for the test.
 * @param config       Test configuration (question count, difficulty, etc.).
 * @param apiKey       API key (used as `openrouterKey` when provider is 'openrouter').
 * @param model        Model name (defaults to 'openai/gpt-4o').
 * @param systemPrefix Optional prefix prepended to the system message.
 * @param provider     Provider identifier (default: 'openrouter').
 */
export async function generateTest(
  prompt: string,
  config: TestConfig,
  apiKey: string,
  model: string = DEFAULT_MODEL,
  systemPrefix?: string,
  provider: ProviderType = 'openrouter'
): Promise<Test> {
  // Build a minimal Settings object from the parameters.
  // The single `apiKey` argument is the credential for the active provider;
  // route it to the per-provider key field that `buildHeaders` reads via
  // `getProviderKey()` (see src/lib/providers/registry.ts).
  // - ollama: `apiKey` is actually the server URL (no Authorization header)
  // - anthropic: routes through OpenRouter, so uses openrouterKey (not anthropicKey)
  const settings: Settings = {
    apiKey,
    model,
    defaultQuestionCount: config.questionCount,
    defaultMcqPercentage: config.mcqPercentage,
    defaultDifficulty: config.difficulty,
    provider,
    ...(provider === 'openai' ? { openaiKey: apiKey } : {}),
    ...(provider === 'anthropic' ? { openrouterKey: apiKey } : {}),
    ...(provider === 'gemini' ? { geminiKey: apiKey } : {}),
    ...(provider === 'ollama' ? { ollamaUrl: apiKey } : {}),
    ...(provider === 'openrouter' ? { openrouterKey: apiKey } : {}),
  };

  return generateWithProvider(provider, prompt, config, settings, systemPrefix);
}

// Re-export key utilities for consumers
export { isApiError, shouldRetry, ErrorCodes } from './errorUtils';
