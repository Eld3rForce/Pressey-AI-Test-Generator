# Decisions — Pressey AI Test Generator

## Wave 1 Dispatch Decisions
- Tasks 1+3 combined into single delegation (both touch tauri.conf.json and Cargo.toml)
- Task 2 handles ALL package.json changes (deps, scripts, zod) to avoid conflicts with Task 5
- Task 5 creates types.ts that Task 4 imports — both create different files, safe to parallelize
- Task 4 creates db.ts that imports from types.ts (created by Task 5); both are new file creations

## Architecture Decisions (from plan)
- HTTP: http:default permission for frontend fetch to OpenRouter
- SQL: 	auri-plugin-sql (official plugin, JS API)
- PDF: Frontend generation (jsPDF or similar)
- PDF text extraction: Rust backend via pdf-extract crate
