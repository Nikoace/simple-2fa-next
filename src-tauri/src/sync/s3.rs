use std::sync::Arc;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use object_store::{aws::AmazonS3Builder, path::Path, ObjectStore, ObjectStoreExt};

use crate::{error::AppError, sync::SyncProvider};

#[derive(Clone)]
pub struct S3Provider {
    store: Arc<dyn ObjectStore>,
    prefix: String,
}

impl S3Provider {
    pub fn new(
        bucket: impl Into<String>,
        prefix: impl Into<String>,
        region: impl Into<String>,
        access_key: impl Into<String>,
        secret_key: impl Into<String>,
    ) -> Result<Self, AppError> {
        let store = AmazonS3Builder::new()
            .with_bucket_name(bucket.into())
            .with_region(region.into())
            .with_access_key_id(access_key.into())
            .with_secret_access_key(secret_key.into())
            .build()
            .map_err(|e| AppError::Sync(e.to_string()))?;

        Ok(Self {
            store: Arc::new(store),
            prefix: prefix.into(),
        })
    }

    #[cfg(test)]
    fn with_store(store: Arc<dyn ObjectStore>, prefix: impl Into<String>) -> Self {
        Self {
            store,
            prefix: prefix.into(),
        }
    }

    fn object_path(&self, remote_path: &str) -> Result<Path, AppError> {
        let prefix = self.prefix.trim_matches('/');
        let remote = remote_path.trim_start_matches('/');
        let full = if prefix.is_empty() {
            remote.to_string()
        } else {
            format!("{prefix}/{remote}")
        };
        Path::parse(full).map_err(|e| AppError::Sync(e.to_string()))
    }
}

#[async_trait]
impl SyncProvider for S3Provider {
    async fn upload(&self, data: &[u8], remote_path: &str) -> Result<(), AppError> {
        let path = self.object_path(remote_path)?;
        self.store
            .put(&path, data.to_vec().into())
            .await
            .map_err(|e| match e {
                object_store::Error::PermissionDenied { .. } => AppError::SyncAuthFailed,
                other => AppError::Sync(other.to_string()),
            })?;
        Ok(())
    }

    async fn download(&self, remote_path: &str) -> Result<Option<Vec<u8>>, AppError> {
        let path = self.object_path(remote_path)?;
        match self.store.get(&path).await {
            Ok(result) => {
                let bytes = result
                    .bytes()
                    .await
                    .map_err(|e| AppError::Sync(e.to_string()))?;
                Ok(Some(bytes.to_vec()))
            }
            Err(object_store::Error::NotFound { .. }) => Ok(None),
            Err(object_store::Error::PermissionDenied { .. }) => Err(AppError::SyncAuthFailed),
            Err(e) => Err(AppError::Sync(e.to_string())),
        }
    }

    async fn last_modified(&self, remote_path: &str) -> Result<Option<DateTime<Utc>>, AppError> {
        let path = self.object_path(remote_path)?;
        match self.store.head(&path).await {
            Ok(meta) => Ok(Some(meta.last_modified)),
            Err(object_store::Error::NotFound { .. }) => Ok(None),
            Err(object_store::Error::PermissionDenied { .. }) => Err(AppError::SyncAuthFailed),
            Err(e) => Err(AppError::Sync(e.to_string())),
        }
    }
}

#[cfg(test)]
mod tests {
    use object_store::memory::InMemory;

    use super::*;

    #[tokio::test]
    async fn upload_writes_object() {
        let mem = Arc::new(InMemory::new());
        let provider = S3Provider::with_store(mem.clone(), "prefix");

        provider
            .upload(&[1, 2, 3], "vault.s2fa")
            .await
            .expect("upload should succeed");

        let path = Path::parse("prefix/vault.s2fa").expect("valid path");
        let bytes = mem
            .get(&path)
            .await
            .expect("object should exist")
            .bytes()
            .await
            .expect("bytes should load");

        assert_eq!(bytes.to_vec(), vec![1, 2, 3]);
    }

    #[tokio::test]
    async fn download_reads_object() {
        let mem = Arc::new(InMemory::new());
        let path = Path::parse("prefix/vault.s2fa").expect("valid path");
        mem.put(&path, vec![7, 8, 9].into())
            .await
            .expect("seed put should succeed");

        let provider = S3Provider::with_store(mem, "prefix");
        let out = provider
            .download("vault.s2fa")
            .await
            .expect("download should succeed")
            .expect("object should exist");

        assert_eq!(out, vec![7, 8, 9]);
    }

    #[tokio::test]
    async fn last_modified_returns_meta_timestamp() {
        let mem = Arc::new(InMemory::new());
        let path = Path::parse("prefix/vault.s2fa").expect("valid path");
        mem.put(&path, vec![9].into())
            .await
            .expect("seed put should succeed");

        let provider = S3Provider::with_store(mem.clone(), "prefix");
        let ts = provider
            .last_modified("vault.s2fa")
            .await
            .expect("head should succeed")
            .expect("timestamp should exist");

        let head = mem.head(&path).await.expect("head should succeed");
        assert_eq!(ts, head.last_modified);
    }
}
