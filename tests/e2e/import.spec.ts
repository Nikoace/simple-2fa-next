import { $, expect } from "@wdio/globals";
import { describe, it } from "mocha";

import { LEGACY_FIXTURE_PASSWORD, LEGACY_FIXTURE_PATH, setupFreshVault } from "./helpers";

describe("import flow", () => {
  it("imports the legacy v1 fixture through the desktop UI", async () => {
    await setupFreshVault();

    await $("aria/Import").click();
    const fileInput = await $("aria/Choose File");
    await fileInput.setValue(LEGACY_FIXTURE_PATH);
    await $("aria/Export Password").setValue(LEGACY_FIXTURE_PASSWORD);
    await $("aria/Preview").click();

    await expect($("*=alice@example.com")).toBeDisplayed();
    await expect($("*=bob@example.com")).toBeDisplayed();
    await expect($("*=service@corp.example")).toBeDisplayed();

    await $("aria/Confirm Import").click();

    await expect(
      $("[data-testid='account-item'][data-account-name='alice@example.com']"),
    ).toBeDisplayed();
    await expect(
      $("[data-testid='account-item'][data-account-name='bob@example.com']"),
    ).toBeDisplayed();
    await expect(
      $("[data-testid='account-item'][data-account-name='service@corp.example']"),
    ).toBeDisplayed();
  });
});
