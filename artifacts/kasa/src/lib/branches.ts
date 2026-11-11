import { useMemo } from 'react';
import { getGetKasaBranchesQueryKey, useGetKasaBranches } from '@workspace/api-client-react';

export function useBranches() {
  const q = useGetKasaBranches({ query: { queryKey: getGetKasaBranchesQueryKey(), staleTime: 15000 } });
  const map = useMemo(() => new Map((q.data ?? []).map((b) => [b.id, b.name])), [q.data]);
  const name = (id: number | null | undefined) => (id == null ? '—' : (map.get(id) ?? `Şube #${id}`));
  return { ...q, name };
}
