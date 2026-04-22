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
