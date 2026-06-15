## [2026-06-15T21:38:00Z] Plan Start
Pressey Tweaks plan started. Active boulder: pressey-tweaks-5c344951.

## Codebase Structure
- Stack: Tauri v2 (Rust) + Svelte 5 (runes) + TypeScript + SQLite (via dbService)
- Tests: Vitest + Svelte Testing Library + jsdom
- Type validation: Zod for API responses (schemas.ts)
- Settings store: src/lib/settingsStore.svelte.ts — Svelte 5 runes-based ($state)

## Key Architectural Facts
- 	heme and ccent are NOT in the Settings interface. They're persisted via updateSetting calls in Settings.svelte (lines 84-85). saveSettings does full overwrite — must preserve theme/accent.
- pi.ts:25 hardcodes OPENROUTER_URL — needs provider abstraction
- explanations.ts:12 hardcodes OPENROUTER_URL — needs provider abstraction
- 	estGenerator.ts calls generateTest — must pass provider parameter after refactor
- All providers use OpenAI-compatible passthrough (simpler abstraction, single request shape)

## Provider Routing Strategy
- OpenAI: Direct (https://api.openai.com/v1/chat/completions) with openaiKey
- Anthropic: Via OpenRouter (no OpenAI-compat native API) -> uses openrouterKey
- Gemini: Google OpenAI-compat endpoint (https://generativelanguage.googleapis.com/v1beta/openai/chat/completions) with geminiKey
- Ollama: Local OpenAI-compat endpoint (http://localhost:11434/v1/chat/completions), uses ollamaUrl as base, NO Authorization header
- OpenRouter: Direct with openrouterKey (default provider, backward compat)

## Migration Strategy
- apiKey -> openrouterKey (if apiKey exists and openrouterKey is empty)
- defaultMcqPercentage=0 -> includeMcq=false, includeText=true
- defaultMcqPercentage=100 -> includeMcq=true, includeText=false
- defaultMcqPercentage=50/70 -> includeMcq=true, includeText=true

## [2026-06-15T22:43:30Z] Task 3 — Exam-badger Logo
- Sidebar brand slot is h-9 w-9 (36x36) gold-tinted badge — Logo will be slotted in at size={28} to leave breathing room inside the rounded square (Task 12).
- Default size={40} chosen because the badge container includes 4px padding; 40px is the standalone identity size.
- Theme tokens from src/app.css @theme block (oklch): --color-primary (gold), --color-foreground (light text), --color-background (dark surface). All three used as ar(...) in the SVG fills/strokes.
- Static favicon SVG embeds the same oklch values inside a <style> block — favicons don't inherit page CSS, so duplicating the tokens is the only theme-safe way to ship a non-component SVG.
- Svelte 5 test pattern: screen.getByRole('img', { name: 'Pressey logo' }) works directly on SVGs that declare ole="img" + ria-label. No need to query via container.querySelector.
- class.baseVal (not className) on SVGElement returns the merged class list as a string when queried via @testing-library.
- Vitest result: 8/8 tests pass in 90ms.

## Task 1 Complete (2026-06-15)

## [2026-06-15T22:52:49Z] Task 4 Complete — Unified Provider Client
- src/lib/providers/client.ts exports generateWithProvider(provider, prompt, config, settings, systemPrefix?) — single OpenAI-compat call shape across all 5 providers.
- Endpoint resolution: 4 providers use getProviderConfig(provider).url directly; Ollama builds the URL at call time from settings.ollamaUrl + /v1/chat/completions (strips trailing slashes), so a custom host/port works.
- Ollama is the only provider that omits Authorization — header builder explicitly skips it for 'ollama'. Content-Type: application/json always present.
- Provider-specific extras (HTTP-Referer, X-Title) come from ProviderConfig.headers and are merged after the auth/content-type headers, so Anthropic+OpenRouter get them, OpenAI/Gemini/Ollama don't.
- Model precedence: settings.model (non-empty) > getProviderConfig(provider).defaultModel. Tests verify both branches for all 5 providers.
- Retry behavior ported from src/lib/api.ts unchanged: MAX_RETRIES=3 → 4 total attempts; BACKOFF_DELAYS=[1000,2000,4000]; sleep mocked in tests so retries are instant. 401/400 short-circuit (no retry); 429/5xx/network/malformed-JSON/empty/validation are all retried.
- isApiError, shouldRetry, ErrorCodes re-exported for consumers.
- Test file: 23 tests, all green. Mocked global.fetch per case; response body wrapped in JSON.stringify({...}) to mirror real OpenRouter/OpenAI payload shape.

## Implementation Notes (TDD)
- Tests written FIRST — initial vitest run failed with Failed to resolve import './client' (file didn't exist), confirming TDD red phase.
- After implementation: 23/23 green in ~22ms.
- 
pm run test -- src/lib/providers/client.test.ts is the pre-commit gate.

## Task 6 - explanations.ts provider abstraction (2026-06-15)

### Changes made:
1. **src/lib/providers/client.ts**: Added generateExplanationWithProvider()
   - New exported function with same retry/error logic as generateWithProvider
   - Validates against ExplanationResponseSchema instead of TestResponseSchema
   - Uses esolveEndpoint() and uildHeaders() for provider-agnostic URL/headers
   - Temperature set to 0.5 (matching the original explanation temperature)

2. **src/lib/explanations.ts**: Refactored to use provider abstraction
   - Removed OPENROUTER_URL constant (was hardcoded)
   - Removed local classifyHttpError() and getHttpErrorMessage() functions
   - Removed alidateExplanationResponse() — validation now in provider layer
   - Added uildSettings() helper for backward compat from apiKey+model
   - Added optional provider param (default: 'openrouter')
   - Added optional settings param (built from apiKey+model if not provided)
   - Uses generateExplanationWithProvider() in the loop

3. **src/lib/explanations.test.ts**: Added 3 new tests
   - "should work with OpenAI provider" — verifies endpoint: api.openai.com
   - "should work with explicit settings object" — verifies settings override
   - "should use OpenRouter endpoint when provider is openrouter" — verifies endpoint
   - Fixed error message expectation for API-level error (code appended)
   - All 18 tests pass

### Lessons:
- The existing consumer (TestReview.svelte) requires NO changes — it calls
  generateExplanations(attempt, test, settings.apiKey, settings.model) and the
  new optional params default to the same behavior.
- Error message format changed slightly: data.error.message (code: data.error.code)
  instead of just data.error.message (consistent with generateWithProvider).
- generateExplanationWithProvider needed systemMessage as a parameter (not just
  prompt and settings), since explanations use a different system prompt than
  test generation.

## [2026-06-15T23:05:39Z] Task 12 Complete - Sidebar + Favicon
- Sidebar.svelte: replaced Sparkles with <Logo size={28}/> inside the existing 36x36 badge slot. Dropped the wrapper's aria-hidden=true (Logo owns its own role/aria-label) and the text-primary class (Logo is a coloured SVG, doesn't need a CSS tint).
- index.html: favicon href swapped to /pressey-logo.svg. public/pressey-logo.svg already exists from Task 3 with embedded oklch tokens in an internal <style> block (favicons can't inherit page CSS).
- Sidebar.test.ts: added 2 tests - Logo render via screen.getByRole('img', { name: 'Pressey logo' }) and explicit role + aria-label assertions. 11/11 vitest pass in 192ms.
- Pre-commit gate: npx vitest run src/components/Sidebar.test.ts - 11/11 green.
- svelte-check shows 14 pre-existing errors in untouched files (GenerateTest, SettingsForm, Settings, Card.test) - none in Sidebar. Out of scope for this task.
