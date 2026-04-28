import { $, expect } from "@wdio/globals";
import { describe, it } from "mocha";

import { lockVault, MASTER_PASSWORD, setupFreshVault, unlockVault } from "./helpers";

describe("vault flow", () => {
  it("handles first launch, setup, lock, and unlock", async () => {
    await setupFreshVault();
    await lockVault();
    await unlockVault();
    await expect($("[data-testid='open-add-account']")).toBeDisplayed();
  });

  it("shows an error for a wrong password", async () => {
    await lockVault();
    await $("aria/Master password").setValue(`${MASTER_PASSWORD}-wrong`);
    await $("aria/Unlock").click();
    await expect($("*=Wrong password")).toBeDisplayed();
  });
});
