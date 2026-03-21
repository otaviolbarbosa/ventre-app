"use client";

import { useAuth } from "@/hooks/use-auth";
import { PatientTeamEnterpriseScreen, PatientTeamScreen } from "@/screens";

export default function PatientTeamPage() {
  const { isStaff } = useAuth();

  if (isStaff) return <PatientTeamEnterpriseScreen />;
  return <PatientTeamScreen />;
}
