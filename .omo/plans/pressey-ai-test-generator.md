# Pressey AI Test Generator — Work Plan

## TL;DR

> **Quick Summary**: Rebuild the existing "Pressey" Tauri v2 template from React 19 to Svelte 5, transforming it into "Pressey AI Test Generator" — a desktop app that generates tests via OpenRouter (GPT-4o), supports file uploads (txt/md/PDF), stores data in SQLite, exports tests as PDF, and includes a test-taking mode with scoring and review.
>
> **Deliverables**:
> - Svelte 5 frontend with Obsidian Studio dark theme design system
> - OpenRouter AI integration for structured test generation
> - File upload and text extraction (txt/md/PDF)
> - SQLite persistence with full schema (tests, questions, attempts, responses, settings)
> - Test-taking UI with scoring and answer review
> - PDF export (questions + answer key)
> - Settings UI for API key, model preferences, defaults
> - Vitest test suite
> - GitHub repo renamed to `Pressey-AI-Test-Generator`
>
> **Estimated Effort**: Large (~20-25 tasks)
> **Parallel Execution**: YES — 5 waves
> **Critical Path**: Foundation (Wave 1) → Core Logic (Wave 2) → UI Screens (Wave 3) → Integration (Wave 4) → Verification (Wave FINAL)

---

## Context

### Original Request
Rebuild the existing Pressey project (Tauri + React template) into "Pressey AI Test Generator" using Svelte, with OpenRouter AI integration, test generation from prompts and file uploads, multiple-choice and text response questions, SQLite persistence, and PDF export. Also rename the project folder and GitHub repository.

### Interview Summary
**Key Discussions**:
- **Full stack change**: React 19 → Svelte 5 (with runes: `$state`, `$derived`, `$effect`)
- **GitHub repo rename**: `Pressey` → `Pressey-AI-Test-Generator`
- **AI integration**: OpenRouter API (GPT-4o default), user-provided API key via settings UI
- **File upload**: MVP supports txt/md/PDF. Excel/CSV/Office/Outlook deferred to Phase 2.
- **Test generation**: Configurable question count (max 50), MCQ/text percentage, difficulty (Easy/Medium/Hard)
- **Test-taking mode**: User answers questions, gets scored, reviews with correct answers highlighted
- **Persistence**: SQLite via `tauri-plugin-sql` with tables: tests, questions, attempts, responses, settings
- **Export**: PDF with questions + answer key on separate pages
- **UI design**: Obsidian Studio dark theme (deep charcoal, gold primary, teal accents, Sora/Inter/JetBrains Mono fonts)
- **Window**: Resizable, minimum 1024x768
- **Testing**: Vitest + Svelte Testing Library

**Technical Decisions**:
- **HTTP**: `http:default` permission for frontend fetch to OpenRouter (simpler than Rust proxy)
- **SQL**: `tauri-plugin-sql` (official plugin, JS API, needs `sql:default` permission)
- **Settings**: Separate tab/route with sidebar navigation
- **PDF**: Frontend generation (jsPDF or similar) for MVP

**Research Findings**:
- Current project is a stock Tauri v2 + React 19 + Vite 7 template (1 commit, no custom code)
- All React-specific files need replacement; Tauri backend scaffold is preserved
- No tests, no env files, no custom backend code beyond a `greet` demo
- Tailwind v4 is current and works with Svelte + Vite via `@tailwindcss/vite` plugin

### Metis Review
**Identified Gaps** (addressed):
- **Jest → Vitest**: Metis identified Jest + Svelte 5 incompatibility; switched to Vitest
- **HTTP strategy**: Clarified `http:default` permission vs Rust proxy; chose frontend fetch
- **SQL strategy**: Clarified `tauri-plugin-sql` vs `rusqlite`; chose official plugin
- **Scope creep guardrails**: Locked down test-taking mode, export formats, file upload scope
- **Edge cases**: Added handling for empty prompts, API failures, file size limits, concurrent clicks
- **PDF text extraction**: Confirmed Rust PDF parsing only works for text-layer PDFs (not scanned)

---

## Work Objectives

### Core Objective
Rebuild the Pressey Tauri template into a fully functional "Pressey AI Test Generator" desktop application using Svelte 5, with AI-powered test generation, test-taking, file upload, SQLite persistence, and PDF export.

### Concrete Deliverables
- `package.json` — Svelte 5, Vitest, Tailwind CSS, tauri-plugin-sql dependencies
- `vite.config.ts` — Svelte Vite plugin configuration
- `tailwind.config.ts` — Obsidian Studio design tokens
- `src/main.ts` — Svelte 5 entry point
- `src/App.svelte` — Root app component with sidebar navigation
- `src/lib/` — Stores, API client, database utilities, types, personalities, explanations
- `src/components/` — Reusable UI components (surface-card, glass-panel, etc.)
- `src/routes/` — GenerateTest, TakeTest, TestHistory, Settings, TestReview
- `src-tauri/tauri.conf.json` — Updated product name, identifier, window config, permissions
- `src-tauri/Cargo.toml` — Updated package name, dependencies
- `src-tauri/capabilities/default.json` — `http:default`, `sql:default` permissions
- Database migration file — Schema creation (including explanations table)
- Vitest test files — Component and API tests
- `.omo/evidence/` — QA scenario screenshots and outputs

### Definition of Done
- [ ] App launches with title "Pressey AI Test Generator"
- [ ] User can enter OpenRouter API key in settings
- [ ] User can generate a test from text prompt (10 questions, mixed MCQ/text)
- [ ] User can upload a .md file and generate a test from it
- [ ] Generated tests are saved to SQLite
- [ ] User can view test history
- [ ] User can take a test and get scored
- [ ] User can export test as PDF
- [ ] User can select AI personality (pre-defined or custom instructions)
- [ ] User can get AI explanations for wrong answers with learning resources
- [ ] All Vitest tests pass
- [ ] GitHub repo renamed to `Pressey-AI-Test-Generator`

### Must Have
- Svelte 5 frontend with runes
- OpenRouter API integration (GPT-4o default)
- Test generation with configurable options
- File upload (txt, md, PDF)
- SQLite persistence (tauri-plugin-sql)
- Test-taking mode with scoring
- AI-powered explanations for wrong answers with learning resources
- AI personality selection (pre-defined + custom instructions)
- PDF export
- Settings UI (API key, model, defaults, personality)
- Obsidian Studio dark theme design system
- Vitest test suite
- GitHub repo rename

### Must NOT Have (Guardrails)
- Multi-window architecture (single window only)
- Routing library (SvelteKit or full SPA router) — use conditional rendering
- Generic LLM provider abstraction layer (OpenRouter only)
- User authentication or profiles
- Excel/CSV/Office/Outlook file parsing (deferred to Phase 2)
- Cloud sync or online storage
- Real-time collaboration
- Auto-updater (deferred)
- Markdown export (deferred)
- Svelte 4 legacy patterns (stores, `$:` reactive statements)
- `any` types in TypeScript
- Direct DOM manipulation when Svelte bindings exist
- Unhandled promise rejections from Tauri invoke calls

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (current project has no tests)
- **Automated tests**: YES (Vitest + Svelte Testing Library)
- **Framework**: Vitest
- **Test setup**: Included as Wave 1 task
- **Agent-Executed QA**: ALWAYS (mandatory for all tasks)

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.omo/evidence/`.
- **Frontend/UI**: Playwright (navigate, interact, assert DOM, screenshot)
- **TUI/CLI**: tmux (run command, validate output)
- **API/Backend**: Bash (curl) — for OpenRouter API validation
- **Library/Module**: Bash (bun/node REPL) — import, call functions, compare output

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — Start Immediately):
├── 1. GitHub repo rename and project metadata update
├── 2. Svelte 5 + Tailwind CSS + Vitest setup
├── 3. Tauri config update (name, permissions, window)
├── 4. Database schema and migrations (SQLite)
└── 5. OpenRouter API client and types

Wave 2 (Core Logic — After Wave 1):
├── 6. File upload and text extraction (txt/md/PDF)
├── 7. Test generation service (prompt → structured JSON)
├── 8. Database service layer (CRUD operations)
├── 9. Settings store and UI component
└── 10. PDF export service

Wave 3 (UI Screens — After Wave 2):
├── 11. Sidebar navigation and layout shell
├── 12. Generate Test screen (prompt + file upload + config)
├── 13. Test History screen (list, search, delete)
├── 14. Take Test screen (question display, answer input, timer)
├── 15. Test Review screen (score, correct answers, explanations)
└── 16. Settings screen (API key, model, defaults, theme)

Wave 4 (Integration + Polish — After Wave 3):
├── 17. App shell integration (routing, state management, error handling)
├── 18. Design system implementation (tokens, components, typography)
├── 19. Vitest tests (components, API client, database)
├── 20. Edge case handling and error boundaries
├── 21. AI personality selection and custom instructions
└── 22. AI explanations for wrong answers and learning resources

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── F1. Plan compliance audit (oracle)
├── F2. Code quality review (unspecified-high)
├── F3. Real manual QA (unspecified-high)
└── F4. Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: Wave 1 (Tasks 1-5) → Wave 2 (Tasks 6-10) → Wave 3 (Tasks 11-16) → Wave 4 (Tasks 17-22) → F1-F4 → user okay
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 6 (Wave 4)
```

### Dependency Matrix

- **1-5**: None (foundation tasks) → 6-10, 11-16
- **6-10**: 1-5 → 11-16, 17-22
- **11-16**: 6-10 → 17-22
- **17-22**: 11-16 → F1-F4
- **F1-F4**: 17-22 → user okay

### Agent Dispatch Summary

- **Wave 1**: 5 tasks — all `quick` (setup, config, rename)
- **Wave 2**: 5 tasks — mix of `deep` (API client, generation logic) and `unspecified-high` (file upload, PDF)
- **Wave 3**: 6 tasks — `visual-engineering` (UI screens, design system)
- **Wave 4**: 6 tasks — `deep` (integration, error handling, explanations), `visual-engineering` (personality, design system), `unspecified-high` (tests)
- **Wave FINAL**: 4 tasks — `oracle`, `unspecified-high`, `unspecified-high`, `deep`

---

## TODOs

- [x] 1. **GitHub Repo Rename and Project Metadata Update**

  **What to do**:
  - Rename GitHub repository from `Pressey` to `Pressey-AI-Test-Generator` (use `gh repo rename`)
  - Update local git remote URL to point to new repo name
  - Update `package.json` name field to `pressey-ai-test-generator`
  - Update `src-tauri/Cargo.toml` package name to `pressey-ai-test-generator`, lib name to `pressey_ai_test_generator_lib`
  - Update `src-tauri/tauri.conf.json` productName to `Pressey AI Test Generator`, identifier to `com.adamburness-smith.pressey-ai-test-generator`, window title to `Pressey AI Test Generator`
  - Update `index.html` title tag to `Pressey AI Test Generator`
  - Update README.md with project description, tech stack, and setup instructions
  - Rename local project folder from `Pressey` to `Pressey-AI-Test-Generator` (or update references)

  **Must NOT do**:
  - Do NOT delete the git history
  - Do NOT break existing git remote connections
  - Do NOT change the version number (keep 0.1.0)
  - Do NOT modify any source code logic (only metadata and names)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: This is a configuration/metadata task with no implementation logic
  - **Skills**: `git-master`
    - `git-master`: Needed for GitHub repo rename, remote URL updates, and commit strategy

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 2-5)
  - **Parallel Group**: Wave 1
  - **Blocks**: None (other tasks don't depend on this)
  - **Blocked By**: None

  **References**:
  - `src-tauri/Cargo.toml` — Current package name and lib name
  - `src-tauri/tauri.conf.json` — Current productName, identifier, window title
  - `package.json` — Current name field
  - `README.md` — Current generic template text
  - GitHub CLI docs: `gh repo rename` usage

  **WHY Each Reference Matters**:
  - These files contain the current naming that must be updated consistently
  - Tauri bundle identifiers must be globally unique
  - GitHub repo rename affects the remote URL in `.git/config`

  **Acceptance Criteria**:
  - [ ] `gh repo view Eld3rForce/Pressey-AI-Test-Generator` returns the repo
  - [ ] `git remote -v` shows `https://github.com/Eld3rForce/Pressey-AI-Test-Generator.git`
  - [ ] `package.json` name is `pressey-ai-test-generator`
  - [ ] `src-tauri/Cargo.toml` name is `pressey-ai-test-generator`
  - [ ] `src-tauri/tauri.conf.json` productName is `Pressey AI Test Generator`
  - [ ] `index.html` title is `Pressey AI Test Generator`
  - [ ] README.md describes the AI Test Generator project

  **QA Scenarios**:
  ```
  Scenario: GitHub repo rename successful
    Tool: Bash
    Preconditions: gh CLI authenticated, repo exists at Eld3rForce/Pressey
    Steps:
      1. Run `gh repo rename Pressey --repo Eld3rForce/Pressey --yes Pressey-AI-Test-Generator`
      2. Run `git remote set-url origin https://github.com/Eld3rForce/Pressey-AI-Test-Generator.git`
      3. Run `git remote -v` and verify output contains Pressey-AI-Test-Generator
    Expected Result: Remote URL updated successfully
    Evidence: .omo/evidence/task-1-repo-rename.txt
  ```

  **Evidence to Capture**:
  - [ ] Screenshot of GitHub repo showing new name
  - [ ] Terminal output of `git remote -v`

  **Commit**: YES
  - Message: `chore: rename project to Pressey AI Test Generator`
  - Files: `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `index.html`, `README.md`
  - Pre-commit: `npm run build` (verify no build errors after rename)

- [x] 2. **Svelte 5 + Tailwind CSS + Vitest Setup**

  **What to do**:
  - Remove React dependencies: `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`
  - Add Svelte 5 dependencies: `svelte`, `@sveltejs/vite-plugin-svelte`, `svelte-check`, `@tsconfig/svelte`
  - Add Tailwind CSS v4: `tailwindcss`, `@tailwindcss/vite`, `postcss`
  - Add Vitest: `vitest`, `@testing-library/svelte`, `jsdom`, `@vitest/ui`
  - Add ESLint + TypeScript: `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-svelte`, `globals`
  - Add Prettier: `prettier`, `prettier-plugin-svelte`, `prettier-plugin-tailwindcss`
  - Add Svelte type definitions: `@sveltejs/adapter-auto`, `@sveltejs/kit` (if needed for types)
  - Add `cn()` utility dependency: `clsx`, `tailwind-merge` (for the `cn()` utility from design system)
  - Update `vite.config.ts` to use `@sveltejs/vite-plugin-svelte` instead of `@vitejs/plugin-react`
  - Update `tsconfig.json` to extend `@tsconfig/svelte/tsconfig.json` and remove `jsx: "react-jsx"`
  - Create `src/main.ts` (Svelte 5 entry point using `mount()` from `svelte`)
  - Create `src/App.svelte` (root component with basic structure)
  - Create global CSS file with Tailwind v4 `@theme` block and Obsidian Studio tokens
  - Create `eslint.config.js` (or `eslint.config.mjs`) with Svelte + TypeScript rules:
    - Extends `@eslint/js` recommended, `typescript-eslint` recommended, `eslint-plugin-svelte`
    - Rules: no-explicit-any, no-unused-vars, svelte/no-at-debug-tags, etc.
  - Create `.prettierrc` with Svelte and Tailwind plugins:
    - plugins: `["prettier-plugin-svelte", "prettier-plugin-tailwindcss"]`
    - overrides for `.svelte` files
  - Add npm scripts: `lint`, `lint:fix`, `format`, `format:check`
  - Update `index.html` to point to `/src/main.ts` instead of `/src/main.tsx`
  - Delete React files: `src/main.tsx`, `src/App.tsx`, `src/App.css`, `src/assets/react.svg`, `src/vite-env.d.ts` (if not needed)
  - Add `vitest.config.ts` with Svelte plugin and jsdom environment
  - Create `src/lib/utils.ts` with `cn()` utility (clsx + tailwind-merge wrapper)

  **Must NOT do**:
  - Do NOT use Svelte 4 legacy syntax (stores, `$:` reactive statements)
  - Do NOT use `tailwind.config.js` (Tailwind v4 uses CSS-based config via `@theme`)
  - Do NOT keep React files in the project
  - Do NOT use Jest (use Vitest only)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: This is infrastructure setup, not complex logic
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: Needed for Tailwind v4 + Svelte 5 integration and design system setup

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 1, 3-5)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 6-20 (all implementation depends on this infrastructure)
  - **Blocked By**: None

  **References**:
  - `package.json` — Current dependencies to remove
  - `vite.config.ts` — Current React plugin configuration
  - `tsconfig.json` — Current JSX settings
  - `src/main.tsx` — Current React entry point
  - `index.html` — Current script src pointing to main.tsx
  - Tailwind v4 docs: `@tailwindcss/vite` plugin setup
  - Svelte 5 docs: `mount()` API for entry point
  - Vitest docs: Svelte component testing configuration

  **WHY Each Reference Matters**:
  - `vite.config.ts`: Must replace React plugin with Svelte plugin for compilation
  - `tsconfig.json`: Must remove JSX and add Svelte type declarations
  - `src/main.tsx`: Must be replaced with Svelte 5 `mount()` pattern
  - Tailwind v4 `@theme`: The design system uses CSS-based token definitions

  **Acceptance Criteria**:
  - [ ] `npm run build` succeeds with no errors
  - [ ] `npm run dev` launches the app (Vite dev server)
  - [ ] `npx vitest run` executes (may have 0 tests initially, but config works)
  - [ ] `npm run lint` runs ESLint without errors
  - [ ] `npm run format:check` runs Prettier without errors
  - [ ] `src/App.svelte` renders without errors
  - [ ] No React references in `package.json` or source files
  - [ ] Tailwind CSS classes work (e.g., `bg-background` renders correctly)
  - [ ] `cn()` utility works in a test component

  **QA Scenarios**:
  ```
  Scenario: Svelte 5 app renders correctly
    Tool: Playwright
    Preconditions: App built with `npm run build`
    Steps:
      1. Open app at `http://localhost:1420`
      2. Assert body contains Svelte-rendered content
      3. Take screenshot of initial render
    Expected Result: App renders without React errors, Tailwind styles applied
    Evidence: .omo/evidence/task-2-svelte-render.png

  Scenario: Vitest configuration works
    Tool: Bash
    Preconditions: `vitest.config.ts` created
    Steps:
      1. Run `npx vitest run`
      2. Verify output shows "No test files found" or "0 tests" (not config error)
    Expected Result: Vitest starts without configuration errors
    Evidence: .omo/evidence/task-2-vitest-run.txt
  ```

  **Evidence to Capture**:
  - [ ] Screenshot of app rendering with Tailwind styles
  - [ ] Terminal output of `npm run build`
  - [ ] Terminal output of `npx vitest run`
  - [ ] Terminal output of `npm run lint`
  - [ ] Terminal output of `npm run format:check`

  **Commit**: YES
  - Message: `feat: setup Svelte 5 + Tailwind v4 + Vitest + ESLint + Prettier`
  - Files: `package.json`, `vite.config.ts`, `tsconfig.json`, `src/main.ts`, `src/App.svelte`, `index.html`, `vitest.config.ts`, `eslint.config.js`, `.prettierrc`, `src/lib/utils.ts`, new CSS files
  - Pre-commit: `npm install && npm run build && npm run lint && npm run format:check`

- [x] 3. **Tauri Config Update (Name, Permissions, Window)**

  **What to do**:
  - Update `src-tauri/tauri.conf.json`:
    - `productName`: `"Pressey AI Test Generator"`
    - `identifier`: `"com.adamburness-smith.pressey-ai-test-generator"`
    - Window `title`: `"Pressey AI Test Generator"`
    - Window `width`: `1024`, `height`: `768`
    - Window `resizable`: `true`
    - Window `minWidth`: `1024`, `minHeight`: `768`
  - Update `src-tauri/Cargo.toml`:
    - `name`: `pressey-ai-test-generator`
    - `description`: `"AI-powered test generator desktop app"`
    - `lib.name`: `pressey_ai_test_generator_lib`
  - Update `src-tauri/capabilities/default.json`:
    - Add `"http:default"` to permissions list (for OpenRouter API calls)
    - Add `"sql:default"` to permissions list (for tauri-plugin-sql)
  - Add `tauri-plugin-sql` to `src-tauri/Cargo.toml` dependencies
  - Update `src-tauri/src/lib.rs` to register `tauri_plugin_sql` plugin
  - Verify Rust compilation: `cargo check --manifest-path src-tauri/Cargo.toml`

  **Must NOT do**:
  - Do NOT add unnecessary permissions (keep principle of least privilege)
  - Do NOT change the `devUrl` or `frontendDist` paths
  - Do NOT modify the `greet` command or remove it yet (keep for testing)
  - Do NOT change the bundle icon configuration

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Configuration updates with minor Rust code changes
  - **Skills**: `git-master`
    - `git-master`: Not needed for this specific task

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 1-2, 4-5)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 6-20 (all need correct Tauri permissions and config)
  - **Blocked By**: None

  **References**:
  - `src-tauri/tauri.conf.json` — Current window config and permissions
  - `src-tauri/Cargo.toml` — Current package name and dependencies
  - `src-tauri/capabilities/default.json` — Current permission list
  - `src-tauri/src/lib.rs` — Current plugin registration
  - Tauri v2 docs: Capabilities and permissions
  - Tauri v2 docs: `tauri-plugin-sql` setup

  **WHY Each Reference Matters**:
  - `tauri.conf.json`: Window size and resizability are user requirements
  - `capabilities/default.json`: `http:default` and `sql:default` are required for MVP features
  - `lib.rs`: Must register the SQL plugin before it can be used from JS
  - Cargo.toml: Plugin dependencies must be declared for compilation

  **Acceptance Criteria**:
  - [ ] `cargo check --manifest-path src-tauri/Cargo.toml` passes
  - [ ] `src-tauri/tauri.conf.json` has correct window size (1024x768) and resizable=true
  - [ ] `capabilities/default.json` includes `http:default` and `sql:default`
  - [ ] `src-tauri/src/lib.rs` registers `tauri_plugin_sql`
  - [ ] App window title shows "Pressey AI Test Generator" when launched

  **QA Scenarios**:
  ```
  Scenario: Tauri app launches with correct window
    Tool: Bash
    Preconditions: `cargo check` passed
    Steps:
      1. Run `npm run tauri dev`
      2. Wait for window to appear
      3. Verify window title in OS taskbar
    Expected Result: Window title is "Pressey AI Test Generator", size >= 1024x768
    Evidence: .omo/evidence/task-3-tauri-window.png

  Scenario: Rust compilation succeeds
    Tool: Bash
    Preconditions: Cargo.toml updated with new dependencies
    Steps:
      1. Run `cargo check --manifest-path src-tauri/Cargo.toml`
      2. Verify no errors
    Expected Result: Compilation succeeds with 0 errors
    Evidence: .omo/evidence/task-3-cargo-check.txt
  ```

  **Evidence to Capture**:
  - [ ] Screenshot of app window showing title and size
  - [ ] Terminal output of `cargo check`

  **Commit**: YES
  - Message: `feat: update Tauri config for Pressey AI Test Generator`
  - Files: `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/capabilities/default.json`, `src-tauri/src/lib.rs`
  - Pre-commit: `cargo check --manifest-path src-tauri/Cargo.toml`

- [x] 4. **Database Schema and Migrations (SQLite)**

  **What to do**:
  - Design and document the SQLite schema:
    - `settings` (key TEXT PRIMARY KEY, value TEXT)
    - `tests` (id INTEGER PRIMARY KEY, title TEXT, topic TEXT, difficulty TEXT, question_count INTEGER, mcq_percentage INTEGER, created_at TEXT, updated_at TEXT)
    - `questions` (id INTEGER PRIMARY KEY, test_id INTEGER, type TEXT, text TEXT, options TEXT, correct_answer TEXT, explanation TEXT, order_index INTEGER, FOREIGN KEY(test_id))
    - `attempts` (id INTEGER PRIMARY KEY, test_id INTEGER, started_at TEXT, completed_at TEXT, score REAL, total_questions INTEGER, FOREIGN KEY(test_id))
    - `responses` (id INTEGER PRIMARY KEY, attempt_id INTEGER, question_id INTEGER, user_answer TEXT, is_correct INTEGER, FOREIGN KEY(attempt_id, question_id))
  - Create the migration SQL file in the Tauri app data directory
  - Create a `src/lib/db.ts` utility module that:
    - Initializes the database using `tauri-plugin-sql`
    - Runs migrations on first launch
    - Provides typed CRUD functions for each table
    - Handles connection errors gracefully
  - Add `db.test.ts` with Vitest tests for database operations

  **Must NOT do**:
  - Do NOT use `rusqlite` directly (use `tauri-plugin-sql` as decided)
  - Do NOT store the OpenRouter API key in plaintext without a security note
  - Do NOT create tables without migration versioning (use a `migrations` table or version tracking)
  - Do NOT skip foreign key constraints

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Database schema design and migration logic require careful architecture
  - **Skills**: None
    - This is a custom module, no specific skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 1-3, 5)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 8, 12-16 (all database-dependent features)
  - **Blocked By**: Task 3 (Tauri config with `sql:default` permission)

  **References**:
  - `tauri-plugin-sql` docs: Database initialization and migrations
  - `src-tauri/capabilities/default.json` — Must have `sql:default` permission
  - Obsidian Studio design: No specific reference for DB layer

  **WHY Each Reference Matters**:
  - `tauri-plugin-sql`: Provides the JS API for SQLite operations in Tauri v2
  - Capabilities: Without `sql:default`, the SQL plugin cannot function
  - Schema design: The 5 tables support the full test lifecycle (generation → taking → scoring)

  **Acceptance Criteria**:
  - [ ] `db.ts` initializes database without errors
  - [ ] All 5 tables are created on first launch
  - [ ] `db.test.ts` passes with Vitest
  - [ ] CRUD operations work: create test, read test, update test, delete test
  - [ ] Foreign key constraints are enforced (e.g., deleting a test cascades to questions)

  **QA Scenarios**:
  ```
  Scenario: Database initializes and creates tables
    Tool: Bash
    Preconditions: Task 3 complete (sql:default permission)
    Steps:
      1. Run `npx vitest run src/lib/db.test.ts`
      2. Verify all tests pass
    Expected Result: Database creates tables, CRUD operations succeed
    Evidence: .omo/evidence/task-4-db-tests.txt

  Scenario: Database migration on first launch
    Tool: Playwright
    Preconditions: App launched with fresh database
    Steps:
      1. Launch app
      2. Check app_data_dir for database file
      3. Verify SQLite file exists and has correct schema
    Expected Result: Database file created with all 5 tables
    Evidence: .omo/evidence/task-4-db-schema.txt
  ```

  **Evidence to Capture**:
  - [ ] Terminal output of `npx vitest run src/lib/db.test.ts`
  - [ ] SQLite schema dump showing all tables

  **Commit**: YES
  - Message: `feat: add SQLite database schema and utilities`
  - Files: `src/lib/db.ts`, `src/lib/db.test.ts`, `src/lib/schema.ts` (if types extracted)
  - Pre-commit: `npx vitest run src/lib/db.test.ts`

- [x] 5. **OpenRouter API Client and Types**

  **What to do**:
  - Create `src/lib/api.ts` — OpenRouter API client:
    - `generateTest(prompt: string, options: TestConfig): Promise<Test>`
    - Uses `fetch()` to call OpenRouter `/chat/completions` endpoint
    - Sends structured prompt requesting JSON output with test questions
    - Validates response with Zod schema
    - Handles errors: rate limit, invalid key, malformed JSON, timeout
    - Implements retry logic (max 3 retries with exponential backoff)
  - Create `src/lib/types.ts` — TypeScript types:
    - `TestConfig` (questionCount, mcqPercentage, difficulty, topic)
    - `Question` (id, type, text, options?, correctAnswer, explanation?)
    - `Test` (id, title, topic, difficulty, questions: Question[])
    - `Attempt` (id, testId, startedAt, completedAt?, score?, totalQuestions)
    - `Response` (id, attemptId, questionId, userAnswer, isCorrect)
    - `Settings` (apiKey, model, defaultQuestionCount, defaultMcqPercentage, defaultDifficulty)
  - Create `src/lib/api.test.ts` — Vitest tests for API client:
    - Mock `fetch()` for OpenRouter responses
    - Test successful generation, invalid key, malformed JSON, timeout
  - Add Zod dependency: `zod`

  **Must NOT do**:
  - Do NOT hardcode API key (must come from settings)
  - Do NOT use `any` types for API responses
  - Do NOT skip error handling for network failures
  - Do NOT add a generic LLM provider abstraction (OpenRouter only)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: API client requires careful error handling, retry logic, and type safety
  - **Skills**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 1-4)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 7, 12 (test generation and UI depend on API client)
  - **Blocked By**: Task 2 (Vitest setup for tests), Task 3 (http:default permission for fetch)

  **References**:
  - OpenRouter API docs: `/chat/completions` endpoint, JSON mode, error responses
  - Zod docs: Schema validation for structured outputs
  - `src/lib/db.ts` — Database types must align with API types
  - `src/lib/types.ts` — Central type definitions

  **WHY Each Reference Matters**:
  - OpenRouter docs: Defines the exact endpoint, request format, and response structure
  - Zod: Critical for validating AI-generated JSON (which can be malformed)
  - Type alignment: API types must match database schema for seamless storage

  **Acceptance Criteria**:
  - [ ] `src/lib/api.test.ts` passes with mocked fetch
  - [ ] API client handles 401 (invalid key) with clear error
  - [ ] API client handles 429 (rate limit) with retry
  - [ ] API client validates response with Zod schema
  - [ ] Generated prompt produces structured JSON with test questions
  - [ ] Retry logic works (max 3 retries)

  **QA Scenarios**:
  ```
  Scenario: API client generates test from mock response
    Tool: Bash
    Preconditions: Vitest setup complete
    Steps:
      1. Run `npx vitest run src/lib/api.test.ts`
      2. Verify mock tests pass (success, error, retry)
    Expected Result: All API tests pass
    Evidence: .omo/evidence/task-5-api-tests.txt

  Scenario: Real API call to OpenRouter (optional, requires valid key)
    Tool: Bash
    Preconditions: Valid OpenRouter API key in environment
    Steps:
      1. Run a test script that calls `generateTest("Photosynthesis", {questionCount: 3, mcqPercentage: 100, difficulty: "Easy"})`
      2. Verify response contains 3 questions with correct structure
    Expected Result: Valid JSON response with 3 questions
    Evidence: .omo/evidence/task-5-real-api.txt
  ```

  **Evidence to Capture**:
  - [ ] Terminal output of `npx vitest run src/lib/api.test.ts`
  - [ ] Sample JSON response from mock (or real) API call

  **Commit**: YES
  - Message: `feat: add OpenRouter API client with Zod validation`
  - Files: `src/lib/api.ts`, `src/lib/types.ts`, `src/lib/api.test.ts`, `package.json` (zod added)
  - Pre-commit: `npx vitest run src/lib/api.test.ts`

- [x] 6. **File Upload and Text Extraction (txt/md/PDF)**

  **What to do**:
  - Create `src/lib/fileUpload.ts` utility:
    - Uses Tauri `dialog` API to open file picker (or drag-and-drop)
    - Validates file type: `.txt`, `.md`, `.pdf`
    - Validates file size: max 10MB
    - Reads `.txt` and `.md` files using `readTextFile` from `@tauri-apps/api`
    - Extracts text from `.pdf` files using a Rust backend command with `pdf-extract` or `lopdf` crate
    - Returns extracted text content and file metadata
  - Create `src-tauri/src/commands/file.rs` (or add to `lib.rs`):
    - `extract_pdf_text(path: &str) -> Result<String, String>` command
    - Uses `pdf-extract` crate for text-layer PDFs
    - Returns error for scanned/image-only PDFs
  - Add `pdf-extract` to `src-tauri/Cargo.toml` dependencies
  - Create `src/lib/fileUpload.test.ts` with Vitest tests
  - Update `src-tauri/src/lib.rs` to register the new `extract_pdf_text` command
  - Update `src-tauri/capabilities/default.json` to add `dialog:default` permission (for file picker)

  **Must NOT do**:
  - Do NOT support Excel/CSV/Office/Outlook in this task (deferred to Phase 2)
  - Do NOT use frontend libraries for PDF parsing (use Rust backend for performance)
  - Do NOT skip file size validation (prevent OOM from huge files)
  - Do NOT support scanned/image-only PDFs (out of scope for MVP)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Requires both Rust and TypeScript implementation, with file I/O and parsing logic
  - **Skills**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 7-10)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 12 (Generate Test screen uses file upload)
  - **Blocked By**: Tasks 3-5 (Tauri permissions, database types, API client)

  **References**:
  - `src-tauri/src/lib.rs` — Current command registration pattern
  - `src-tauri/Cargo.toml` — Current dependencies
  - Tauri docs: `dialog` plugin for file picker
  - `pdf-extract` crate docs: Text extraction from PDFs
  - `src/lib/api.ts` — Extracted text feeds into the prompt

  **WHY Each Reference Matters**:
  - `lib.rs`: Must register new Rust commands for PDF text extraction
  - `Cargo.toml`: Must add `pdf-extract` crate for PDF parsing
  - Tauri `dialog`: Required for cross-platform file picker UI
  - API client: Extracted text is passed to `generateTest()` as the prompt

  **Acceptance Criteria**:
  - [ ] `.txt` files are read and text is extracted correctly
  - [ ] `.md` files are read and text is extracted correctly
  - [ ] `.pdf` files (text-layer) have text extracted via Rust command
  - [ ] File size > 10MB is rejected with clear error message
  - [ ] Scanned/image-only PDFs return graceful error
  - [ ] `fileUpload.test.ts` passes

  **QA Scenarios**:
  ```
  Scenario: Upload valid text file and extract content
    Tool: Playwright
    Preconditions: App running with file upload component
    Steps:
      1. Create a test .txt file with known content
      2. Trigger file upload via dialog or drag-and-drop
      3. Verify extracted text matches file content
    Expected Result: Text extracted correctly, displayed in UI
    Evidence: .omo/evidence/task-6-upload-txt.png

  Scenario: Reject oversized file
    Tool: Playwright
    Preconditions: App running
    Steps:
      1. Create a 11MB dummy file
      2. Attempt to upload
      3. Verify error message: "File exceeds 10MB limit"
    Expected Result: Upload rejected with user-friendly error
    Evidence: .omo/evidence/task-6-upload-error.png
  ```

  **Evidence to Capture**:
  - [ ] Screenshot of file upload UI
  - [ ] Terminal output of `fileUpload.test.ts`
  - [ ] Screenshot of PDF text extraction result

  **Commit**: YES
  - Message: `feat: add file upload and text extraction (txt/md/PDF)`
  - Files: `src/lib/fileUpload.ts`, `src-tauri/src/commands/file.rs`, `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src/lib/fileUpload.test.ts`
  - Pre-commit: `npx vitest run src/lib/fileUpload.test.ts`

- [x] 7. **Test Generation Service (Prompt → Structured JSON)**

  **What to do**:
  - Create `src/lib/testGenerator.ts`:
    - `generateFromPrompt(prompt: string, config: TestConfig): Promise<Test>`
    - `generateFromFile(filePath: string, config: TestConfig): Promise<Test>`
    - Composes the OpenRouter prompt with explicit instructions for JSON output
    - Prompt template: "Generate a test with {N} questions on topic: {topic}. Difficulty: {difficulty}. {X}% multiple choice (4 options each), {Y}% text response. Return JSON with array of questions..."
    - Calls `api.ts` `generateTest()` with the composed prompt
    - Validates the returned JSON structure with Zod schema
    - Saves the generated test to SQLite via `db.ts`
    - Returns the complete `Test` object with questions
  - Create `src/lib/testGenerator.test.ts`:
    - Mock the API client and database
    - Test prompt composition, JSON validation, database save
    - Test error handling for malformed AI responses
  - Add Zod schema for AI response validation:
    - `QuestionSchema` (type, text, options array, correctAnswer, explanation)
    - `TestSchema` (title, topic, difficulty, questions array)

  **Must NOT do**:
  - Do NOT let the AI decide question count (must enforce user's config)
  - Do NOT skip validation of AI-generated JSON (always Zod-check)
  - Do NOT generate tests without saving to database
  - Do NOT support question types beyond MCQ and text response

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex orchestration of prompt engineering, API calls, validation, and database persistence
  - **Skills**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 6, 8-10)
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 12, 13 (Generate Test UI and Test History depend on generation)
  - **Blocked By**: Tasks 4-5 (database and API client)

  **References**:
  - `src/lib/api.ts` — OpenRouter API client
  - `src/lib/db.ts` — Database save operations
  - `src/lib/types.ts` — Test, Question, TestConfig types
  - `src/lib/fileUpload.ts` — File extraction for `generateFromFile()`
  - Zod docs: Schema validation for structured outputs
  - OpenRouter docs: JSON mode and structured output

  **WHY Each Reference Matters**:
  - `api.ts`: The generation service is the orchestrator that calls the API client
  - `db.ts`: Every generated test must be persisted immediately
  - `types.ts`: Zod schemas must align with TypeScript types exactly
  - `fileUpload.ts`: Extracted text from files is the input to generation
  - Zod: AI-generated JSON is unreliable; validation is critical

  **Acceptance Criteria**:
  - [ ] `generateFromPrompt()` returns a valid Test with correct question count
  - [ ] `generateFromFile()` reads file and generates test from content
  - [ ] AI response is validated with Zod schema
  - [ ] Generated test is saved to SQLite with all questions
  - [ ] Malformed AI response triggers retry (up to 3 times)
  - [ ] `testGenerator.test.ts` passes

  **QA Scenarios**:
  ```
  Scenario: Generate test from text prompt
    Tool: Bash
    Preconditions: Mock API client and database
    Steps:
      1. Run `npx vitest run src/lib/testGenerator.test.ts`
      2. Verify mock generation produces correct Test structure
    Expected Result: Test generated with correct question count, types, and saved to DB
    Evidence: .omo/evidence/task-7-generator-tests.txt

  Scenario: Handle malformed AI response
    Tool: Bash
    Preconditions: Mock API returning invalid JSON
    Steps:
      1. Run test for malformed response
      2. Verify retry logic attempts 3 times
      3. Verify final error is thrown gracefully
    Expected Result: 3 retries, then graceful error
    Evidence: .omo/evidence/task-7-malformed-error.txt
  ```

  **Evidence to Capture**:
  - [ ] Terminal output of `testGenerator.test.ts`
  - [ ] Sample generated test JSON (from mock or real API)

  **Commit**: YES
  - Message: `feat: add test generation service with Zod validation`
  - Files: `src/lib/testGenerator.ts`, `src/lib/testGenerator.test.ts`, `src/lib/schemas.ts`
  - Pre-commit: `npx vitest run src/lib/testGenerator.test.ts`

- [x] 8. **Database Service Layer (CRUD Operations)**

  **What to do**:
  - Create `src/lib/dbService.ts` — high-level database service:
    - `createTest(test: Test): Promise<number>` — returns test ID
    - `getTest(id: number): Promise<Test | null>` — with joined questions
    - `getAllTests(): Promise<Test[]>` — list all tests with question counts
    - `deleteTest(id: number): Promise<void>` — cascade delete
    - `createAttempt(attempt: Attempt): Promise<number>` — returns attempt ID
    - `getAttempts(testId: number): Promise<Attempt[]>` — list attempts for a test
    - `saveResponses(responses: Response[]): Promise<void>` — batch save
    - `getSettings(): Promise<Settings>` — load all settings
    - `saveSetting(key: string, value: string): Promise<void>` — update single setting
  - Create `src/lib/dbService.test.ts` — Vitest tests for all CRUD operations
  - Ensure all functions use the `tauri-plugin-sql` API correctly
  - Add proper error handling for database errors (connection lost, constraint violations)

  **Must NOT do**:
  - Do NOT expose raw SQL to components (all queries encapsulated in service)
  - Do NOT skip transaction handling for multi-table operations
  - Do NOT use `any` types for database results
  - Do NOT skip error handling for database failures

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Database layer is critical for data integrity and must be thoroughly tested
  - **Skills**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 6-7, 9-10)
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 12-16 (all UI screens depend on database service)
  - **Blocked By**: Task 4 (database schema and `db.ts` utilities)

  **References**:
  - `src/lib/db.ts` — Low-level database connection and utilities
  - `src/lib/types.ts` — TypeScript types for all entities
  - `tauri-plugin-sql` docs: SELECT, INSERT, UPDATE, DELETE API
  - `src/lib/dbService.test.ts` — Test patterns

  **WHY Each Reference Matters**:
  - `db.ts`: The service layer builds on the low-level connection utilities
  - `types.ts`: All CRUD operations must use typed parameters and return typed results
  - `tauri-plugin-sql`: Defines the exact JS API for SQL operations
  - Test file: Ensures every CRUD operation is verified before UI uses it

  **Acceptance Criteria**:
  - [ ] `createTest()` inserts test and questions correctly
  - [ ] `getTest()` returns test with all questions
  - [ ] `getAllTests()` returns array with question counts
  - [ ] `deleteTest()` removes test and cascades to questions
  - [ ] `createAttempt()` creates attempt with timestamp
  - [ ] `saveResponses()` saves all responses in one transaction
  - [ ] `getSettings()` returns all settings as Settings object
  - [ ] `dbService.test.ts` passes

  **QA Scenarios**:
  ```
  Scenario: Full CRUD lifecycle
    Tool: Bash
    Preconditions: Database initialized
    Steps:
      1. Run `npx vitest run src/lib/dbService.test.ts`
      2. Verify all CRUD operations pass
    Expected Result: All 8 CRUD operations pass
    Evidence: .omo/evidence/task-8-crud-tests.txt

  Scenario: Database error handling
    Tool: Bash
    Preconditions: Mock database errors
    Steps:
      1. Run tests for error scenarios (connection lost, constraint violation)
      2. Verify errors are caught and returned gracefully
    Expected Result: No unhandled exceptions, all errors return as rejected promises
    Evidence: .omo/evidence/task-8-error-tests.txt
  ```

  **Evidence to Capture**:
  - [ ] Terminal output of `dbService.test.ts`
  - [ ] SQLite query log showing CRUD operations

  **Commit**: YES
  - Message: `feat: add database service layer with CRUD operations`
  - Files: `src/lib/dbService.ts`, `src/lib/dbService.test.ts`
  - Pre-commit: `npx vitest run src/lib/dbService.test.ts`

- [x] 9. **Settings Store and UI Component**

  **What to do**:
  - Create `src/lib/settingsStore.ts` — Svelte 5 runes-based store:
    - Uses `$state` for reactive settings object
    - `loadSettings()` — reads from SQLite via `dbService.getSettings()`
    - `saveSettings(settings: Settings)` — writes to SQLite
    - `updateSetting(key: string, value: string)` — updates single setting
    - Reactive derived values for default config
  - Create `src/components/SettingsForm.svelte`:
    - Input fields: OpenRouter API key (password field), model selection (dropdown: GPT-4o, GPT-3.5-turbo, Claude-3.5-Sonnet), default question count (number, 1-50), default MCQ percentage (slider, 0-100), default difficulty (radio: Easy/Medium/Hard)
    - "Save" button with validation
    - "Test Connection" button that validates API key with a simple OpenRouter ping
    - Visual feedback: success toast, error messages
    - Uses Obsidian Studio design tokens (surface-card, inputs, buttons)
  - Create `src/components/SettingsForm.test.ts` — Vitest tests for component

  **Must NOT do**:
  - Do NOT use Svelte 4 legacy stores (`writable`, `readable`) — use `$state` runes
  - Do NOT store API key in localStorage (use SQLite only)
  - Do NOT skip API key validation (must test connection before saving)
  - Do NOT use generic input components (follow design system styling)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component with form validation and visual feedback
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: Needed for form design, validation UX, and Obsidian Studio design system compliance

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 6-8, 10)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 16 (Settings screen uses this component)
  - **Blocked By**: Tasks 4-5 (database and types), Task 8 (dbService for settings CRUD)

  **References**:
  - `src/lib/dbService.ts` — For settings CRUD
  - `src/lib/types.ts` — Settings type definition
  - Obsidian Studio design system: Input styling, button variants, surface-card
  - Svelte 5 docs: `$state` runes for reactive stores
  - `src/components/SettingsForm.test.ts` — Component testing patterns

  **WHY Each Reference Matters**:
  - `dbService.ts`: Settings must be persisted to SQLite immediately
  - `types.ts`: Settings form fields map directly to the Settings type
  - Design system: All inputs must follow Obsidian Studio styling (rounded-lg, bg-background/30, ring-accent)
  - Svelte 5 runes: `$state` is the modern replacement for Svelte stores

  **Acceptance Criteria**:
  - [ ] Settings form renders with all fields
  - [ ] API key input is masked (password type)
  - [ ] "Save" persists settings to SQLite
  - [ ] "Test Connection" validates API key with OpenRouter
  - [ ] Validation shows error for empty API key
  - [ ] Settings load on component mount
  - [ ] `SettingsForm.test.ts` passes

  **QA Scenarios**:
  ```
  Scenario: Save and load settings
    Tool: Playwright
    Preconditions: App running on Settings screen
    Steps:
      1. Enter API key in password field
      2. Select model from dropdown
      3. Set default question count to 15
      4. Click "Save"
      5. Reload app
      6. Verify settings are restored
    Expected Result: Settings persist across app restarts
    Evidence: .omo/evidence/task-9-settings-save.png

  Scenario: Test API key connection
    Tool: Playwright
    Preconditions: App running on Settings screen
    Steps:
      1. Enter valid API key
      2. Click "Test Connection"
      3. Verify success message
      4. Enter invalid key
      5. Click "Test Connection"
      6. Verify error message
    Expected Result: Valid key shows success, invalid key shows error
    Evidence: .omo/evidence/task-9-api-test.png
  ```

  **Evidence to Capture**:
  - [ ] Screenshot of Settings form with all fields
  - [ ] Screenshot of success toast after saving
  - [ ] Screenshot of API key validation result

  **Commit**: YES
  - Message: `feat: add settings store and form component`
  - Files: `src/lib/settingsStore.ts`, `src/components/SettingsForm.svelte`, `src/components/SettingsForm.test.ts`
  - Pre-commit: `npx vitest run src/components/SettingsForm.test.ts`

- [x] 10. **PDF Export Service**

  **What to do**:
  - Create `src/lib/pdfExport.ts`:
    - `exportTestToPdf(test: Test, includeAnswerKey: boolean): Promise<Uint8Array>`
    - Uses a PDF generation library (e.g., `jsPDF` or `pdfmake` — choose based on Svelte 5 compatibility)
    - Generates PDF with:
      - Title page: test title, topic, difficulty, question count
      - Question pages: numbered questions, MCQ options (A, B, C, D), text response areas
      - Answer key section (if includeAnswerKey=true): correct answers with explanations
      - Footer: page numbers and "Generated by Pressey AI Test Generator"
    - Uses Inter font for body text, JetBrains Mono for code/technical labels
    - Follows Obsidian Studio color scheme (dark background for code blocks if needed)
  - Create `src/lib/pdfExport.test.ts`:
    - Mock test data
    - Verify PDF structure and content
    - Verify answer key is included when requested
  - Add PDF library dependency to `package.json`

  **Must NOT do**:
  - Do NOT generate PDFs in Rust backend (frontend library is sufficient for MVP)
  - Do NOT skip answer key separation (must be on separate pages)
  - Do NOT use system fonts that may not be embedded
  - Do NOT add Word/Google Docs export (deferred)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: PDF generation is complex formatting work with specific layout requirements
  - **Skills**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 6-9)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 15 (Test Review screen uses PDF export)
  - **Blocked By**: Task 2 (package.json setup), Task 5 (types for Test/Question)

  **References**:
  - `src/lib/types.ts` — Test and Question types for PDF content
  - `jsPDF` or `pdfmake` docs: API for creating PDFs with text, tables, and formatting
  - Obsidian Studio design: Typography (Inter, JetBrains Mono), colors
  - `src/lib/pdfExport.test.ts` — PDF structure validation

  **WHY Each Reference Matters**:
  - `types.ts`: PDF content is derived from Test and Question objects
  - PDF library docs: Must understand the exact API for page layout, fonts, and styling
  - Design system: PDF should visually match the app's Obsidian Studio aesthetic
  - Test file: PDF generation is error-prone; must validate structure programmatically

  **Acceptance Criteria**:
  - [ ] PDF contains all questions from the test
  - [ ] MCQ questions show 4 options (A, B, C, D)
  - [ ] Text response questions show blank space for answers
  - [ ] Answer key is on separate pages at the end
  - [ ] PDF metadata includes title and generation date
  - [ ] `pdfExport.test.ts` passes
  - [ ] PDF file size is reasonable (< 1MB for 50 questions)

  **QA Scenarios**:
  ```
  Scenario: Generate PDF with answer key
    Tool: Bash
    Preconditions: Mock test data with 5 questions
    Steps:
      1. Run `npx vitest run src/lib/pdfExport.test.ts`
      2. Verify PDF contains 5 questions
      3. Verify answer key section exists with correct answers
    Expected Result: PDF generated with correct structure
    Evidence: .omo/evidence/task-10-pdf-tests.txt

  Scenario: Real PDF export and preview
    Tool: Playwright
    Preconditions: App with generated test
    Steps:
      1. Navigate to test review
      2. Click "Export to PDF"
      3. Save PDF file
      4. Open PDF in system viewer
      5. Verify content and formatting
    Expected Result: PDF opens correctly with all questions and answer key
    Evidence: .omo/evidence/task-10-pdf-export.pdf
  ```

  **Evidence to Capture**:
  - [ ] Terminal output of `pdfExport.test.ts`
  - [ ] Generated PDF file (sample)
  - [ ] Screenshot of PDF opened in viewer

  **Commit**: YES
  - Message: `feat: add PDF export service with answer key`
  - Files: `src/lib/pdfExport.ts`, `src/lib/pdfExport.test.ts`, `package.json` (PDF library added)
  - Pre-commit: `npx vitest run src/lib/pdfExport.test.ts`

- [x] 11. **Sidebar Navigation and Layout Shell**

  **What to do**:
  - Create `src/App.svelte` — root layout with sidebar navigation:
    - Sidebar: Logo (Pressey AI Test Generator), navigation links (Generate Test, Take Test, Test History, Settings), current route indicator
    - Main content area: renders the active route component
    - Uses simple conditional rendering (`{#if activeRoute === '...'}`) instead of a routing library
    - Responsive: sidebar collapses to hamburger menu on narrow screens (optional for MVP)
    - Uses Obsidian Studio design tokens: dark background, surface-card for sidebar, gold accents for active items
  - Create `src/components/Sidebar.svelte`:
    - Navigation items with icons (Lucide icons: FileQuestion, Play, History, Settings)
    - Active state styling with gold accent
    - Hover effects (lift, shadow)
  - Create `src/components/Layout.svelte`:
    - Two-column layout: sidebar (fixed width) + main content (flexible)
    - Uses CSS Grid or Flexbox with Tailwind
  - Add `lucide-svelte` dependency for icons
  - Create `src/routes/` directory structure

  **Must NOT do**:
  - Do NOT use a routing library (SvelteKit, svelte-spa-router, etc.)
  - Do NOT use multi-window architecture (single window only)
  - Do NOT add animation libraries (keep it simple with CSS transitions)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Core UI layout with navigation and design system implementation
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: Needed for layout architecture, navigation patterns, and responsive design

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 12-16)
  - **Parallel Group**: Wave 3
  - **Blocks**: Tasks 17-20 (integration depends on layout shell)
  - **Blocked By**: Task 2 (Svelte + Tailwind setup), Task 18 (design system components)

  **References**:
  - Obsidian Studio design system: Two-column layout, sidebar styling, surface-card
  - `src/App.svelte` — Root component
  - Lucide Svelte docs: Icon usage in Svelte 5
  - Svelte 5 docs: Conditional rendering with `{#if}` blocks

  **WHY Each Reference Matters**:
  - Design system: Defines the exact layout proportions (sidebar 0.85fr, main 1.35fr)
  - `App.svelte`: The root component must mount the layout and manage route state
  - Lucide Svelte: Standard icon library for Svelte apps
  - Svelte 5: Conditional rendering is the simple alternative to routing libraries

  **Acceptance Criteria**:
  - [ ] Sidebar renders with 4 navigation items
  - [ ] Clicking a navigation item shows the correct route
  - [ ] Active route is highlighted with gold accent
  - [ ] Layout is responsive (sidebar + main content)
  - [ ] No routing library is used
  - [ ] App launches with "Generate Test" as default route

  **QA Scenarios**:
  ```
  Scenario: Navigate between routes
    Tool: Playwright
    Preconditions: App running with sidebar
    Steps:
      1. Click "Generate Test" in sidebar
      2. Verify main content shows Generate Test form
      3. Click "Test History"
      4. Verify main content shows history list
      5. Click "Settings"
      6. Verify main content shows Settings form
    Expected Result: Each route renders correctly with active state
    Evidence: .omo/evidence/task-11-navigation.png
  ```

  **Evidence to Capture**:
  - [ ] Screenshot of sidebar with active state
  - [ ] Screenshot of each route after navigation

  **Commit**: YES
  - Message: `feat: add sidebar navigation and layout shell`
  - Files: `src/App.svelte`, `src/components/Sidebar.svelte`, `src/components/Layout.svelte`
  - Pre-commit: `npm run build`

- [x] 12. **Generate Test Screen (Prompt + File Upload + Config)**

  **What to do**:
  - Create `src/routes/GenerateTest.svelte`:
    - Header: "Generate Test" with micro-label (JetBrains Mono, uppercase)
    - Text area: Large prompt input for topic/description
    - File upload section: Drag-and-drop zone or "Upload File" button (delegates to `fileUpload.ts`)
    - Configuration panel:
      - Question count: number input (1-50, default from settings)
      - MCQ percentage: slider (0-100, default from settings)
      - Difficulty: radio buttons (Easy, Medium, Hard, default from settings)
      - Topic: text input (auto-filled from prompt if detected)
    - "Generate Test" button with command-strip glow (primary action)
    - Loading state: Spinner or progress indicator while AI generates
    - Success state: Show generated test preview (editable questions)
    - Error state: Display error message (API failure, invalid prompt, etc.)
    - Uses `testGenerator.ts` for generation and `dbService.ts` for saving
    - Uses Obsidian Studio design: surface-card for config panel, glass-panel for header
  - Create `src/routes/GenerateTest.test.ts`:
    - Mock file upload, test generation, and database save
    - Test form validation, generation flow, error handling

  **Must NOT do**:
  - Do NOT allow generation without prompt or file (validate before API call)
  - Do NOT skip the preview step (user must see questions before saving)
  - Do NOT use generic form inputs (follow design system styling)
  - Do NOT skip debouncing (prevent double-click on Generate button)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Complex form with multiple inputs, file upload, and dynamic states
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: Needed for form design, validation UX, and generation flow

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 11, 13-16)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 17 (integration)
  - **Blocked By**: Tasks 6-9 (file upload, test generation, database service, settings)

  **References**:
  - `src/lib/testGenerator.ts` — For generation logic
  - `src/lib/fileUpload.ts` — For file upload handling
  - `src/lib/dbService.ts` — For saving generated test
  - `src/lib/settingsStore.ts` — For default configuration values
  - Obsidian Studio design: Form inputs, buttons, loading states, surface-card
  - `src/routes/GenerateTest.test.ts` — Test patterns

  **WHY Each Reference Matters**:
  - `testGenerator.ts`: The screen's primary action calls this service
  - `fileUpload.ts`: File upload is a secondary input method alongside text prompts
  - `dbService.ts`: Generated tests must be saved immediately after preview
  - `settingsStore.ts`: Default values come from user settings
  - Design system: Defines exact styling for all form elements and states

  **Acceptance Criteria**:
  - [ ] Form renders with prompt text area, file upload, and config panel
  - [ ] "Generate" button is disabled when prompt is empty and no file is selected
  - [ ] Config values default to settings values
  - [ ] Generation shows loading state
  - [ ] Generated test preview shows all questions
  - [ ] User can edit questions before saving
  - [ ] Saving stores test in SQLite
  - [ ] Error messages display for API failures
  - [ ] `GenerateTest.test.ts` passes

  **QA Scenarios**:
  ```
  Scenario: Generate test from prompt
    Tool: Playwright
    Preconditions: App with valid API key in settings
    Steps:
      1. Navigate to "Generate Test"
      2. Enter prompt: "Photosynthesis for grade 10 biology"
      3. Set question count to 10
      4. Set MCQ percentage to 70
      5. Set difficulty to "Medium"
      6. Click "Generate Test"
      7. Wait for loading to complete
      8. Verify preview shows 10 questions
      9. Click "Save Test"
      10. Verify success message
    Expected Result: Test generated with correct count, saved to database
    Evidence: .omo/evidence/task-12-generate-test.png

  Scenario: Generate test from file upload
    Tool: Playwright
    Preconditions: App with test .md file
    Steps:
      1. Navigate to "Generate Test"
      2. Upload a .md file about "World War II"
      3. Click "Generate Test"
      4. Verify preview shows questions based on file content
    Expected Result: Test generated from file content
    Evidence: .omo/evidence/task-12-file-generate.png

  Scenario: Handle empty prompt
    Tool: Playwright
    Preconditions: App on Generate Test screen
    Steps:
      1. Leave prompt empty
      2. Click "Generate Test"
      3. Verify error message: "Please enter a prompt or upload a file"
    Expected Result: Generation blocked, error shown
    Evidence: .omo/evidence/task-12-empty-prompt.png
  ```

  **Evidence to Capture**:
  - [ ] Screenshots of Generate Test form (empty, filled, loading, preview, success)
  - [ ] Terminal output of `GenerateTest.test.ts`
  - [ ] Screenshot of error state

  **Commit**: YES
  - Message: `feat: add Generate Test screen with AI integration`
  - Files: `src/routes/GenerateTest.svelte`, `src/routes/GenerateTest.test.ts`
  - Pre-commit: `npx vitest run src/routes/GenerateTest.test.ts`

- [x] 13. **Test History Screen (List, Search, Delete)**

  **What to do**:
  - Create `src/routes/TestHistory.svelte`:
    - Header: "Test History" with micro-label
    - Search bar: Filter tests by title or topic
    - Sort dropdown: By date (newest/oldest), by title, by difficulty
    - Test list: Each test as a surface-card with:
      - Title, topic, difficulty badge, question count, date created
      - "Take Test" button (navigates to Take Test with this test)
      - "Review" button (navigates to Test Review)
      - "Delete" button with destructive styling (red, confirmation modal)
    - Empty state: "No tests yet" with illustration and CTA to Generate Test
    - Uses `dbService.getAllTests()` for data
    - Uses Svelte 5 `$derived` for filtered/sorted list
    - Uses Obsidian Studio design: surface-card, badges, micro-label
  - Create `src/routes/TestHistory.test.ts`:
    - Mock database with sample tests
    - Test search, sort, delete, and empty state

  **Must NOT do**:
  - Do NOT add pagination for MVP (scrollable list is fine for < 100 tests)
  - Do NOT add categories/tags (deferred)
  - Do NOT skip confirmation modal for delete
  - Do NOT use table layout (use card-based list for design system consistency)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: List UI with search, sort, and actions
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: Needed for list design, search UX, and empty state design

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 11-12, 14-16)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 17 (integration)
  - **Blocked By**: Task 8 (dbService for CRUD), Task 11 (layout shell)

  **References**:
  - `src/lib/dbService.ts` — For loading test list
  - `src/lib/types.ts` — Test type for display
  - Obsidian Studio design: surface-card, badges, destructive buttons, empty states
  - Svelte 5 docs: `$derived` for reactive filtering
  - `src/routes/TestHistory.test.ts` — Test patterns

  **WHY Each Reference Matters**:
  - `dbService.ts`: The screen loads all tests from the database
  - `types.ts`: Test properties (title, topic, difficulty) are displayed in the list
  - Design system: Defines card styling, badge colors, and empty state layout
  - Svelte 5: `$derived` is the efficient way to filter/sort reactive lists

  **Acceptance Criteria**:
  - [ ] Test list renders with all saved tests
  - [ ] Search filters tests by title or topic
  - [ ] Sort changes the order of tests
  - [ ] Delete shows confirmation modal and removes test
  - [ ] Empty state shows when no tests exist
  - [ ] Clicking "Take Test" navigates to Take Test with selected test
  - [ ] `TestHistory.test.ts` passes

  **QA Scenarios**:
  ```
  Scenario: View and manage test history
    Tool: Playwright
    Preconditions: App with 3 saved tests
    Steps:
      1. Navigate to "Test History"
      2. Verify 3 tests are displayed
      3. Search for "biology" — verify 1 test shown
      4. Sort by "Newest" — verify order
      5. Click "Delete" on one test
      6. Confirm deletion
      7. Verify test removed from list
    Expected Result: List updates correctly after search, sort, delete
    Evidence: .omo/evidence/task-13-history.png

  Scenario: Empty state
    Tool: Playwright
    Preconditions: Fresh database with no tests
    Steps:
      1. Navigate to "Test History"
      2. Verify "No tests yet" message
      3. Click "Generate Test" CTA
      4. Verify navigation to Generate Test
    Expected Result: Empty state shown with working CTA
    Evidence: .omo/evidence/task-13-empty.png
  ```

  **Evidence to Capture**:
  - [ ] Screenshot of test history list
  - [ ] Screenshot of search results
  - [ ] Screenshot of delete confirmation modal
  - [ ] Screenshot of empty state

  **Commit**: YES
  - Message: `feat: add Test History screen with search and delete`
  - Files: `src/routes/TestHistory.svelte`, `src/routes/TestHistory.test.ts`
  - Pre-commit: `npx vitest run src/routes/TestHistory.test.ts`

- [x] 14. **Take Test Screen (Question Display, Answer Input, Timer)**

  **What to do**:
  - Create `src/routes/TakeTest.svelte`:
    - Header: Test title, topic, difficulty badge, progress indicator (question X of Y)
    - Question display: Large text area with question
    - MCQ mode: 4 radio buttons (A, B, C, D) with options
    - Text response mode: Textarea for written answer
    - Navigation: "Previous" and "Next" buttons (disabled at bounds)
    - Optional timer: Countdown timer (if enabled in settings)
    - Submit button: "Finish Test" (appears on last question, confirmation modal)
    - Scoring: After submit, show score (X/Y correct, percentage)
    - Uses `dbService.getTest()` for questions, `dbService.createAttempt()` for tracking
    - Uses Svelte 5 `$state` for current question index, answers, timer
    - Uses Obsidian Studio design: surface-card for question, code-surface for technical content
  - Create `src/routes/TakeTest.test.ts`:
    - Mock test with questions
    - Test navigation, answer input, submission, scoring

  **Must NOT do**:
  - Do NOT allow skipping questions without warning (show confirmation)
  - Do NOT show correct answers during the test (only in review)
  - Do NOT auto-submit on timer expiry without confirmation (show warning)
  - Do NOT use generic form inputs (follow design system)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Interactive test-taking UI with state management and scoring
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: Needed for test-taking UX, timer design, and scoring display

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 11-13, 15-16)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 17 (integration)
  - **Blocked By**: Tasks 8-9 (dbService for test data, settings for timer defaults)

  **References**:
  - `src/lib/dbService.ts` — For loading test and saving attempt
  - `src/lib/types.ts` — Test, Question, Attempt types
  - `src/lib/settingsStore.ts` — For timer and other settings
    - Obsidian Studio design: Surface cards, radio buttons, progress indicators, timer styling
  - Svelte 5 docs: `$state` for reactive test session state
  - `src/routes/TakeTest.test.ts` — Test patterns

  **WHY Each Reference Matters**:
    - `dbService.ts`: Must load test questions and save the attempt when finished
  - `types.ts`: Question type determines if MCQ or text response is shown
  - `settingsStore.ts`: Timer settings and other preferences affect test UI
  - Design system: Defines exact styling for progress bars, radio buttons, and timer
  - Svelte 5: `$state` is essential for tracking answers and current question index

  **Acceptance Criteria**:
  - [ ] Test renders with first question and navigation
  - [ ] MCQ questions show 4 radio options
  - [ ] Text response questions show textarea
  - [ ] Navigation moves between questions
  - [ ] Timer counts down (if enabled)
  - [ ] Submit shows confirmation modal
  - [ ] Score is calculated and displayed after submit
  - [ ] Attempt is saved to database
  - [ ] `TakeTest.test.ts` passes

  **QA Scenarios**:
  ```
  Scenario: Take a multiple-choice test
    Tool: Playwright
    Preconditions: App with a 5-question MCQ test
    Steps:
      1. Navigate to "Test History"
      2. Click "Take Test" on a biology test
      3. Verify question 1 shows with 4 options
      4. Select option B
      5. Click "Next"
      6. Answer remaining questions
      7. Click "Finish Test"
      8. Confirm submission
      9. Verify score shows (e.g., "4/5 correct, 80%")
    Expected Result: Test completed, score calculated, attempt saved
    Evidence: .omo/evidence/task-14-take-test.png

  Scenario: Navigate back and change answer
    Tool: Playwright
    Preconditions: App with a 3-question test
    Steps:
      1. Answer question 1 with option A
      2. Click "Next" to question 2
      3. Click "Previous" to question 1
      4. Change answer to option C
      5. Click "Next" again
      6. Verify answer is saved
    Expected Result: Answer change persists
    Evidence: .omo/evidence/task-14-navigate.png
  ```

  **Evidence to Capture**:
  - [ ] Screenshot of test-taking interface (question, options, navigation)
  - [ ] Screenshot of score display after submission
  - [ ] Screenshot of timer (if enabled)

  **Commit**: YES
  - Message: `feat: add Take Test screen with scoring`
  - Files: `src/routes/TakeTest.svelte`, `src/routes/TakeTest.test.ts`
  - Pre-commit: `npx vitest run src/routes/TakeTest.test.ts`

- [x] 15. **Test Review Screen (Score, Correct Answers, Explanations)**

  **What to do**:
  - Create `src/routes/TestReview.svelte`:
    - Header: Test title, attempt date, score (large display with percentage)
    - Score breakdown: Correct vs incorrect count, time taken
    - Question list: Each question with:
      - User's answer (highlighted in red if incorrect, green if correct)
      - Correct answer (shown for all questions)
      - Explanation (if provided by AI)
      - Badge: "Correct" or "Incorrect"
    - "Export to PDF" button: Uses `pdfExport.ts` to generate PDF
    - "Retake Test" button: Starts a new attempt
    - Filter: Show all, correct only, incorrect only
    - Uses `dbService.getTest()` and `dbService.getAttempts()` for data
    - Uses Obsidian Studio design: surface-card for questions, badges for correct/incorrect
  - Create `src/routes/TestReview.test.ts`:
    - Mock attempt with responses
    - Test score calculation, answer highlighting, PDF export button

  **Must NOT do**:
  - Do NOT show correct answers before the user has attempted the test
  - Do NOT skip the explanation section (it's valuable for learning)
  - Do NOT add sharing functionality (deferred)
  - Do NOT use table layout (use card-based review)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Review UI with score display, answer comparison, and explanations
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: Needed for review UX, score visualization, and answer highlighting

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 11-14, 16)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 17 (integration)
  - **Blocked By**: Tasks 10 (PDF export), Task 14 (attempt scoring logic)

  **References**:
  - `src/lib/pdfExport.ts` — For PDF export button
  - `src/lib/dbService.ts` — For loading test and attempt data
  - `src/lib/types.ts` — Attempt, Response types
  - Obsidian Studio design: Badge colors, surface-card, score display
  - `src/routes/TestReview.test.ts` — Test patterns

  **WHY Each Reference Matters**:
  - `pdfExport.ts`: The review screen is the primary place for PDF export
  - `dbService.ts`: Must load both the test questions and the user's attempt responses
  - `types.ts`: Response objects contain user answers and correctness flags
  - Design system: Defines color coding for correct (green) and incorrect (red) answers

  **Acceptance Criteria**:
  - [ ] Review shows test title and attempt date
  - [ ] Score is displayed prominently (percentage + fraction)
  - [ ] Each question shows user's answer and correct answer
  - [ ] Correct answers highlighted in green, incorrect in red
  - [ ] Explanations are shown (if available)
  - [ ] "Export to PDF" button generates PDF
  - [ ] "Retake Test" button starts new attempt
  - [ ] Filter toggles between all/correct/incorrect
  - [ ] `TestReview.test.ts` passes

  **QA Scenarios**:
  ```
  Scenario: Review test results
    Tool: Playwright
    Preconditions: App with completed attempt (3 questions, 2 correct)
    Steps:
      1. Navigate to "Test History"
      2. Click "Review" on the test
      3. Verify score shows "2/3 correct, 67%"
      4. Verify correct answers highlighted green
      5. Verify incorrect answers highlighted red
      6. Verify explanations shown
    Expected Result: Review displays all results clearly
    Evidence: .omo/evidence/task-15-review.png

  Scenario: Export to PDF from review
    Tool: Playwright
    Preconditions: App on Test Review screen
    Steps:
      1. Click "Export to PDF"
      2. Verify save dialog opens
      3. Save PDF file
      4. Open PDF and verify content
    Expected Result: PDF generated with questions and answer key
    Evidence: .omo/evidence/task-15-pdf-export.png
  ```

  **Evidence to Capture**:
  - [ ] Screenshot of test review with score and answers
  - [ ] Screenshot of PDF export dialog
  - [ ] Generated PDF file

  **Commit**: YES
  - Message: `feat: add Test Review screen with scoring and PDF export`
  - Files: `src/routes/TestReview.svelte`, `src/routes/TestReview.test.ts`
  - Pre-commit: `npx vitest run src/routes/TestReview.test.ts`

- [x] 16. **Settings Screen (API Key, Model, Defaults, Theme)**

  **What to do**:
  - Create `src/routes/Settings.svelte`:
    - Header: "Settings" with micro-label
    - Sections (each in a surface-card):
      - API Settings: API key input (password), model dropdown, "Test Connection" button
      - Default Preferences: Question count (number), MCQ percentage (slider), difficulty (radio)
      - Appearance: Theme toggle (Dark/Light/System), font size (optional)
      - About: App version, GitHub repo link, license
    - Uses `SettingsForm.svelte` component for API settings
    - Uses `settingsStore.ts` for all settings
    - "Save" button at bottom with command-strip glow
    - "Reset to Defaults" button (secondary)
    - Success toast after saving
    - Uses Obsidian Studio design: surface-card sections, form styling
  - Create `src/routes/Settings.test.ts`:
    - Mock settings store
    - Test save, reset, and validation

  **Must NOT do**:
  - Do NOT add user authentication (not in scope)
  - Do NOT add cloud sync or backup settings (deferred)
  - Do NOT add auto-updater settings (deferred)
  - Do NOT skip the "Reset to Defaults" functionality

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Form-heavy screen with multiple sections and settings
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: Needed for settings organization, form validation, and user feedback

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 11-15)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 17 (integration)
  - **Blocked By**: Task 9 (SettingsForm component), Task 11 (layout shell)

  **References**:
  - `src/components/SettingsForm.svelte` — Reuse for API settings section
  - `src/lib/settingsStore.ts` — For all settings
  - `src/lib/types.ts` — Settings type
  - Obsidian Studio design: Form sections, surface-card, buttons
  - `src/routes/Settings.test.ts` — Test patterns

  **WHY Each Reference Matters**:
  - `SettingsForm.svelte`: The API key section is already built as a component
  - `settingsStore.ts`: All settings are managed through this store
  - `types.ts`: Settings type defines all configurable fields
  - Design system: Defines section styling and form layout

  **Acceptance Criteria**:
  - [ ] Settings screen shows all sections
  - [ ] API key is masked and testable
  - [ ] Default preferences save to SQLite
  - [ ] Theme toggle changes app theme (if implemented)
  - [ ] "Save" button persists all settings
  - [ ] "Reset to Defaults" restores initial values
  - [ ] Success toast shows after saving
  - [ ] `Settings.test.ts` passes

  **QA Scenarios**:
  ```
  Scenario: Save and reset settings
    Tool: Playwright
    Preconditions: App on Settings screen
    Steps:
      1. Enter new API key
      2. Change default question count to 20
      3. Change theme to "Light"
      4. Click "Save"
      5. Verify success toast
      6. Reload app
      7. Verify settings persisted
      8. Click "Reset to Defaults"
      9. Verify defaults restored
    Expected Result: Settings save, persist, and reset correctly
    Evidence: .omo/evidence/task-16-settings.png
  ```

  **Evidence to Capture**:
  - [ ] Screenshot of Settings screen with all sections
  - [ ] Screenshot of success toast after saving
  - [ ] Screenshot of theme change (if applicable)

  **Commit**: YES
  - Message: `feat: add Settings screen with preferences and theme`
  - Files: `src/routes/Settings.svelte`, `src/routes/Settings.test.ts`
  - Pre-commit: `npx vitest run src/routes/Settings.test.ts`

- [x] 17. **App Shell Integration (Routing, State Management, Error Handling)**

  **What to do**:
  - Integrate all routes into `src/App.svelte`:
    - Route state management: `activeRoute` using Svelte 5 `$state`
    - Navigation between routes: `navigateTo(route)` function
    - Route parameters: Pass test ID to TakeTest and TestReview routes
    - Route guards: Prevent direct access to TakeTest without a test ID
  - Create `src/lib/appStore.ts`:
    - Global app state using Svelte 5 `$state`:
      - `activeRoute`: Current route
      - `selectedTestId`: Currently selected test for taking/reviewing
      - `selectedAttemptId`: Currently selected attempt for reviewing
      - `isLoading`: Global loading state
      - `error`: Global error message
    - `navigateTo(route, params?)` function
    - `setError(message)` and `clearError()` functions
  - Add error boundary component `src/components/ErrorBoundary.svelte`:
    - Catches errors from child components
    - Shows user-friendly error message with "Reload" button
    - Logs error details to console
  - Add global loading indicator `src/components/LoadingOverlay.svelte`:
    - Spinner overlay when `isLoading` is true
    - Blocks interaction during critical operations
  - Ensure all routes handle missing data gracefully (e.g., TestHistory with no tests)
  - Create `src/lib/appStore.test.ts`:
    - Test navigation, state updates, error handling

  **Must NOT do**:
  - Do NOT use a routing library (keep conditional rendering)
  - Do NOT use Svelte 4 stores (`writable`, `readable`)
  - Do NOT skip error boundaries for Tauri invoke calls
  - Do NOT allow unhandled promise rejections

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Core architecture for state management, routing, and error handling
  - **Skills**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 18-20)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task F1-F4 (final verification)
  - **Blocked By**: Tasks 11-16 (all routes must exist before integration)

  **References**:
  - `src/App.svelte` — Root component for route integration
  - `src/components/Sidebar.svelte` — Navigation triggers route changes
  - `src/routes/*.svelte` — All route components
  - Svelte 5 docs: `$state` for global state, error boundaries
  - `src/lib/appStore.test.ts` — Test patterns

  **WHY Each Reference Matters**:
  - `App.svelte`: Must orchestrate all routes and state
  - `Sidebar.svelte`: Navigation events trigger route changes via appStore
  - Routes: Each route component must accept parameters (test ID, attempt ID)
  - Svelte 5: `$state` is the modern approach for global state management

  **Acceptance Criteria**:
  - [ ] All routes render correctly via conditional rendering
  - [ ] Route parameters are passed correctly (test ID, attempt ID)
  - [ ] Navigation from sidebar works for all routes
  - [ ] Error boundary catches and displays errors
  - [ ] Loading overlay shows during generation
  - [ ] `appStore.test.ts` passes
  - [ ] No unhandled promise rejections in console

  **QA Scenarios**:
  ```
  Scenario: Full navigation flow
    Tool: Playwright
    Preconditions: App with all routes implemented
    Steps:
      1. Launch app → verify default route (Generate Test)
      2. Navigate to Test History → verify list
      3. Click "Take Test" → verify TakeTest route with test ID
      4. Complete test → verify TestReview route with attempt ID
      5. Navigate to Settings → verify settings form
      6. Navigate back to Generate Test
    Expected Result: All routes work with correct parameters
    Evidence: .omo/evidence/task-17-navigation-flow.png

  Scenario: Error boundary catches error
    Tool: Playwright
    Preconditions: App with error boundary
    Steps:
      1. Trigger an error (e.g., invalid test ID)
      2. Verify error boundary shows friendly message
      3. Click "Reload"
      4. Verify app recovers
    Expected Result: Error handled gracefully, app recovers
    Evidence: .omo/evidence/task-17-error-boundary.png
  ```

  **Evidence to Capture**:
  - [ ] Screenshots of each route after navigation
  - [ ] Screenshot of error boundary
  - [ ] Screenshot of loading overlay

  **Commit**: YES
  - Message: `feat: integrate app shell with routing and error handling`
  - Files: `src/App.svelte`, `src/lib/appStore.ts`, `src/components/ErrorBoundary.svelte`, `src/components/LoadingOverlay.svelte`, `src/lib/appStore.test.ts`
  - Pre-commit: `npx vitest run src/lib/appStore.test.ts`

- [x] 18. **Design System Implementation (Tokens, Components, Typography)**

  **What to do**:
  - Create global CSS file with Tailwind v4 `@theme` block:
    - Map all Obsidian Studio tokens: background, foreground, card, primary, accent, secondary, muted, border, ring, destructive
    - Use OKLCH color values from the design system
    - Define font families: Sora (display), Inter (body), JetBrains Mono (code)
  - Create utility CSS classes:
    - `.studio-bg` — Page background with radial gradient orbs
    - `.glass-panel` — High-emphasis translucent panel
    - `.surface-card` — Default content container with hover shadow
    - `.code-surface` — Dark embedded surface for technical content
    - `.command-strip` — Gradient border for primary actions
    - `.micro-label` — Technical eyebrow label
    - `.section-divider` — Gradient horizontal rule
  - Create reusable Svelte components:
    - `Button.svelte` — Variants: default, outline, ghost, destructive, secondary
    - `Input.svelte` — Text input with embedded styling and focus ring
    - `Textarea.svelte` — Large text area with embedded styling
    - `Card.svelte` — Surface card with title slot and content slot
    - `Badge.svelte` — Mono uppercase compact pills
    - `Toast.svelte` — Success/error notification toast
    - `Modal.svelte` — Confirmation/dialog modal
  - Add font dependencies (Google Fonts or local files)
  - Ensure all components use Tailwind v4 classes
  - Create component tests for each component

  **Must NOT do**:
  - Do NOT use Tailwind v3 config (use v4 @theme CSS)
  - Do NOT skip typography tokens (fonts are critical to the design system)
  - Do NOT use generic names (Button, Card are fine; avoid data/result/item)
  - Do NOT add animation libraries (use CSS transitions only)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Core design system implementation with custom CSS and reusable components
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: Needed for design system implementation, token mapping, and component architecture

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 17, 19-20)
  - **Parallel Group**: Wave 4
  - **Blocks**: All UI tasks (components are used everywhere)
  - **Blocked By**: Task 2 (Tailwind v4 setup)

  **References**:
  - `C:\Users\AdamBurness-Smith\.config\opencode\DESIGN.md` — Obsidian Studio design system
  - Tailwind v4 docs: `@theme` block, `@utility` directives
  - Svelte 5 docs: Component composition with slots
  - `src/components/*.svelte` — Component files
  - `src/components/*.test.ts` — Component tests

  **WHY Each Reference Matters**:
  - DESIGN.md: The single source of truth for all design tokens and patterns
  - Tailwind v4: `@theme` block is the v4 way to define custom tokens
  - Svelte 5: Component slots allow flexible composition (Card with title/content)
  - Component tests: Each component must be verified in isolation

  **Acceptance Criteria**:
  - [ ] All design tokens are defined in CSS
  - [ ] All utility classes work (studio-bg, surface-card, etc.)
  - [ ] All components render correctly in Storybook-like tests
  - [ ] Button variants have correct styling
  - [ ] Inputs have correct focus rings
  - [ ] Cards have hover shadow lift
  - [ ] Typography uses correct fonts (Sora, Inter, JetBrains Mono)
  - [ ] Component tests pass

  **QA Scenarios**:
  ```
  Scenario: Design system components render correctly
    Tool: Playwright
    Preconditions: App with design system components
    Steps:
      1. Navigate to a page with all components visible
      2. Verify buttons have correct colors and hover states
      3. Verify inputs have correct focus rings
      4. Verify cards have hover shadow
      5. Verify typography uses correct fonts
      6. Take screenshots
    Expected Result: All components match design system
    Evidence: .omo/evidence/task-18-design-system.png

  Scenario: Component tests pass
    Tool: Bash
    Preconditions: All components created
    Steps:
      1. Run `npx vitest run src/components/`
      2. Verify all component tests pass
    Expected Result: 100% component tests pass
    Evidence: .omo/evidence/task-18-component-tests.txt
  ```

  **Evidence to Capture**:
  - [ ] Screenshot of component showcase page
  - [ ] Terminal output of component tests
  - [ ] Screenshots of individual components (button, input, card, badge)

  **Commit**: YES
  - Message: `feat: implement Obsidian Studio design system with components`
  - Files: `src/styles/tokens.css`, `src/components/Button.svelte`, `src/components/Input.svelte`, `src/components/Textarea.svelte`, `src/components/Card.svelte`, `src/components/Badge.svelte`, `src/components/Toast.svelte`, `src/components/Modal.svelte`, `src/components/*.test.ts`
  - Pre-commit: `npx vitest run src/components/`

- [x] 19. **Vitest Tests (Components, API Client, Database)**

  **What to do**:
  - Create comprehensive Vitest tests for all modules:
    - Component tests: `Button.test.ts`, `Input.test.ts`, `Card.test.ts`, `Sidebar.test.ts`, `SettingsForm.test.ts`, `GenerateTest.test.ts`, `TakeTest.test.ts`, `TestReview.test.ts`, `TestHistory.test.ts`
    - Service tests: `api.test.ts`, `testGenerator.test.ts`, `pdfExport.test.ts`, `fileUpload.test.ts`, `dbService.test.ts`, `db.test.ts`, `settingsStore.test.ts`, `appStore.test.ts`
    - Integration tests: `app.test.ts` — Full app flow from generation to review
  - Mock Tauri APIs using `vi.mock('@tauri-apps/api')` or `vi.mock('tauri-plugin-sql')`
  - Mock OpenRouter API using `vi.mock` or `msw` (Mock Service Worker)
  - Ensure test coverage targets: 80% for services, 60% for components
  - Add test scripts to `package.json`: `test`, `test:ui`, `test:coverage`
  - Run all tests: `npx vitest run` — verify 100% pass

  **Must NOT do**:
  - Do NOT skip testing error paths (test failures, not just success paths)
  - Do NOT use real API calls in tests (always mock)
  - Do NOT skip component interaction tests (clicks, inputs, navigation)
  - Do NOT use `any` types in test files

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Comprehensive test suite covering all modules
  - **Skills**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 17-18, 20)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task F2 (code quality review)
  - **Blocked By**: Tasks 2 (Vitest setup), all other tasks (tests depend on implementation)

  **References**:
  - `vitest.config.ts` — Test configuration
  - `src/**/*.test.ts` — All test files
  - Vitest docs: Mocking, coverage, UI mode
  - `@testing-library/svelte` docs: Component testing patterns
  - `tauri-plugin-sql` docs: Mocking database for tests

  **WHY Each Reference Matters**:
  - `vitest.config.ts`: Must be configured for Svelte 5 components and jsdom
  - Test files: Each module should have a corresponding test file
  - Vitest docs: Mocking Tauri APIs is critical for unit tests
  - Testing Library: Provides utilities for Svelte component interaction tests

  **Acceptance Criteria**:
  - [ ] All service tests pass (api, testGenerator, pdfExport, fileUpload, dbService, db)
  - [ ] All component tests pass (Button, Input, Card, Sidebar, SettingsForm, routes)
  - [ ] Integration test passes (full app flow)
  - [ ] No test uses real API calls
  - [ ] Test coverage report generated
  - [ ] `npm run test` passes in CI

  **QA Scenarios**:
  ```
  Scenario: All tests pass
    Tool: Bash
    Preconditions: All tests written
    Steps:
      1. Run `npx vitest run`
      2. Verify 100% pass rate
      3. Run `npx vitest run --coverage`
      4. Verify coverage thresholds met
    Expected Result: All tests pass, coverage >= 80% for services
    Evidence: .omo/evidence/task-19-all-tests.txt
  ```

  **Evidence to Capture**:
  - [ ] Terminal output of `npx vitest run`
  - [ ] Coverage report screenshot

  **Commit**: YES
  - Message: `test: add comprehensive Vitest suite for all modules`
  - Files: `src/**/*.test.ts`, `vitest.config.ts`, `package.json` (test scripts)
  - Pre-commit: `npx vitest run`

- [x] 20. **Edge Case Handling and Error Boundaries**

  **What to do**:
  - Add comprehensive error handling to all services:
    - `api.ts`: Handle 401 (invalid key), 429 (rate limit), 500 (server error), timeout, network failure
    - `testGenerator.ts`: Handle malformed AI response, missing fields, wrong question count
    - `fileUpload.ts`: Handle file not found, permission denied, unsupported format, corrupted file
    - `dbService.ts`: Handle connection lost, constraint violation, migration failure
    - `pdfExport.ts`: Handle PDF generation failure, memory issues
  - Add user-friendly error messages to all UI components:
    - `GenerateTest.svelte`: "API key invalid — please check your settings", "Rate limit reached — try again in 60 seconds", "AI response malformed — retrying..."
    - `TakeTest.svelte`: "Test data not found — the test may have been deleted"
    - `TestReview.svelte`: "Attempt not found — please take the test first"
    - `Settings.svelte`: "Connection failed — check your API key and internet"
  - Add loading states and debouncing:
    - Generate Test button: Disabled during generation, spinner shown
    - File upload: Progress indicator for large files
    - Test taking: Save answer state on each navigation
  - Add input validation:
    - API key: Trim whitespace, minimum length check
    - Question count: Range 1-50, integer only
    - MCQ percentage: Range 0-100, integer only
    - Prompt: Minimum 10 characters, maximum 10000 characters
  - Add retry mechanisms:
    - API calls: 3 retries with exponential backoff
    - File upload: 2 retries for network issues
  - Create `src/lib/errorHandling.test.ts`:
    - Test all error scenarios

  **Must NOT do**:
  - Do NOT use generic error messages ("Something went wrong" — be specific)
  - Do NOT skip error logging (log to console for debugging)
  - Do NOT allow infinite retries (cap at 3)
  - Do NOT swallow errors silently (always show UI feedback)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Error handling is critical for user experience and requires thorough testing
  - **Skills**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 17-19)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task F1-F4 (final verification)
  - **Blocked By**: All other tasks (error handling wraps all functionality)

  **References**:
  - `src/lib/api.ts` — API error handling
  - `src/lib/testGenerator.ts` — Generation error handling
  - `src/lib/fileUpload.ts` — File upload error handling
  - `src/lib/dbService.ts` — Database error handling
  - `src/components/ErrorBoundary.svelte` — UI error handling
  - `src/lib/errorHandling.test.ts` — Test file
  - Svelte 5 docs: Error boundaries and reactive error states

  **WHY Each Reference Matters**:
  - `api.ts`: OpenRouter errors are the most common user-facing issues
  - `testGenerator.ts`: AI can return malformed JSON; must handle gracefully
  - `fileUpload.ts`: File I/O errors are common (missing files, permissions)
  - `dbService.ts`: Database errors can corrupt data if not handled
  - ErrorBoundary: Catches unexpected errors and prevents app crashes
  - Svelte 5: Error boundaries are a built-in feature for component error handling

  **Acceptance Criteria**:
  - [ ] All API errors show specific user-friendly messages
  - [ ] All file upload errors show specific messages
  - [ ] All database errors are caught and logged
  - [ ] Generate button is disabled during generation (no double-clicks)
  - [ ] Input validation prevents invalid values
  - [ ] Retry logic works for API calls (max 3 retries)
  - [ ] ErrorBoundary catches unhandled errors
  - [ ] `errorHandling.test.ts` passes

  **QA Scenarios**:
  ```
  Scenario: Handle invalid API key
    Tool: Playwright
    Preconditions: App with invalid API key in settings
    Steps:
      1. Navigate to Generate Test
      2. Enter prompt and click Generate
      3. Verify error message: "API key invalid — please check your settings"
      4. Verify button is re-enabled after error
    Expected Result: Specific error shown, UI recovers
    Evidence: .omo/evidence/task-20-api-error.png

  Scenario: Handle rate limit
    Tool: Playwright
    Preconditions: Mock rate limit response
    Steps:
      1. Trigger generation
      2. Verify error message: "Rate limit reached — try again in 60 seconds"
      3. Verify retry countdown
    Expected Result: User informed of rate limit with retry time
    Evidence: .omo/evidence/task-20-rate-limit.png

  Scenario: Handle empty prompt validation
    Tool: Playwright
    Preconditions: App on Generate Test screen
    Steps:
      1. Leave prompt empty
      2. Click Generate
      3. Verify error: "Please enter a prompt or upload a file (minimum 10 characters)"
    Expected Result: Validation prevents empty prompt
    Evidence: .omo/evidence/task-20-validation.png
  ```

  **Evidence to Capture**:
  - [ ] Screenshots of each error state
  - [ ] Screenshot of loading state
  - [ ] Terminal output of `errorHandling.test.ts`

  **Commit**: YES
  - Message: `feat: add comprehensive error handling and edge cases`
  - Files: `src/lib/errorUtils.ts`, `src/lib/errorHandling.test.ts`, updated error handling in all service files
  - Pre-commit: `npx vitest run src/lib/errorHandling.test.ts`

- [x] 21. **AI Personality Selection and Custom Instructions**

  **What to do**:
  - Add `personality` field to `Settings` type and database schema:
    - Pre-defined personalities: "Friendly Tutor", "Strict Professor", "Encouraging Coach", "Socratic Guide", "Concise Expert"
    - Each personality has a prompt prefix/suffix that affects AI tone
    - "Custom" option with free-text instructions field
  - Update `src/lib/settingsStore.ts` to manage personality settings
  - Update `src/components/SettingsForm.svelte` to add personality selection:
    - Dropdown for pre-defined personalities
    - Textarea for custom instructions (shown when "Custom" is selected)
    - Preview of how the personality affects prompts
  - Update `src/lib/testGenerator.ts` to prepend personality prompt to all OpenRouter requests:
    - `personalityPrompt` field in the prompt template
    - "You are a [personality name]. [custom instructions]. Generate questions in this tone..."
  - Update `src/lib/api.ts` to accept personality parameter
  - Create `src/lib/personalities.ts` — personality definitions and prompt modifiers
  - Add personality to `src/routes/Settings.svelte` UI
  - Create `src/lib/personalities.test.ts` — Vitest tests

  **Must NOT do**:
  - Do NOT make personality affect the test structure (only the tone and wording)
  - Do NOT skip the custom instructions validation (max 500 characters)
  - Do NOT hardcode personality strings in multiple places (use the personalities module)
  - Do NOT add too many pre-defined personalities (keep it to 5 + Custom)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Settings UI enhancement with personality selection and preview
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: Needed for form design, personality preview UX, and settings organization

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 17-20)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task F1-F4 (final verification)
  - **Blocked By**: Tasks 5, 7, 9 (API client, test generator, settings store)

  **References**:
  - `src/lib/settingsStore.ts` — For personality state management
  - `src/lib/types.ts` — Settings type with personality field
  - `src/lib/testGenerator.ts` — For prompt template modification
  - `src/lib/api.ts` — For API client personality parameter
  - `src/components/SettingsForm.svelte` — For personality selection UI
  - `src/routes/Settings.svelte` — For settings screen integration
  - `src/lib/dbService.ts` — For saving personality to database

  **WHY Each Reference Matters**:
  - `settingsStore.ts`: Personality is a user preference that must persist
  - `types.ts`: Personality field must be added to the Settings type
  - `testGenerator.ts`: The personality prompt is prepended to every generation request
  - `api.ts`: Must accept and pass personality to the prompt builder
  - Settings UI: Users must be able to select and preview personality

  **Acceptance Criteria**:
  - [ ] 5 pre-defined personalities are available in settings
  - [ ] Custom personality option with instructions textarea
  - [ ] Personality selection affects test generation tone
  - [ ] Personality persists across app restarts
  - [ ] Custom instructions are limited to 500 characters
  - [ ] Personality prompt is visible in the API request
  - [ ] `personalities.test.ts` passes
  - [ ] Settings UI shows personality preview

  **QA Scenarios**:
  ```
  Scenario: Select and save personality
    Tool: Playwright
    Preconditions: App on Settings screen
    Steps:
      1. Open personality dropdown
      2. Select "Strict Professor"
      3. Click "Save"
      4. Verify success toast
      5. Reload app
      6. Verify "Strict Professor" is still selected
    Expected Result: Personality persists and affects generation
    Evidence: .omo/evidence/task-21-personality.png

  Scenario: Custom personality instructions
    Tool: Playwright
    Preconditions: App on Settings screen
    Steps:
      1. Select "Custom" from dropdown
      2. Enter instructions: "Be very encouraging and use emojis"
      3. Click "Save"
      4. Generate a test
      5. Verify test tone matches custom instructions
    Expected Result: Custom instructions affect AI tone
    Evidence: .omo/evidence/task-21-custom-personality.png
  ```

  **Evidence to Capture**:
  - [ ] Screenshot of personality dropdown in settings
  - [ ] Screenshot of custom instructions textarea
  - [ ] Sample generated test showing personality tone
  - [ ] Terminal output of `personalities.test.ts`

  **Commit**: YES
  - Message: `feat: add AI personality selection and custom instructions`
  - Files: `src/lib/personalities.ts`, `src/lib/personalities.test.ts`, updated settings files, updated testGenerator.ts
  - Pre-commit: `npx vitest run src/lib/personalities.test.ts`

- [x] 22. **AI Explanations for Wrong Answers and Learning Resources**

  **What to do**:
  - Create `src/lib/explanations.ts`:
    - `generateExplanations(attempt: Attempt, test: Test): Promise<Explanation[]>`
    - Sends wrong answers + questions to OpenRouter
    - Prompt: "Explain why the correct answer is right and why the user's answer is wrong. Provide 2-3 learning resources."
    - Returns array of explanations with: questionId, explanation, userMistake, resources[]
    - Validates response with Zod schema
    - Saves explanations to SQLite (new `explanations` table or JSON column in responses)
  - Add `explanations` table to database schema:
    - `explanations` (id INTEGER PRIMARY KEY, attempt_id INTEGER, question_id INTEGER, explanation TEXT, user_mistake TEXT, resources TEXT, FOREIGN KEY(attempt_id, question_id))
  - Update `src/routes/TestReview.svelte`:
    - Add "Get AI Explanations" button (only shown for incorrect answers)
    - Show explanation cards for each wrong answer:
      - Explanation text
      - "What you got wrong" section
      - "Learning Resources" section with clickable links
    - Loading state while fetching explanations
    - Error handling for explanation generation failures
  - Update `src/lib/dbService.ts`:
    - `saveExplanations(explanations: Explanation[]): Promise<void>`
    - `getExplanations(attemptId: number): Promise<Explanation[]>`
  - Create `src/lib/explanations.test.ts`:
    - Mock API responses for explanations
    - Test generation, validation, and database save
  - Update `src/lib/types.ts`:
    - Add `Explanation` type

  **Must NOT do**:
  - Do NOT generate explanations for correct answers (only wrong ones)
  - Do NOT skip Zod validation for explanation responses
  - Do NOT show raw AI output without formatting (clean up markdown, links)
  - Do NOT store explanations without linking to the attempt
  - Do NOT generate explanations automatically without user consent (require button click)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex AI interaction with structured output validation and database persistence
  - **Skills**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 17-20, 21)
  - **Parallel Group**: Wave 4
  - **Blocks**: Task F1-F4 (final verification)
  - **Blocked By**: Tasks 5, 7, 8 (API client, test generator, database service), Task 14 (attempt scoring)

  **References**:
  - `src/lib/api.ts` — For OpenRouter API calls
  - `src/lib/types.ts` — For Explanation type
  - `src/lib/dbService.ts` — For saving explanations
  - `src/routes/TestReview.svelte` — For displaying explanations
  - `src/lib/testGenerator.ts` — For prompt template patterns
  - Zod docs: Schema validation for explanation responses
  - OpenRouter docs: Structured output for explanations

  **WHY Each Reference Matters**:
  - `api.ts`: Explanations are generated via OpenRouter API calls
  - `types.ts`: Explanation type defines the structure of AI responses
  - `dbService.ts`: Explanations must be persisted to SQLite for review
  - `TestReview.svelte`: The primary UI for viewing explanations
  - `testGenerator.ts`: Prompt engineering patterns from test generation apply here
  - Zod: AI explanations can be malformed; validation is critical

  **Acceptance Criteria**:
  - [ ] "Get AI Explanations" button appears for incorrect answers
  - [ ] Explanations are generated only for wrong answers
  - [ ] Each explanation shows: why correct, what user got wrong, resources
  - [ ] Explanations are saved to database
  - [ ] Explanations persist across app restarts
  - [ ] Loading state shown during generation
  - [ ] Error handling for explanation failures
  - [ ] `explanations.test.ts` passes

  **QA Scenarios**:
  ```
  Scenario: Generate AI explanations for wrong answers
    Tool: Playwright
    Preconditions: App with completed attempt (2 wrong answers)
    Steps:
      1. Navigate to Test Review
      2. Verify score shows 2 wrong
      3. Click "Get AI Explanations" button
      4. Wait for loading
      5. Verify explanations appear for both wrong answers
      6. Verify each explanation has: explanation, mistake, resources
    Expected Result: Explanations generated and displayed
    Evidence: .omo/evidence/task-22-explanations.png

  Scenario: Explanations persist after reload
    Tool: Playwright
    Preconditions: App with generated explanations
    Steps:
      1. Navigate to Test Review
      2. Verify explanations are shown
      3. Close app
      4. Reopen app
      5. Navigate to same Test Review
      6. Verify explanations are still shown
    Expected Result: Explanations persist in database
    Evidence: .omo/evidence/task-22-persist.png
  ```

  **Evidence to Capture**:
  - [ ] Screenshot of Test Review with explanations
  - [ ] Screenshot of explanation card (explanation, mistake, resources)
  - [ ] Screenshot of loading state during explanation generation
  - [ ] Terminal output of `explanations.test.ts`

  **Commit**: YES
  - Message: `feat: add AI explanations for wrong answers with learning resources`
  - Files: `src/lib/explanations.ts`, `src/lib/explanations.test.ts`, `src/routes/TestReview.svelte` (updated), database schema updated
  - Pre-commit: `npx vitest run src/lib/explanations.test.ts`

---

## Final Verification Wave

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.omo/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + linter + `bun test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together). Test edge cases: empty state, invalid input, rapid actions. Save to `.omo/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built, nothing beyond spec was built. Check "Must NOT do" compliance. Detect cross-task contamination.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `feat: setup Svelte 5 + Tailwind + Vitest infrastructure` — all config files
- **Wave 2**: `feat: add OpenRouter integration, file upload, database layer` — core services
- **Wave 3**: `feat: implement UI screens (generate, take, review, history, settings)` — Svelte components
- **Wave 4**: `feat: integrate app shell, design system, tests, error handling` — integration + polish
- **Wave FINAL**: `chore: final verification and QA evidence` — no code changes

---

## Success Criteria

### Verification Commands
```bash
# Build
npm run build
# Expected: no errors, dist/ generated

# Tauri dev
npm run tauri dev
# Expected: app launches, window title "Pressey AI Test Generator"

# Tests
npx vitest run
# Expected: all tests pass

# Type check
npx tsc --noEmit
# Expected: no type errors

# Lint
npm run lint
# Expected: no lint errors

# Format check
npm run format:check
# Expected: no formatting errors
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] App builds successfully
- [ ] GitHub repo renamed to `Pressey-AI-Test-Generator`
- [ ] QA evidence files exist in `.omo/evidence/`
- [ ] All 4 final verification agents approve
- [ ] AI personality selection works (pre-defined + custom)
- [ ] AI explanations for wrong answers work with learning resources
