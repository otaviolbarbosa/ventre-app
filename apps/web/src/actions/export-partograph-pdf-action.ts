"use server";

import { fetchBirthModeTimelineData } from "@/lib/birth-mode-timeline-data";
import { fetchPartographHeaderInfo } from "@/lib/partograph-header-data";
import { renderPartographImageBuffer } from "@/lib/partograph-image";
import { buildPartographPdfFileName, renderPartographPdfBuffer } from "@/lib/partograph-pdf";
import { uploadPartographImage } from "@/lib/partograph-storage";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

export const exportPartographPdfAction = authActionClient
  .inputSchema(z.object({ pregnancyId: z.string().uuid() }))
  .action(async ({ parsedInput: { pregnancyId }, ctx: { supabase, supabaseAdmin } }) => {
    const [{ events, patientName }, headerInfo] = await Promise.all([
      fetchBirthModeTimelineData(supabase, pregnancyId),
      fetchPartographHeaderInfo(supabase, pregnancyId),
    ]);
    const imageBuffer = events.length > 0 ? await renderPartographImageBuffer(events) : null;

    if (imageBuffer) {
      try {
        await uploadPartographImage({ supabaseAdmin, pregnancyId, buffer: imageBuffer });
      } catch (error) {
        // Best-effort: the Storage copy is an audit artifact, not required for the
        // export itself — the buffer already in memory is what goes into the PDF.
        console.error("[exportPartographPdfAction] falha ao salvar imagem no storage", error);
      }
    }

    const buffer = await renderPartographPdfBuffer({ headerInfo, imageBuffer });
    return {
      pdfBase64: buffer.toString("base64"),
      fileName: buildPartographPdfFileName(patientName ?? "Paciente"),
    };
  });
