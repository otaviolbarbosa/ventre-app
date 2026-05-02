"use client";

import { dayjs } from "@/lib/dayjs";
import type { ActivityLog } from "@/services/activity-logs";
import { Button } from "@ventre/ui/button";
import { Card, CardContent } from "@ventre/ui/card";
import {
  Building2,
  Calendar,
  DollarSign,
  FileHeart,
  FlaskConical,
  Syringe,
  UserPlus,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";

const ACTION_TYPE_CONFIG = {
  appointment: { icon: Calendar, colorClass: "text-primary" },
  patient: { icon: UserPlus, colorClass: "text-green-500" },
  team: { icon: Users, colorClass: "text-purple-500" },
  clinical: { icon: FileHeart, colorClass: "text-pink-500" },
  exam: { icon: FlaskConical, colorClass: "text-orange-500" },
  vaccine: { icon: Syringe, colorClass: "text-teal-500" },
  billing: { icon: DollarSign, colorClass: "text-yellow-500" },
  enterprise: { icon: Building2, colorClass: "text-muted-foreground" },
} as const;

type LastActivitiesScreenProps = {
  logs: ActivityLog[];
  currentPage: number;
  totalPages: number;
  total: number;
};

export function LastActivitiesScreen({
  logs,
  currentPage,
  totalPages,
  total,
}: LastActivitiesScreenProps) {
  const router = useRouter();

  return (
    <div className="flex flex-1 flex-col space-y-4 px-4 pt-4 pb-28 sm:pb-4 md:px-6">
      <p className="text-muted-foreground text-sm">{total} atividades registradas</p>
      <Card>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground text-sm">
              Nenhuma atividade registrada ainda.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log) => {
                const config =
                  ACTION_TYPE_CONFIG[log.action_type as keyof typeof ACTION_TYPE_CONFIG] ??
                  ACTION_TYPE_CONFIG.enterprise;
                const Icon = config.icon;
                return (
                  <div key={log.id} className="flex gap-3 px-4 py-4">
                    <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${config.colorClass}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm">{log.action_name}</p>
                        <p className="mt-0.5 shrink-0 text-muted-foreground text-xs">
                          {dayjs(log.created_at).format("DD/MM HH:mm")}
                        </p>
                      </div>
                      <p className="mt-0.5 text-muted-foreground text-xs">{log.description}</p>
                      {log.user && (
                        <p className="mt-0.5 text-muted-foreground text-xs">
                          Por: {log.user.name}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => router.push(`/last-activities?page=${currentPage - 1}`)}
          >
            Anterior
          </Button>
          <span className="text-muted-foreground text-sm">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => router.push(`/last-activities?page=${currentPage + 1}`)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
