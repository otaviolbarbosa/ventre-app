"use server";

import { renderContractPdfBuffer, sanitizeClausesHtml } from "@/lib/contract-pdf";
import { buildSignatureLocalityLine } from "@/lib/contract-signature-text";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const contractHeaderBlocksSchema = z.object({
  contratanteBlock: z.string(),
  contratadaBlock: z.string(),
  teamMembersBlock: z.string().nullable(),
});

// Draft contracts have no real signature yet, but the preview should still show the
// signature footer (locality line + blank lines + party names) as it will look before
// finalization — stamps only render once both parties have actually signed.
const signaturePreviewSchema = z.object({
  city: z.string().nullable(),
  state: z.string().nullable(),
  contratanteName: z.string().nullable(),
  contratadaName: z.string().nullable(),
});

export const previewContractPdfAction = authActionClient
  .inputSchema(
    z.object({
      headerBlocks: contractHeaderBlocksSchema,
      title: z.string(),
      clausesHtml: z.string(),
      signaturePreview: signaturePreviewSchema.optional(),
    }),
  )
  .action(async ({ parsedInput: { headerBlocks, title, clausesHtml, signaturePreview } }) => {
    const buffer = await renderContractPdfBuffer({
      headerBlocks,
      title,
      clausesHtml: sanitizeClausesHtml(clausesHtml),
      signature: signaturePreview
        ? {
            localityLine: buildSignatureLocalityLine(
              signaturePreview.city,
              signaturePreview.state,
              new Date(),
            ),
            contratanteName: signaturePreview.contratanteName ?? "[não informado]",
            contratadaName: signaturePreview.contratadaName ?? "[não informado]",
          }
        : undefined,
    });

    return { pdfBase64: buffer.toString("base64") };
  });
