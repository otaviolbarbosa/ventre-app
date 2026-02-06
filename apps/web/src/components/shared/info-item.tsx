"use client";

export default function InfoItem({
  label,
  value,
}: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="font-medium">{value || "-"}</p>
    </div>
  );
}
