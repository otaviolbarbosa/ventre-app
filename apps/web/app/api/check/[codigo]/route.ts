import { createHash } from "node:crypto";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { NextResponse } from "next/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB — signed contract PDFs are small text documents

export async function POST(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  try {
    const { codigo } = await params;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Envie um arquivo PDF" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Arquivo muito grande. O tamanho máximo é 10MB." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const computedHash = createHash("sha256").update(buffer).digest("hex");

    const supabaseAdmin = await createServerSupabaseAdmin();
    const { data: contract } = await supabaseAdmin
      .from("contracts")
      .select("is_signed, signed_at, signed_by, content_hash")
      .eq("verification_code", codigo)
      .maybeSingle();

    if (!contract?.is_signed || !contract.content_hash) {
      return NextResponse.json({ valid: false });
    }

    if (computedHash !== contract.content_hash) {
      return NextResponse.json({ valid: false });
    }

    let signedByName: string | null = null;
    if (contract.signed_by) {
      const { data: signer } = await supabaseAdmin
        .from("users")
        .select("name")
        .eq("id", contract.signed_by)
        .maybeSingle();
      signedByName = signer?.name ?? null;
    }

    return NextResponse.json({
      valid: true,
      signedByName,
      signedAt: contract.signed_at,
    });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
