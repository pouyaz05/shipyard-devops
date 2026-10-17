import { statusInfo, type StatusTone } from "./status";

const TONES: Record<StatusTone, string> = {
  amber: "bg-amber-100 text-amber-800",
  green: "bg-green-100 text-green-700",
  sky: "bg-sky-100 text-sky-700",
  slate: "bg-slate-100 text-slate-700",
};

export default function OrderStatusBadge({ status }: { status: string }) {
  const { label, tone } = statusInfo(status);
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>{label}</span>
  );
}
