import { $, expect } from "@wdio/globals";
import { describe, it } from "mocha";

import {
  accountItem,
  addAccount,
  expectAccountOrder,
  refreshAndUnlock,
  setupFreshVault,
} from "./helpers";

describe("account management flow", () => {
  it("adds an account, copies its code, and deletes it", async () => {
    await setupFreshVault();
    await addAccount("GitHub");

    const account = await accountItem("GitHub");
    await expect(account).toBeDisplayed();
    await expect(account.$(".countdown-ring")).toExist();

    await account.$("[data-testid='copy-code-button']").click();
    await expect(account.$("*=Copied")).toBeDisplayed();

    await account.$("[data-testid='account-options-trigger']").click();
    await $("aria/Delete").click();
    await $("//button[normalize-space()='Delete']").click();

    await (await accountItem("GitHub")).waitForExist({ reverse: true, timeout: 15_000 });
  });

  it("persists reordered accounts after a refresh and unlock", async () => {
    await setupFreshVault();
    await addAccount("Alpha");
    await addAccount("Bravo");
    await expectAccountOrder(["Alpha", "Bravo"]);

    const bravoHandle = await (await accountItem("Bravo")).$("[data-testid='account-drag-handle']");
    const alphaHandle = await (await accountItem("Alpha")).$("[data-testid='account-drag-handle']");
    await bravoHandle.dragAndDrop(alphaHandle);
    await expectAccountOrder(["Bravo", "Alpha"]);

    await refreshAndUnlock();
    await expectAccountOrder(["Bravo", "Alpha"]);
  });
});
