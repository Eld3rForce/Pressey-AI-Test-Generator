# Pressey AI Test Generator

An AI-powered test generator desktop app built with Tauri v2 (Rust backend) and a modern web frontend. Pressey helps you generate, manage, and export tests by combining document ingestion (PDF extraction), LLM-driven test generation (OpenRouter), and a local SQLite store for persistence.

## Features

- Desktop app powered by Tauri v2 + Rust
- Local-first SQLite storage for test cases, documents, and run history
- HTTP fetch from the renderer for OpenRouter API calls
- File dialog support for uploading source documents (PDF, etc.)
- PDF text extraction on the Rust backend
- Frontend-generated PDF test reports

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
