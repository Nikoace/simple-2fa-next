use async_trait::async_trait;
use chrono::{DateTime, Utc};
use reqwest::{header, Method, StatusCode};

use crate::{error::AppError, sync::SyncProvider};

#[derive(Debug, Clone)]
pub struct WebDavProvider {
    base_url: String,
    username: String,
    password: String,
    client: reqwest::Client,
}

impl WebDavProvider {
    pub fn new(
        url: impl Into<String>,
        username: impl Into<String>,
        password: impl Into<String>,
    ) -> Self {
        Self {
            base_url: url.into().trim_end_matches('/').to_string(),
            username: username.into(),
            password: password.into(),
            client: reqwest::Client::new(),
        }
    }

    fn file_url(&self, remote_path: &str) -> String {
        let path = remote_path.trim_start_matches('/');
        format!("{}/{}", self.base_url, path)
    }

    fn parse_last_modified(xml: &str) -> Option<DateTime<Utc>> {
        let marker = "getlastmodified>";
        let start = xml.find(marker)? + marker.len();
        let end = xml[start..].find('<')? + start;
        let value = xml[start..end].trim();

        if let Ok(dt) = DateTime::parse_from_rfc2822(value) {
            return Some(dt.with_timezone(&Utc));
        }

        let without_weekday = value
            .split_once(',')
            .map(|(_, rhs)| rhs.trim())
            .unwrap_or(value);
        let naive =
            chrono::NaiveDateTime::parse_from_str(without_weekday, "%d %b %Y %H:%M:%S GMT").ok()?;
        Some(naive.and_utc())
    }
}

#[async_trait]
impl SyncProvider for WebDavProvider {
    async fn upload(&self, data: &[u8], remote_path: &str) -> Result<(), AppError> {
        let url = self.file_url(remote_path);
        let response = self
            .client
            .put(url)
            .basic_auth(&self.username, Some(&self.password))
            .header(header::CONTENT_TYPE, "application/octet-stream")
            .body(data.to_vec())
            .send()
            .await
            .map_err(|e| AppError::Sync(e.to_string()))?;

        match response.status() {
            s if s.is_success() => Ok(()),
            StatusCode::UNAUTHORIZED => Err(AppError::SyncAuthFailed),
            s => Err(AppError::Sync(format!("webdav upload failed: {s}"))),
        }
    }

    async fn download(&self, remote_path: &str) -> Result<Option<Vec<u8>>, AppError> {
        let url = self.file_url(remote_path);
        let response = self
            .client
            .get(url)
            .basic_auth(&self.username, Some(&self.password))
            .send()
            .await
            .map_err(|e| AppError::Sync(e.to_string()))?;

        match response.status() {
            StatusCode::NOT_FOUND => Ok(None),
            StatusCode::UNAUTHORIZED => Err(AppError::SyncAuthFailed),
            s if s.is_success() => {
                let bytes = response
                    .bytes()
                    .await
                    .map_err(|e| AppError::Sync(e.to_string()))?;
                Ok(Some(bytes.to_vec()))
            }
            s => Err(AppError::Sync(format!("webdav download failed: {s}"))),
        }
    }

    async fn last_modified(&self, remote_path: &str) -> Result<Option<DateTime<Utc>>, AppError> {
        let url = self.file_url(remote_path);
        let response = self
            .client
            .request(Method::from_bytes(b"PROPFIND").expect("valid method"), url)
            .basic_auth(&self.username, Some(&self.password))
            .header("Depth", "0")
            .header(header::CONTENT_TYPE, "application/xml")
            .body(
                r#"<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:getlastmodified />
  </d:prop>
</d:propfind>"#,
            )
            .send()
            .await
            .map_err(|e| AppError::Sync(e.to_string()))?;

        match response.status() {
            StatusCode::NOT_FOUND => Ok(None),
            StatusCode::UNAUTHORIZED => Err(AppError::SyncAuthFailed),
            s if s.is_success() => {
                let body = response
                    .text()
                    .await
                    .map_err(|e| AppError::Sync(e.to_string()))?;
                Ok(Self::parse_last_modified(&body))
            }
            s => Err(AppError::Sync(format!("webdav propfind failed: {s}"))),
        }
    }
}

#[cfg(test)]
mod tests {
    use wiremock::{
        matchers::{body_bytes, header, method, path},
        Mock, MockServer, ResponseTemplate,
    };

    use super::*;

    fn auth_header(username: &str, password: &str) -> String {
        use base64::{engine::general_purpose::STANDARD, Engine as _};
        format!(
            "Basic {}",
            STANDARD.encode(format!("{username}:{password}"))
        )
    }

    #[tokio::test]
    async fn upload_sends_put_with_body_and_content_type() {
        let server = MockServer::start().await;
        Mock::given(method("PUT"))
            .and(path("/remote/vault.s2fa"))
            .and(header("content-type", "application/octet-stream"))
            .and(header("authorization", &auth_header("u", "p")))
            .and(body_bytes(vec![1u8, 2, 3]))
            .respond_with(ResponseTemplate::new(201))
            .mount(&server)
            .await;

        let provider = WebDavProvider::new(format!("{}/remote", server.uri()), "u", "p");
        provider
            .upload(&[1, 2, 3], "vault.s2fa")
            .await
            .expect("upload should succeed");
    }

    #[tokio::test]
    async fn download_returns_bytes_on_success() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/remote/vault.s2fa"))
            .respond_with(ResponseTemplate::new(200).set_body_bytes(vec![7u8, 8, 9]))
            .mount(&server)
            .await;

        let provider = WebDavProvider::new(format!("{}/remote", server.uri()), "u", "p");
        let bytes = provider
            .download("vault.s2fa")
            .await
            .expect("download should succeed")
            .expect("payload should exist");
        assert_eq!(bytes, vec![7, 8, 9]);
    }

    #[tokio::test]
    async fn last_modified_parses_propfind_response() {
        let server = MockServer::start().await;
        let body = r#"<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:propstat>
      <d:prop>
        <d:getlastmodified>Wed, 24 Apr 2026 10:00:00 GMT</d:getlastmodified>
      </d:prop>
    </d:propstat>
  </d:response>
</d:multistatus>"#;

        Mock::given(method("PROPFIND"))
            .and(path("/remote/vault.s2fa"))
            .and(header("depth", "0"))
            .respond_with(ResponseTemplate::new(207).set_body_string(body))
            .mount(&server)
            .await;

        let provider = WebDavProvider::new(format!("{}/remote", server.uri()), "u", "p");
        let ts = provider
            .last_modified("vault.s2fa")
            .await
            .expect("propfind should succeed")
            .expect("timestamp should exist");

        assert_eq!(ts.to_rfc3339(), "2026-04-24T10:00:00+00:00");
    }

    #[tokio::test]
    async fn maps_unauthorized_to_sync_auth_failed() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/remote/vault.s2fa"))
            .respond_with(ResponseTemplate::new(401))
            .mount(&server)
            .await;

        let provider = WebDavProvider::new(format!("{}/remote", server.uri()), "u", "p");
        let err = provider
            .download("vault.s2fa")
            .await
            .expect_err("download should fail");

        assert!(matches!(err, AppError::SyncAuthFailed));
    }

    #[tokio::test]
    async fn download_returns_none_on_404() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/remote/vault.s2fa"))
            .respond_with(ResponseTemplate::new(404))
            .mount(&server)
            .await;

        let provider = WebDavProvider::new(format!("{}/remote", server.uri()), "u", "p");
        let payload = provider
            .download("vault.s2fa")
            .await
            .expect("download should not error for 404");
        assert!(payload.is_none());
    }
}
