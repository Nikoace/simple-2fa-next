use simple_2fa_next_lib::importer::otpauth::parse_otpauth_uri;

#[test]
fn parse_standard_otpauth_uri() {
    let uri = "otpauth://totp/GitHub:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&algorithm=SHA1&digits=6&period=30";
    let item = parse_otpauth_uri(uri).expect("parse must succeed");

    assert_eq!(item.name, "alice@example.com");
    assert_eq!(item.issuer.as_deref(), Some("GitHub"));
    assert_eq!(item.algorithm, "SHA1");
    assert_eq!(item.digits, 6);
    assert_eq!(item.period, 30);
    assert_eq!(item.secret, "JBSWY3DPEHPK3PXP");
}

#[test]
fn parse_defaults_when_optional_fields_missing() {
    let uri = "otpauth://totp/alice@example.com?secret=JBSWY3DPEHPK3PXP";
    let item = parse_otpauth_uri(uri).expect("parse must succeed");

    assert_eq!(item.name, "alice@example.com");
    assert_eq!(item.issuer, None);
    assert_eq!(item.algorithm, "SHA1");
    assert_eq!(item.digits, 6);
    assert_eq!(item.period, 30);
}

#[test]
fn parse_missing_secret_returns_error() {
    let uri = "otpauth://totp/GitHub:alice@example.com?issuer=GitHub";
    assert!(parse_otpauth_uri(uri).is_err());
}

#[test]
fn parse_rejects_non_totp_uri() {
    let uri = "https://example.com?secret=JBSWY3DPEHPK3PXP";
    assert!(parse_otpauth_uri(uri).is_err());
}

#[test]
fn parse_rejects_unsupported_algorithm() {
    let uri = "otpauth://totp/GitHub:alice@example.com?secret=JBSWY3DPEHPK3PXP&algorithm=MD5";
    assert!(parse_otpauth_uri(uri).is_err());
}

#[test]
fn parse_rejects_digits_out_of_range() {
    let uri = "otpauth://totp/GitHub:alice@example.com?secret=JBSWY3DPEHPK3PXP&digits=9";
    assert!(parse_otpauth_uri(uri).is_err());
}

#[test]
fn parse_rejects_period_out_of_range() {
    let uri = "otpauth://totp/GitHub:alice@example.com?secret=JBSWY3DPEHPK3PXP&period=0";
    assert!(parse_otpauth_uri(uri).is_err());
}
