import { useAuth } from "@clerk/react";
import { Redirect } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetNexusIntakes, useReviewNexusIntake, useSetNexusPublication,
  getGetPublicNexusPublicationsQueryKey, type NexusIntake } from "@workspace/api-client-react";
import NexusReviewDesk, { type NexusAction } from "@/components/nexus-review-desk";

export default function StaffNexusDesk() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  if (!isLoaded) return <main aria-busy="true">Oturum kontrol ediliyor…</main>;
  if (!isSignedIn) return <Redirect to="/staff/giris" />;
  return <NexusDesk userId={userId!} />;
}

function NexusDesk({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const decision = useReviewNexusIntake();
  const publication = useSetNexusPublication();
  const list = useGetNexusIntakes({ query: {
    queryKey: ["/api/nexus/intakes", userId], retry: false, staleTime: 0, refetchInterval: 30000,
  } });
  async function act(row: NexusIntake, action: NexusAction) {
    const result = action === "approve" || action === "reject"
      ? await decision.mutateAsync({ id: row.id, data: { action, snapshotToken: row.snapshotToken } })
      : await publication.mutateAsync({ id: row.id, data: { action, snapshotToken: row.snapshotToken } });
    queryClient.setQueryData<NexusIntake[]>(["/api/nexus/intakes", userId], old =>
      old?.map(item => item.id === result.id ? result : item));
    void queryClient.invalidateQueries({ queryKey: ["/api/nexus/intakes", userId] });
    void queryClient.invalidateQueries({ queryKey: getGetPublicNexusPublicationsQueryKey() });
    return result;
  }
  return <NexusReviewDesk records={list.isError ? [] : list.data ?? []} loading={list.isLoading}
    unavailable={list.isError} act={act} reload={async () => {
      const refreshed = await list.refetch();
      if (refreshed.isError) throw refreshed.error;
      return refreshed.data ?? [];
    }} />;
}
