import { describe, expect, it } from "vitest";

import en from "./locales/en.json";
import ja from "./locales/ja.json";
import zhCN from "./locales/zh-CN.json";

const requiredKeys = [
  "vault.setup_title",
  "vault.setup_submit",
  "vault.unlock_title",
  "vault.unlock_submit",
  "vault.password_placeholder",
  "vault.wrong_password",
  "accounts.empty_title",
  "accounts.empty_hint",
  "accounts.copied",
  "accounts.add",
  "accounts.edit",
  "accounts.delete",
  "accounts.delete_confirm_title",
  "accounts.delete_confirm_desc",
  "accounts.name_label",
  "accounts.name_placeholder",
  "accounts.issuer_label",
  "accounts.issuer_placeholder",
  "accounts.secret_label",
  "accounts.secret_placeholder",
  "accounts.algorithm_label",
  "accounts.digits_label",
  "accounts.period_label",
  "accounts.name_required",
  "accounts.secret_required",
  "accounts.secret_invalid",
  "accounts.save",
  "accounts.cancel",
  "accounts.drag_hint",
  "nav.lock",
  "theme.light",
  "theme.dark",
  "theme.system",
];

function flatten(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "object" && v !== null
      ? flatten(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

describe("i18n locale coverage", () => {
  for (const key of requiredKeys) {
    it(`zh-CN has key: ${key}`, () => {
      expect(flatten(zhCN)).toContain(key);
    });
    it(`en has key: ${key}`, () => {
      expect(flatten(en)).toContain(key);
    });
    it(`ja has key: ${key}`, () => {
      expect(flatten(ja)).toContain(key);
    });
  }
});
