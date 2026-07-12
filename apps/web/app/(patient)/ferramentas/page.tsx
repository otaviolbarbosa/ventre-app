import { Badge } from "@ventre/ui/badge";
import { Activity, HeartPulse } from "lucide-react";

export default function PatientFerramentasPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-bold text-2xl text-[#433831]">Ferramentas</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-8 text-center opacity-60 shadow-sm">
          <Activity className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium text-[#433831]">Medidor de contração</p>
          <Badge variant="secondary">Em breve</Badge>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-8 text-center opacity-60 shadow-sm">
          <HeartPulse className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium text-[#433831]">Contador de batimentos cardíacos</p>
          <Badge variant="secondary">Em breve</Badge>
        </div>
      </div>
    </div>
  );
}
