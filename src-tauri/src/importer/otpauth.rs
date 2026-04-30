use std::collections::HashMap;

use url::Url;

use crate::{
    error::AppError,
    importer::ImportAccountItem,
    totp::secret::{decode_base32_lenient, normalize_secret},
};

pub fn parse_otpauth_uri(uri: &str) -> Result<ImportAccountItem, AppError> {
    let parsed = Url::parse(uri).map_err(|e| AppError::Import(format!("invalid URI: {e}")))?;
    if parsed.scheme() != "otpauth" || parsed.host_str() != Some("totp") {
        return Err(AppError::Import(
            "only otpauth://totp/ URIs are supported".into(),
        ));
    }

    let label_raw = parsed.path().trim_start_matches('/');
    if label_raw.is_empty() {
        return Err(AppError::Import("missing account label".into()));
    }

    let mut query: HashMap<String, String> = HashMap::new();
    for (k, v) in parsed.query_pairs() {
        query.insert(k.into_owned(), v.into_owned());
    }

    let secret = query
        .get("secret")
        .ok_or_else(|| AppError::Import("missing required query parameter: secret".into()))?;
    let normalized_secret = normalize_secret(secret);
    decode_base32_lenient(&normalized_secret)?;

    let (label_issuer, label_name) = split_label(label_raw)?;
    let name = label_name.to_string();
    let issuer = query
        .get("issuer")
        .cloned()
        .or_else(|| label_issuer.map(|s| s.to_string()));

    let algorithm = query
        .get("algorithm")
        .map(|s| s.trim().to_ascii_uppercase())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "SHA1".to_string());
    let digits = query
        .get("digits")
        .map(|s| {
            s.parse::<u8>()
                .map_err(|_| AppError::Import("digits must be an integer".into()))
        })
        .transpose()?
        .unwrap_or(6);
    let period = query
        .get("period")
        .map(|s| {
            s.parse::<u32>()
                .map_err(|_| AppError::Import("period must be an integer".into()))
        })
        .transpose()?
        .unwrap_or(30);
    validate_totp_params(&algorithm, digits, period)?;

    Ok(ImportAccountItem {
        name,
        issuer,
        secret: normalized_secret,
        algorithm,
        digits,
        period,
    })
}

fn split_label(label: &str) -> Result<(Option<&str>, &str), AppError> {
    if let Some((issuer, name)) = label.split_once(':') {
        let name = name.trim();
        if name.is_empty() {
            return Err(AppError::Import("missing account name in label".into()));
        }
        let issuer = issuer.trim();
        let issuer = if issuer.is_empty() {
            None
        } else {
            Some(issuer)
        };
        Ok((issuer, name))
    } else {
        let name = label.trim();
        if name.is_empty() {
            return Err(AppError::Import("missing account name in label".into()));
        }
        Ok((None, name))
    }
}

fn validate_totp_params(algorithm: &str, digits: u8, period: u32) -> Result<(), AppError> {
    if !matches!(algorithm, "SHA1" | "SHA256" | "SHA512") {
        return Err(AppError::Import(format!(
            "unsupported algorithm: {algorithm}"
        )));
    }
    if !(6..=8).contains(&digits) {
        return Err(AppError::Import("digits must be between 6 and 8".into()));
    }
    if !(15..=300).contains(&period) {
        return Err(AppError::Import("period must be between 15 and 300".into()));
    }
    Ok(())
}
