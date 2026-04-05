import { AlertStatus } from "@/components/alert-status";

export default function AlertPage({ params }: { params: { id: string } }) {
  return <AlertStatus alertId={params.id} />;
}
