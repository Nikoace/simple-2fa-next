use simple_2fa_next_lib::importer::{
    export::{export_s2fa, ExportAccount},
    s2fa::import_s2fa,
};

#[test]
fn export_v2_roundtrip_via_import_succeeds() {
    let accounts = vec![
        ExportAccount {
            name: "alice@example.com".to_string(),
            issuer: Some("GitHub".to_string()),
            secret_plaintext: "JBSWY3DPEHPK3PXP".to_string(),
            algorithm: "SHA1".to_string(),
            digits: 6,
            period: 30,
        },
        ExportAccount {
            name: "bob@example.com".to_string(),
            issuer: None,
            secret_plaintext: "GEZDGNBVGY3TQOJQ".to_string(),
            algorithm: "SHA256".to_string(),
            digits: 8,
            period: 45,
        },
    ];

    let bytes = export_s2fa(&accounts, "test123").expect("export must succeed");
    let preview = import_s2fa(&bytes, "test123").expect("import must succeed");

    assert_eq!(preview.items.len(), 2);
    assert_eq!(preview.items[0].name, "alice@example.com");
    assert_eq!(preview.items[0].issuer.as_deref(), Some("GitHub"));
    assert_eq!(preview.items[0].algorithm, "SHA1");
    assert_eq!(preview.items[0].digits, 6);
    assert_eq!(preview.items[0].period, 30);

    assert_eq!(preview.items[1].name, "bob@example.com");
    assert_eq!(preview.items[1].issuer, None);
    assert_eq!(preview.items[1].algorithm, "SHA256");
    assert_eq!(preview.items[1].digits, 8);
    assert_eq!(preview.items[1].period, 45);
}

#[test]
fn export_v2_wrong_password_fails_import() {
    let accounts = vec![ExportAccount {
        name: "alice@example.com".to_string(),
        issuer: Some("GitHub".to_string()),
        secret_plaintext: "JBSWY3DPEHPK3PXP".to_string(),
        algorithm: "SHA1".to_string(),
        digits: 6,
        period: 30,
    }];

    let bytes = export_s2fa(&accounts, "correct").expect("export must succeed");
    assert!(import_s2fa(&bytes, "wrong").is_err());
}
