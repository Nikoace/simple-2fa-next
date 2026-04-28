import assert from "node:assert/strict";
import path from "node:path";

import { $, $$, browser, expect } from "@wdio/globals";

export const MASTER_PASSWORD = "test12345";
export const LEGACY_FIXTURE_PASSWORD = "test123";
export const LEGACY_FIXTURE_PATH = path.resolve(
  process.cwd(),
  "tests/fixtures/legacy_v1_sample.s2fa",
);

async function languageTrigger() {
  return $(
    "//button[contains(., '中文') or contains(., 'EN') or contains(., 'English') or contains(., '日本語')]",
  );
}

export async function switchLanguageToEnglish() {
  const englishMenuItem = await $("//*[@role='menuitem' and normalize-space()='English']");
  if (await englishMenuItem.isExisting()) {
    return;
  }

  const trigger = await languageTrigger();
  await trigger.waitForClickable({ timeout: 15_000 });
  await trigger.click();
  await englishMenuItem.waitForClickable({ timeout: 10_000 });
  await englishMenuItem.click();
  await expect($("aria/Master password")).toExist();
}

export async function setupFreshVault(password = MASTER_PASSWORD) {
  await switchLanguageToEnglish();
  await expect($("aria/Set Master Password")).toBeDisplayed();
  const passwordInput = await $("aria/Master password");
  await passwordInput.setValue(password);
  await $("aria/Create Vault").click();
  await expect($("[data-testid='open-add-account']")).toBeDisplayed();
}

export async function lockVault() {
  await $("aria/Lock").click();
  await expect($("aria/Unlock Vault")).toBeDisplayed();
}

export async function unlockVault(password = MASTER_PASSWORD) {
  const passwordInput = await $("aria/Master password");
  await passwordInput.waitForDisplayed({ timeout: 15_000 });
  await passwordInput.setValue(password);
  await $("aria/Unlock").click();
  await expect($("[data-testid='open-add-account']")).toBeDisplayed();
}

export async function addAccount(name: string, issuer = "GitHub") {
  await $("[data-testid='open-add-account']").click();
  await $("aria/Account Name").setValue(name);
  await $("aria/Issuer").setValue(issuer);
  await $("aria/Secret (Base32)").setValue("JBSWY3DPEHPK3PXP");
  await $("[data-testid='submit-add-account']").click();

  const account = await accountItem(name);
  await account.waitForDisplayed({ timeout: 15_000 });
}

export async function accountItem(name: string) {
  return $(`[data-testid='account-item'][data-account-name="${name}"]`);
}

export async function accountOrder() {
  const items = await $$("[data-testid='account-item']");
  const names = await Promise.all(
    items.map((item) => browser.execute((element) => element.dataset.accountName ?? null, item)),
  );
  return names.filter((name): name is string => Boolean(name));
}

export async function expectAccountOrder(expected: string[]) {
  await browser.waitUntil(
    async () => {
      const current = await accountOrder();
      return (
        current.length === expected.length &&
        current.every((name, index) => name === expected[index])
      );
    },
    {
      timeout: 15_000,
      timeoutMsg: `Expected account order ${expected.join(", ")}`,
    },
  );

  assert.deepEqual(await accountOrder(), expected);
}

export async function refreshAndUnlock() {
  await browser.refresh();
  await expect($("aria/Unlock Vault")).toBeDisplayed();
  await unlockVault();
}
