"use server";

import { fetchBirthModeTimelineData } from "@/lib/birth-mode-timeline-data";
import { buildPartographPdfFileName, renderPartographPdfBuffer } from "@/lib/partograph-pdf";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

export const exportPartographPdfAction = authActionClient
  .inputSchema(z.object({ pregnancyId: z.string().uuid() }))
  .action(async ({ parsedInput: { pregnancyId }, ctx: { supabase } }) => {
    const { events, patientName } = await fetchBirthModeTimelineData(supabase, pregnancyId);
    const buffer = await renderPartographPdfBuffer({
      patientName: patientName ?? "Paciente",
      events,
    });
    return {
      pdfBase64: buffer.toString("base64"),
      fileName: buildPartographPdfFileName(patientName ?? "Paciente"),
    };
  });
