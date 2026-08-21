"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { PREGNANCY_DELIVERY_METHOD } from "@/lib/constants";
import { sendWhatsAppToUser } from "@/lib/notifications/whatsapp-send";
import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { finishCareActionSchema } from "@/lib/validations/birth-outcome";
import { revalidatePath, updateTag } from "next/cache";

export const finishPatientCareAction = authActionClient
  .inputSchema(finishCareActionSchema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const bornAt =
      parsedInput.addBornAt && parsedInput.bornAt
        ? new Date(`${parsedInput.bornAt}T${parsedInput.bornAtTime || "00:00"}:00`).toISOString()
        : null;

    const { data: activePregnancy } = await supabase
      .from("pregnancies")
      .select("birth_mode_active")
      .eq("patient_id", parsedInput.patientId)
      .eq("has_finished", false)
      .maybeSingle();

    const { error: updateError } = await supabase
      .from("pregnancies")
      .update({
        has_finished: true,
        born_at: bornAt,
        delivery_method: parsedInput.addBornAt ? (parsedInput.deliveryMethod ?? null) : null,
        baby_sex: parsedInput.addBornAt ? (parsedInput.babySex ?? null) : null,
        birth_weight_grams: parsedInput.addBornAt ? (parsedInput.birthWeightGrams ?? null) : null,
        ...(activePregnancy?.birth_mode_active
          ? { birth_mode_active: false, birth_mode_ended_at: new Date().toISOString() }
          : {}),
      })
      .eq("patient_id", parsedInput.patientId);

    if (updateError) throw new Error(updateError.message);

    if (parsedInput.addApgar) {
      if (!parsedInput.pregnancyId) {
        throw new Error("Não é possível registrar APGAR sem uma gestação associada");
      }

      const { error: apgarError } = await supabase.from("birth_apgar_scores").upsert(
        [
          {
            pregnancy_id: parsedInput.pregnancyId,
            patient_id: parsedInput.patientId,
            professional_id: user.id,
            minute: 1,
            appearance: parsedInput.apgar1.appearance as number,
            pulse: parsedInput.apgar1.pulse as number,
            grimace: parsedInput.apgar1.grimace as number,
            activity: parsedInput.apgar1.activity as number,
            respiration: parsedInput.apgar1.respiration as number,
          },
          {
            pregnancy_id: parsedInput.pregnancyId,
            patient_id: parsedInput.patientId,
            professional_id: user.id,
            minute: 5,
            appearance: parsedInput.apgar5.appearance as number,
            pulse: parsedInput.apgar5.pulse as number,
            grimace: parsedInput.apgar5.grimace as number,
            activity: parsedInput.apgar5.activity as number,
            respiration: parsedInput.apgar5.respiration as number,
          },
        ],
        { onConflict: "pregnancy_id,minute" },
      );

      if (apgarError) throw new Error(apgarError.message);
    }

    if (parsedInput.description) {
      const { error: evolutionError } = await supabase.from("patient_evolutions").insert({
        patient_id: parsedInput.patientId,
        professional_id: user.id,
        content: parsedInput.description,
      });

      if (evolutionError) throw new Error(evolutionError.message);
    }

    revalidatePath("/patients");
    updateTag(`home-patients-${user.id}`);
    updateTag(`home-data-${user.id}`);

    const { data: patient } = await supabase
      .from("patients")
      .select("id, name")
      .eq("id", parsedInput.patientId)
      .single();

    if (patient) {
      sendWhatsAppToUser({ recipientType: "patient", recipientId: patient.id }, "care_finished", {
        patientName: patient.name,
      }).catch((err) => {
        console.error("[whatsapp] care_finished send failed", err);
      });
    }

    if (profile.enterprise_id) {
      updateTag(`enterprise-patients-${profile.enterprise_id}`);

      const deliveryLabel = parsedInput.deliveryMethod
        ? PREGNANCY_DELIVERY_METHOD[parsedInput.deliveryMethod]
        : null;
      insertActivityLog({
        supabaseAdmin,
        actionName: "Acompanhamento encerrado",
        description: patient
          ? `Acompanhamento de ${patient.name} encerrado${deliveryLabel ? ` (${deliveryLabel})` : ""}`
          : "Acompanhamento encerrado",
        actionType: "patient",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: parsedInput.patientId,
        metadata: { delivery_method: parsedInput.deliveryMethod ?? null },
      });
    }

    await captureServerEvent(user.id, "finish_patient_care", {
      patient_id: parsedInput.patientId,
    });

    return { success: true };
  });
