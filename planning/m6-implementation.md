# M6 实现计划 — 导入 / 导出

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用户能从 `.s2fa` v1/v2 文件、`otpauth://` URI 导入账户；能导出为 `.s2fa` v2 加密备份。

**Architecture:**
- Rust 新增 `commands/import.rs`（IPC 层）、`importer/otpauth.rs`（URI 解析）、`importer/export.rs`（v2 导出）
- Frontend 新增 `ImportDialog`（文件/URI 两种模式 + 预览 + 确认）、`ExportDialog`
- 文件选择器用 `@tauri-apps/plugin-dialog`（`open` / `save`）

**Tech Stack:** Rust `url` crate（otpauth URI 解析）、`@tauri-apps/plugin-dialog`

---

## 前置条件

```bash
bun run test && bun run typecheck   # M5 全绿
cd src-tauri && cargo test
```

---

## 文件清单

| 路径 | 操作 |
|---|---|
| `src-tauri/src/importer/otpauth.rs` | 新建 |
| `src-tauri/src/importer/export.rs` | 新建 |
| `src-tauri/src/importer/mod.rs` | 修改 — 导出新模块 |
| `src-tauri/src/commands/import.rs` | 新建 |
| `src-tauri/src/commands/mod.rs` | 修改 — 注册命令 |
| `src-tauri/src/lib.rs` | 修改 — invoke_handler 注册 |
| `src/lib/tauri.ts` | 修改 — 添加 import/export IPC 绑定 |
| `src/components/import/ImportDialog.tsx` | 新建 |
| `src/components/import/ImportDialog.test.tsx` | 新建 |
| `src/components/import/ExportDialog.tsx` | 新建 |
| `src/components/import/ExportDialog.test.tsx` | 新建 |
| `src/pages/MainPage.tsx` | 修改 — 添加导入/导出入口 |
| `src/i18n/locales/*.json` | 修改 — 补充 import/export 相关 key |

---

## Task 1: Rust — otpauth:// URI 解析

**Files:** `src-tauri/src/importer/otpauth.rs`

TDD 步骤：
- [ ] **写失败测试**（`src-tauri/tests/otpauth.rs` 或 inline `#[cfg(test)]`）
  - 解析标准 URI：`otpauth://totp/GitHub:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&algorithm=SHA1&digits=6&period=30`
  - 验证 name/issuer/secret/algorithm/digits/period 字段提取正确
  - 缺少 secret 时返回 `Err`
  - 非 `otpauth://totp/` 前缀时返回 `Err`
- [ ] **实现 `parse_otpauth_uri(uri: &str) -> Result<ImportAccountItem, AppError>`**
  - 用标准库 URL 解析 or 手动解析 query string
  - label 格式支持 `issuer:name` 和纯 `name`
  - 默认值：algorithm=SHA1, digits=6, period=30
- [ ] **跑测试 → PASS，Commit**

```bash
cd src-tauri && cargo test otpauth
git commit -m "feat(rust): add otpauth:// URI parser"
```

---

## Task 2: Rust — .s2fa v2 导出

**Files:** `src-tauri/src/importer/export.rs`

v2 格式规范：
```
偏移   长度    内容
0      8      magic = b"S2FA_V2\x00"
8      16     Argon2id salt（随机）
24     12     AES-256-GCM nonce（随机）
36     *      AES-256-GCM ciphertext
               plaintext = JSON 数组（同 v1 的账户结构）
```
KDF 参数与 vault 相同（Argon2id m=65536 t=3 p=4）。

TDD 步骤：
- [ ] **写失败测试**：导出后再导入（调 `import_s2fa`），账户数量和字段一致
- [ ] **实现 `export_s2fa(accounts: &[ExportAccount], password: &str) -> Result<Vec<u8>, AppError>`**
  - ExportAccount = {name, issuer, secret_plaintext, algorithm, digits, period}（从 vault 解密 secret 再序列化）
  - 用现有 `kdf::derive_key` + `aead::seal`
- [ ] **跑测试 → PASS，Commit**

```bash
cd src-tauri && cargo test export
git commit -m "feat(rust): add .s2fa v2 export"
```

---

## Task 3: Rust — import/export Tauri 命令

**Files:** `src-tauri/src/commands/import.rs`

命令列表：
- `import_s2fa_file(path: String, password: String) -> Result<ImportPreview, AppError>` — 读文件 bytes + 调 `import_s2fa`
- `commit_import(items: Vec<ImportAccountItem>) -> Result<Vec<AccountWithCode>, AppError>` — 批量 `add_account` + 去重检测
- `parse_otpauth_uri_cmd(uri: String) -> Result<ImportAccountItem, AppError>` — 直接转发
- `export_vault_to_file(path: String, password: String) -> Result<(), AppError>` — 解密所有账户 + `export_s2fa` + 写文件

TDD 步骤：
- [ ] **写失败测试**（integration test with `AppState` mock）
- [ ] **实现并注册到 `invoke_handler`**
- [ ] **跑测试 → PASS，Commit**

```bash
cd src-tauri && cargo test import
git commit -m "feat(rust): add import/export Tauri commands"
```

---

## Task 4: Frontend — tauri.ts 绑定

**Files:** `src/lib/tauri.ts`

- [ ] 添加类型和函数：
  ```ts
  export type ImportAccountItem = { name: string; issuer?: string; secret: string; algorithm: string; digits: number; period: number; };
  export type ImportPreview = { items: ImportAccountItem[]; source_version: number; };
  export const importS2faFile = (path: string, password: string) => invoke<ImportPreview>("import_s2fa_file", { path, password });
  export const commitImport = (items: ImportAccountItem[]) => invoke<AccountWithCode[]>("commit_import", { items });
  export const parseOtpauthUri = (uri: string) => invoke<ImportAccountItem>("parse_otpauth_uri_cmd", { uri });
  export const exportVaultToFile = (path: string, password: string) => invoke<void>("export_vault_to_file", { path, password });
  ```
- [ ] **Commit**

---

## Task 5: Frontend — ImportDialog

**Files:** `src/components/import/ImportDialog.tsx` + `ImportDialog.test.tsx`

TDD 步骤：
- [ ] **写失败测试**
  - 标签页切换：文件 / URI
  - 文件模式：选择文件 → 输入密码 → 点预览 → 账户列表显示 → 勾选 → 确认导入 → invalidate
  - URI 模式：粘贴 URI → 账户预览 → 确认 → invalidate
  - mock `@tauri-apps/plugin-dialog` 和 `@/lib/tauri`
- [ ] **实现**
  - `Tabs` 组件（shadcn）切换文件/URI 模式
  - 文件模式：`Button` 触发 `open({ filters: [{ name: "s2fa", extensions: ["s2fa"] }] })` → 密码输入 → `importS2faFile`
  - URI 模式：`Textarea` 粘贴 → `parseOtpauthUri`
  - 预览：可勾选的账户列表（Checkbox per item）
  - 确认：调 `commitImport(selectedItems)` → `invalidateQueries(["accounts"])` → `onClose`
- [ ] **跑测试 → PASS，Commit**

```bash
git commit -m "feat(frontend): add ImportDialog"
```

---

## Task 6: Frontend — ExportDialog

**Files:** `src/components/import/ExportDialog.tsx` + `ExportDialog.test.tsx`

TDD 步骤：
- [ ] **写失败测试**：输入密码 → 点导出 → mock `save` dialog + `exportVaultToFile` 被调用
- [ ] **实现**
  - 密码输入 + 确认密码（两次一致校验）
  - 点导出 → `save({ filters: [{ name: "s2fa", extensions: ["s2fa"] }] })` → `exportVaultToFile(path, password)`
  - 成功提示（toast 或 inline message）
- [ ] **跑测试 → PASS，Commit**

```bash
git commit -m "feat(frontend): add ExportDialog"
```

---

## Task 7: MainPage / AppShell 集成入口

- [ ] AppShell header 添加 "导入" 和 "导出" 按钮（仅 `vaultStatus === "unlocked"` 时显示）
- [ ] 补充 i18n 键：`import.title`, `import.file_tab`, `import.uri_tab`, `import.preview`, `import.confirm`, `export.title`, `export.password`, `export.submit`
- [ ] **全量测试 → PASS，Typecheck → 0 errors，Commit**

---

## 最终验收

**人工验收清单（dev 模式）：**
- [ ] 导入 `tests/fixtures/legacy_v1_sample.s2fa`（密码 `test123`）→ 3 个账户出现
- [ ] 粘贴 `otpauth://totp/GitHub:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub` → 预览正确 → 导入
- [ ] 导出 vault → 生成 .s2fa 文件 → 再导入 → 账户一致
- [ ] 导入预览可勾选：取消勾选某个账户后，该账户不被导入
