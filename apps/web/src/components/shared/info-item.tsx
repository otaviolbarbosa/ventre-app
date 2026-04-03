"use client";

export default function InfoItem({
  label,
  value,
}: { label: string; value: React.ReactElement | string | null | undefined }) {
  return (
    <div>
      <p className="text-muted-foreground text-sm">{label}</p>
      {!!value || typeof value === "string" ? <p className="font-medium">{value || "-"}</p> : value}
    </div>
  );
}
