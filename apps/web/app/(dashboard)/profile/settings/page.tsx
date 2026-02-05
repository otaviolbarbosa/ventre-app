import { Header } from "@/components/layouts/header";

export default function SettingsPage() {
  return (
    <div className="flex h-screen flex-1 flex-col">
      <Header title="Configurações" back />
      <div className="flex flex-1 items-center justify-center">Settings</div>
    </div>
  );
}
