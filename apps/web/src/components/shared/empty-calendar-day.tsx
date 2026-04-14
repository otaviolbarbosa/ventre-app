import { Card, CardContent } from "@ventre/ui/card";
import { Plus } from "lucide-react";

type EmptyCalendarDayProps = {
  onAddAppointment?: () => void;
};

export function EmptyCalendarDay({ onAddAppointment }: EmptyCalendarDayProps) {
  return (
    <Card
      className="mt-3 cursor-pointer border-primary transition-colors hover:bg-muted/40"
      onClick={onAddAppointment}
    >
      <CardContent className="flex items-center gap-4 p-0">
        <div className="flex min-h-20 w-20 items-center justify-center border-r bg-primary/5 text-primary">
          <Plus className="h-6 w-6" />
        </div>
        <div className="pr-4">
          <p className="font-semibold">Sua agenda está livre</p>
          <p className="mt-1 text-muted-foreground text-xs">
            Clique aqui e adicione compromissos na sua agenda.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
