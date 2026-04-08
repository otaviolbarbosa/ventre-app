import { formatDate } from "@/lib/utils";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { Card } from "@ventre/ui/card";
import { Input } from "@ventre/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ventre/ui/table";
import Link from "next/link";

type SearchParams = Promise<{ q?: string }>;

export default async function PatientsPage({ searchParams }: { searchParams: SearchParams }) {
  const { q } = await searchParams;
  const supabase = await createServerSupabaseAdmin();

  let query = supabase
    .from("patients")
    .select("id, name, email, phone, date_of_birth, created_by, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (q) {
    query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
  }

  const { data: patients } = await query;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl text-foreground">Pacientes</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            {patients?.length ?? 0} paciente(s) encontrado(s)
          </p>
        </div>
      </div>

      <form method="GET" className="mb-4">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome, e-mail ou telefone..."
          className="max-w-sm"
        />
      </form>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Nascimento</TableHead>
              <TableHead>Cadastrado em</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients?.map((patient) => (
              <TableRow key={patient.id}>
                <TableCell className="font-medium">{patient.name}</TableCell>
                <TableCell className="text-muted-foreground">{patient.email ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{patient.phone}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(patient.date_of_birth)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(patient.created_at)}
                </TableCell>
                <TableCell>
                  <Link href={`/patients/${patient.id}`} className="text-primary hover:underline">
                    Editar
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {(!patients || patients.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Nenhum paciente encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
