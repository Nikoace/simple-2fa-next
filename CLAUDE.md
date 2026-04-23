# CLAUDE.md — Simple 2FA Next Development Standards

## Project Overview

Simple 2FA Next: a Tauri 2 desktop TOTP authenticator with modern UI.
React 19 + TypeScript + shadcn/ui + Tailwind v4 frontend; Rust + SQLite backend.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Tauri 2 |
| Frontend | React 19 + TypeScript + Vite 7 |
| UI library | shadcn/ui + Tailwind v4 |
| State | Zustand + TanStack Query |
| Routing | TanStack Router |
| Animation | Framer Motion + CSS @property |
| Drag & drop | dnd-kit |
| Lint/Format | Biome |
| i18n | i18next + react-i18next |
| Build | Bun |
| Frontend test | Vitest + @testing-library/react |
| E2E test | Playwright + tauri-driver |
| Backend | Rust (SQLite via rusqlite) |
| TOTP | totp-rs |
| Crypto | aes-gcm + argon2 |
| Backend test | cargo test + proptest |

## Directory Structure

```
simple-2fa-next/
├── src/                  # Frontend
│   ├── components/       # UI components (ui/ = shadcn generated)
│   ├── pages/            # Route pages
│   ├── stores/           # Zustand stores
│   ├── hooks/            # Custom hooks
│   ├── lib/              # Utilities (tauri.ts, utils.ts, ...)
│   ├── i18n/             # Translations
│   ├── styles/           # globals.css (Tailwind v4 @theme)
│   └── test/             # Vitest setup
├── src-tauri/            # Rust backend
│   └── src/
│       ├── commands/     # Tauri IPC commands
│       ├── crypto/       # KDF + AEAD + legacy .s2fa compat
│       ├── totp/         # TOTP generation + secret normalization
│       ├── db/           # SQLite schema + migrations + repo
│       ├── importer/     # .s2fa v1/v2 + otpauth + migration + QR
│       ├── biometric/    # Cross-platform biometric unlock
│       └── sync/         # Cloud sync (WebDAV / S3)
└── tests/fixtures/       # Fixed .s2fa v1 samples for integration tests
```

## Development Rules

### General
- **TDD required**: write tests before implementation
- **Coverage threshold**: 80% (Rust + frontend, enforced in CI)
- **Test code**: do not delete or modify tests without user review
- **No comments** unless the WHY is non-obvious (hidden constraint, workaround, etc.)
- **Branch**: feature/* or fix/* → PR → main

### Rust Standards
- Error handling: `thiserror` custom error types, return `Result<T, E>`
- Serialize: Tauri command I/O must implement `serde::Serialize/Deserialize`
- DB connection: `Mutex<Connection>` held in Tauri State
- Memory: vault key in `secrecy::SecretBox`, zeroize on drop
- **Secret rule**: Tauri commands NEVER return secret plaintext to frontend
- Format: `cargo fmt`; Lint: `cargo clippy -D warnings`

### Frontend Standards
- Never use `fetch()` — use `@tauri-apps/api/core` `invoke()` only
- All Tauri IPC calls centralized in `src/lib/tauri.ts`
- TypeScript strict mode ON
- Path alias `@/` = `src/`
- Theme: CSS variables via Tailwind v4 `@theme`, `<html class="dark">` toggle

### Backup Compatibility (CRITICAL)
- `src-tauri/src/crypto/legacy_s2fa.rs` must remain a 1:1 copy of the v1 format
- Never change the v1 decrypt path (magic=S2FA_ENC, Argon2id m=65536 t=3 p=4, AES-256-GCM)
- The `legacy_decrypt` integration test in `src-tauri/tests/legacy_decrypt.rs` must always pass
- Any change to the .s2fa format must add a new version byte and keep the v1 path untouched

### Commit Messages
```
<type>(<scope>): <description>

type: feat | fix | refactor | test | docs | chore | perf | build | ci | revert
scope: rust | frontend | config | infra | deps | docs | release
```

## Common Commands

```bash
# Dev
bun run tauri dev

# Frontend tests
bun run test
bun run test:coverage

# Rust tests
cd src-tauri && cargo test

# Lint
bun run lint:ci
cd src-tauri && cargo clippy --all-targets -- -D warnings

# Type check
bun run typecheck

# Format
bun run format
cd src-tauri && cargo fmt
```

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **simple-2fa-next** (332 symbols, 672 relationships, 22 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/simple-2fa-next/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/simple-2fa-next/context` | Codebase overview, check index freshness |
| `gitnexus://repo/simple-2fa-next/clusters` | All functional areas |
| `gitnexus://repo/simple-2fa-next/processes` | All execution flows |
| `gitnexus://repo/simple-2fa-next/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

- Re-index: `npx gitnexus analyze`
- Check freshness: `npx gitnexus status`
- Generate docs: `npx gitnexus wiki`

<!-- gitnexus:end -->
