## 2026-06-16 Task: T6-ollama-url

### Bug
In `src/lib/explanations.ts:65`, `buildSettings()` incorrectly assigned `settings.ollamaUrl = apiKey` for the 'ollama' provider case. This meant the API key string (e.g., `sk-or-v1-...`) was being used as the Ollama server URL.

### Fix
Changed line 65 to: `settings.ollamaUrl = settings.ollamaUrl || 'http://localhost:11434';`

This preserves any user-configured `ollamaUrl` passed via the `settings` parameter (e.g., from the UI), and falls back to the standard Ollama default when none is set.

### Key Insight
The `resolveEndpoint()` function in `src/lib/providers/client.ts:76` already had the fallback logic: `const base = (settings.ollamaUrl ?? 'http://localhost:11434')`. The bug was in `buildSettings()` which was overwriting `ollamaUrl` with the API key before it ever reached `resolveEndpoint()`.

### Tests Added
- `should use default Ollama endpoint when provider is ollama and no custom URL` — verifies endpoint is `http://localhost:11434/v1/chat/completions`
- `should use custom Ollama endpoint when provider is ollama with custom ollamaUrl` — verifies endpoint uses `http://custom:11434/v1/chat/completions`

## 2026-06-16 Task: T10-research

### Goal
Build `src/lib/research.ts` — opt-in DuckDuckGo web search + in-memory document search with graceful degradation. No API key, no external libs, no persistence.

### Files touched
- `src/lib/research.ts` (new) — `searchWeb`, `searchDocument`, `buildResearchContext`
- `src/lib/research.test.ts` (new) — 21 tests with mocked `fetch` via `vi.stubGlobal`
- `src/lib/errorUtils.ts` — added `RESEARCH_FETCH_FAILED`, `RESEARCH_PARSE_FAILED`, `RESEARCH_NO_RESULTS` codes + friendly messages
- `src/lib/schemas.ts` — added `ResearchResultSchema`, `ResearchDocResultSchema` + array variants
- `src/lib/types.ts` — added `enableResearch`, `researchMaxResults`, `researchMaxSnippetChars` to `Settings`
- `src/lib/settingsStore.svelte.ts` — defaults: `false`, `5`, `800`

### Design choices
- **Native `fetch` only** (no tauri-plugin-http) — matches the pattern in `src/lib/providers/client.ts:190, 368`.
- **DOMParser primary, regex fallback** — `jsdom` provides `DOMParser` in tests; production Tauri webview also has it. The regex path covers any non-DOM environment.
- **Graceful degradation contract**: every failure mode (network throw, non-2xx, parse error, empty results, empty inputs) returns `[]` / `''` and logs `console.warn` with a specific error code. No exceptions ever escape.
- **Opt-in** — `enableResearch` defaults to `false`. The module itself does not read settings; callers gate the call, so `fetch` is never invoked when disabled (verified by test).
- **Truncation** — snippets capped at `snippetChars` (with `...` suffix). Titles also capped at `min(200, snippetChars)` to keep context blocks bounded.
- **Document search** — splits query into terms ≥2 chars, dedupes by `matchPos`, sorts by position ascending, max 20 results.

### Key insight
DDG HTML markup is loose: titles live in `<a class="result__a" href="...">` while snippets live in `<a class="result__snippet" href="...">`. Both are anchors inside the same `<div class="result">` container. The DOMParser path walks up to `.result` to scope the snippet lookup; the regex path uses lookahead-friendly capture groups across both anchors.

### Tests
- `searchWeb` (8): happy path, URL encoding, maxResults cap, snippet truncation, empty query, empty results, fetch throw, non-2xx
- `searchDocument` (6): basic match, empty text, empty query, no matches, multiple terms, dedup by position, sort by position
- `buildResearchContext` (5): empty input, web only, docs only, both, end-to-end (searchWeb -> context contains snippet)
- opt-in contract (1): `enableResearch: false` path never calls fetch
- All 21 pass. `npx svelte-check` clean. `npx eslint` clean.
- Evidence: `.omo/evidence/task-10-research-happy.txt`, `.omo/evidence/task-10-research-fail.txt`


## 2026-06-16T01:06 Task: T8-snarky
- Added `snarky-tutor` entry to `PERSONALITIES` array (6 total)
- systemPrompt: sarcastic but factually accurate, uses "snark is seasoning, not the meal" framing
- Dropdown auto-includes via `{#each PERSONALITIES}` — no SettingsForm.svelte changes
- Updated test count to 6, added 'snarky-tutor' to expected IDs
- Added specific tests: prefix starts with "You are", matches systemPrompt via getPersonality
- 25/25 tests pass (was 21)


## [2026-06-16 01:08] Task: T1-dbService

**Root cause:** `getSettings()` in `src/lib/dbService.ts:546` only returned 7 of the 15 `Settings` fields defined in `src/lib/types.ts:80-96`. Per-provider keys (`openaiKey`, `anthropicKey`, `geminiKey`, `ollamaUrl`, `openrouterKey`), `provider`, and the `includeMcq`/`includeText` toggles were never loaded from the DB, so the settings store's `loadSettings()` could not hydrate them and API calls used an empty key.

**Fix:** Extended the return object in `getSettings()` to map every `Settings` field from the key-value `settings` table:
- `provider` cast to `Settings['provider']` (ProviderType)
- 5 per-provider keys via `map.get(key) ?? undefined`
- `includeMcq`/`includeText` parsed as boolean via `map.has(key) ? map.get(key) === 'true' : undefined`

**Constraints honored:**
- Legacy `apiKey` field still returned (preserves backward compat with `settingsStore.svelte.ts:54-56` migration that copies `apiKey` -> `openrouterKey`)
- No DB migration or new table - generic key-value `settings` table unchanged
- No changes outside `dbService.ts` and `dbService.test.ts`
- TypeScript clean: `npx tsc --noEmit` passes
- All tests pass: 50/50 (40 original + 10 new)

**New tests added** (in `describe('getSettings')`):
1. `returns openaiKey when stored via saveSetting`
2. `returns anthropicKey when stored via saveSetting`
3. `returns geminiKey when stored via saveSetting`
4. `returns ollamaUrl when stored via saveSetting`
5. `returns openrouterKey when stored via saveSetting`
6. `returns provider when stored via saveSetting`
7. `returns includeMcq parsed as boolean`
8. `returns includeText parsed as boolean`
9. `returns legacy apiKey AND per-provider keys together` (composite regression test)
10. `returns undefined for missing per-provider keys (not empty string)`

**Evidence:** `.omo/evidence/task-1-db-keys-pass.txt`


## [2026-06-16 01:18] Task: T7-mcq-tooltip

**Status**: Complete - all acceptance criteria met.

### Deliverables
- src/components/Tooltip.svelte (79 LOC) - wrapper span + role=tooltip bubble, data-visible toggle driven by mouseenter/leave + focusin/out, native CSS :hover/:focus-within fallback so the bubble shows even before hydration.
- src/components/Tooltip.test.ts - 10 tests covering role/aria-describedby/tabindex/data-visible/hover/focus/text-prop/class-merge.
- Applied to 5 MCQ hotspots (3 in GenerateTest.svelte, 1 in Settings.svelte, 1 in SettingsForm.svelte).

### Design system compliance
- Uses existing tokens: --color-card, --color-border, --color-foreground, --color-accent, .micro-label utility.
- No new design tokens added. No portals. No animation beyond CSS transitions.

### MCQ hotspots actually found (5, not 6)
- GenerateTest.svelte:370 - MCQ toggle label "Multiple Choice"
- GenerateTest.svelte:421 - MCQ % slider label "MCQ %"
- Settings.svelte:240 - Default Preferences MCQ toggle label "MCQ"
- SettingsForm.svelte:262 - Default MCQ percentage label "MCQ Percentage: {n}%"
- (No "Include Multiple Choice" text exists in the codebase - the plan's 6th hotspot is a description mismatch. The first 2 GenerateTest hotspots above are what the plan calls the "MCQ toggle label" and "MCQ percentage slider label".)
- Inherited wisdom said "5 is acceptable" - confirmed.

### Lessons / gotchas
- **Svelte 5 snippet testing**: passing () => 'text' as unknown as Snippet to @testing-library/svelte works for props/attribute checks but the snippet's text content does NOT end up in the rendered DOM via wrapper.textContent. Tests should target the bubble (screen.getByRole('tooltip')) directly rather than asserting slot content via the wrapper.
- **a11y linter**: the tooltip wrapper legitimately needs tabindex=0 (to be focusable for keyboard users) and mouseenter/mouseleave handlers (for hover-to-show), so two <!-- svelte-ignore a11y_* --> directives are required. These are infrastructure directives, not free-form comments.
- **Svelte-ignore syntax**: combining rules on a single line (<!-- svelte-ignore rule1 rule2 -->) only suppressed the first rule. Use one comment per rule.
- **data-visible attribute**: chose data-* over a class because (a) it's a boolean state attribute, (b) it's a clean test hook for jsdom where :hover/:focus-within CSS pseudo-classes aren't fully simulated, and (c) the JS handler is the single source of truth.
- **LOC counting**: Measure-Object -Line reports a different count than .Count (75 vs 80) for the same file. Use .Count for the canonical "lines in file" count.

### Verification
- npx vitest run src/components/Tooltip.test.ts - 10/10 passed
- npx vitest run (full suite) - 537 passed, 2 skipped (pre-existing Toast  bug, unrelated)
- npx svelte-check --tsconfig ./tsconfig.json --threshold error - 0 errors, 0 warnings
- Evidence saved: .omo/evidence/task-7-tooltip-hover.txt, .omo/evidence/task-7-tooltip-focus.txt


## [2026-06-16] Task: T3-validation

### Goal
Replace legacy `validateApiKey(settingsStore.settings.apiKey)` with per-provider `validateProvider(provider, settings)` across all validation call sites, and update the `canGenerate` derived gate to use `getProviderKey` instead of `settings.apiKey`. This fixes the "API key is required" error for all 5 providers.

### Files changed
- `src/routes/GenerateTest.svelte` — 4 changes:
  - Import `validateProvider` (from errorUtils) and `getProviderKey` (from providers/registry) instead of `validateApiKey`
  - `canGenerate` derived: `!!settingsStore.settings.apiKey` → `!!getProviderKey(settingsStore.settings, settingsStore.settings.provider ?? 'openrouter')`
  - `handleGenerate` validation: `validateApiKey(settingsStore.settings.apiKey)` → `validateProvider(settingsStore.settings.provider ?? 'openrouter', settingsStore.settings)`
  - Warning banner: `!settingsStore.settings.apiKey` → `!getProviderKey(settingsStore.settings, settingsStore.settings.provider ?? 'openrouter')`
- `src/components/SettingsForm.svelte` — 2 changes:
  - Import `validateProvider` instead of `validateApiKey`
  - `handleSave` validation: `validateApiKey(apiKey)` → `validateProvider(provider, settingsStore.settings)`
- `src/routes/GenerateTest.test.ts` — mock defaults now include all per-provider key fields + warning test uses `openrouterKey` instead of `apiKey`
- `src/lib/errorHandling.test.ts` — added parametric tests for all 5 providers (10 new tests: each provider tested with valid key → `{valid: true}` and empty key → `PROVIDER_KEY_MISSING`)

### No changes needed
- `Settings.svelte` — no `validateApiKey` call site exists; it passes `apiKey` through without validation
- `SettingsForm.test.ts` — no validation-dependent tests exist

### Key insight
The `validateApiKey(apiKey)` call in `SettingsForm.handleSave()` had a latent bug: it always validated the legacy `apiKey` field regardless of which provider was selected. Switching to `validateProvider(provider, settingsStore.settings)` checks the correct per-provider key for the currently selected provider.

### Test results
- GenerateTest.test.ts: 14/14 passed
- SettingsForm.test.ts: 9/9 passed
- Settings.test.ts: 17/17 passed
- errorHandling.test.ts: 127/127 passed (10 new parametric tests)
