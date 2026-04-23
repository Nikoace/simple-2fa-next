import { describe, expect, it } from "vitest";

describe("router", () => {
  it("exports a router instance", async () => {
    const { router } = await import("./router");
    expect(router).toBeDefined();
    expect(router.routeTree).toBeDefined();
  });

  it("has three top-level routes: / /unlock /setup", async () => {
    const { router } = await import("./router");
    const rawPaths = router.routeTree.children?.map((r: { path: string }) => r.path) ?? [];
    // Normalize to leading-slash form regardless of how TanStack Router stores them internally.
    const paths = rawPaths.map((p: string) => (p.startsWith("/") ? p : `/${p}`));
    expect(paths).toContain("/");
    expect(paths).toContain("/unlock");
    expect(paths).toContain("/setup");
  });
});
