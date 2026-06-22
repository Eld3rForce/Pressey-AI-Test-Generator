# Pressey v${{ github.ref_name }}

An AI test generator that turns a topic (or a source document) into an editable,
exportable test. Local-first, multi-provider, and ships installers for Windows,
macOS, and Linux.

## How to install

### Use a package manager (recommended)

**Windows (winget):**

```powershell
winget install Eld3rForce.Pressey-AI-Test-Generator
```

**Windows (Scoop):**

```powershell
scoop bucket add extras
scoop install pressey-ai-test-generator
```

**macOS (Homebrew, personal tap — project is unsigned):**

```bash
brew install Eld3rForce/homebrew-pressey-ai-test-generator/pressey-ai-test-generator
```

### Download an installer

Grab the installer for your platform from the assets below.

> **First run warnings** (the project is not code-signed, which is normal for
> open-source indie apps):
>
> - **Windows**: "Windows protected your PC" — click "More info" → "Run anyway".
>   This is a SmartScreen reputation warning, not a virus warning.
> - **macOS**: "Cannot be opened because the developer cannot be verified" —
>   right-click the app in Finder, choose Open, then click Open in the dialog.
>   Or install via the Homebrew command above to avoid this dialog entirely.
> - **Linux**: No warnings. Install and run.

### Verify your download

```bash
sha256sum -c SHA256SUMS.txt
```

### Build from source

See the [README](https://github.com/Eld3rForce/Pressey-AI-Test-Generator#build-it-yourself)
for build instructions.

## What you need before you start

Pressey uses AI to generate and grade questions, so you'll need an account with
at least one supported provider (free tiers work). Open the app, go to Settings,
and paste in your API key. Ollama users don't need a key at all — Pressey
connects to a local AI automatically.

## Full release notes

See the [README](https://github.com/Eld3rForce/Pressey-AI-Test-Generator#whats-new)
for the latest changelog.
