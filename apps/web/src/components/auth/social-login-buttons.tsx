"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import CustomIcon from "@/components/shared/custom-icon";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

interface SocialLoginButtonsProps {
  redirectTo?: string;
}

function GoogleIcon() {
  return <CustomIcon icon="google" />;
}

export function SocialLoginButtons({ redirectTo }: SocialLoginButtonsProps) {
  const { signInWithGoogle } = useAuth();
  const [loadingProvider, setLoadingProvider] = useState<null | "google">(null);

  const handleGoogleLogin = async () => {
    setLoadingProvider("google");
    const { error } = await signInWithGoogle(redirectTo);

    if (error) {
      const errorMessage =
        typeof error === "object" && error !== null && "message" in error
          ? (error as { message?: string }).message
          : "Ocorreu um erro desconhecido.";
      toast.error("Erro ao fazer login com Google", {
        description: errorMessage,
      });
      setLoadingProvider(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Button
        size="xl"
        variant="outline"
        className="w-full bg-white"
        onClick={handleGoogleLogin}
        disabled={loadingProvider !== null}
      >
        {loadingProvider === "google" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        Continuar com Google
      </Button>
    </div>
  );
}
