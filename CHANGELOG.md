# Changelog

## [0.1.2](https://github.com/Nikoace/simple-2fa-next/compare/v0.1.1...v0.1.2) (2026-04-29)


### Bug Fixes

* **rust:** move PRAGMA journal_mode=WAL outside migration transaction ([#14](https://github.com/Nikoace/simple-2fa-next/issues/14)) ([39c1451](https://github.com/Nikoace/simple-2fa-next/commit/39c1451e77bb12bc0aef037ab4468ab9d15426de))

## [0.1.1](https://github.com/Nikoace/simple-2fa-next/compare/v0.1.0...v0.1.1) (2026-04-29)


### Features

* **config:** configure updater signing key and endpoint ([76a0f30](https://github.com/Nikoace/simple-2fa-next/commit/76a0f30d9b964bb01d950a5eaa91bfff7808c8b3))
* **frontend,rust,ci:** complete M10 — E2E testing + sync improvements ([e934328](https://github.com/Nikoace/simple-2fa-next/commit/e9343282e0f374b499615b535a18ce7f4562a4ae))
* **frontend,rust:** complete M6 — import/export .s2fa and otpauth URI ([bffd3d6](https://github.com/Nikoace/simple-2fa-next/commit/bffd3d6fbcb12fdf4b2aa689e5780da761297c02))
* **frontend,rust:** complete M7 (groups) and M8 (biometric unlock) with review fixes ([8c5c66f](https://github.com/Nikoace/simple-2fa-next/commit/8c5c66f328418419a8037952217b070a314a71c0))
* **frontend,rust:** complete M9 — cloud sync (WebDAV/S3) with review fixes ([01adfd1](https://github.com/Nikoace/simple-2fa-next/commit/01adfd13c48a6b26df1c9c15f890b5c79771c1d9))
* **frontend:** complete m4 router i18n and pages ([0f974d0](https://github.com/Nikoace/simple-2fa-next/commit/0f974d08478342e9e67ffece9281c4343b61baf7))
* **frontend:** implement m5 account management ui ([7c316f3](https://github.com/Nikoace/simple-2fa-next/commit/7c316f34d379a1507f06fca2181aaa3b37890ae8))
* **rust:** complete M3 — legacy .s2fa v1 import, CI hardening, security fixes ([58acfe2](https://github.com/Nikoace/simple-2fa-next/commit/58acfe28a9530bd123c1cbfee6b2a08fbf8e2e42))
* **rust:** implement M2 TOTP core — DB, crypto, vault commands, accounts CRUD ([9ea645e](https://github.com/Nikoace/simple-2fa-next/commit/9ea645e42631e63369a9d46c244589d130422a78))


### Bug Fixes

* **config:** add deps-dev scope to commitlint; fix biometric test race ([f33024c](https://github.com/Nikoace/simple-2fa-next/commit/f33024c1d696610e6231b5077b891a1be82e4f3a))
* **config:** apply biome + rustfmt formatting ([6a7401d](https://github.com/Nikoace/simple-2fa-next/commit/6a7401d333753ffba1424e93f6e6e2c33da2847d))
* **frontend:** add outline variant to Button component ([3524eba](https://github.com/Nikoace/simple-2fa-next/commit/3524ebacfbff5e3edade387b0380663065e805d5))
* **frontend:** apply M4 code review fixes ([2a1ceb9](https://github.com/Nikoace/simple-2fa-next/commit/2a1ceb9574a208feb66c7268aa76cede7628ead9))
* **frontend:** apply M5 code review fixes ([2525e3e](https://github.com/Nikoace/simple-2fa-next/commit/2525e3e9a5b4ada09186521abe8d05a921124155))
* **frontend:** apply M5 code review fixes round 2 ([131869a](https://github.com/Nikoace/simple-2fa-next/commit/131869a3c0a4a3a4d08c8e3d4d31f3dfc5acedf3))
* **frontend:** fix biome lint — non-null assertions, import order, exclude coverage dir ([e3cf4bd](https://github.com/Nikoace/simple-2fa-next/commit/e3cf4bde4ea1ffa301424fe671f4a5d239926200))
* **frontend:** fix remaining biome format violations in test files ([66f2d13](https://github.com/Nikoace/simple-2fa-next/commit/66f2d134c812c54c3ab1c5dd9ab65c43c99a6c50))
* **frontend:** replace prompt/confirm with inline input and AlertDialog in GroupBar, add error handling ([a679148](https://github.com/Nikoace/simple-2fa-next/commit/a6791486db5701c44158ac41caf889762dfa8feb))
* **frontend:** set staleTime=30s for useGroups, fix Biome import order ([5ef8549](https://github.com/Nikoace/simple-2fa-next/commit/5ef85493ae466550aec8fe71e785a68a16670017))
* **rust:** add vault lock guard to all group commands ([daee7bd](https://github.com/Nikoace/simple-2fa-next/commit/daee7bd5b1e8681df1d40131dd0acf610922ae94))
* **rust:** enable PRAGMA foreign_keys = ON per connection ([3081a28](https://github.com/Nikoace/simple-2fa-next/commit/3081a285efa1189ca73e067c9f0d50f1017e4daa))
* **rust:** fix serde double-option for UpdateAccount.group_id ([c069b8e](https://github.com/Nikoace/simple-2fa-next/commit/c069b8e11b5975120090ba2718f87796721af678))


### Documentation

* **config:** add deps-dev to commit scope list ([5dfb833](https://github.com/Nikoace/simple-2fa-next/commit/5dfb8330ec55c468f15333c584224f6544edfe5c))
* **planning:** add M4 implementation plan — frontend UI + animation + nightly ([c1e4a7b](https://github.com/Nikoace/simple-2fa-next/commit/c1e4a7b8a819e3c0292a4b5f23b86574e00eca99))
* **planning:** add M5-M10 implementation plans for remaining milestones ([eee799c](https://github.com/Nikoace/simple-2fa-next/commit/eee799c0635acb84be85d036b6618e89fb7638a3))
