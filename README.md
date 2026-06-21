# Pressey AI Test Generator

A desktop app that turns a topic (or a source document) into an editable,
exportable test in seconds. Built with **Tauri v2** (Rust backend) and a
Svelte 5 + Tailwind v4 frontend, Pressey is local-first, multi-provider,
and ships installers for Windows, macOS, and Linux.

> **Latest release: v0.3.0** — see [What's New](#whats-new-in-v030) below.

---

## Features

- **Multi-provider LLM support** — OpenRouter, OpenAI, Anthropic, Gemini, and
  Ollama, each with its own per-provider API key in Settings.
- **Two question types, fully tunable** — Multiple Choice and Open Response,
  with a per-test MCQ % slider, question count (1–50), and Easy / Medium /
  Hard difficulty.
- **Source material ingestion** — upload `.txt`, `.md`, or `.pdf` files;
  pressey extracts the text on the Rust side and feeds it to the generator.
- **URL ingestion** — paste URLs in the prompt and pressey fetches them
  (HTML via Readability, PDF via a Rust Tauri command) and folds the
  extracted text into the LLM context, so the generator can author
  questions grounded in the linked material. Opt-in per URL and per
  Settings toggle.
- **Inline editing & review** — every generated question, option, answer, and
  explanation is editable in-place before you save; "Show Answers" reveals
  model answers and explanations.
- **Take & resume** — start a test, walk away, and pick up where you left off
  (partial attempts persist locally).
- **Semantic marking** — short-answer responses are graded against the model
  answer with rubric-aware semantic similarity, not just string equality.
- **PDF export** — render finished tests (with or without answers) to PDF
  straight from the frontend.
- **Local-first storage** — SQLite via Tauri, storing tests, attempts, and
  responses on disk; nothing leaves your machine except the LLM request
  itself.
- **Personality & research** — optional system-personality prefix, custom
  instructions, and web research augmentation for prompt construction.

---

## What's New in v0.3.0

- **URL ingestion** — When enabled in Settings, URLs pasted into the
  test-generation prompt are fetched and their content is added to the LLM
  context. Supports HTML and PDF URLs.
- **CI improvements** — GitHub Actions upgraded to Node.js 24; resolved
  lint/typecheck/test issues.
- **Internal** — Added `@mozilla/readability` for content extraction; new
  `fetch_and_extract_pdf_url` Tauri command for PDF URL support.

## What's New in v0.2.6

- **Generate Test layout balance** — the prompt/topic card and the
  Configuration sidebar now share the same height on desktop. The prompt
  textarea flex-grows to fill the card instead of leaving an empty gap
  below the topic input.

## What's New in v0.2.5

- **Topic input** on the Generate Test page is now optional and is sent
  through to the generator when populated.

## What's New in v0.2.4

- **Per-provider API key validation** in the Generate flow.
- **MCQ tooltip** explaining what "Multiple Choice" means.
- **Take Test: resume partial attempt** support.

---

## Installation

Pre-built binaries for Windows (MSI + NSIS), macOS (Intel + Apple Silicon,
`.dmg`) and Linux (`.deb` + `.AppImage`) are published on the GitHub
Releases page:

<https://github.com/Eld3rForce/Pressey-AI-Test-Generator/releases/latest>

Each release ships with a `SHA256SUMS.txt` file — verify the integrity of
the artifact you downloaded with:

```bash
sha256sum -c SHA256SUMS.txt
```

> **First run:** open the app and head to **Settings** to add at least one
> provider API key before generating a test.

---

## How It Works

1. **Generate** — describe a topic (or upload a source file), pick your
   question count, MCQ/text mix, and difficulty, and click **Generate Test**.
   The selected LLM authors the questions, model answers, and explanations.
2. **Review & edit** — tweak wording, fix answers, adjust explanations, or
   discard the whole set and start over.
3. **Save** — store the test in the local library.
4. **Take** — open a test from the library, answer each question, and submit.
   You can leave and resume any time.
5. **Export** — print or save the test (and answer key) as a PDF.

---

## Development

### Prerequisites

- **Node.js** 20+
- **Rust** stable (install via [rustup](https://rustup.rs/))
- **Platform toolchains** — MSVC Build Tools on Windows, Xcode CLT on macOS,
  `build-essential` + `webkit2gtk` on Linux

### Install

```bash
npm install
```

### Run in dev mode (hot reload)

```bash
npm run tauri dev
```

### Type-check, lint, test

```bash
npm run check      # svelte-check + tsc
npm run lint
npm test
```

### Build a release bundle (local)

```bash
npm run tauri build
```

Bundles land in `src-tauri/target/release/bundle/`. The convenience copies
in `bin/<platform>/` are refreshed from there — see `bin/README.md` for the
exact copy commands.

---

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + the
  [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
  and
  [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
  extensions.

---

## Project Layout

```
src/                  Svelte 5 frontend (routes, components, lib)
src-tauri/            Rust backend, tauri.conf.json, capabilities, icons
src-tauri/src/        PDF extraction, SQLite migrations, Tauri commands
bin/                  Local-only convenience folder for built executables (gitignored)
.github/workflows/    CI (lint/typecheck/test) and Release (multi-platform tauri-action)
```
