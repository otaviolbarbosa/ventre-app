// Server-only module. Never import from client components.
import type { createServerSupabaseAdmin } from "@ventre/supabase/server";

type SupabaseAdmin = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;

export async function uploadPartographImage({
  supabaseAdmin,
  pregnancyId,
  buffer,
}: {
  supabaseAdmin: SupabaseAdmin;
  pregnancyId: string;
  buffer: Buffer;
}): Promise<{ storagePath: string }> {
  const storagePath = `${pregnancyId}/partograma_${Date.now()}.png`;

  const { error } = await supabaseAdmin.storage
    .from("partograph")
    .upload(storagePath, buffer, { contentType: "image/png", upsert: false });

  if (error) throw new Error(error.message);

  return { storagePath };
}
