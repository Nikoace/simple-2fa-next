use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::error::AppError;

pub mod s3;
pub mod webdav;

#[async_trait]
pub trait SyncProvider: Send + Sync {
    async fn upload(&self, data: &[u8], remote_path: &str) -> Result<(), AppError>;
    async fn download(&self, remote_path: &str) -> Result<Option<Vec<u8>>, AppError>;
    async fn last_modified(&self, remote_path: &str) -> Result<Option<DateTime<Utc>>, AppError>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SyncConfig {
    WebDav {
        url: String,
        username: String,
        password: String,
        #[serde(rename = "remotePath")]
        remote_path: String,
    },
    S3 {
        bucket: String,
        prefix: String,
        region: String,
        #[serde(rename = "accessKey")]
        access_key: String,
        #[serde(rename = "secretKey")]
        secret_key: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub last_sync: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
    pub in_progress: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SyncOutcome {
    Uploaded,
    Downloaded,
    NoOp,
}

pub async fn sync_vault<P, E, I>(
    provider: &P,
    remote_path: &str,
    local_last_modified: Option<DateTime<Utc>>,
    mut export_local: E,
    mut import_remote: I,
) -> Result<SyncOutcome, AppError>
where
    P: SyncProvider,
    E: FnMut() -> Result<Vec<u8>, AppError>,
    I: FnMut(Vec<u8>) -> Result<(), AppError>,
{
    let remote_last_modified = provider.last_modified(remote_path).await?;

    match (local_last_modified, remote_last_modified) {
        (None, None) => Ok(SyncOutcome::NoOp),
        (Some(_), None) => {
            let data = export_local()?;
            provider.upload(&data, remote_path).await?;
            Ok(SyncOutcome::Uploaded)
        }
        (None, Some(_)) => {
            if let Some(bytes) = provider.download(remote_path).await? {
                import_remote(bytes)?;
                Ok(SyncOutcome::Downloaded)
            } else {
                Ok(SyncOutcome::NoOp)
            }
        }
        (Some(local_ts), Some(remote_ts)) if local_ts > remote_ts => {
            let data = export_local()?;
            provider.upload(&data, remote_path).await?;
            Ok(SyncOutcome::Uploaded)
        }
        (Some(local_ts), Some(remote_ts)) if remote_ts > local_ts => {
            if let Some(bytes) = provider.download(remote_path).await? {
                import_remote(bytes)?;
                Ok(SyncOutcome::Downloaded)
            } else {
                Ok(SyncOutcome::NoOp)
            }
        }
        (Some(_), Some(_)) => Ok(SyncOutcome::NoOp),
    }
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};

    use chrono::TimeZone;

    use super::*;

    #[derive(Clone, Default)]
    struct MockProvider {
        remote_last_modified: Option<DateTime<Utc>>,
        remote_payload: Option<Vec<u8>>,
        uploads: Arc<Mutex<Vec<Vec<u8>>>>,
    }

    #[async_trait]
    impl SyncProvider for MockProvider {
        async fn upload(&self, data: &[u8], _remote_path: &str) -> Result<(), AppError> {
            self.uploads
                .lock()
                .expect("uploads lock")
                .push(data.to_vec());
            Ok(())
        }

        async fn download(&self, _remote_path: &str) -> Result<Option<Vec<u8>>, AppError> {
            Ok(self.remote_payload.clone())
        }

        async fn last_modified(
            &self,
            _remote_path: &str,
        ) -> Result<Option<DateTime<Utc>>, AppError> {
            Ok(self.remote_last_modified)
        }
    }

    #[tokio::test]
    async fn sync_uploads_when_local_is_newer() {
        let provider = MockProvider {
            remote_last_modified: Some(Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0).unwrap()),
            remote_payload: None,
            uploads: Arc::new(Mutex::new(Vec::new())),
        };

        let mut imported = Vec::new();
        let result = sync_vault(
            &provider,
            "vault.s2fa",
            Some(Utc.with_ymd_and_hms(2026, 1, 2, 0, 0, 0).unwrap()),
            || Ok(vec![1, 2, 3]),
            |bytes| {
                imported = bytes;
                Ok(())
            },
        )
        .await
        .expect("sync should succeed");

        assert_eq!(result, SyncOutcome::Uploaded);
        assert_eq!(provider.uploads.lock().expect("uploads lock").len(), 1);
        assert!(imported.is_empty());
    }

    #[tokio::test]
    async fn sync_downloads_when_remote_is_newer() {
        let provider = MockProvider {
            remote_last_modified: Some(Utc.with_ymd_and_hms(2026, 1, 2, 0, 0, 0).unwrap()),
            remote_payload: Some(vec![9, 8, 7]),
            uploads: Arc::new(Mutex::new(Vec::new())),
        };

        let mut imported = Vec::new();
        let result = sync_vault(
            &provider,
            "vault.s2fa",
            Some(Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0).unwrap()),
            || Ok(vec![1, 2, 3]),
            |bytes| {
                imported = bytes;
                Ok(())
            },
        )
        .await
        .expect("sync should succeed");

        assert_eq!(result, SyncOutcome::Downloaded);
        assert!(provider.uploads.lock().expect("uploads lock").is_empty());
        assert_eq!(imported, vec![9, 8, 7]);
    }

    #[tokio::test]
    async fn sync_is_noop_when_timestamps_are_equal() {
        let ts = Utc.with_ymd_and_hms(2026, 1, 1, 0, 0, 0).unwrap();
        let provider = MockProvider {
            remote_last_modified: Some(ts),
            remote_payload: Some(vec![9, 8, 7]),
            uploads: Arc::new(Mutex::new(Vec::new())),
        };

        let mut imported = Vec::new();
        let result = sync_vault(
            &provider,
            "vault.s2fa",
            Some(ts),
            || Ok(vec![1, 2, 3]),
            |bytes| {
                imported = bytes;
                Ok(())
            },
        )
        .await
        .expect("sync should succeed");

        assert_eq!(result, SyncOutcome::NoOp);
        assert!(provider.uploads.lock().expect("uploads lock").is_empty());
        assert!(imported.is_empty());
    }
}
