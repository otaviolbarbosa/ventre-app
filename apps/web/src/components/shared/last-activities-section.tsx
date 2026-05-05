"use client";

import { dayjs } from "@/lib/dayjs";
import type { ActivityLog } from "@/services/activity-logs";
import { Button } from "@ventre/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ventre/ui/card";
import { Skeleton } from "@ventre/ui/skeleton";
import {
  ArrowRightIcon,
  Building2,
  Calendar,
  CircleDollarSign,
  FileHeart,
  FlaskConical,
  Syringe,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";

const ACTION_TYPE_CONFIG = {
  appointment: { icon: Calendar, colorClass: "text-primary" },
  patient: { icon: UserPlus, colorClass: "text-green-500" },
  team: { icon: Users, colorClass: "text-purple-500" },
  clinical: { icon: FileHeart, colorClass: "text-pink-500" },
  exam: { icon: FlaskConical, colorClass: "text-orange-500" },
  vaccine: { icon: Syringe, colorClass: "text-teal-500" },
  billing: { icon: CircleDollarSign, colorClass: "text-yellow-500" },
  enterprise: { icon: Building2, colorClass: "text-muted-foreground" },
} as const;

type LastActivitiesSectionProps = {
  logs: ActivityLog[];
  isLoading: boolean;
};

function LastActivitiesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Card>
        <CardContent className="space-y-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function LastActivitiesSection({ logs, isLoading }: LastActivitiesSectionProps) {
  if (isLoading) return <LastActivitiesSkeleton />;

  return (
    <Card className="h-fit p-1">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-1.5 pl-4">
        <CardTitle>Últimas Atualizações</CardTitle>
        <Button size="icon" variant="outline" asChild>
          <Link href="/last-activities">
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 bg-background">
        {logs.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm">
            Nenhuma atividade registrada ainda.
          </p>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => {
              const config =
                ACTION_TYPE_CONFIG[log.action_type as keyof typeof ACTION_TYPE_CONFIG] ??
                ACTION_TYPE_CONFIG.enterprise;
              const Icon = config.icon;
              return (
                <div key={log.id} className="flex gap-3">
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${config.colorClass}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm">{log.action_name}</p>
                      <p className="shrink-0 text-muted-foreground text-xs">
                        {dayjs(log.created_at).fromNow()}
                      </p>
                    </div>
                    <p className="mt-0.5 text-muted-foreground text-xs">{log.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
