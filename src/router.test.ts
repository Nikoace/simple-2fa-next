import { describe, expect, it } from "vitest";

describe("router", () => {
  it("exports a router instance", async () => {
    const { router } = await import("./router");
    expect(router).toBeDefined();
    expect(router.routeTree).toBeDefined();
  });

  it("has three top-level routes: / /unlock /setup", async () => {
    const { router } = await import("./router");
    const paths = router.routeTree.children?.map((r: { path: string }) => r.path) ?? [];
    expect(paths).toContain("/");
    expect(paths).toContain("unlock");
    expect(paths).toContain("setup");
  });
});
