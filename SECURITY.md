# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | Yes       |
| < 1.0   | Best-effort |

## Reporting a Vulnerability

**Do not report security vulnerabilities via public GitHub Issues.**

Please email security reports to: gordon7970@gmail.com

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (optional)

We will acknowledge receipt within **48 hours** and aim to provide a fix or mitigation within **14 days** for critical issues.

## Security Design Notes

- All account secrets are **never returned to the frontend** — only generated TOTP codes are sent over IPC
- The local database encrypts each secret individually with the vault key (AES-256-GCM)
- The vault key is derived from the master password via Argon2id (m=64 MiB, t=3, p=4)
- Backup files use the `.s2fa` format with AES-256-GCM + Argon2id
- Memory holding the vault key uses `secrecy::SecretBox` + `zeroize` to minimize exposure
- The app is fully offline — no network connections are made unless cloud sync is explicitly configured
