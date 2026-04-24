import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { MainPage } from "@/pages/MainPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SetupPage } from "@/pages/SetupPage";
import { UnlockPage } from "@/pages/UnlockPage";
import { useVaultStore } from "@/stores/vault";

const rootRoute = createRootRoute({
  component: AppShell,
  notFoundComponent: () => <Outlet />,
});

async function requireUnlocked() {
  const { status, checkStatus } = useVaultStore.getState();
  if (status === "loading") {
    await checkStatus();
  }

  const nextStatus = useVaultStore.getState().status;
  if (nextStatus === "uninitialized") {
    throw redirect({ to: "/setup" });
  }
  if (nextStatus !== "unlocked") {
    throw redirect({ to: "/unlock" });
  }
}

const mainRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: requireUnlocked,
  component: MainPage,
});

const unlockRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/unlock",
  component: UnlockPage,
});

const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/setup",
  component: SetupPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  beforeLoad: requireUnlocked,
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([mainRoute, unlockRoute, setupRoute, settingsRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
