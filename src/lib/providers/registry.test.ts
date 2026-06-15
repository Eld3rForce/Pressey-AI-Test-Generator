import { describe, it, expect } from 'vitest';
import { getProviderConfig, getProviderKey } from './registry';
import type { Settings } from '../types';

const mockSettings: Settings = {
  apiKey: 'sk-legacy',
  model: 'gpt-4o',
  defaultQuestionCount: 5,
  defaultMcqPercentage: 60,
  defaultDifficulty: 'Medium',
  openaiKey: 'sk-openai-123',
  openrouterKey: 'sk-or-456',
  geminiKey: 'sk-gemini-789',
  ollamaUrl: 'http://localhost:11434',
};

describe('getProviderConfig', () => {
  it('should return OpenAI config', () => {
    const config = getProviderConfig('openai');
    expect(config.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(config.keyField).toBe('openaiKey');
    expect(config.defaultModel).toBe('gpt-4o');
  });

  it('should return Anthropic config (via OpenRouter)', () => {
    const config = getProviderConfig('anthropic');
    expect(config.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(config.keyField).toBe('openrouterKey');
    expect(config.defaultModel).toBe('anthropic/claude-3.5-sonnet');
    expect(config.headers).toEqual({
      'HTTP-Referer': 'https://pressey.app',
      'X-Title': 'Pressey AI Test Generator',
    });
  });

  it('should return Gemini config', () => {
    const config = getProviderConfig('gemini');
    expect(config.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    );
    expect(config.keyField).toBe('geminiKey');
    expect(config.defaultModel).toBe('gemini-1.5-pro');
  });

  it('should return Ollama config', () => {
    const config = getProviderConfig('ollama');
    expect(config.url).toBe('http://localhost:11434/v1/chat/completions');
    expect(config.keyField).toBe('ollamaUrl');
    expect(config.defaultModel).toBe('llama3.2');
  });

  it('should return OpenRouter config (default)', () => {
    const config = getProviderConfig('openrouter');
    expect(config.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(config.keyField).toBe('openrouterKey');
    expect(config.defaultModel).toBe('openai/gpt-4o');
    expect(config.headers).toEqual({
      'HTTP-Referer': 'https://pressey.app',
      'X-Title': 'Pressey AI Test Generator',
    });
  });
});

describe('getProviderKey', () => {
  it('should return openaiKey for OpenAI', () => {
    expect(getProviderKey(mockSettings, 'openai')).toBe('sk-openai-123');
  });

  it('should return openrouterKey for Anthropic', () => {
    expect(getProviderKey(mockSettings, 'anthropic')).toBe('sk-or-456');
  });

  it('should return geminiKey for Gemini', () => {
    expect(getProviderKey(mockSettings, 'gemini')).toBe('sk-gemini-789');
  });

  it('should return ollamaUrl for Ollama', () => {
    expect(getProviderKey(mockSettings, 'ollama')).toBe('http://localhost:11434');
  });

  it('should return openrouterKey for OpenRouter', () => {
    expect(getProviderKey(mockSettings, 'openrouter')).toBe('sk-or-456');
  });

  it('should return undefined for missing keys', () => {
    const emptySettings = {
      apiKey: '',
      model: 'gpt-4o',
      defaultQuestionCount: 5,
      defaultMcqPercentage: 60,
      defaultDifficulty: 'Medium' as const,
    };
    expect(getProviderKey(emptySettings, 'openai')).toBeUndefined();
    expect(getProviderKey(emptySettings, 'openrouter')).toBeUndefined();
  });
});
