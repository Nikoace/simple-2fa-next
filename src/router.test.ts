import { describe, expect, it } from "vitest";
import { router } from "./router";

describe("router", () => {
  it("exports a router instance", () => {
    expect(router).toBeDefined();
    expect(router.routeTree).toBeDefined();
  });

  it("has top-level routes including /settings", () => {
    const rawPaths = router.routeTree.children?.map((r: { path: string }) => r.path) ?? [];
    // Normalize to leading-slash form regardless of how TanStack Router stores them internally.
    const paths = rawPaths.map((p: string) => (p.startsWith("/") ? p : `/${p}`));
    expect(paths).toContain("/");
    expect(paths).toContain("/unlock");
    expect(paths).toContain("/setup");
    expect(paths).toContain("/settings");
  });
});
