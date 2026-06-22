<div align="center">

# Pressey — AI test generator

**Generate practice tests on any topic, with your own AI.**

A free, open-source desktop app that turns a topic, a document, or a webpage
into an editable practice test. You bring the AI service, Pressey does the
rest: writing the questions, grading your answers, and exporting the result
as a PDF.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.3.0-blue.svg)](https://github.com/Eld3rForce/Pressey-AI-Test-Generator/releases/latest)
[![Windows](https://img.shields.io/badge/Windows-0078D6?logo=windows&logoColor=white)](https://github.com/Eld3rForce/Pressey-AI-Test-Generator/releases/latest)
[![macOS](https://img.shields.io/badge/macOS-000000?logo=apple&logoColor=white)](https://github.com/Eld3rForce/Pressey-AI-Test-Generator/releases/latest)
[![Linux](https://img.shields.io/badge/Linux-FCC624?logo=linux&logoColor=black)](https://github.com/Eld3rForce/Pressey-AI-Test-Generator/releases/latest)

<!-- TODO: add screenshot -->

</div>

---

## What is Pressey?

Pressey is a desktop app that turns a topic, a document, or a webpage into a
practice test you can edit, take, and save. Pick the AI service you already
use, choose how many questions you want, and Pressey writes the questions,
grades your answers, and exports the result as a PDF. Everything you create
stays on your computer.

## What can it do?

- **Works with the AI you already use.** If you have an account with OpenAI,
  Anthropic, Google Gemini, or you run a local AI on your computer, Pressey
  works with it.
- **Build a test from anything.** Type a topic, upload a file (`.txt`, `.md`,
  or `.pdf`), or paste a URL. Pressey reads the source and turns it into
  questions.
- **Edit anything before you save.** Every question, answer choice, model
  answer, and explanation is editable in place, so you can fix wording,
  correct a wrong answer, or sharpen an explanation without starting over.
- **Show answers when you're ready.** A "Show Answers" button reveals the
  model's answer and explanation for each question on demand, perfect for
  studying after a first attempt.
- **Take a test, leave, come back.** Your in-progress answers are saved
  automatically. Close the app and pick up where you left off later, on the
  same machine.
- **Smart grading for short answers.** Short-answer questions are graded
  against the model answer using AI similarity, not just exact wording. So
  "Paris" gets credit for "the capital of France."
- **Export to PDF.** Save the finished test (with or without an answer key)
  as a PDF in one click. Ready to print, share, or hand out.
- **Everything stays on your computer.** All your tests and answers are
  stored locally on your hard drive. Nothing is sent to a server, only the
  question text is sent to the AI when you generate or grade a test.
- **Customize the AI's personality.** Pick a tone for the AI (formal,
  friendly, socratic, and so on), add your own custom instructions, and
  optionally let the AI search the web for fresh material when generating
  questions.
- **You control the difficulty.** Pick the number of questions (1 to 50),
  choose the mix of multiple-choice vs. short-answer, and set the
  difficulty to Easy, Medium, or Hard.

## How to install

> **You need an API key.** Before you generate your first test, open
> **Settings** inside the app and add an API key for the AI service you
> want to use. If you have an account with OpenRouter, OpenAI, Anthropic,
> or Google Gemini, paste the key there. Ollama users don't need a key at
> all, Pressey connects to a local AI automatically.

Pick whichever option fits how you work.

### Option 1: Use a package manager

The easiest way to install Pressey and keep it up to date. All three of
these are submitted for review and will work as soon as the upstream
maintainers approve them.

#### Windows (winget)

```powershell
winget install Eld3rForce.Pressey-AI-Test-Generator
```

<sub>Submitted as PR to [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs/pull/391360), awaiting review.</sub>

#### Windows (Scoop)

```powershell
scoop install extras/pressey-ai-test-generator
```

<sub>Submitted as PR to [ScoopInstaller/Extras](https://github.com/ScoopInstaller/Extras/pull/18112), awaiting review.</sub>

#### macOS (Homebrew)

```bash
brew install Eld3rForce/homebrew-pressey-ai-test-generator/pressey-ai-test-generator
```

<sub>Installs from a [personal tap](https://github.com/Eld3rForce/homebrew-pressey-ai-test-generator) because the project isn't signed. The official Homebrew Cask repository requires Apple Developer ID signing for all submissions as of 2025.</sub>

### Option 2: Download an installer

Grab a pre-built installer for your platform from the GitHub Releases page:

<https://github.com/Eld3rForce/Pressey-AI-Test-Generator/releases/latest>

Available formats:

- **Windows:** `.msi` (Windows Installer) and `-setup.exe` (NSIS installer)
- **macOS:** `.dmg` for both Intel and Apple Silicon Macs
- **Linux:** `.deb` (Debian/Ubuntu) and `.AppImage` (portable, no install)

> **First-run warnings on unsigned installers.** Pressey isn't code-signed,
> so your operating system will show a warning the first time you launch
> the app. Here's how to get past each one:
>
> - **Windows SmartScreen:** Click **More info**, then click **Run anyway**.
> - **macOS Gatekeeper:** Right-click the app in Finder, choose **Open**,
>   then click **Open** in the confirmation dialog. (Or install via the
>   Homebrew command above to skip this step entirely.)
> - **Linux:** No warnings, just run the file.

### Option 3: Build it yourself

If you'd rather build Pressey from source, see the
[Build it yourself](#build-it-yourself) section below for prerequisites
and the exact commands.

### Option 4: Verify your download

Each release ships with a `SHA256SUMS.txt` file. After downloading an
installer, run this in the folder that contains the installer and the
checksum file:

```bash
sha256sum -c SHA256SUMS.txt
```

A line per file should print `OK`. If any line says `FAILED`, do not run
the installer; delete it and download it again.

## How to use it

1. **Generate.** Type a topic, upload a file, or paste a URL. Pick how
   many questions you want, the mix of multiple-choice vs. short-answer,
   and the difficulty. Click **Generate Test**.
2. **Review.** Read through the questions. Fix any wording, correct
   answers, or explanations that don't sound right. This is the best
   moment to catch a wrong answer before saving.
3. **Save.** When it looks good, save the test to your local library.
4. **Take.** Open a saved test from the library, answer each question,
   and submit. You can leave and come back any time, and partial
   attempts are saved as you go.
5. **Export.** When you're done, save the test (and its answer key) as
   a PDF for printing or sharing.

## Build it yourself

If you want to build Pressey from source, you'll need a few tools first.

### Prerequisites

- **Node.js** 20 or newer
- **Rust** stable (install via [rustup](https://rustup.rs/))
- **Platform toolchains:**
  - **Windows:** Microsoft C++ Build Tools (the
    "Desktop development with C++" workload)
  - **macOS:** Xcode Command Line Tools (`xcode-select --install`)
  - **Linux:** `build-essential` and the `webkit2gtk-4.1` development
    packages

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

The finished installers land in `src-tauri/target/release/bundle/`. The
convenience copies in `bin/<platform>/` are refreshed from there. See
`bin/README.md` for the exact copy commands.

### Troubleshooting

- **Linux build fails with "webkit2gtk not found":** install the
  development package for your distro. On Debian/Ubuntu it's
  `libwebkit2gtk-4.1-dev`. On Fedora it's `webkit2gtk4.1-devel`.
- **macOS build fails with "no SDK":** run `xcode-select --install` and
  accept the license with `sudo xcodebuild -license accept`.
- **Windows build fails with "link.exe not found":** the C++ Build Tools
  aren't on your `PATH`. Open the "x64 Native Tools Command Prompt"
  from the Start menu and run `npm run tauri build` from there.

## For developers

### Quality gates (run before a release)

```bash
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

### Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + the
  [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
  and
  [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
  extensions.

### Project Layout

```text
src/                  Svelte 5 frontend (routes, components, lib)
src-tauri/            Rust backend, tauri.conf.json, capabilities, icons
src-tauri/src/        PDF extraction, SQLite migrations, Tauri commands
bin/                  Local-only convenience folder for built executables (gitignored)
.github/workflows/    CI (lint/typecheck/test) and Release (multi-platform tauri-action)
```

## What's new

### v0.3.0

- **Pull content from a URL.** When enabled in Settings, URLs pasted into
  the test-generation prompt are fetched and their content is added to
  the AI's context. Supports both HTML and PDF URLs.
- **Internal improvements.** GitHub Actions upgraded to Node.js 24.
  Added the `@mozilla/readability` library for cleaner HTML extraction
  and a new `fetch_and_extract_pdf_url` command for PDF URL support.

See [CHANGELOG.md](CHANGELOG.md) for older versions.
