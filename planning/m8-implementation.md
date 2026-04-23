# M8 实现计划 — 生物识别解锁

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持 Touch ID（macOS）/ Windows Hello（Windows）/ polkit（Linux）作为 vault 解锁方式；生物识别成功后从系统 keychain 取出 vault 密钥，无需用户输入密码。

**Architecture:**
- Rust：`biometric/` 模块封装 `tauri-plugin-biometric`（v2）；vault key 通过 `keyring` crate 存入系统 keychain；新增命令 `biometric_available`, `enable_biometric`, `unlock_with_biometric`, `disable_biometric`
- Frontend：`UnlockPage` 添加生物识别按钮（仅在可用且已启用时显示）；设置页 toggle 开启/关闭；`useSettingsStore` 增加 `biometricEnabled` 字段

**Dependencies:**
```toml
# src-tauri/Cargo.toml
tauri-plugin-biometric = "2"
keyring = "3"
```

---

## 前置条件

```bash
bun run test && bun run typecheck   # M7 全绿
cd src-tauri && cargo test
```

---

## 文件清单

| 路径 | 操作 |
|---|---|
| `src-tauri/src/biometric/mod.rs` | 新建 |
| `src-tauri/src/commands/biometric.rs` | 新建 |
| `src-tauri/src/commands/mod.rs` | 修改 |
| `src-tauri/src/lib.rs` | 修改 — 注册插件 + 命令 |
| `src-tauri/Cargo.toml` | 修改 — 添加依赖 |
| `src-tauri/capabilities/default.json` | 修改 — biometric 权限 |
| `src/lib/tauri.ts` | 修改 — biometric IPC 绑定 |
| `src/stores/settings.ts` | 修改 — biometricEnabled 字段 |
| `src/stores/settings.test.ts` | 修改 |
| `src/pages/UnlockPage.tsx` | 修改 — biometric 按钮 |
| `src/pages/UnlockPage.test.tsx` | 修改 |
| `src/pages/SettingsPage.tsx` | 新建（如尚未存在） |
| `src/pages/SettingsPage.test.tsx` | 新建 |
| `src/i18n/locales/*.json` | 修改 — biometric 相关 key |

---

## Task 1: Rust — biometric 模块

**Files:** `src-tauri/src/biometric/mod.rs`

- [ ] **添加依赖** 到 `Cargo.toml`：`tauri-plugin-biometric = "2"`, `keyring = "3"`
- [ ] **写失败测试**（unit，mock keyring）：
  - `store_vault_key(key: &[u8])` → keyring set
  - `load_vault_key()` → keyring get，key 一致
  - `delete_vault_key()` → keyring delete
- [ ] **实现**：
  ```rust
  // biometric/mod.rs
  pub fn store_vault_key(key: &[u8]) -> Result<(), AppError>     // keyring::Entry::set_password(hex(key))
  pub fn load_vault_key() -> Result<Vec<u8>, AppError>           // keyring::Entry::get_password() → hex decode
  pub fn delete_vault_key() -> Result<(), AppError>              // keyring::Entry::delete_credential()
  ```
  keyring service = `"simple-2fa"`, username = `"vault-key"`
- [ ] **跑测试 → PASS，Commit**

```bash
cd src-tauri && cargo test biometric
git commit -m "feat(rust): add biometric module with keychain vault key storage"
```

---

## Task 2: Rust — biometric Tauri 命令

**Files:** `src-tauri/src/commands/biometric.rs`

命令：
- `biometric_available() -> Result<bool, AppError>` — 调 tauri-plugin-biometric `is_available()`
- `enable_biometric(password: String) -> Result<(), AppError>` — 验证密码解锁 vault → 存储 key 到 keychain
- `unlock_with_biometric() -> Result<(), AppError>` — tauri-plugin-biometric authenticate → load key → 装入 AppState vault
- `disable_biometric() -> Result<(), AppError>` — delete keychain entry

安全约束：
- `enable_biometric` 必须在 vault 已解锁状态下调用（否则返回 `AppError::VaultLocked`）
- `unlock_with_biometric` 如 keychain 无 key 返回 `AppError::BiometricNotEnabled`
- vault key 在 `SecretBox` 中管理，keychain 中存储 hex 字符串（兼容 keyring API）

TDD 步骤：
- [ ] **写失败测试**（mock keychain + mock biometric auth）
- [ ] **实现并注册**
- [ ] **跑测试 → PASS，Commit**

```bash
git commit -m "feat(rust): add biometric Tauri commands"
```

---

## Task 3: Frontend — tauri.ts + settings store

**Files:** `src/lib/tauri.ts`, `src/stores/settings.ts`

- [ ] `tauri.ts` 添加：
  ```ts
  export const biometricAvailable = () => invoke<boolean>("biometric_available");
  export const enableBiometric = (password: string) => invoke<void>("enable_biometric", { password });
  export const unlockWithBiometric = () => invoke<void>("unlock_with_biometric");
  export const disableBiometric = () => invoke<void>("disable_biometric");
  ```
- [ ] `settings.ts` 添加 `biometricEnabled: boolean`（persist 到 `s2fa-settings`）
- [ ] **补测试 → PASS，Commit**

```bash
git commit -m "feat(frontend): add biometric IPC bindings and settings"
```

---

## Task 4: Frontend — UnlockPage 生物识别按钮

**Files:** `src/pages/UnlockPage.tsx` + `UnlockPage.test.tsx`

TDD 步骤：
- [ ] **补失败测试**：
  - `biometric_available=true` 且 `biometricEnabled=true` 时渲染指纹按钮
  - 点击指纹按钮 → 调 `unlockWithBiometric`
  - `biometric_available=false` 时不渲染按钮
- [ ] **实现**：
  - `useEffect` 检查 `biometricAvailable()`
  - 条件渲染 `BiometricButton`（Fingerprint 图标，来自 lucide-react）
  - 点击 → `unlockWithBiometric()` → success → `navigate({ to: "/" })`
- [ ] **跑测试 → PASS，Commit**

```bash
git commit -m "feat(frontend): add biometric unlock button to UnlockPage"
```

---

## Task 5: Frontend — SettingsPage（生物识别 Toggle）

**Files:** `src/pages/SettingsPage.tsx` + `SettingsPage.test.tsx`

如 SettingsPage 不存在则新建，否则追加 section。

- [ ] **写失败测试**：
  - 渲染生物识别 Switch
  - 开启时调 `enableBiometric`（需用户输入密码 → 小 Dialog）
  - 关闭时调 `disableBiometric`
- [ ] **实现**：
  - shadcn Switch 绑定 `biometricEnabled`
  - 开启时弹出密码确认 Dialog → `enableBiometric(password)` → 成功后 `setбиometricEnabled(true)`
  - 关闭时直接 `disableBiometric()` → `setBiometricEnabled(false)`
- [ ] **路由注册** `src/router.tsx` 添加 `/settings` 路由
- [ ] **AppShell** 添加设置入口（齿轮图标）
- [ ] **跑测试 → PASS，Commit**

```bash
git commit -m "feat(frontend): add SettingsPage with biometric toggle"
```

---

## 最终验收

```bash
bun run test:coverage
bun run typecheck
bun run lint:ci
cd src-tauri && cargo test
```

**人工验收清单（dev 模式，需真实硬件生物识别支持）：**
- [ ] 设置页 → 开启生物识别 → 输入密码 → 成功提示
- [ ] 锁定 vault → 解锁页出现指纹图标
- [ ] 点击指纹 → 系统弹出生物识别提示 → 成功后进入主页
- [ ] 生物识别失败（取消）→ 提示错误，密码输入框仍可用
- [ ] 设置页关闭生物识别 → 解锁页指纹按钮消失

> **CI 注意：** 生物识别相关的 Rust integration tests 在 CI 中需 mock keyring（`KEYRING_MOCK=1` 环境变量或 feature flag），不得依赖真实系统凭证存储。
