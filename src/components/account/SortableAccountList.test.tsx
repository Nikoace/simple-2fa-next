import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tauri", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tauri")>("@/lib/tauri");
  return { ...actual, reorderAccounts: vi.fn() };
});
vi.mock("@/hooks/useNow", () => ({ useNow: () => 1704067215 }));
vi.mock("framer-motion", () => ({
  motion: { span: "span" },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import type { AccountWithCode } from "@/lib/tauri";
import { SortableAccountList } from "./SortableAccountList";

const accounts: AccountWithCode[] = [
  {
    id: 1,
    name: "A",
    issuer: null,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    groupId: null,
    icon: null,
    color: null,
    sortOrder: 0,
    code: "111111",
    ttl: 15,
    progress: 0.5,
  },
  {
    id: 2,
    name: "B",
    issuer: null,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    groupId: null,
    icon: null,
    color: null,
    sortOrder: 1,
    code: "222222",
    ttl: 15,
    progress: 0.5,
  },
];

describe("SortableAccountList", () => {
  it("renders all account cards", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <SortableAccountList accounts={accounts} />
      </QueryClientProvider>,
    );
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("B")).toBeTruthy();
  });
});
