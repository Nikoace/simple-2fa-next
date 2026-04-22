use data_encoding::BASE32_NOPAD;
use totp_rs::{Algorithm, TOTP};

use crate::error::AppError;

/// Strips whitespace, dashes, uppercases, and removes trailing '=' padding.
pub fn normalize_secret(s: &str) -> String {
    s.chars()
        .filter(|c| !c.is_whitespace() && *c != '-')
        .map(|c| c.to_ascii_uppercase())
        .collect::<String>()
        .trim_end_matches('=')
        .to_owned()
}

/// Decodes a Base32 string (RFC 4648, no-padding) to raw bytes.
pub fn decode_base32_lenient(s: &str) -> Result<Vec<u8>, AppError> {
    let normalized = normalize_secret(s);
    BASE32_NOPAD
        .decode(normalized.as_bytes())
        .map_err(|e| AppError::InvalidInput(format!("invalid base32: {e}")))
}

/// Generates a TOTP code.
/// `algo` must be "SHA1", "SHA256", or "SHA512" (unknown values fall back to SHA1).
/// `t` is Unix time in seconds; pass `0` to use the current system time.
pub fn generate(secret_bytes: &[u8], algo: &str, digits: u8, period: u32, t: u64) -> String {
    let time = if t == 0 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    } else {
        t
    };

    let algorithm = match algo {
        "SHA256" => Algorithm::SHA256,
        "SHA512" => Algorithm::SHA512,
        _ => Algorithm::SHA1,
    };

    let totp = TOTP::new_unchecked(
        algorithm,
        digits as usize,
        1,
        period.into(),
        secret_bytes.to_vec(),
    );

    totp.generate(time)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_strips_spaces_and_dashes() {
        assert_eq!(normalize_secret("JBSW Y3DP"), "JBSWY3DP");
        assert_eq!(normalize_secret("JBSW-Y3DP"), "JBSWY3DP");
    }

    #[test]
    fn normalize_uppercases() {
        assert_eq!(normalize_secret("jbswy3dp"), "JBSWY3DP");
    }

    #[test]
    fn normalize_strips_trailing_padding() {
        assert_eq!(normalize_secret("JBSWY3DP=="), "JBSWY3DP");
    }

    #[test]
    fn normalize_idempotent() {
        let s = "JBSWY3DPEHPK3PXP";
        assert_eq!(normalize_secret(s), normalize_secret(&normalize_secret(s)));
    }

    #[test]
    fn decode_base32_known_vector() {
        let encoded = "JBSWY3DPEHPK3PXP";
        let decoded = decode_base32_lenient(encoded).expect("decode must succeed");
        assert!(!decoded.is_empty());
    }

    #[test]
    fn decode_invalid_returns_error() {
        assert!(decode_base32_lenient("!!!INVALID!!!").is_err());
    }

    #[test]
    fn generate_totp_known_vector_shape() {
        let secret =
            decode_base32_lenient("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ").expect("decode must succeed");
        let code = generate(&secret, "SHA1", 6, 30, 0);
        assert_eq!(code.len(), 6);
        assert!(code.chars().all(|c| c.is_ascii_digit()));
    }

    #[test]
    fn generate_returns_zero_padded_6_digits() {
        let secret = decode_base32_lenient("JBSWY3DPEHPK3PXP").expect("decode must succeed");
        let code = generate(&secret, "SHA1", 6, 30, 12_345_678);
        assert_eq!(code.len(), 6);
    }

    #[test]
    fn generate_sha256_produces_valid_code() {
        // RFC 6238 SHA256 seed: "12345678901234567890123456789012" (32 ASCII bytes)
        let secret = b"12345678901234567890123456789012";
        let code = generate(secret, "SHA256", 8, 30, 59);
        assert_eq!(code.len(), 8);
        assert!(code.chars().all(|c| c.is_ascii_digit()));
        assert_eq!(code, "46119246");
    }

    #[test]
    fn generate_sha512_produces_valid_code() {
        // RFC 6238 SHA512 seed (64 ASCII bytes), T=59
        let secret = b"1234567890123456789012345678901234567890123456789012345678901234";
        let code = generate(secret, "SHA512", 8, 30, 59);
        assert_eq!(code.len(), 8);
        assert_eq!(code, "90693936");
    }

    #[test]
    fn generate_unknown_algo_falls_back_to_sha1() {
        let secret = decode_base32_lenient("JBSWY3DPEHPK3PXP").expect("decode must succeed");
        let sha1_code = generate(&secret, "SHA1", 6, 30, 12_345_678);
        let fallback_code = generate(&secret, "UNKNOWN", 6, 30, 12_345_678);
        assert_eq!(sha1_code, fallback_code);
    }
}
