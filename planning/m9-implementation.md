# M9 实现计划 — 云同步（WebDAV / S3）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 账户数据能通过 WebDAV 或 S3 在多设备间同步；同步格式为加密的 `.s2fa` v2 文件（M6 已实现）；冲突策略 last-write-wins（v1 实现，v2 可升级 3-way merge）。

**Architecture:**
- Rust：`sync/` 模块，`SyncProvider` trait，WebDAV 实现（`reqwest`）+ S3 实现（`object_store`）；`commands/sync.rs` IPC 层
- Frontend：`SyncSettingsPage`（配置 + 状态），AppShell 同步状态 badge

**Dependencies:**
```toml
# src-tauri/Cargo.toml
reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }
object_store = { version = "0.11", features = ["aws"] }
tokio = { version = "1", features = ["rt"] }
serde_json = "1"
```

---

## 前置条件

```bash
bun run test && bun run typecheck   # M8 全绿
cd src-tauri && cargo test
```

---

## 文件清单

| 路径 | 操作 |
|---|---|
| `src-tauri/src/sync/mod.rs` | 新建 — SyncProvider trait + SyncConfig + SyncStatus |
| `src-tauri/src/sync/webdav.rs` | 新建 |
| `src-tauri/src/sync/s3.rs` | 新建 |
| `src-tauri/src/commands/sync.rs` | 新建 |
| `src-tauri/src/commands/mod.rs` | 修改 |
| `src-tauri/src/lib.rs` | 修改 |
| `src-tauri/Cargo.toml` | 修改 |
| `src/lib/tauri.ts` | 修改 |
| `src/pages/SyncSettingsPage.tsx` | 新建（或追加到 SettingsPage） |
| `src/pages/SyncSettingsPage.test.tsx` | 新建 |
| `src/router.tsx` | 修改 — `/settings/sync` 路由 |
| `src/i18n/locales/*.json` | 修改 |

---

## Task 1: Rust — SyncProvider trait + SyncConfig

**Files:** `src-tauri/src/sync/mod.rs`

- [ ] **定义**：
  ```rust
  #[async_trait]
  pub trait SyncProvider: Send + Sync {
      async fn upload(&self, data: &[u8], remote_path: &str) -> Result<(), AppError>;
      async fn download(&self, remote_path: &str) -> Result<Option<Vec<u8>>, AppError>;
      async fn last_modified(&self, remote_path: &str) -> Result<Option<DateTime<Utc>>, AppError>;
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  #[serde(tag = "type")]
  pub enum SyncConfig {
      WebDav { url: String, username: String, password: String, remote_path: String },
      S3 { bucket: String, prefix: String, region: String, access_key: String, secret_key: String },
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct SyncStatus {
      pub last_sync: Option<DateTime<Utc>>,
      pub last_error: Option<String>,
      pub in_progress: bool,
  }
  ```
- [ ] **写失败测试**（unit，mock provider）：sync logic — upload if local newer, download if remote newer, no-op if equal
- [ ] **实现 `sync_vault` 函数**：比较 last_modified → 决定上传/下载/skip → 冲突（两端都更新）→ 按 last_modified 取胜
- [ ] **Commit**

```bash
cd src-tauri && cargo test sync
git commit -m "feat(rust): add SyncProvider trait and sync_vault logic"
```

---

## Task 2: Rust — WebDAV 实现

**Files:** `src-tauri/src/sync/webdav.rs`

- [ ] **写失败测试**（mockito 或 wiremock mock HTTP）：
  - `upload` → PUT request，验证 Content-Type + body
  - `download` → GET request，返回 bytes
  - `last_modified` → PROPFIND request，解析 `getlastmodified`
  - HTTP 401 → `AppError::SyncAuthFailed`
  - HTTP 404 on download → `Ok(None)`
- [ ] **实现 `WebDavProvider`**：
  - `reqwest::Client` with Basic auth
  - upload: `PUT {url}/{remote_path}`
  - download: `GET {url}/{remote_path}`
  - last_modified: `PROPFIND` with `Depth: 0` → parse XML `DAV:getlastmodified`
- [ ] **跑测试 → PASS，Commit**

```bash
git commit -m "feat(rust): add WebDAV sync provider"
```

---

## Task 3: Rust — S3 实现

**Files:** `src-tauri/src/sync/s3.rs`

- [ ] **写失败测试**（`object_store` mock 或 `localstack`）：upload / download / last_modified
- [ ] **实现 `S3Provider`**：
  - `object_store::aws::AmazonS3Builder`
  - upload: `put` + metadata
  - download: `get` → bytes
  - last_modified: `head` → `ObjectMeta.last_modified`
- [ ] **跑测试 → PASS，Commit**

```bash
git commit -m "feat(rust): add S3 sync provider"
```

---

## Task 4: Rust — sync Tauri 命令

**Files:** `src-tauri/src/commands/sync.rs`

命令：
- `configure_sync(config: SyncConfig) -> Result<(), AppError>` — 存储 config 到 AppState + DB（加密存储凭证）
- `sync_now() -> Result<SyncStatus, AppError>` — 调 `sync_vault(provider, vault_data, export_password)` → 更新 AppState SyncStatus
- `get_sync_status() -> Result<SyncStatus, AppError>`
- `disable_sync() -> Result<(), AppError>` — 清除 config

TDD 步骤：
- [ ] **写失败测试**（mock provider）
- [ ] **实现**：sync password 与 vault master password 相同（简化 UX），sync 后 emit Tauri event `sync://status-changed`
- [ ] **注册并跑测试 → PASS，Commit**

```bash
git commit -m "feat(rust): add sync Tauri commands"
```

---

## Task 5: Frontend — tauri.ts + SyncSettingsPage

**Files:** `src/lib/tauri.ts`, `src/pages/SyncSettingsPage.tsx`

- [ ] `tauri.ts` 添加：
  ```ts
  export type SyncConfig =
    | { type: "WebDav"; url: string; username: string; password: string; remotePath: string }
    | { type: "S3"; bucket: string; prefix: string; region: string; accessKey: string; secretKey: string };
  export type SyncStatus = { lastSync: string | null; lastError: string | null; inProgress: boolean };
  export const configureSync = (config: SyncConfig) => invoke<void>("configure_sync", { config });
  export const syncNow = () => invoke<SyncStatus>("sync_now");
  export const getSyncStatus = () => invoke<SyncStatus>("get_sync_status");
  export const disableSync = () => invoke<void>("disable_sync");
  ```
- [ ] **写失败测试** `SyncSettingsPage.test.tsx`：
  - 渲染 provider 选择（WebDAV / S3 / 禁用）
  - 填写 WebDAV 配置 → 点保存 → `configureSync` 被调用
  - "立即同步" → `syncNow` → 状态更新
- [ ] **实现 `SyncSettingsPage`**：
  - Select：禁用 / WebDAV / S3
  - WebDAV form：URL + 用户名 + 密码 + 远程路径
  - S3 form：bucket + prefix + region + access key + secret key
  - 同步状态：上次同步时间 + 错误信息 + 进度 spinner
  - "立即同步" 按钮
- [ ] **路由 `/settings/sync` 注册，AppShell 设置 → 同步入口**
- [ ] **跑测试 → PASS，Commit**

```bash
git commit -m "feat(frontend): add SyncSettingsPage"
```

---

## Task 6: AppShell — 同步状态 badge

- [ ] 监听 `sync://status-changed` Tauri 事件（`@tauri-apps/api/event` `listen`）
- [ ] AppShell header 显示状态图标：同步中（旋转）/ 上次同步时间 / 错误（红色）
- [ ] **补测试 → PASS，Commit**

```bash
git commit -m "feat(frontend): add sync status badge to AppShell"
```

---

## 最终验收

```bash
bun run test:coverage
bun run typecheck
bun run lint:ci
cd src-tauri && cargo test
```

**人工验收清单：**
- [ ] 设置页配置 WebDAV → 保存 → 点立即同步 → 状态变为"刚刚"
- [ ] 在另一设备（或同设备另一 vault）导入生成的 .s2fa 文件 → 账户一致
- [ ] 修改账户 → 手动同步 → 第二设备同步后看到更新
- [ ] 网络断开时同步 → 状态显示错误信息
- [ ] 禁用同步 → badge 消失

> **CI 注意：** WebDAV/S3 集成测试需用 docker-compose 启动 `nginx-webdav` 和 `localstack`，在 CI workflow 中添加 service containers；或用 `mockito` mock HTTP。
