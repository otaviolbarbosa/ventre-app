import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { UserCreateForm } from "./_components/user-create-form";

export default async function NewUserPage() {
  const supabase = await createServerSupabaseAdmin();

  const { data: enterprises } = await supabase.from("enterprises").select("id, name").order("name");

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-foreground">Novo Usuário</h1>
        <p className="mt-1 text-muted-foreground text-sm">Criar um novo usuário na plataforma</p>
      </div>
      <UserCreateForm enterprises={enterprises ?? []} />
    </div>
  );
}
