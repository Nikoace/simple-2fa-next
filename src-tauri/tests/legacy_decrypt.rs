//! Integration test: decrypts committed .s2fa v1 fixture and validates known accounts.
//! This test is a release gate for legacy compatibility.

use simple_2fa_next_lib::{crypto::legacy_s2fa::decrypt_v1, importer::s2fa::import_s2fa};

const FIXTURE: &[u8] = include_bytes!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../tests/fixtures/legacy_v1_sample.s2fa"
));
const PASSWORD: &str = "test123";

#[test]
fn decrypt_v1_fixture_succeeds() {
    let accounts = decrypt_v1(FIXTURE, PASSWORD).expect("decrypt_v1 must succeed");
    assert_eq!(accounts.len(), 3, "fixture contains 3 accounts");
}

#[test]
fn fixture_account_names_match() {
    let accounts = decrypt_v1(FIXTURE, PASSWORD).expect("decrypt_v1 must succeed");
    assert_eq!(accounts[0].name, "alice@example.com");
    assert_eq!(accounts[1].name, "bob@example.com");
    assert_eq!(accounts[2].name, "service@corp.example");
}

#[test]
fn fixture_issuers_match() {
    let accounts = decrypt_v1(FIXTURE, PASSWORD).expect("decrypt_v1 must succeed");
    assert_eq!(accounts[0].issuer.as_deref(), Some("GitHub"));
    assert!(accounts[1].issuer.is_none());
    assert_eq!(accounts[2].issuer.as_deref(), Some("Corp SSO"));
}

#[test]
fn fixture_secrets_are_valid_base32() {
    use simple_2fa_next_lib::totp::secret::decode_base32_lenient;

    let accounts = decrypt_v1(FIXTURE, PASSWORD).expect("decrypt_v1 must succeed");
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
    for item in &preview.items {
        assert!(!item.secret_bytes.is_empty());
        assert_eq!(item.algorithm, "SHA1");
        assert_eq!(item.digits, 6);
        assert_eq!(item.period, 30);
    }
}
