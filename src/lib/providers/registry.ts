import type { ProviderType, ProviderConfig, Settings } from '../types';

const providerConfigs: Record<ProviderType, ProviderConfig> = {
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    keyField: 'openaiKey',
    defaultModel: 'gpt-4o',
    headers: {},
  },
  anthropic: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    keyField: 'openrouterKey',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    headers: {
      'HTTP-Referer': 'https://pressey.app',
      'X-Title': 'Pressey AI Test Generator',
    },
  },
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    keyField: 'geminiKey',
    defaultModel: 'gemini-1.5-pro',
    headers: {},
  },
  ollama: {
    url: 'http://localhost:11434/v1/chat/completions',
    keyField: 'ollamaUrl',
    defaultModel: 'llama3.2',
    headers: {},
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    keyField: 'openrouterKey',
    defaultModel: 'openai/gpt-4o',
    headers: {
      'HTTP-Referer': 'https://pressey.app',
      'X-Title': 'Pressey AI Test Generator',
    },
  },
};

export function getProviderConfig(provider: ProviderType): ProviderConfig {
  return providerConfigs[provider];
}

export function getProviderKey(
  settings: Settings,
  provider: ProviderType,
): string | undefined {
  const config = getProviderConfig(provider);

  if (provider === 'ollama') {
    return settings.ollamaUrl;
  }

  const value = settings[config.keyField];
  return typeof value === 'string' ? value : undefined;
}
