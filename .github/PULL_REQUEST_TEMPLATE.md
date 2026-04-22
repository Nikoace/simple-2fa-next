## Summary

<!-- Brief description of what this PR does -->

## Type of change

- [ ] feat: new feature
- [ ] fix: bug fix
- [ ] refactor: code refactor (no behavior change)
- [ ] docs: documentation
- [ ] ci: CI/CD change
- [ ] chore: housekeeping

## Impact / Affected areas

<!-- Which modules, commands, or UI components are affected? -->

## Testing

- [ ] `cargo test` passes locally
- [ ] `bun run test` passes locally
- [ ] `bun run lint:ci` passes
- [ ] Manual testing performed (describe below)

**Manual test steps:**

<!-- e.g., opened app, unlocked, imported .s2fa backup, verified codes displayed -->

## Backup compatibility

<!-- If this PR touches src-tauri/src/crypto/, src-tauri/src/importer/, or the .s2fa file format: -->
- [ ] Does NOT affect .s2fa import/export behavior
- [ ] Does affect .s2fa behavior — legacy_decrypt fixture test updated/passing

## Documentation

- [ ] CHANGELOG entry (handled by release-please via commit message)
- [ ] README updated (if needed)
