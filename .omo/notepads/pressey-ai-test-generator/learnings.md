# Learnings � Pressey AI Test Generator

## Project State (pre-Wave 1)
- Current project is a stock Tauri v2 + React 19 + Vite 7 template (1 commit)
- No tests, no custom code beyond greet demo
- Tailwind NOT yet installed
- All React-specific files must be replaced with Svelte 5 equivalents

## Task 4 — Database Schema & Module (completed)
- Created `src/lib/db.ts` with `initDatabase()` (singleton pattern) and `runMigrations()` (versioned migrations)
- Schema: 5 tables (settings, tests, questions, attempts, responses) + schema_version tracking
- All tables use IF NOT EXISTS; all FKs use ON DELETE CASCADE
- Tests: `src/lib/db.test.ts` with 15 tests, all passing (mocked tauri-plugin-sql-api via vi.hoisted + vi.mock)
- Key learning: `vi.mock()` is hoisted — top-level variables in mock factory must use `vi.hoisted()` to avoid ReferenceError
- Note: vitest.config.ts has unresolved deps (@sveltejs/vite-plugin-svelte conflicts with vite 7) — Task 2's domain

## Key Conventions
- Svelte 5 runes ONLY: $state, $derived, $effect � NO Svelte 4 stores
- Tailwind v4 CSS-based config via @theme block � NO 	ailwind.config.js 
- Conditional rendering for routing � NO SvelteKit/router library
- OKLCH color space for all design tokens
- Fonts: Sora (display), Inter (body), JetBrains Mono (code/labels)

## Task 1+3 — GitHub Rename & Tauri Plugin Config (completed)
- GitHub repo renamed: `Eld3rForce/Pressey` -> `Eld3rForce/Pressey-AI-Test-Generator` (via `gh repo rename -R Eld3rForce/Pressey -y Pressey-AI-Test-Generator`)
- Local `origin` updated to new URL
- `src-tauri/Cargo.toml`: package renamed to `pressey-ai-test-generator`, lib renamed to `pressey_ai_test_generator_lib` (binary `main.rs` also updated to reference new lib name)
- `src-tauri/tauri.conf.json`: productName="Pressey AI Test Generator", identifier="com.adamburness-smith.pressey-ai-test-generator", window 1024x768 resizable with minWidth/minHeight 1024/768
- `src-tauri/capabilities/default.json`: added `http:default`, `sql:default`, `dialog:default` permissions
- `src-tauri/src/lib.rs`: registered `tauri_plugin_opener::init()`, `tauri_plugin_sql::Builder::default().build()`, `tauri_plugin_dialog::init()`, `tauri_plugin_http::init()`. Greet command preserved.
- `cargo check --manifest-path src-tauri/Cargo.toml`: PASSES with 0 errors
- `README.md` rewritten as Pressey AI Test Generator project description

### Tauri v2 plugin init pattern — CORRECTED inherited wisdom
The inherited note said to use `tauri_plugin_sql::init()` like the opener pattern. This is WRONG for tauri-plugin-sql v2.4.0:
- `tauri_plugin_opener` exposes a top-level `init()` function
- `tauri_plugin_dialog` exposes a top-level `init()` function
- `tauri_plugin_http` exposes a top-level `init()` function
- **`tauri_plugin_sql` v2.4.0 does NOT expose `init()` — must use `tauri_plugin_sql::Builder::default().build()`**
- Reason: tauri-plugin-sql takes a runtime `Builder` (with config like db connections) that needs explicit construction, not a zero-arg init. The `Builder` exposes `.add_migrations(...)` etc. later if needed.

### `http:default` permission requires `tauri-plugin-http`
Adding `http:default` to capabilities/default.json without the tauri-plugin-http plugin installed produces a build error (`Permission http:default not found`). The Tauri build script validates permissions against registered plugins only. **If you reference any `<plugin>:default` permission, the matching plugin MUST be in Cargo.toml deps AND registered in lib.rs.**

### Renaming a Tauri crate: don't forget `src/main.rs`
When renaming the lib in `[lib].name`, the binary's `src/main.rs` must also update its reference (e.g. `pressey_lib::run()` -> `pressey_ai_test_generator_lib::run()`). Otherwise you get `error[E0433]: cannot find module or unlinked crate`.

### `tauri-plugin-http` adds 32 transitive deps (reqwest, rustls, hyper, h2, etc.) — large but well-maintained
First `cargo check` after adding tauri-plugin-http downloads ~30 crates (cookie_store, rustls, ring, etc.). Subsequent checks are fast.

## Task 2 — Svelte 5 + Tailwind v4 + Vitest + ESLint + Prettier (completed)
- Replaced React 19 with Svelte 5, added full toolchain, added `zod` for Task 5 API client
- All Wave 1 deps installed: `svelte ^5.19`, `@sveltejs/vite-plugin-svelte ^6.2.4`, `@tailwindcss/vite ^4.0.6`, `vitest ^3.0.5`, `eslint ^9.20`, `prettier ^3.5`, `zod ^3.24`, `clsx`, `tailwind-merge`, `lucide-svelte`
- Vite build passes: 108 modules transformed, ~25 KB JS gzipped
- ESLint runs cleanly (1 unused-import error in `api.test.ts` from Task 5 — not my domain)
- Vitest runs and discovers tests; `api.test.ts` (Task 5) passes 14/14; `db.test.ts` (Task 4) fails because parallel task didn't install `tauri-plugin-sql-api` — Task 1+3 will fix via Cargo.toml
- Obsidian Studio design tokens live in `src/app.css` `@theme` block (Tailwind v4 CSS-only)
- 7 utility classes: `studio-bg`, `surface-card`, `glass-panel`, `code-surface`, `command-strip`, `micro-label`, `section-divider`
- Google Fonts loaded via `@import url` for Sora / Inter / JetBrains Mono

### Key version pin: `@sveltejs/vite-plugin-svelte` v5 does NOT support Vite 7
- v5.x peer dep: `vite@^6.0.0` — fails ERESOLVE on Vite 7
- v6.x peer dep: `vite@^6.3.0 || ^7.0.0` — works with Vite 7
- v7.x peer dep: `vite@^8.0.0-beta.7 || ^8.0.0` — requires Vite 8
- Pin: `@sveltejs/vite-plugin-svelte ^6.2.4` for Vite 7 projects

### Tailwind v4 `@theme` block vs `tailwind.config.js`
- v4 is CSS-only — no JS config file
- Tokens defined as CSS custom properties inside `@theme { --color-* }` are auto-exposed as Tailwind utility classes (`bg-background`, `text-foreground`, etc.)
- Composable utility classes use `@utility <name> { ... }` syntax (single declaration per utility)
- Import tailwind with `@import 'tailwindcss';` (not `@tailwind base; @tailwind components; @tailwind utilities;`)

### Svelte 5 entry: `mount()` from 'svelte', not `new App({ target })`
- Old Svelte 4 pattern: `new App({ target: document.getElementById('root') })`
- New Svelte 5 pattern: `mount(App, { target: document.getElementById('app')! })`
- Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`, `$bindable`) replace all reactive declarations

### Tauri Vite config caveat: `process.env.TAURI_DEV_HOST`
- `process` is a Node.js global — keep the `// @ts-expect-error` comment above the `const host = process.env.TAURI_DEV_HOST` line
- This is the canonical Tauri + Vite pattern; the comment must stay exactly above the `process` access

### Vitest 3 + Svelte plugin in same config
- Use `vitest/config`'s `defineConfig` (not `vite/config`) so `test` block is typed
- For Svelte components: pass `svelte({ hot: false })` to avoid HMR sockets in test runs
- `setupFiles` should import `@testing-library/svelte/vitest` to add matchers like `toBeInTheDocument`

### Windows filesystem is case-insensitive — `App.css` vs `app.css`
- `Remove-Item App.css` then `Write app.css` collapses both — but `cmd /c "dir /b src"` shows the actual case
- Vite's resolver is case-SENSITIVE on case-insensitive filesystems: `import './app.css'` from `main.ts` fails to resolve if the file is `App.css`
- Always verify file case matches the import path string, even on Windows

## Task 5 — OpenRouter API Client & Types (completed)
- Created `src/lib/types.ts`: All shared types (TestConfig, Question, Test, Attempt, Response, Settings, OpenRouterMessage/Request/Response/Choice, ApiError, Explanation, LearningResource) — zero `any` types
- Created `src/lib/schemas.ts`: Zod schemas (`QuestionSchema`, `TestResponseSchema`) with inferred types exported as `ValidatedQuestion` and `ValidatedTestResponse`
- Created `src/lib/api.ts`: `generateTest(prompt, config, apiKey, model?)` with:
  - System prompt construction from TestConfig (topic, difficulty, question count, MCQ percentage)
  - POST to `https://openrouter.ai/api/v1/chat/completions` with `Authorization: Bearer`, `HTTP-Referer`, `X-Title`, `Content-Type` headers
  - `response_format: { type: 'json_object' }` for structured JSON output
  - Retry logic: max 3 retries with exponential backoff (1s, 2s, 4s) — retries on 429, 5xx, malformed JSON, empty response, validation errors, network errors. Does NOT retry on 401 or 400
  - Zod `safeParse` validation via `validateApiResponse()` before returning
  - All errors wrapped as `ApiError` typed objects `{ code: string; message: string; status?: number }`
  - Extracted `sleep()` to `src/lib/utils.ts` (appended to existing clsx/twMerge module)
- Created `src/lib/api.test.ts`: 14 tests, all passing (`npx vitest run src/lib/api.test.ts` → 14/14, exit 0)
  - Tests cover: success case, 401 (no retry), 429 (retry ×3), malformed JSON (retry), network error, 3rd attempt success, prompt construction, empty response retry, validation error, API-level error, 500 server error retry, 400 (no retry), custom model, default model
- TypeScript compiles cleanly: `npx tsc --noEmit --strict src/lib/api.ts` → no errors

### Mocking `sleep()` for retry tests without fake timers
- Fake timers (`vi.useFakeTimers()` + `vi.runAllTimersAsync()`) caused unhandled promise rejections when switching back to real timers because internal `setTimeout`-based promises in the retry loop were "detached" (known vitest quirk)
- **Solution**: Extracted `sleep` to a separate module (`src/lib/utils.ts`), used `vi.mock('./utils', () => ({ sleep: vi.fn().mockResolvedValue(undefined) }))` at the top of the test file. This mocks the module-level import so `generateTest`'s internal `sleep()` calls resolve immediately — no timers needed
- This pattern avoids all fake-timer headaches while still testing retry counts and error paths

### Zod validation with `safeParse` and inferred types
- `TestResponseSchema.safeParse(parsed)` returns `{ success: boolean; data?: T; error?: ZodError }` — use `result.data` for the validated type (not `result.success && result.data` which TypeScript can't narrow)
- Export inferred types: `export type ValidatedTestResponse = z.infer<typeof TestResponseSchema>` — this preserves the exact type for use in other functions (e.g., `validateApiResponse` return type)
- The `questions` array in `ValidatedTestResponse` has typed elements (`ValidatedQuestion`), so mapping over `validated.questions.map((q, index) => ...)` preserves `q.type`, `q.text`, etc. — no loose `Record<string, unknown>` needed

### ApiError as interface, not class
- Task spec defines `ApiError` as `{ code: string; message: string; status?: number }` — a plain interface
- Created with `createApiError(code, message, status?)` helper returning plain objects
- Checked with `isApiError(error: unknown): error is ApiError` type guard using structural check (`'code' in error && 'message' in error`)
- Note: plain object errors don't have stack traces — acceptable for this use case since errors are handled via `code`/`message` pattern

