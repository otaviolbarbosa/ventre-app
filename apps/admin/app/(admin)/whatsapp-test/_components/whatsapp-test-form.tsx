"use client";

import { testWhatsAppTemplateAction } from "@/actions/whatsapp-test";
import { Button } from "@ventre/ui/button";
import { Card, CardContent } from "@ventre/ui/card";
import { Input } from "@ventre/ui/input";
import { Label } from "@ventre/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

const TEMPLATE_OPTIONS = [
  { value: "appointment_reminder", label: "Lembrete de consulta" },
  { value: "subscription_billing_issue", label: "Problema de cobrança da assinatura" },
  { value: "patient_self_registration_invite", label: "Convite de autocadastro de paciente" },
  { value: "patient_link_existing_invite", label: "Convite de vínculo a paciente existente" },
  { value: "birth_mode_activated", label: "Modo parto ativado" },
] as const;

type TemplateType = (typeof TEMPLATE_OPTIONS)[number]["value"];

export function WhatsAppTestForm() {
  const [templateType, setTemplateType] = useState<TemplateType>("appointment_reminder");
  const [phone, setPhone] = useState("");
  const [patientName, setPatientName] = useState("Maria Teste");
  const [professionalName, setProfessionalName] = useState("Dra. Ana Teste");
  const [appointmentType, setAppointmentType] = useState("Consulta de pré-natal");
  const [date, setDate] = useState("25/12/2026");
  const [time, setTime] = useState("14:00");
  const [location, setLocation] = useState("Clínica Central");
  const [planName, setPlanName] = useState("Plano Premium");
  const [patientInviteId, setPatientInviteId] = useState("00000000-0000-0000-0000-000000000000");

  const { execute, isExecuting, result } = useAction(testWhatsAppTemplateAction, {
    onSuccess: ({ data }) => {
      toast.success(`Mensagem enviada! ID: ${data?.externalMessageId}`);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao enviar mensagem de teste");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    switch (templateType) {
      case "appointment_reminder":
        execute({
          templateType,
          phone,
          patientName,
          appointmentType,
          date,
          time,
          professionalName,
          location,
        });
        break;
      case "subscription_billing_issue":
        execute({ templateType, phone, professionalName, planName });
        break;
      case "patient_self_registration_invite":
      case "patient_link_existing_invite":
        execute({ templateType, phone, patientName, patientInviteId });
        break;
      case "birth_mode_activated":
        execute({ templateType, phone, professionalName, patientName });
        break;
    }
  }

  return (
    <div className="max-w-2xl">
      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1">
              <Label>Template *</Label>
              <Select
                value={templateType}
                onValueChange={(value) => setTemplateType(value as TemplateType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Telefone de destino *</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="11987654321"
                required
              />
            </div>

            {(templateType === "appointment_reminder" ||
              templateType === "subscription_billing_issue" ||
              templateType === "birth_mode_activated") && (
              <div className="space-y-1">
                <Label>Nome do profissional *</Label>
                <Input
                  value={professionalName}
                  onChange={(e) => setProfessionalName(e.target.value)}
                  required
                />
              </div>
            )}

            {(templateType === "appointment_reminder" ||
              templateType === "patient_self_registration_invite" ||
              templateType === "patient_link_existing_invite" ||
              templateType === "birth_mode_activated") && (
              <div className="space-y-1">
                <Label>Nome da paciente *</Label>
                <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} required />
              </div>
            )}

            {templateType === "appointment_reminder" && (
              <>
                <div className="space-y-1">
                  <Label>Tipo de consulta *</Label>
                  <Input
                    value={appointmentType}
                    onChange={(e) => setAppointmentType(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Data *</Label>
                    <Input value={date} onChange={(e) => setDate(e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <Label>Hora *</Label>
                    <Input value={time} onChange={(e) => setTime(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Local *</Label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} required />
                </div>
              </>
            )}

            {templateType === "subscription_billing_issue" && (
              <div className="space-y-1">
                <Label>Nome do plano *</Label>
                <Input value={planName} onChange={(e) => setPlanName(e.target.value)} required />
              </div>
            )}

            {(templateType === "patient_self_registration_invite" ||
              templateType === "patient_link_existing_invite") && (
              <div className="space-y-1">
                <Label>ID do convite (parâmetro do botão) *</Label>
                <Input
                  value={patientInviteId}
                  onChange={(e) => setPatientInviteId(e.target.value)}
                  required
                />
              </div>
            )}

            {result.serverError && (
              <p className="text-destructive text-sm">{result.serverError}</p>
            )}

            {result.data && (
              <p className="text-muted-foreground text-xs">
                Enviado com o template <strong>{result.data.templateName}</strong> (ID da mensagem:{" "}
                {result.data.externalMessageId})
              </p>
            )}

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isExecuting}>
                {isExecuting ? "Enviando..." : "Enviar mensagem de teste"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
