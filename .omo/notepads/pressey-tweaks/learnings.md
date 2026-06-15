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
