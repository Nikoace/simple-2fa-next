# Contributing to Simple 2FA Next

## Development Setup

```bash
# Prerequisites: Rust (stable), Bun, system WebKit/GTK libs (Linux)
git clone <repo>
cd simple-2fa-next
bun install

# Install git hooks
bunx lefthook install

# Start dev server
bun run tauri dev
```

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/). Every commit must follow:

```
<type>(<scope>): <description>

type: feat | fix | refactor | test | docs | chore | perf | build | ci | revert
scope: rust | frontend | config | infra | deps | docs | release
```

Examples:
```
feat(rust): add biometric unlock via Windows Hello
fix(frontend): prevent countdown ring jitter at period boundary
test(rust): add fixture test for legacy .s2fa v1 decryption
ci: add nightly build workflow
```

Breaking changes: add `!` after type/scope or `BREAKING CHANGE:` in footer.

## Branch Strategy

- `main` — protected, requires CI pass + 1 review
- Feature branches: `feat/<topic>`, `fix/<topic>`
- Never force-push to `main`

## Running Tests

```bash
# Rust
cd src-tauri && cargo test

# Frontend
bun run test
bun run test:coverage

# Lint
bun run lint:ci
cd src-tauri && cargo clippy --all-targets -- -D warnings

# Type check
bun run typecheck
```

Coverage threshold: **80%** for both Rust and frontend (enforced in CI).

## Versioning & Releases

Releases are automated via [release-please](https://github.com/googleapis/release-please). Merging to `main` automatically updates the release PR. Merging the release PR:
1. Bumps `Cargo.toml`, `package.json`, `tauri.conf.json` versions
2. Updates `CHANGELOG.md`
3. Creates a git tag
4. Triggers multi-platform `release.yml` build

## Backup Compatibility

**Any change touching `src-tauri/src/crypto/`, `src-tauri/src/importer/`, or the `.s2fa` file format MUST:**
1. Keep `legacy_s2fa.rs` intact (the v1 decryption path is never modified)
2. Pass the `legacy_decrypt` integration test with the fixture in `tests/fixtures/legacy_v1_sample.s2fa`
3. Add a regression test if introducing a new format version

## Security-Sensitive Areas

Changes to `src-tauri/src/crypto/`, `src-tauri/src/biometric/`, or `src-tauri/src/importer/` require extra CODEOWNERS review. See [SECURITY.md](SECURITY.md) for the vulnerability disclosure policy.
