# M10 实现计划 — E2E 测试 + 发布

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 关键用户流程有 Playwright + tauri-driver E2E 覆盖；前端/Rust 覆盖率均 ≥ 80%；Release Please 驱动版本管理和 changelog；macOS notarize + Windows Authenticode 代码签名就绪；v1.0 正式包可发布。

---

## 前置条件

```bash
bun run test && bun run typecheck   # M9 全绿
cd src-tauri && cargo test
```

---

## 文件清单

| 路径 | 操作 |
|---|---|
| `tests/e2e/vault.spec.ts` | 新建 |
| `tests/e2e/accounts.spec.ts` | 新建 |
| `tests/e2e/import.spec.ts` | 新建 |
| `playwright.config.ts` | 修改 — tauri-driver 配置 |
| `.github/workflows/ci.yml` | 修改 — E2E job + 覆盖率上传 |
| `.github/workflows/release.yml` | 修改 — Release Please + 代码签名 |
| `.release-please-manifest.json` | 新建（或已存在则验证） |
| `release-please-config.json` | 新建 |
| `src-tauri/tauri.conf.json` | 修改 — bundle identifier + signing |

---

## Task 1: Playwright + tauri-driver 环境搭建

- [ ] **安装 tauri-driver**：
  ```bash
  cargo install tauri-driver
  bun add -D @tauri-apps/driver webdriverio
  ```
- [ ] **更新 `playwright.config.ts`**：
  ```ts
  // webServer: tauri-driver 启动 tauri dev build
  // baseURL: tauri:// or http://tauri.localhost
  // 参考 tauri-apps/tauri-driver 官方文档
  ```
- [ ] **验证 `bun run test:e2e` 可启动**（即使没有测试文件也不报错）
- [ ] **Commit**

```bash
git commit -m "test(e2e): set up Playwright with tauri-driver"
```

---

## Task 2: E2E — vault 流程

**Files:** `tests/e2e/vault.spec.ts`

- [ ] **写测试**：
  ```ts
  test("first launch → setup → unlock → lock flow", async ({ page }) => {
    // 1. 打开应用 → 自动跳转 /setup
    // 2. 输入密码 → 点 "创建 Vault" → 跳转主页（空列表）
    // 3. 点 "锁定" → 跳转 /unlock
    // 4. 输入密码 → 解锁 → 主页
    // 5. 刷新 → 仍在主页（已解锁状态保持）
  });

  test("wrong password shows error", async ({ page }) => {
    // 解锁页输入错误密码 → 显示错误信息
  });
  ```
- [ ] **跑测试 → PASS，Commit**

```bash
git commit -m "test(e2e): add vault setup/unlock/lock E2E tests"
```

---

## Task 3: E2E — 账户管理流程

**Files:** `tests/e2e/accounts.spec.ts`

- [ ] **写测试**：
  ```ts
  test("add account → view TOTP code → copy → delete", async ({ page }) => {
    // 解锁 vault
    // 点 "+" → 填写 name="GitHub" secret="JBSWY3DPEHPK3PXP" → 提交
    // 主页看到 "GitHub" 卡片
    // 倒计时环存在（.countdown-ring）
    // 点复制按钮 → 验证剪贴板（或 "已复制" toast）
    // 打开菜单 → 删除 → 确认 → 卡片消失
  });

  test("drag reorder persists after reload", async ({ page }) => {
    // 添加两个账户 A 和 B
    // 拖拽 B 到 A 上面
    // 刷新页面
    // 验证 B 在 A 前面
  });
  ```
- [ ] **跑测试 → PASS，Commit**

---

## Task 4: E2E — 导入流程

**Files:** `tests/e2e/import.spec.ts`

- [ ] **写测试**：
  ```ts
  test("import legacy .s2fa v1 fixture", async ({ page }) => {
    // 解锁 vault
    // 点导入 → 选择 tests/fixtures/legacy_v1_sample.s2fa
    // 输入密码 "test123" → 预览 3 个账户
    // 确认导入 → 主页出现 3 个账户（alice@example.com, bob@example.com, service@corp.example）
  });
  ```
- [ ] **跑测试 → PASS，Commit**

---

## Task 5: 覆盖率达标

- [ ] **前端覆盖率检查**：
  ```bash
  bun run test:coverage
  # 确保 statements/branches/functions/lines 均 ≥ 80%
  ```
  若不足则补单元测试（优先覆盖 stores、hooks、utils）。

- [ ] **Rust 覆盖率**：
  ```bash
  cd src-tauri
  cargo install cargo-llvm-cov
  cargo llvm-cov --all-features --workspace --lcov --output-path lcov.info
  # 检查总覆盖率 ≥ 80%
  ```
  若不足则补 `#[cfg(test)]` 测试（优先覆盖 importer、sync、biometric）。

- [ ] **CI 集成覆盖率上传**（Codecov 或 artifact）：在 `.github/workflows/ci.yml` 添加 coverage job

- [ ] **Commit**

```bash
git commit -m "test: achieve ≥80% coverage frontend and Rust"
```

---

## Task 6: Release Please 配置

**Files:** `release-please-config.json`, `.release-please-manifest.json`

- [ ] **初始化 Release Please**：
  ```json
  // release-please-config.json
  {
    "release-type": "rust",
    "packages": {
      ".": { "release-type": "node", "package-name": "simple-2fa-next" },
      "src-tauri": { "release-type": "rust", "package-name": "simple-2fa-next" }
    },
    "changelog-sections": [
      { "type": "feat", "section": "Features" },
      { "type": "fix", "section": "Bug Fixes" },
      { "type": "perf", "section": "Performance" }
    ]
  }
  ```
- [ ] **更新 `release.yml`**：
  - Release Please Action → 生成 PR + tag
  - tag 触发 Tauri build + notarize + upload to GitHub Release
- [ ] **Commit**

```bash
git commit -m "ci(release): configure Release Please for v1.0 workflow"
```

---

## Task 7: 代码签名配置（文档 + secrets）

- [ ] **macOS notarize**：
  - 在 `tauri.conf.json` 的 `bundle.macOS` 配置 `signingIdentity`
  - CI secrets：`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_ID_PASSWORD`, `APPLE_TEAM_ID`
  - 在 `release.yml` 添加 macOS notarize 步骤（`tauri-action` 已支持）

- [ ] **Windows Authenticode**：
  - CI secrets：`WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD`
  - `tauri.conf.json` 的 `bundle.windows.certificateThumbprint` 或通过 env

- [ ] **验证**：在 CI 中手动触发 `workflow_dispatch` 确认签名步骤不报错（可用 self-hosted runner）

- [ ] **Commit**

```bash
git commit -m "ci(release): add code signing configuration for macOS and Windows"
```

---

## Task 8: 发布 v1.0

- [ ] 确认所有验收条件满足（见下方）
- [ ] 合并 Release Please 生成的 release PR
- [ ] 确认 GitHub Release 自动创建，包含三平台安装包

---

## 最终验收

| 检查项 | 命令 / 方式 |
|---|---|
| 前端测试全绿 | `bun run test` |
| 前端覆盖率 ≥ 80% | `bun run test:coverage` |
| Rust 测试全绿 | `cd src-tauri && cargo test` |
| Rust 覆盖率 ≥ 80% | `cargo llvm-cov` |
| E2E vault 流程 | `bun run test:e2e tests/e2e/vault.spec.ts` |
| E2E accounts 流程 | `bun run test:e2e tests/e2e/accounts.spec.ts` |
| E2E import 流程 | `bun run test:e2e tests/e2e/import.spec.ts` |
| Typecheck | `bun run typecheck` 0 errors |
| Lint | `bun run lint:ci` 零错 |
| Clippy | `cargo clippy -D warnings` |
| nightly 手动触发 | GitHub Actions workflow_dispatch |
| release PR 生成 | Release Please bot |
| 代码签名 | macOS .dmg notarized，Windows .exe signed |
