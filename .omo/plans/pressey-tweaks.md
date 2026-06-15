# Pressey Tweaks — Work Plan

## TL;DR

> **Quick Summary**: Enhance Pressey with independent question-type toggles (MCQ + text), multi-provider LLM support (OpenAI, Anthropic, Google, Ollama, OpenRouter), and a branded exam-badger logo — without breaking existing OpenRouter behavior or user data.
>
> **Deliverables**:
> - Question type toggles (`includeMcq`, `includeText`) with conditional mcqPercentage slider
> - Multi-provider API client with per-provider config (URL, key, model)
> - Provider settings UI with all provider keys stored
> - Exam-badger SVG logo + Tauri platform icons
> - Updated test suite (provider tests, toggle tests, regression tests)
>
> **Estimated Effort**: Medium (~12-15 tasks)
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Types (Wave 1) → Provider Client (Wave 2) → UI Integration (Wave 3) → Verification (Wave FINAL)

---

## Context

### Original Request
Add three tweaks to Pressey: (1) independent toggles for MCQ and text/open response question types, (2) support for multiple LLM providers beyond OpenRouter, (3) generate a cool exam-badger logo.

### Interview Summary
**Key Discisions**:
- **Toggle behavior**: Independent toggles (`includeMcq`, `includeText`). If both disabled, show validation error.
- **Provider routing**: OpenAI-compatible passthrough for all providers (simpler abstraction, single request shape).
- **Providers**: OpenAI, Anthropic Claude, Google Gemini, Ollama/Local, OpenRouter (keep existing).
- **Question split**: Keep `mcqPercentage` slider, but only show it when BOTH toggles are ON.
- **API key storage**: Store all provider keys (`openaiKey`, `anthropicKey`, `geminiKey`, `ollamaUrl`, `openrouterKey`).
- **Logo**: SVG for sidebar + favicon. Render SVG to PNG and generate Tauri platform icons (icon.ico, icon.icns) for OS window.

**Technical Decisions**:
- **Migration**: `mcqPercentage=0` → MCQ off, text on. `mcqPercentage=100` → MCQ on, text off. `mcqPercentage=50/70` → both ON.
- **Test strategy**: TDD for new provider client; tests-after for UI tweaks; agent QA mandatory for all.
- **Backward compat**: Keep `mcqPercentage` field for existing tests. Add `includeMcq`/`includeText` as new primary controls.

**Research Findings**:
- Current Settings model: `apiKey`, `model`, `defaultQuestionCount`, `defaultMcqPercentage`, `defaultDifficulty`, `personality`, `customInstructions`
- Current API: Hardcoded OpenRouter URL in `api.ts` and `explanations.ts`
- TestConfig: `mcqPercentage` drives question type distribution
- UI: MCQ slider in `GenerateTest.svelte` (id) and `SettingsForm.svelte` (id)
- Settings store: `saveSettings()` does full overwrite; must preserve `theme`/`accent` (stored via `updateSetting`)
- Project has Vitest + Svelte Testing Library + Zod for API response validation
- No Zod schemas for `Settings` or `TestConfig` (imperative validation in `errorUtils.ts`)
- Tauri window icon requires PNG/ICO/ICNS generated via `npx @tauri-apps/cli icon`

### Metis Review
**Identified Gaps** (addressed):
- **Provider shape mismatch**: Chose OpenAI-compatible passthrough to avoid native API complexity
- **Ghost settings**: `theme`/`accent` are persisted via `updateSetting`, not `saveSettings` — must not break
- **Both-on split**: Decided to keep mcqPercentage slider visible only when both toggles are ON
- **Key storage**: Decided to store all provider keys for user convenience
- **Logo scope**: Decided to cover sidebar + favicon + OS window
- **Two-layer Settings**: `Settings.svelte` + `SettingsForm.svelte` split preserved, not refactored

---

## Work Objectives

### Core Objective
Enhance Pressey with independent question-type toggles (MCQ + text), multi-provider LLM support (OpenAI, Anthropic, Google, Ollama, OpenRouter), and a branded exam-badger logo — without breaking existing OpenRouter behavior or user data.

### Concrete Deliverables
- `src/lib/types.ts` — Updated `TestConfig`, `Settings`, new `Provider` types
- `src/lib/providers/` — Provider registry, per-provider configs, unified client
- `src/lib/api.ts` — Refactored to use provider abstraction
- `src/lib/explanations.ts` — Updated to use provider abstraction
- `src/lib/testGenerator.ts` — Pass provider to generateFromPrompt/generateFromFile
- `src/lib/settingsStore.svelte.ts` — Provider keys, migration logic, theme/accent preservation
- `src/lib/errorUtils.ts` — New provider validation, toggle validation
- `src/routes/GenerateTest.svelte` — Toggle UI, conditional slider
- `src/components/SettingsForm.svelte` — Provider key fields, model dropdown per provider
- `src/routes/Settings.svelte` — Toggle defaults, provider selector
- `src/components/Logo.svelte` — Exam-badger SVG component
- `src-tauri/icons/` — Regenerated platform icons from logo PNG
- `index.html` — Updated favicon
- Test files — Updated for toggles, provider tests, regression tests

### Definition of Done
- [ ] App launches with new logo in sidebar
- [ ] User can toggle MCQ and text independently in GenerateTest
- [ ] User can select provider and enter API key in Settings
- [ ] User can generate tests with any supported provider
- [ ] Existing tests updated and passing
- [ ] New provider tests passing
- [ ] Theme/accent regression tests passing
- [ ] `npm run test` exits 0
- [ ] `npm run check` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run build` exits 0

### Must Have
- Independent `includeMcq` and `includeText` toggles
- `mcqPercentage` slider visible only when both toggles are ON
- Validation error when both toggles are OFF
- Support for 5 providers: OpenAI, Anthropic, Google, Ollama, OpenRouter
- Per-provider API key storage
- Provider selection in Settings
- Exam-badger SVG logo in sidebar
- Tauri platform icons regenerated
- All existing tests still pass
- New provider unit tests (mocked fetch)
- Toggle behavior tests
- Theme/accent preservation regression tests

### Must NOT Have (Guardrails)
- MUST NOT: Extract shared form components (out of scope)
- MUST NOT: Convert imperative validation to Zod schemas (preserve existing pattern)
- MUST NOT: Fix `validatePrompt` global stub bug (out of scope)
- MUST NOT: Refactor `Settings.svelte` + `SettingsForm.svelte` two-layer architecture
- MUST NOT: Add streaming responses
- MUST NOT: Add usage/cost tracking
- MUST NOT: Add Ollama auto-discovery
- MUST NOT: Fetch model lists dynamically from providers
- MUST NOT: Touch DB schema for tests/questions/attempts tables
- MUST NOT: Change existing Zod schemas for API response

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (Vitest + Svelte Testing Library + jsdom)
- **Automated tests**: Mixed — TDD for provider client, tests-after for UI
- **Framework**: Vitest
- **Agent QA**: ALWAYS mandatory for every task

### QA Policy
Every task MUST include agent-executed QA scenarios:
- **Frontend/UI**: Vitest + Svelte Testing Library (render, fire events, assert DOM)
- **API/Backend**: Vitest (mock fetch, assert request/response)
- **Library/Module**: Vitest (import, call functions, compare output)
- Evidence saved to `.omo/evidence/task-{N}-{scenario-slug}.txt`

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — Types + Provider Config):
├── Task 1: Update types (TestConfig, Settings, Provider)
├── Task 2: Create provider registry + per-provider configs
└── Task 3: Create exam-badger SVG logo component

Wave 2 (Core — Provider Client + Settings):
├── Task 4: Build unified provider API client (TDD)
├── Task 5: Refactor api.ts to use provider abstraction
├── Task 6: Update explanations.ts for provider abstraction
├── Task 7: Update settingsStore with provider keys + migration
└── Task 8: Add validation for toggles + providers

Wave 3 (UI — Toggles + Provider Settings + Icons):
├── Task 9: Add toggle UI to GenerateTest.svelte
├── Task 10: Add provider settings to SettingsForm.svelte
├── Task 11: Add toggle defaults + provider selector to Settings.svelte
├── Task 12: Integrate Logo into Sidebar + update favicon
└── Task 13: Generate Tauri platform icons

Wave FINAL (Verification — 4 parallel reviews):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: Task 1 → Task 2 → Task 4 → Task 5 → Task 6 → Task 9 → Task 10 → Task 11 → Task 12 → F1-F4
Parallel Speedup: ~50% faster than sequential
Max Concurrent: 5 (Wave 2)
```

### Dependency Matrix
- **1**: - - 2, 4, 5, 6, 7, 8
- **2**: 1 - 4, 5, 6, 7
- **3**: - - 12
- **4**: 1, 2 - 5, 6
- **5**: 1, 2, 4 - 9
- **6**: 1, 2, 4 - 9
- **7**: 1, 2 - 10, 11
- **8**: 1, 2 - 9, 10
- **9**: 5, 6, 8 - 11
- **10**: 7, 8 - 11
- **11**: 9, 10 - 12
- **12**: 3, 11 - 13
- **13**: 12 - F1-F4

### Agent Dispatch Summary
- **Wave 1**: 3 tasks → `quick` (types, config), `quick` (registry), `visual-engineering` (logo)
- **Wave 2**: 5 tasks → `deep` (client), `quick` (refactor), `quick` (explanations), `quick` (store), `quick` (validation)
- **Wave 3**: 5 tasks → `visual-engineering` (toggles), `quick` (settings), `quick` (settings), `visual-engineering` (logo), `quick` (icons)
- **Wave FINAL**: 4 tasks → `oracle`, `unspecified-high`, `unspecified-high`, `deep`

---

## TODOs

- [x] 1. Update types for toggles and providers

  **What to do**:
  - Add `includeMcq: boolean` and `includeText: boolean` to `TestConfig` interface
  - Add `provider: ProviderType` to `TestConfig` and `Settings`
  - Add `openaiKey`, `anthropicKey`, `geminiKey`, `ollamaUrl`, `openrouterKey` to `Settings`
  - Create `ProviderType` enum: `'openai' | 'anthropic' | 'gemini' | 'ollama' | 'openrouter'`
  - Create `ProviderConfig` interface with `url`, `keyField`, `defaultModel`, `headers` (optional)
  - Keep existing `mcqPercentage` field for backward compatibility
  - Ensure `theme` and `accent` are NOT added to the Settings interface (they remain component-local, persisted via `updateSetting`)

  **Must NOT do**:
  - Remove existing `apiKey` field yet (handle in migration task)
  - Add Zod schemas for Settings (out of scope)
  - Change existing Question, Test, Attempt, Response interfaces

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: Type changes are straightforward, no UI or complex logic

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Tasks 2, 4, 5, 6, 7, 8, 9, 10, 11
  - **Blocked By**: None

  **References**:
  - `src/lib/types.ts:66-74` — Current Settings interface (add new fields)
  - `src/lib/types.ts:7-12` — Current TestConfig interface (add toggles, provider)
  - `src/lib/types.ts:76-105` — OpenRouter API types (keep as reference for provider request shape)

  **Acceptance Criteria**:
  - [ ] `src/lib/types.ts` compiles with `npm run check` (0 errors)
  - [ ] `TestConfig` includes `includeMcq`, `includeText`, `provider`
  - [ ] `Settings` includes `provider`, `openaiKey`, `anthropicKey`, `geminiKey`, `ollamaUrl`, `openrouterKey`
  - [ ] `ProviderType` enum is exported
  - [ ] `ProviderConfig` interface is exported

  **QA Scenarios**:

  ```
  Scenario: Types compile correctly
    Tool: Bash
    Preconditions: Clean working directory
    Steps:
      1. Run `npm run check`
    Expected Result: Exit code 0, no type errors
    Evidence: .omo/evidence/task-1-types-compile.txt
  ```

  **Commit**: YES
  - Message: `feat(types): add question toggles and provider types`
  - Files: `src/lib/types.ts`
  - Pre-commit: `npm run check`

---

- [x] 2. Create provider registry and per-provider configs

  **What to do**:
  - Create `src/lib/providers/` directory
  - Create `src/lib/providers/registry.ts` with provider configs (all OpenAI-compatible shape):
    - `openai`: `{ url: 'https://api.openai.com/v1/chat/completions', keyField: 'openaiKey', defaultModel: 'gpt-4o', headers: {} }`
    - `anthropic`: `{ url: 'https://openrouter.ai/api/v1/chat/completions', keyField: 'openrouterKey', defaultModel: 'anthropic/claude-3.5-sonnet', headers: { 'HTTP-Referer': 'https://pressey.app', 'X-Title': 'Pressey AI Test Generator' } }` (Anthropic native API is not OpenAI-compatible; uses OpenRouter routing)
    - `gemini`: `{ url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', keyField: 'geminiKey', defaultModel: 'gemini-1.5-pro', headers: {} }` (Google's OpenAI-compatible endpoint)
    - `ollama`: `{ url: 'http://localhost:11434/v1/chat/completions', keyField: 'ollamaUrl', defaultModel: 'llama3.2', headers: {} }` (Ollama's OpenAI-compatible endpoint, no Authorization header)
    - `openrouter`: `{ url: 'https://openrouter.ai/api/v1/chat/completions', keyField: 'openrouterKey', defaultModel: 'openai/gpt-4o', headers: { 'HTTP-Referer': 'https://pressey.app', 'X-Title': 'Pressey AI Test Generator' } }`
  - Create `src/lib/providers/index.ts` barrel export
  - Add `getProviderConfig(provider: ProviderType): ProviderConfig` function
  - Add `getProviderKey(settings: Settings, provider: ProviderType): string | undefined` function
  - Note: For Ollama, the "key" is actually the URL (stored in `ollamaUrl`). No Authorization header.

  **Must NOT do**:
  - Implement the actual API client (that is Task 4)
  - Add native API shapes for Anthropic/Gemini (OpenAI-compatible passthrough only)
  - Add dynamic model fetching

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: Configuration data, no complex logic

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Tasks 4, 5, 6, 7, 10
  - **Blocked By**: Task 1

  **References**:
  - `src/lib/types.ts` (after Task 1) — ProviderType, ProviderConfig, Settings
  - `src/lib/api.ts:25` — Current OpenRouter URL
  - `src/lib/api.ts:138-143` — Current headers pattern

  **Acceptance Criteria**:
  - [ ] `src/lib/providers/registry.ts` exists with all 5 provider configs
  - [ ] `getProviderConfig` returns correct config for each provider
  - [ ] `getProviderKey` returns correct key from Settings for each provider
  - [ ] `npm run test` passes for provider registry tests

  **QA Scenarios**:

  ```
  Scenario: Provider registry returns correct configs
    Tool: Bash (vitest)
    Preconditions: Task 1 completed
    Steps:
      1. Run `npx vitest run src/lib/providers/registry.test.ts`
    Expected Result: All tests pass (5 provider configs verified)
    Evidence: .omo/evidence/task-2-registry-tests.txt
  ```

  **Commit**: YES
  - Message: `feat(providers): create provider registry and configs`
  - Files: `src/lib/providers/registry.ts`, `src/lib/providers/index.ts`, `src/lib/providers/registry.test.ts`
  - Pre-commit: `npm run test -- src/lib/providers/registry.test.ts`

---

- [x] 3. Create exam-badger SVG logo component

  **What to do**:
  - Create `src/components/Logo.svelte` — an inline SVG component
  - Design: Stylized badger wearing a graduation cap (mortarboard) with a pencil/quill behind the ear
  - Style: Flat vector illustration, matches Obsidian Studio dark theme (uses `@theme` color tokens: `var(--color-primary)` for gold accents, `var(--color-foreground)` for lines, `var(--color-background)` for fill)
  - Size: `viewBox="0 0 100 100"` with responsive sizing via CSS
  - Include `aria-label="Pressey logo"` and `role="img"`
  - The SVG should be clean and renderable at small sizes (40px sidebar) and larger sizes (favicon base)
  - Export a static version to `public/pressey-logo.svg` for favicon use

  **Must NOT do**:
  - Add external image dependencies (no PNG/JPG assets)
  - Use raster images within the SVG
  - Add complex gradients or filters that hurt performance
  - Hardcode colors that break light/dark theme switching

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []
  - **Reason**: SVG design and component creation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 12
  - **Blocked By**: None

  **References**:
  - `src/app.css` — Theme color tokens (`--color-primary`, `--color-foreground`, `--color-background`)
  - `src/components/Sidebar.svelte` — Where logo will be integrated (replaces Sparkles icon)
  - `public/` — Static assets directory for favicon SVG

  **Acceptance Criteria**:
  - [ ] `src/components/Logo.svelte` exists and renders without errors
  - [ ] `public/pressey-logo.svg` exists and is valid SVG
  - [ ] SVG uses theme CSS variables for colors
  - [ ] SVG has `viewBox`, `aria-label`, `role="img"`
  - [ ] Logo renders at 40px without visual artifacts
  - [ ] Vitest test: renders Logo, asserts `role="img"` and `aria-label` present

  **QA Scenarios**:

  ```
  Scenario: Logo renders correctly in component
    Tool: Bash (vitest)
    Preconditions: Clean working directory
    Steps:
      1. Run `npx vitest run src/components/Logo.test.ts`
    Expected Result: Test passes (logo renders, has correct attributes)
    Evidence: .omo/evidence/task-3-logo-render.txt

  Scenario: Static SVG is valid
    Tool: Bash
    Preconditions: Logo component created
    Steps:
      1. Check `public/pressey-logo.svg` exists with `Test-Path`
      2. Verify file contains `<svg` and `viewBox`
    Expected Result: File exists and is valid SVG markup
    Evidence: .omo/evidence/task-3-svg-valid.txt
  ```

  **Commit**: YES
  - Message: `feat(logo): add exam-badger SVG component`
  - Files: `src/components/Logo.svelte`, `src/components/Logo.test.ts`, `public/pressey-logo.svg`
  - Pre-commit: `npm run test -- src/components/Logo.test.ts`

- [x] 4. Build unified provider API client (TDD)

  **What to do**:
  - Create `src/lib/providers/client.ts` — unified `generateWithProvider()` function
  - TDD approach: Write failing tests FIRST, then implement
  - Tests must cover:
    - Correct URL is called for each provider (specific URL string)
    - Correct headers (Authorization, Content-Type, provider-specific like `anthropic-version`)
    - Correct request body shape (system message placement, model param location)
    - Zod-parsed result matches expected `Test` shape
    - Error handling: 401 (auth), 429 (rate limit), 500 (server), network error, malformed JSON
  - Implementation:
    - Accept `provider`, `prompt`, `config`, `settings` as parameters
    - Build request using `getProviderConfig` + `getProviderKey`
    - Handle OpenAI-compatible request shape for all providers
    - For Ollama: no Authorization header, use `ollamaUrl` as base URL
    - Keep retry logic (3 attempts with backoff) from existing `api.ts`
    - Return `Test` object
  - Add `src/lib/providers/client.test.ts` with mocked `fetch` per provider

  **Must NOT do**:
  - Add streaming support
  - Add native Anthropic/Gemini API shapes
  - Remove existing `api.ts` yet (refactor in Task 5)
  - Add usage/cost tracking

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []
  - **Reason**: Core business logic, requires careful design and comprehensive testing

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 1)
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7, 8)
  - **Blocks**: Tasks 5, 6
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `src/lib/providers/registry.ts` (Task 2) — Provider configs
  - `src/lib/types.ts` (Task 1) — ProviderType, ProviderConfig, Settings
  - `src/lib/api.ts:124-247` — Current `generateTest` function (model the retry/validation logic)
  - `src/lib/errorUtils.ts` — Error codes and helpers
  - `src/lib/schemas.ts` — Zod schemas for response validation
  - `src/lib/api.test.ts` — Existing test patterns (mock fetch, assert response)

  **Acceptance Criteria**:
  - [ ] `src/lib/providers/client.test.ts` exists and passes (TDD: tests written first)
  - [ ] All 5 providers have mocked fetch tests
  - [ ] Error scenarios tested (401, 429, 500, network, malformed JSON)
  - [ ] `generateWithProvider` returns valid `Test` object
  - [ ] `npm run test` passes for client tests

  **QA Scenarios**:

  ```
  Scenario: OpenAI provider generates test
    Tool: Bash (vitest)
    Preconditions: Tasks 1-2 complete
    Steps:
      1. Run `npx vitest run src/lib/providers/client.test.ts -t "OpenAI"`
    Expected Result: Test passes (correct URL, headers, body, response)
    Evidence: .omo/evidence/task-4-openai-test.txt

  Scenario: Anthropic provider generates test
    Tool: Bash (vitest)
    Preconditions: Tasks 1-2 complete
    Steps:
      1. Run `npx vitest run src/lib/providers/client.test.ts -t "Anthropic"`
    Expected Result: Test passes (correct URL, headers including anthropic-version, body, response)
    Evidence: .omo/evidence/task-4-anthropic-test.txt

  Scenario: Ollama provider generates test
    Tool: Bash (vitest)
    Preconditions: Tasks 1-2 complete
    Steps:
      1. Run `npx vitest run src/lib/providers/client.test.ts -t "Ollama"`
    Expected Result: Test passes (correct URL, NO Authorization header, body, response)
    Evidence: .omo/evidence/task-4-ollama-test.txt

  Scenario: Error handling for auth failure
    Tool: Bash (vitest)
    Preconditions: Tasks 1-2 complete
    Steps:
      1. Run `npx vitest run src/lib/providers/client.test.ts -t "401"`
    Expected Result: Test passes (throws ApiError with correct code, no retries)
    Evidence: .omo/evidence/task-4-error-401.txt
  ```

  **Commit**: YES
  - Message: `feat(api): unified provider client with TDD tests`
  - Files: `src/lib/providers/client.ts`, `src/lib/providers/client.test.ts`
  - Pre-commit: `npm run test -- src/lib/providers/client.test.ts`

---

- [ ] 5. Refactor api.ts to use provider abstraction

  **What to do**:
  - Refactor `src/lib/api.ts` to delegate to `generateWithProvider` from `src/lib/providers/client.ts`
  - Keep the same public API: `generateTest(prompt, config, apiKey, model, systemPrefix)`
  - Add `provider` parameter (default to `'openrouter'` for backward compatibility)
  - Use `settingsStore.settings.provider` as the default provider if not passed
  - Keep `buildSystemPrompt`, `buildRequest`, `validateApiResponse` as internal helpers OR move to client.ts if they belong there
  - Ensure all existing tests in `src/lib/api.test.ts` still pass (update mocks if needed)
  - Update `OPENROUTER_URL` references to use provider config instead

  **Must NOT do**:
  - Change the public `generateTest` signature drastically (add optional params only)
  - Remove error handling patterns (keep retry, validation, classification)
  - Break existing consumers of `generateTest`
  - Forget to update `testGenerator.ts` to pass provider parameter

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: Refactoring existing code to use new abstraction

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 1)
  - **Parallel Group**: Wave 2 (with Tasks 4, 6, 7, 8)
  - **Blocks**: Task 9
  - **Blocked By**: Tasks 1, 2, 4

  **References**:
  - `src/lib/api.ts` — Current implementation
  - `src/lib/api.test.ts` — Existing tests (must continue passing)
  - `src/lib/providers/client.ts` (Task 4) — New unified client
  - `src/lib/testGenerator.ts` — Consumer of `generateTest` (must pass provider param)

  **Acceptance Criteria**:
  - [ ] `src/lib/api.ts` delegates to `generateWithProvider`
  - [ ] All existing `api.test.ts` tests pass
  - [ ] `generateTest` accepts optional `provider` parameter
  - [ ] Backward compatibility: calling `generateTest` without provider still works (defaults to OpenRouter)

  **QA Scenarios**:

  ```
  Scenario: Existing api tests still pass
    Tool: Bash (vitest)
    Preconditions: Task 4 complete
    Steps:
      1. Run `npx vitest run src/lib/api.test.ts`
    Expected Result: All tests pass (backward compatibility verified)
    Evidence: .omo/evidence/task-5-api-backward-compat.txt
  ```

  **Commit**: YES
  - Message: `refactor(api): use provider abstraction`
  - Files: `src/lib/api.ts`
  - Pre-commit: `npm run test -- src/lib/api.test.ts`

---

- [ ] 6. Update explanations.ts for provider abstraction

  **What to do**:
  - Refactor `src/lib/explanations.ts` to use `generateWithProvider` instead of hardcoded OpenRouter URL
  - The `getExplanation` function currently calls OpenRouter directly at `src/lib/explanations.ts:12`
  - Update to use the active provider from settings
  - Keep the same public API: `getExplanation(question, userAnswer, apiKey, model, personalityPrompt)`
  - Add optional `provider` parameter (default to `'openrouter'`)
  - Update `src/lib/explanations.test.ts` to test with different providers
  - Update the `OPENROUTER_URL` reference in `src/lib/explanations.ts` to use provider config

  **Must NOT do**:
  - Change the explanation prompt format (preserve existing system message)
  - Remove existing explanation response validation
  - Break `TestReview.svelte` or other consumers

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: Similar to Task 5, refactor second call site

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 1)
  - **Parallel Group**: Wave 2 (with Tasks 4, 5, 7, 8)
  - **Blocks**: Task 9
  - **Blocked By**: Tasks 1, 2, 4

  **References**:
  - `src/lib/explanations.ts` — Current implementation
  - `src/lib/explanations.test.ts` — Existing tests
  - `src/lib/providers/client.ts` (Task 4) — Unified client
  - `src/lib/api.ts` (Task 5) — Same pattern

  **Acceptance Criteria**:
  - [ ] `src/lib/explanations.ts` uses `generateWithProvider` or provider config
  - [ ] All existing `explanations.test.ts` tests pass
  - [ ] `getExplanation` accepts optional `provider` parameter
  - [ ] No hardcoded OpenRouter URL remains in `explanations.ts`

  **QA Scenarios**:

  ```
  Scenario: Explanations work with OpenRouter
    Tool: Bash (vitest)
    Preconditions: Tasks 4-5 complete
    Steps:
      1. Run `npx vitest run src/lib/explanations.test.ts -t "OpenRouter"`
    Expected Result: Test passes (correct URL, headers, response)
    Evidence: .omo/evidence/task-6-explanations-openrouter.txt

  Scenario: Explanations work with OpenAI
    Tool: Bash (vitest)
    Preconditions: Tasks 4-5 complete
    Steps:
      1. Run `npx vitest run src/lib/explanations.test.ts -t "OpenAI"`
    Expected Result: Test passes (correct URL, headers, response)
    Evidence: .omo/evidence/task-6-explanations-openai.txt
  ```

  **Commit**: YES
  - Message: `refactor(explanations): use provider abstraction`
  - Files: `src/lib/explanations.ts`
  - Pre-commit: `npm run test -- src/lib/explanations.test.ts`

---

- [x] 7. Update settingsStore with provider keys and migration

  **What to do**:
  - Update `src/lib/settingsStore.svelte.ts`:
    - Add new default fields: `provider: 'openrouter'`, `openaiKey: ''`, `anthropicKey: ''`, `geminiKey: ''`, `ollamaUrl: 'http://localhost:11434'`, `openrouterKey: ''`
    - Update defaults to include `includeMcq: true`, `includeText: true` (derived from `defaultMcqPercentage`)
    - Add migration logic: when loading settings, if `defaultMcqPercentage` exists but no `includeMcq`/`includeText`:
      - `defaultMcqPercentage = 0` → `includeMcq = false`, `includeText = true`
      - `defaultMcqPercentage = 100` → `includeMcq = true`, `includeText = false`
      - `defaultMcqPercentage = 50/70` → `includeMcq = true`, `includeText = true`
    - Migrate `apiKey` → `openrouterKey` if `apiKey` exists and `openrouterKey` is empty
    - Preserve `theme`/`accent` keys: do NOT overwrite them in `saveSettings` — ensure `updateSetting` calls for theme/accent remain separate
    - Update `testApiConnection` to work with any provider (use provider config URL + key)
  - Update `src/lib/settingsStore.test.ts` for new fields and migration

  **Must NOT do**:
  - Add `theme`/`accent` to the `Settings` interface (they stay component-local)
  - Remove existing `apiKey` field immediately (migrate it to `openrouterKey`)
  - Add SQLite schema migration (settings are key-value, new keys are automatic)
  - Break existing settings load/save

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: Store logic updates, migration handling

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 1)
  - **Parallel Group**: Wave 2 (with Tasks 4, 5, 6, 8)
  - **Blocks**: Tasks 10, 11
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `src/lib/settingsStore.svelte.ts` — Current implementation
  - `src/lib/settingsStore.test.ts` — Existing tests
  - `src/lib/dbService.ts` — `getSettings`/`saveSetting` functions
  - `src/lib/types.ts` (Task 1) — Updated Settings interface

  **Acceptance Criteria**:
  - [ ] `settingsStore` defaults include all provider keys and `provider` field
  - [ ] Migration logic correctly converts `defaultMcqPercentage` to toggles
  - [ ] Migration logic correctly converts `apiKey` to `openrouterKey`
  - [ ] `saveSettings` does NOT clobber `theme`/`accent` (regression test)
  - [ ] `testApiConnection` works with selected provider
  - [ ] All existing settings store tests pass

  **QA Scenarios**:

  ```
  Scenario: mcqPercentage=70 migrates to both toggles ON
    Tool: Bash (vitest)
    Preconditions: Task 1 complete
    Steps:
      1. Mock `getSettings` returning `{ defaultMcqPercentage: '70', apiKey: 'sk-old' }`
      2. Call `settingsStore.loadSettings()`
      3. Assert `settingsStore.settings.includeMcq === true`
      4. Assert `settingsStore.settings.includeText === true`
      5. Assert `settingsStore.settings.openrouterKey === 'sk-old'`
    Expected Result: All assertions pass
    Evidence: .omo/evidence/task-7-migration-70.txt

  Scenario: mcqPercentage=0 migrates to MCQ off, text on
    Tool: Bash (vitest)
    Preconditions: Task 1 complete
    Steps:
      1. Mock `getSettings` returning `{ defaultMcqPercentage: '0' }`
      2. Call `settingsStore.loadSettings()`
      3. Assert `settingsStore.settings.includeMcq === false`
      4. Assert `settingsStore.settings.includeText === true`
    Expected Result: All assertions pass
    Evidence: .omo/evidence/task-7-migration-0.txt

  Scenario: Theme/accent preservation regression
    Tool: Bash (vitest)
    Preconditions: Task 1 complete
    Steps:
      1. Mock store with `theme: 'dark', accent: 'cyan'`
      2. Call `settingsStore.saveSettings({ apiKey: 'new', ... })`
      3. Assert `updateSetting` was NOT called with 'theme' or 'accent'
      4. Assert existing theme/accent values unchanged
    Expected Result: All assertions pass
    Evidence: .omo/evidence/task-7-theme-accent-regression.txt
  ```

  **Commit**: YES
  - Message: `feat(settings): provider keys and toggle migration`
  - Files: `src/lib/settingsStore.svelte.ts`, `src/lib/settingsStore.test.ts`
  - Pre-commit: `npm run test -- src/lib/settingsStore.test.ts`

---

- [x] 8. Add validation for toggles and providers

  **What to do**:
  - Update `src/lib/errorUtils.ts`:
    - Add `ErrorCodes.TOGGLES_BOTH_OFF`
    - Add `ErrorCodes.PROVIDER_INVALID`
    - Add `ErrorCodes.PROVIDER_KEY_MISSING`
    - Add `validateToggles(includeMcq: boolean, includeText: boolean)` function
    - Add `validateProvider(provider: ProviderType, settings: Settings)` function
    - Add `validateProviderKey(provider: ProviderType, key: string)` function (per-provider prefix checks: `sk-` for OpenAI, `sk-ant-` for Anthropic, `AIza` for Gemini, any for Ollama, `sk-or-` for OpenRouter)
  - Update `src/lib/errorHandling.test.ts` for new validators
  - Update `GenerateTest.svelte` to call `validateToggles` before generation

  **Must NOT do**:
  - Convert existing validation to Zod (keep imperative pattern)
  - Add validation for business logic beyond toggles/providers
  - Fix the `validatePrompt` global stub bug

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: Adding validation functions, straightforward

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 1)
  - **Parallel Group**: Wave 2 (with Tasks 4, 5, 6, 7)
  - **Blocks**: Tasks 9, 10
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `src/lib/errorUtils.ts` — Current validation patterns
  - `src/lib/errorHandling.test.ts` — Existing validation tests
  - `src/lib/types.ts` (Task 1) — ProviderType, Settings
  - `src/routes/GenerateTest.svelte` — Where toggle validation is called

  **Acceptance Criteria**:
  - [ ] `validateToggles` returns `{ valid: false, error: ... }` when both are off
  - [ ] `validateProvider` returns `{ valid: false, error: ... }` for invalid provider or missing key
  - [ ] `validateProviderKey` checks per-provider key prefixes
  - [ ] All new validation tests pass
  - [ ] `GenerateTest.svelte` calls `validateToggles` before generation

  **QA Scenarios**:

  ```
  Scenario: Both toggles off validation
    Tool: Bash (vitest)
    Preconditions: Task 1 complete
    Steps:
      1. Run `npx vitest run src/lib/errorHandling.test.ts -t "toggle"`
    Expected Result: Test passes (returns error when both toggles off)
    Evidence: .omo/evidence/task-8-toggle-validation.txt

  Scenario: Missing provider key validation
    Tool: Bash (vitest)
    Preconditions: Task 1 complete
    Steps:
      1. Run `npx vitest run src/lib/errorHandling.test.ts -t "provider key"`
    Expected Result: Test passes (returns error for missing key)
    Evidence: .omo/evidence/task-8-provider-key-validation.txt
  ```

  **Commit**: YES
  - Message: `feat(validation): toggle and provider validation`
  - Files: `src/lib/errorUtils.ts`, `src/lib/errorHandling.test.ts`
  - Pre-commit: `npm run test -- src/lib/errorHandling.test.ts`

- [ ] 9. Add toggle UI to GenerateTest.svelte

  **What to do**:
  - Update `src/routes/GenerateTest.svelte`:
    - Replace `mcqPercentage` slider with two toggle switches:
      - `includeMcq` toggle (label: "Multiple Choice")
      - `includeText` toggle (label: "Open Response")
    - Add `provider` dropdown (or keep using settingsStore default)
    - Show `mcqPercentage` slider ONLY when both `includeMcq` and `includeText` are true
    - Add toggle validation: if both are off, show error message "Select at least one question type" before generating
    - Update `TestConfig` construction to include `includeMcq`, `includeText`, `provider`
    - Update `canGenerate` derived to check toggles are valid
    - Update question distribution logic: if only one toggle is on, all questions are that type
    - Keep `mcqPercentage` for the split when both are on
  - Update `src/routes/GenerateTest.test.ts`:
    - Replace `#mcq-percentage-slider` queries with new toggle selectors
    - Add test: both toggles off → validation error
    - Add test: only MCQ on → all questions are MCQ
    - Add test: only text on → all questions are text
    - Add test: both on → slider visible, mcqPercentage applies
    - Ensure existing test patterns (mock settingsStore, mock generateTest) still work

  **Must NOT do**:
  - Add shared Toggle component (out of scope)
  - Change the two-layer form layout drastically
  - Remove the `topic`, `questionCount`, `difficulty` fields
  - Break file upload functionality

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []
  - **Reason**: UI component changes with form interactions

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 2)
  - **Parallel Group**: Wave 3 (with Tasks 10, 11, 12, 13)
  - **Blocks**: Task 11
  - **Blocked By**: Tasks 1, 5, 6, 8

  **References**:
  - `src/routes/GenerateTest.svelte` — Current implementation
  - `src/routes/GenerateTest.test.ts` — Current tests (uses `#mcq-percentage-slider`)
  - `src/lib/types.ts` (Task 1) — Updated TestConfig
  - `src/lib/errorUtils.ts` (Task 8) — Toggle validation
  - `src/lib/settingsStore.svelte.ts` (Task 7) — Provider default

  **Acceptance Criteria**:
  - [ ] Two toggle switches visible in GenerateTest
  - [ ] `mcqPercentage` slider hidden when only one toggle is on
  - [ ] `mcqPercentage` slider visible when both toggles are on
  - [ ] Validation error shows when both toggles are off
  - [ ] `GenerateTest.test.ts` passes with new toggle tests
  - [ ] Existing test functionality preserved (mock settings, mock generation)

  **QA Scenarios**:

  ```
  Scenario: Toggle behavior in GenerateTest
    Tool: Bash (vitest)
    Preconditions: Tasks 1, 5, 6, 8 complete
    Steps:
      1. Run `npx vitest run src/routes/GenerateTest.test.ts`
    Expected Result: All tests pass (toggle tests + existing tests)
    Evidence: .omo/evidence/task-9-generatetest-toggles.txt

  Scenario: Both toggles off shows error
    Tool: Bash (vitest)
    Preconditions: Tasks 1, 5, 6, 8 complete
    Steps:
      1. Run `npx vitest run src/routes/GenerateTest.test.ts -t "both toggles off"`
    Expected Result: Test passes (error message visible)
    Evidence: .omo/evidence/task-9-both-off-error.txt
  ```

  **Commit**: YES
  - Message: `feat(ui): question type toggles in GenerateTest`
  - Files: `src/routes/GenerateTest.svelte`, `src/routes/GenerateTest.test.ts`
  - Pre-commit: `npm run test -- src/routes/GenerateTest.test.ts`

---

- [ ] 10. Add provider settings to SettingsForm.svelte

  **What to do**:
  - Update `src/components/SettingsForm.svelte`:
    - Add `provider` dropdown: OpenAI, Anthropic, Google, Ollama, OpenRouter
    - Add per-provider API key input fields (show only the relevant key for the selected provider, or show all with labels)
    - Add per-provider model dropdown (hardcoded curated list per provider):
      - OpenAI: `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`
      - Anthropic: `claude-3-5-sonnet-20241022`, `claude-3-opus-20240229`, `claude-3-haiku-20240307`
      - Gemini: `gemini-1.5-pro`, `gemini-1.5-flash`
      - Ollama: `llama3.2`, `mistral`, `codellama` (free text input, not dropdown)
      - OpenRouter: `openai/gpt-4o`, `anthropic/claude-3.5-sonnet`, `google/gemini-1.5-pro`
    - Add "Test Connection" button that works with selected provider
    - Update `SettingsForm.test.ts` for new fields
  - Keep the existing API key input as a fallback or rename it to `openrouterKey` based on migration

  **Must NOT do**:
  - Fetch model lists dynamically from providers
  - Add shared Input/Select components
  - Change the two-layer save architecture (SettingsForm saves via settingsStore)
  - Remove existing personality/custom instructions fields

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: Form fields addition, straightforward UI

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 2)
  - **Parallel Group**: Wave 3 (with Tasks 9, 11, 12, 13)
  - **Blocks**: Task 11
  - **Blocked By**: Tasks 1, 2, 7, 8

  **References**:
  - `src/components/SettingsForm.svelte` — Current implementation
  - `src/components/SettingsForm.test.ts` — Current tests
  - `src/lib/settingsStore.svelte.ts` (Task 7) — Updated with provider keys
  - `src/lib/providers/registry.ts` (Task 2) — Provider configs

  **Acceptance Criteria**:
  - [ ] Provider dropdown visible in SettingsForm
  - [ ] API key input visible per provider
  - [ ] Model dropdown (or text input for Ollama) visible per provider
  - [ ] "Test Connection" button works with selected provider
  - [ ] `SettingsForm.test.ts` passes

  **QA Scenarios**:

  ```
  Scenario: Provider selection changes visible fields
    Tool: Bash (vitest)
    Preconditions: Tasks 1, 2, 7, 8 complete
    Steps:
      1. Run `npx vitest run src/components/SettingsForm.test.ts`
    Expected Result: All tests pass
    Evidence: .omo/evidence/task-10-settingsform-provider.txt
  ```

  **Commit**: YES
  - Message: `feat(ui): provider settings in SettingsForm`
  - Files: `src/components/SettingsForm.svelte`, `src/components/SettingsForm.test.ts`
  - Pre-commit: `npm run test -- src/components/SettingsForm.test.ts`

---

- [ ] 11. Add toggle defaults and provider selector to Settings.svelte

  **What to do**:
  - Update `src/routes/Settings.svelte`:
    - Add `includeMcq` and `includeText` toggles to the "Default Preferences" section
    - Show `mcqPercentage` slider only when both toggles are ON
    - Add `provider` dropdown to the "API Settings" section
    - Update `handleSaveAll` to include new toggle defaults and provider
    - Update `handleResetConfirm` to reset toggles to defaults (`includeMcq: true`, `includeText: true`)
    - Update `Settings.test.ts` for new fields
    - Ensure `theme` and `accent` are still persisted via `updateSetting` (not via `saveSettings`) and are not clobbered

  **Must NOT do**:
  - Refactor the two-layer SettingsForm/Settings architecture
  - Add shared Toggle component
  - Remove existing appearance/theme/accent sections

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: Settings page updates, form integration

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 2)
  - **Parallel Group**: Wave 3 (with Tasks 9, 10, 12, 13)
  - **Blocks**: None
  - **Blocked By**: Tasks 1, 7, 9, 10

  **References**:
  - `src/routes/Settings.svelte` — Current implementation
  - `src/routes/Settings.test.ts` — Current tests
  - `src/lib/settingsStore.svelte.ts` (Task 7) — Updated defaults
    - `src/lib/types.ts` (Task 1) — Updated Settings

  **Acceptance Criteria**:
  - [ ] Toggle defaults visible in Settings
  - [ ] Provider selector visible in Settings
  - [ ] `mcqPercentage` slider conditionally visible
    - [ ] Save includes toggles and provider
    - [ ] Reset restores toggle defaults
    - [ ] `theme`/`accent` not clobbered on save
    - [ ] `Settings.test.ts` passes

  **QA Scenarios**:

  ```
  Scenario: Toggle defaults save correctly
    Tool: Bash (vitest)
    Preconditions: Tasks 1, 7, 9, 10 complete
    Steps:
      1. Run `npx vitest run src/routes/Settings.test.ts`
    Expected Result: All tests pass
    Evidence: .omo/evidence/task-11-settings-toggles.txt
  ```

  **Commit**: YES
  - Message: `feat(ui): toggle defaults and provider selector in Settings`
  - Files: `src/routes/Settings.svelte`, `src/routes/Settings.test.ts`
  - Pre-commit: `npm run test -- src/routes/Settings.test.ts`

---

- [ ] 12. Integrate logo into Sidebar and update favicon

  **What to do**:
  - Update `src/components/Sidebar.svelte`:
    - Replace the `Sparkles` icon with `<Logo>` component at the brand area
    - Keep the "Pressey" text label
    - Ensure logo is responsive (40px in sidebar)
  - Update `index.html`:
    - Replace `<link rel="icon" type="image/svg+xml" href="/tauri.svg" />` with `<link rel="icon" type="image/svg+xml" href="/pressey-logo.svg" />`
  - Update `src/components/Sidebar.test.ts`:
    - Assert `Logo` component is rendered
    - Assert `role="img"` and `aria-label` are present

  **Must NOT do**:
  - Remove the sidebar navigation structure
  - Change the sidebar layout drastically
  - Add external image assets

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []
  - **Reason**: UI integration of logo component

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 2)
  - **Parallel Group**: Wave 3 (with Tasks 9, 10, 11, 13)
  - **Blocks**: None
  - **Blocked By**: Task 3

  **References**:
  - `src/components/Sidebar.svelte` — Current implementation (uses Sparkles icon)
  - `src/components/Sidebar.test.ts` — Current tests
  - `src/components/Logo.svelte` (Task 3) — Logo component
  - `index.html` — Current favicon link

  **Acceptance Criteria**:
  - [ ] Logo visible in sidebar (replaces Sparkles)
  - [ ] Favicon updated to `pressey-logo.svg`
  - [ ] `Sidebar.test.ts` passes

  **QA Scenarios**:

  ```
  Scenario: Logo in sidebar
    Tool: Bash (vitest)
    Preconditions: Task 3 complete
    Steps:
      1. Run `npx vitest run src/components/Sidebar.test.ts`
    Expected Result: All tests pass (logo present, correct attributes)
    Evidence: .omo/evidence/task-12-sidebar-logo.txt

  Scenario: Favicon updated
    Tool: Bash
    Preconditions: Task 3 complete
    Steps:
      1. Check `index.html` contains `href="/pressey-logo.svg"`
    Expected Result: Favicon link updated
    Evidence: .omo/evidence/task-12-favicon.txt
  ```

  **Commit**: YES
  - Message: `feat(ui): integrate logo into sidebar and favicon`
  - Files: `src/components/Sidebar.svelte`, `src/components/Sidebar.test.ts`, `index.html`
  - Pre-commit: `npm run test -- src/components/Sidebar.test.ts`

---

- [ ] 13. Generate Tauri platform icons

  **What to do**:
  - Render `public/pressey-logo.svg` to a 1024x1024 PNG (using a tool or manual conversion)
  - Run `npx @tauri-apps/cli icon ./public/pressey-logo-1024.png` to generate all platform icons:
    - `src-tauri/icons/icon.png` (256x256)
    - `src-tauri/icons/icon.ico` (Windows)
    - `src-tauri/icons/icon.icns` (macOS)
    - `src-tauri/icons/32x32.png`, `128x128.png`, etc.
  - Update `src-tauri/tauri.conf.json` if needed to reference the new icon
  - Verify the OS window icon updates after rebuild

  **Must NOT do**:
  - Add external image dependencies
  - Manually create raster icons (use Tauri CLI)
  - Change Tauri bundle identifier or app name

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Reason**: CLI command execution, asset generation

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 2)
  - **Parallel Group**: Wave 3 (with Tasks 9, 10, 11, 12)
  - **Blocks**: Wave FINAL
  - **Blocked By**: Task 3

  **References**:
  - `public/pressey-logo.svg` (Task 3) — Source SVG
  - `src-tauri/tauri.conf.json` — Tauri config
  - `src-tauri/icons/` — Current icons directory
  - Tauri CLI docs: `https://tauri.app/v1/guides/features/icons/`

  **Acceptance Criteria**:
  - [ ] `src-tauri/icons/icon.png` exists and is non-zero size
  - [ ] `src-tauri/icons/icon.ico` exists and is non-zero size
  - [ ] `src-tauri/icons/icon.icns` exists and is non-zero size
  - [ ] All platform sizes generated (32x32, 128x128, etc.)
  - [ ] Tauri config references correct icon path

  **QA Scenarios**:

  ```
  Scenario: Tauri icons generated
    Tool: Bash
    Preconditions: Task 3 complete
    Steps:
      1. Check `src-tauri/icons/icon.png` exists with `Test-Path`
      2. Check `src-tauri/icons/icon.ico` exists with `Test-Path`
      3. Check `src-tauri/icons/icon.icns` exists with `Test-Path`
    Expected Result: All files exist and have non-zero size
    Evidence: .omo/evidence/task-13-tauri-icons.txt
  ```

  **Commit**: YES
  - Message: `feat(assets): generate Tauri platform icons`
  - Files: `src-tauri/icons/*`
  - Pre-commit: `Test-Path src-tauri/icons/icon.png`

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run test). For each "Must NOT Have": search codebase for forbidden patterns. Check evidence files exist in `.omo/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `npm run check` + `npm run lint` + `npm run test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task. Test cross-task integration. Test edge cases: both toggles off, invalid provider key, empty model, Ollama unreachable. Save to `.omo/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built, nothing beyond spec was built. Check "Must NOT do" compliance. Detect cross-task contamination.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `feat(types): add question toggles and provider types` + `feat(providers): create provider registry and configs` + `feat(logo): add exam-badger SVG component`
- **Wave 2**: `feat(api): unified provider client` + `refactor(api): use provider abstraction` + `refactor(explanations): use provider abstraction` + `feat(settings): provider keys and migration` + `feat(validation): toggle and provider validation`
- **Wave 3**: `feat(ui): question type toggles in GenerateTest` + `feat(ui): provider settings in SettingsForm` + `feat(ui): toggle defaults and provider selector in Settings` + `feat(ui): integrate logo into sidebar and favicon` + `feat(assets): generate Tauri platform icons`
- **Wave FINAL**: `test(regression): verify all changes`

---

## Success Criteria

### Verification Commands
```bash
npm run test        # Expected: all tests pass
npm run check       # Expected: 0 errors
npm run lint        # Expected: 0 errors
npm run build       # Expected: exit 0
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] Logo visible in sidebar
- [ ] Favicon updated
- [ ] Tauri platform icons generated
- [ ] Provider switching works
- [ ] Toggle validation works
- [ ] Theme/accent preserved on save
- [ ] Existing test suite still passes
