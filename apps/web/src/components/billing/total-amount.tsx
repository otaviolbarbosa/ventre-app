export function TotalAmount({ amount }: { amount: number }) {
  const [number, fraction] = [
    Math.trunc(amount / 100).toLocaleString("pt-BR"),
    String(Math.abs(amount % 100)).padStart(2, "0"),
  ];
  return (
    <div className="flex items-start gap-0.5 font-poppins">
      <span className="font-medium text-2xl">R$ {number}</span>
      <span className="pt-0.5 text-sm">{fraction}</span>
    </div>
  );
}
