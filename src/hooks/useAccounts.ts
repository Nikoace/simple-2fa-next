import { useQuery } from "@tanstack/react-query";

import { getAccounts } from "@/lib/tauri";

const accountsQueryKey = ["accounts"] as const;

export function useAccounts() {
  const query = useQuery({
    queryKey: accountsQueryKey,
    queryFn: getAccounts,
    refetchInterval: 30_000,
    staleTime: 0,
  });

  return { ...query, queryKey: accountsQueryKey };
}
