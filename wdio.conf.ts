import { type ChildProcess, execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Options } from "@wdio/types";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const e2eDataDir = path.join(rootDir, ".e2e-data");
const nativeBinaryName = process.platform === "win32" ? "simple-2fa-next.exe" : "simple-2fa-next";
const applicationPath = path.join(rootDir, "src-tauri", "target", "debug", nativeBinaryName);
const tauriDriverPath =
  process.env.TAURI_DRIVER_PATH ??
  path.join(
    process.env.CARGO_HOME ?? path.join(process.env.HOME ?? rootDir, ".cargo"),
    "bin",
    process.platform === "win32" ? "tauri-driver.exe" : "tauri-driver",
  );

let driverProcess: ChildProcess | undefined;

function resolveNativeDriverPath() {
  if (process.env.TAURI_NATIVE_DRIVER_PATH) {
    return process.env.TAURI_NATIVE_DRIVER_PATH;
  }

  let binaryCandidates: string[];
  if (process.platform === "win32") {
    binaryCandidates = ["msedgedriver.exe", "msedgedriver"];
  } else if (process.platform === "darwin") {
    binaryCandidates = ["safaridriver"];
  } else {
    binaryCandidates = ["WebKitWebDriver", "webkit2gtk-driver"];
  }

  const pathEntries = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  for (const entry of pathEntries) {
    for (const candidate of binaryCandidates) {
      const candidatePath = path.join(entry, candidate);
      if (fs.existsSync(candidatePath)) {
        return candidatePath;
      }
    }
  }

  return undefined;
}

function resetE2eDataDir() {
  fs.rmSync(e2eDataDir, { recursive: true, force: true });
  fs.mkdirSync(e2eDataDir, { recursive: true });
}

async function waitForDriver() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:4444/status");
      if (response.ok) {
        return;
      }
    } catch {
      // Driver is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error("tauri-driver did not become ready on http://127.0.0.1:4444/status");
}

function buildEnv() {
  return {
    ...process.env,
    XDG_DATA_HOME: e2eDataDir,
  };
}

export const config: Options.Testrunner = {
  runner: "local",
  specs: ["./tests/e2e/**/*.spec.ts"],
  maxInstances: 1,
  logLevel: "warn",
  hostname: "127.0.0.1",
  port: 4444,
  path: "/",
  waitforTimeout: 15_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 1,
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    timeout: 120_000,
  },
  capabilities: [
    {
      browserName: "wry",
      "tauri:options": {
        application: applicationPath,
      },
    },
  ],
  onPrepare() {
    resetE2eDataDir();
    execSync("bunx tauri build --debug --no-bundle", {
      cwd: rootDir,
      stdio: "inherit",
      env: buildEnv(),
    });
  },
  async beforeSession() {
    resetE2eDataDir();
    const nativeDriverPath = resolveNativeDriverPath();
    if (!fs.existsSync(tauriDriverPath)) {
      throw new Error(`tauri-driver not found at ${tauriDriverPath}`);
    }
    if (!nativeDriverPath) {
      throw new Error(
        "No native WebDriver binary found. Install webkit2gtk-driver on Linux or set TAURI_NATIVE_DRIVER_PATH.",
      );
    }

    driverProcess = spawn(tauriDriverPath, ["--native-driver", nativeDriverPath], {
      stdio: "inherit",
      env: buildEnv(),
    });
    await waitForDriver();
  },
  afterSession() {
    if (driverProcess && !driverProcess.killed) {
      driverProcess.kill("SIGTERM");
    }
    driverProcess = undefined;
  },
};
