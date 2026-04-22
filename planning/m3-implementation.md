# M3 实现计划 — 旧备份兼容 + 依赖审计

## 目标

实现 `.s2fa` v1 备份文件的解密兼容层，接入统一导入管道，并将 `cargo-audit` / `cargo-deny`
纳入 CI。**M3 的硬性验收门槛**：`cargo test legacy_decrypt` 通过真实二进制 fixture，
不通过不得合并。

---

## 已有条件

- `tests/fixtures/legacy_v1_sample.s2fa` —— **已生成并提交**，265 字节，包含 3 条账户
  - 密码：`test123`
  - Salt（hex）：`733266615f746573745f73616c742121`（即 ASCII `s2fa_test_salt!!`）
  - Nonce（hex）：`733266615f6e6f6e63652121`（即 ASCII `s2fa_nonce!!`）
  - 账户 1：`{ name: "alice@example.com", issuer: "GitHub", secret: "JBSWY3DPEHPK3PXP" }`
  - 账户 2：`{ name: "bob@example.com", issuer: null, secret: "GEZDGNBVGY3TQOJQ" }`
  - 账户 3：`{ name: "service@corp.example", issuer: "Corp SSO", secret: "MFRA" }`

- `src-tauri/src/crypto/kdf.rs` 的 `derive_key()` 已验证 Argon2id m=65536 t=3 p=4
- `src-tauri/src/crypto/aead.rs` 的 `open()` 已验证 AES-256-GCM

---

## v1 格式规范（完整）

```
偏移  长度   内容
0     8    magic = b"S2FA_ENC"
8     16   Argon2id salt（随机）
24    12   AES-256-GCM nonce（随机）
36    N    AES-256-GCM 密文 + 16B GCM tag
```

KDF：`Argon2id v0x13, m_cost=65536, t_cost=3, p_cost=4, output=32B`

明文 JSON：`[{"name":string,"issuer":string|null,"secret":string}, ...]`（数组，非对象）

**注意**：v1 的 `secret` 字段是 Base32 编码的 TOTP 密钥（如 `JBSWY3DPEHPK3PXP`），
与 M2 accounts 表中 `secret_cipher`（加密 blob）不同——导入时需 `seal(vault_key, decode_base32(secret))`。

---

## v2 格式规范（新版导出，M3 可选实现）

```
偏移  长度   内容
0     8    magic = b"S2FA_ENC"
8     1    version = 0x02
9     1    kdf_id  = 0x01 (Argon2id)
10    4    m_cost (little-endian u32)
14    1    t_cost
15    1    p_cost
16    16   salt
32    12   nonce
44    N    密文 + tag
```

明文 JSON：`{"version":2,"accounts":[{name,issuer,secret,algorithm,digits,period,...}],"groups":[...]}`

**版本分派规则**：读第 9 字节（索引 8）；若等于 `0x02` 走 v2；否则整段按 v1 解析（第 9 字节属于 salt）。

---

## 需要创建/修改的文件

### 1. `src-tauri/src/crypto/legacy_s2fa.rs` ← **新建**

1:1 复刻旧 `crypto.rs` 的解密路径，绝不改动这个文件的解密逻辑。

```rust
use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Nonce};
use argon2::{Argon2, Params, Version};
use serde::{Deserialize, Serialize};
use crate::error::AppError;

const MAGIC: &[u8; 8] = b"S2FA_ENC";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExportAccountV1 {
    pub name: String,
    pub issuer: Option<String>,
    pub secret: String,   // Base32 明文，导入后需立即加密存储
}

/// 解密 v1 格式的 .s2fa 备份。
/// 格式：[8B magic][16B salt][12B nonce][ciphertext+tag]
pub fn decrypt_v1(data: &[u8], password: &str) -> Result<Vec<ExportAccountV1>, AppError> {
    const MIN_LEN: usize = 8 + 16 + 12 + 1;
    if data.len() < MIN_LEN {
        return Err(AppError::Import("file too short".into()));
    }
    if &data[..8] != MAGIC {
        return Err(AppError::Import("invalid magic bytes".into()));
    }

    let salt     = &data[8..24];
    let nonce_b  = &data[24..36];
    let ct       = &data[36..];

    let key = derive_v1_key(password, salt)?;

    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|_| AppError::Crypto("aes init failed".into()))?;
    let nonce = Nonce::from_slice(nonce_b);
    let pt = cipher
        .decrypt(nonce, ct)
        .map_err(|_| AppError::Import("wrong password or corrupted file".into()))?;

    serde_json::from_slice::<Vec<ExportAccountV1>>(&pt)
        .map_err(|e| AppError::Import(format!("json parse failed: {e}")))
}

/// Argon2id KDF — 固定参数，必须与旧版完全一致，禁止修改。
fn derive_v1_key(password: &str, salt: &[u8]) -> Result<[u8; 32], AppError> {
    let params = Params::new(65536, 3, 4, Some(32))
        .map_err(|_| AppError::Crypto("argon2 params".into()))?;
    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0u8; 32];
    argon2
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|_| AppError::Crypto("kdf failed".into()))?;
    Ok(key)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_v1(accounts: &[ExportAccountV1], password: &str) -> Vec<u8> {
        use aes_gcm::aead::KeyInit;
        let salt: [u8; 16] = *b"s2fa_test_salt!!";
        let nonce_b: [u8; 12] = *b"s2fa_nonce!!";
        let key = derive_v1_key(password, &salt).unwrap();
        let pt = serde_json::to_vec(accounts).unwrap();
        let cipher = Aes256Gcm::new_from_slice(&key).unwrap();
        let nonce = Nonce::from_slice(&nonce_b);
        let ct = cipher.encrypt(nonce, pt.as_ref()).unwrap();
        let mut out = b"S2FA_ENC".to_vec();
        out.extend_from_slice(&salt);
        out.extend_from_slice(&nonce_b);
        out.extend_from_slice(&ct);
        out
    }

    fn sample() -> Vec<ExportAccountV1> {
        vec![
            ExportAccountV1 { name: "a".into(), issuer: Some("X".into()), secret: "JBSWY3DPEHPK3PXP".into() },
            ExportAccountV1 { name: "b".into(), issuer: None, secret: "GEZDGNBVGY3TQOJQ".into() },
        ]
    }

    #[test]
    fn roundtrip() {
        let data = make_v1(&sample(), "pw");
        let out = decrypt_v1(&data, "pw").unwrap();
        assert_eq!(out, sample());
    }

    #[test]
    fn wrong_password_errors() {
        let data = make_v1(&sample(), "pw");
        assert!(decrypt_v1(&data, "bad").is_err());
    }

    #[test]
    fn invalid_magic_errors() {
        let mut data = make_v1(&sample(), "pw");
        data[0] = 0xFF;
        assert!(decrypt_v1(&data, "pw").is_err());
    }

    #[test]
    fn too_short_errors() {
        assert!(decrypt_v1(&[0u8; 10], "pw").is_err());
    }

    #[test]
    fn null_issuer_preserved() {
        let accounts = vec![ExportAccountV1 { name: "x".into(), issuer: None, secret: "JBSWY3DP".into() }];
        let data = make_v1(&accounts, "pw");
        let out = decrypt_v1(&data, "pw").unwrap();
        assert!(out[0].issuer.is_none());
    }
}
```

### 2. `src-tauri/src/crypto/mod.rs` ← **修改**

加上：
```rust
pub mod legacy_s2fa;
```

### 3. `src-tauri/src/importer/mod.rs` ← **新建**

```rust
pub mod s2fa;

pub use s2fa::{ImportAccountItem, ImportPreview, import_s2fa};
```

### 4. `src-tauri/src/importer/s2fa.rs` ← **新建**

处理 v1/v2 版本分派，将解密结果转换为可导入的账户列表（不直接写 DB，command 层负责）。

```rust
use crate::{
    crypto::legacy_s2fa::{decrypt_v1, ExportAccountV1},
    error::AppError,
    totp::secret::{decode_base32_lenient, normalize_secret},
};
use serde::{Deserialize, Serialize};

/// 导入管道的中间表示 — 不含密钥，只含解密后的明文字段
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportAccountItem {
    pub name: String,
    pub issuer: Option<String>,
    pub secret_bytes: Vec<u8>,  // 已 Base32 解码的原始密钥字节
    pub algorithm: String,
    pub digits: u8,
    pub period: u32,
}

#[derive(Debug, Serialize)]
pub struct ImportPreview {
    pub items: Vec<ImportAccountItem>,
    pub format: String,   // "v1" | "v2"
}

/// 解析 .s2fa 文件（自动识别 v1/v2），返回待确认的账户列表。
pub fn import_s2fa(data: &[u8], password: &str) -> Result<ImportPreview, AppError> {
    // 版本分派：第 9 字节（索引 8）== 0x02 → v2；否则 → v1
    let is_v2 = data.len() > 8 && data[8] == 0x02;

    if is_v2 {
        import_v2(data, password)
    } else {
        import_v1(data, password)
    }
}

fn import_v1(data: &[u8], password: &str) -> Result<ImportPreview, AppError> {
    let accounts = decrypt_v1(data, password)?;
    let items = accounts
        .into_iter()
        .map(|a| convert_v1_account(a))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(ImportPreview { items, format: "v1".into() })
}

fn convert_v1_account(a: ExportAccountV1) -> Result<ImportAccountItem, AppError> {
    let normalized = normalize_secret(&a.secret);
    let secret_bytes = decode_base32_lenient(&normalized)?;
    Ok(ImportAccountItem {
        name: a.name,
        issuer: a.issuer,
        secret_bytes,
        algorithm: "SHA1".into(),  // v1 固定 SHA1/6/30
        digits: 6,
        period: 30,
    })
}

fn import_v2(data: &[u8], _password: &str) -> Result<ImportPreview, AppError> {
    // v2 解析留待后续实现；当前占位，返回错误
    let _ = data;
    Err(AppError::Import("v2 format not yet supported".into()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::legacy_s2fa::ExportAccountV1;
    use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Nonce};
    use argon2::{Argon2, Params, Version};

    fn make_v1_fixture(accounts: &[ExportAccountV1], password: &str) -> Vec<u8> {
        let salt: [u8; 16] = *b"s2fa_test_salt!!";
        let nonce_b: [u8; 12] = *b"s2fa_nonce!!";
        let params = Params::new(65536, 3, 4, Some(32)).unwrap();
        let argon2 = Argon2::new(argon2::Algorithm::Argon2id, Version::V0x13, params);
        let mut key = [0u8; 32];
        argon2.hash_password_into(password.as_bytes(), &salt, &mut key).unwrap();
        let pt = serde_json::to_vec(accounts).unwrap();
        let cipher = Aes256Gcm::new_from_slice(&key).unwrap();
        let nonce = Nonce::from_slice(&nonce_b);
        let ct = cipher.encrypt(nonce, pt.as_ref()).unwrap();
        let mut out = b"S2FA_ENC".to_vec();
        out.extend_from_slice(&salt);
        out.extend_from_slice(&nonce_b);
        out.extend_from_slice(&ct);
        out
    }

    #[test]
    fn import_v1_produces_correct_items() {
        let accounts = vec![
            ExportAccountV1 { name: "alice".into(), issuer: Some("GH".into()), secret: "JBSWY3DPEHPK3PXP".into() },
        ];
        let data = make_v1_fixture(&accounts, "pw");
        let preview = import_s2fa(&data, "pw").unwrap();
        assert_eq!(preview.format, "v1");
        assert_eq!(preview.items.len(), 1);
        assert_eq!(preview.items[0].name, "alice");
        assert_eq!(preview.items[0].algorithm, "SHA1");
        assert_eq!(preview.items[0].digits, 6);
        assert_eq!(preview.items[0].period, 30);
        assert!(!preview.items[0].secret_bytes.is_empty());
    }

    #[test]
    fn import_v1_wrong_password_errors() {
        let accounts = vec![
            ExportAccountV1 { name: "x".into(), issuer: None, secret: "JBSWY3DP".into() },
        ];
        let data = make_v1_fixture(&accounts, "correct");
        assert!(import_s2fa(&data, "wrong").is_err());
    }

    #[test]
    fn version_dispatch_v2_prefix_returns_error() {
        // v2 prefix: magic + 0x02 byte
        let mut data = b"S2FA_ENC".to_vec();
        data.push(0x02);
        data.extend_from_slice(&[0u8; 50]);
        // Should route to v2 path and return "not yet supported"
        assert!(import_s2fa(&data, "pw").is_err());
    }
}
```

### 5. `src-tauri/src/lib.rs` ← **修改**

在 `mod` 声明列表加上：
```rust
mod importer;
```

### 6. `src-tauri/tests/legacy_decrypt.rs` ← **新建**（集成测试，必须通过）

```rust
//! Integration test: decrypts the committed .s2fa v1 fixture and asserts known accounts.
//! This test MUST pass before merging any change. Do not delete or modify.

use simple_2fa_next_lib::crypto::legacy_s2fa::decrypt_v1;
use simple_2fa_next_lib::importer::s2fa::import_s2fa;

const FIXTURE: &[u8] = include_bytes!("../tests/fixtures/legacy_v1_sample.s2fa");
const PASSWORD: &str = "test123";

#[test]
fn decrypt_v1_fixture_succeeds() {
    let accounts = decrypt_v1(FIXTURE, PASSWORD)
        .expect("decrypt_v1 must succeed with correct password");
    assert_eq!(accounts.len(), 3, "fixture contains 3 accounts");
}

#[test]
fn fixture_account_names_match() {
    let accounts = decrypt_v1(FIXTURE, PASSWORD).unwrap();
    assert_eq!(accounts[0].name, "alice@example.com");
    assert_eq!(accounts[1].name, "bob@example.com");
    assert_eq!(accounts[2].name, "service@corp.example");
}

#[test]
fn fixture_issuers_match() {
    let accounts = decrypt_v1(FIXTURE, PASSWORD).unwrap();
    assert_eq!(accounts[0].issuer.as_deref(), Some("GitHub"));
    assert!(accounts[1].issuer.is_none());
    assert_eq!(accounts[2].issuer.as_deref(), Some("Corp SSO"));
}

#[test]
fn fixture_secrets_are_valid_base32() {
    use simple_2fa_next_lib::totp::secret::decode_base32_lenient;
    let accounts = decrypt_v1(FIXTURE, PASSWORD).unwrap();
    for acc in &accounts {
        decode_base32_lenient(&acc.secret)
            .unwrap_or_else(|_| panic!("secret '{}' is not valid base32", acc.secret));
    }
}

#[test]
fn wrong_password_fails() {
    assert!(decrypt_v1(FIXTURE, "wrongpassword").is_err());
}

#[test]
fn import_s2fa_fixture_preview() {
    let preview = import_s2fa(FIXTURE, PASSWORD).expect("import must succeed");
    assert_eq!(preview.format, "v1");
    assert_eq!(preview.items.len(), 3);
    // All items must have secret_bytes decoded
    for item in &preview.items {
        assert!(!item.secret_bytes.is_empty());
        assert_eq!(item.algorithm, "SHA1");
        assert_eq!(item.digits, 6);
        assert_eq!(item.period, 30);
    }
}
```

注意 `include_bytes!` 路径：`../tests/fixtures/legacy_v1_sample.s2fa`
相对于 `src-tauri/tests/` 目录，上一级是 `src-tauri/`，再上一级是项目根，所以路径应为：
```
../../../tests/fixtures/legacy_v1_sample.s2fa
```

实际路径从集成测试文件（`src-tauri/tests/legacy_decrypt.rs`）开始：
- `../` → `src-tauri/`（`tests/` 的父目录就是 `src-tauri/`）

> 注：Cargo 集成测试的 `include_bytes!` 宏路径是**相对于 Cargo.toml 所在目录**，
> 不是相对于测试文件。所以：
> ```rust
> const FIXTURE: &[u8] = include_bytes!("../tests/fixtures/legacy_v1_sample.s2fa");
> ```
> 这里 `..` 从 `src-tauri/` 上一级到项目根，对应
> `/home/niko/hobby/simple-2fa-next/tests/fixtures/legacy_v1_sample.s2fa`。

### 7. `src-tauri/Cargo.toml` ← **修改**

在 `[dev-dependencies]` 里追加：
```toml
[dev-dependencies]
proptest = "1"

[[test]]
name = "legacy_decrypt"
path = "tests/legacy_decrypt.rs"
```

### 8. `.github/workflows/ci.yml` ← **修改**

在 Rust job 的 `cargo test` 步骤之后新增两个步骤：

```yaml
      - name: cargo-deny (dependency policy)
        run: |
          cargo install cargo-deny --locked 2>/dev/null || true
          cargo deny check
        working-directory: src-tauri

      - name: cargo-audit (known vulnerabilities)
        run: |
          cargo install cargo-audit --locked 2>/dev/null || true
          cargo audit
        working-directory: src-tauri
```

并在 `src-tauri/` 目录新建 `deny.toml`（见下文）。

### 9. `src-tauri/deny.toml` ← **新建**

```toml
[advisories]
ignore = []

[licenses]
allow = [
  "MIT",
  "Apache-2.0",
  "Apache-2.0 WITH LLVM-exception",
  "MPL-2.0",
  "Unicode-DFS-2016",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "CC0-1.0",
  "OpenSSL",
  "Zlib",
]
exceptions = []

[bans]
multiple-versions = "warn"

[sources]
unknown-registry = "deny"
unknown-git = "deny"
```

---

## 模块注册流程

完成以上文件后，`src-tauri/src/crypto/mod.rs` 变为：

```rust
pub mod aead;
pub mod kdf;
pub mod legacy_s2fa;   // ← 新增

pub use aead::{open, seal};
pub use kdf::derive_key;
```

`src-tauri/src/lib.rs` 变为：

```rust
mod commands;
mod crypto;
mod db;
mod error;
mod importer;   // ← 新增
mod state;
mod totp;
// ... 其余不变
```

---

## TDD 顺序（按此顺序写代码）

1. 写 `legacy_s2fa.rs` 的 tests 模块（先测试，后实现）
2. 实现 `decrypt_v1` + `derive_v1_key`，跑测试通过
3. 写 `importer/s2fa.rs` 的 tests
4. 实现 `import_s2fa` / `import_v1` / `convert_v1_account`，跑测试通过
5. 写集成测试 `tests/legacy_decrypt.rs`（此时应全部通过，因为 fixture 已在 repo 中）
6. 更新 `ci.yml` + `deny.toml`

---

## 验收条件（全部绿才能合并）

| 检查项 | 命令 |
|---|---|
| 集成测试（核心门槛） | `cargo test --test legacy_decrypt` |
| 所有单元测试 | `cargo test` |
| clippy 无 warnings | `cargo clippy --all-targets -- -D warnings` |
| 依赖漏洞 0 高危 | `cargo audit` |
| 依赖许可合规 | `cargo deny check` |
| 前端不受影响 | `bun run test` |

---

## 注意事项

1. `decrypt_v1` 的 KDF 参数（m=65536 t=3 p=4）**绝对不能改**，任何重构都不得修改这几个数字
2. `ExportAccountV1.secret` 是 Base32 字符串，导入到 DB 时需先 `decode_base32_lenient` 再 `seal(vault_key, bytes)`
3. `include_bytes!` 路径从 Cargo.toml 所在目录计算（`src-tauri/`），不是从测试文件
4. `import_v2` 留空实现即可，M6 再补全
5. `cargo-deny` 首次运行可能因某些间接依赖许可报错，将合规许可加入 `allow` 列表即可；不要直接 `ignore` 所有

---

## 文件清单

| 路径 | 操作 |
|---|---|
| `src-tauri/src/crypto/legacy_s2fa.rs` | 新建 |
| `src-tauri/src/crypto/mod.rs` | 修改：加 `pub mod legacy_s2fa` |
| `src-tauri/src/importer/mod.rs` | 新建 |
| `src-tauri/src/importer/s2fa.rs` | 新建 |
| `src-tauri/src/lib.rs` | 修改：加 `mod importer` |
| `src-tauri/tests/legacy_decrypt.rs` | 新建（集成测试） |
| `src-tauri/Cargo.toml` | 修改：加 `[[test]]` 段 |
| `src-tauri/deny.toml` | 新建 |
| `.github/workflows/ci.yml` | 修改：加 cargo-audit / cargo-deny 步骤 |
| `tests/fixtures/legacy_v1_sample.s2fa` | **已存在，不要修改** |
