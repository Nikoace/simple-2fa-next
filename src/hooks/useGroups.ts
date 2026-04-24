import { useQuery } from "@tanstack/react-query";

import { listGroups } from "@/lib/tauri";

const groupsQueryKey = ["groups"] as const;

export function useGroups() {
  const query = useQuery({
    queryKey: groupsQueryKey,
    queryFn: listGroups,
    refetchInterval: 60_000,
    staleTime: 0,
  });

  return { ...query, queryKey: groupsQueryKey };
}
