import { AlertSessionStatus } from "@/components/alert-session-status";

export default function AlertSessionPage({ params }: { params: { sessionId: string } }) {
  return <AlertSessionStatus sessionId={params.sessionId} />;
}
