"use client";
import { Header } from "@/components/layouts/header";
import { Card, CardContent } from "@/components/ui/card";
import type { Tables } from "@nascere/supabase";

type HomeScreenProps = {
  profile: Tables<"users">;
};

export default function HomeScreen({ profile }: HomeScreenProps) {
  return (
    <div>
      <Header title={`Olá, ${profile.name ?? "amiga!"}!`} />

      <div className="space-y-2 px-4">
        <h1 className="font-medium font-poppins text-xl">Minhas Gestantes</h1>
        <Card>
          <CardContent className="flex gap-2 divide-x p-4">
            <div className="flex-1 items-center justify-center gap-2 space-y-2 text-center">
              <div className="font-medium text-sm">1ª Trim.</div>
              <div className="flex items-center justify-around">
                <div className="font-semibold text-3xl">2</div>
              </div>
            </div>
            <div className="flex-1 items-center justify-center gap-2 space-y-2 text-center">
              <div className="font-medium text-sm">2ª Trim.</div>
              <div className="flex items-center justify-around">
                <div className="font-semibold text-3xl">2</div>
              </div>
            </div>
            <div className="flex-1 items-center justify-center gap-2 space-y-2 text-center">
              <div className="font-medium text-sm">3ª Trim.</div>
              <div className="flex items-center justify-around">
                <div className="font-semibold text-3xl">2</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <h1 className="font-medium font-poppins text-xl">Próximas consultas</h1>
        {/* <Card></Card> */}
      </div>
    </div>
  );
}
