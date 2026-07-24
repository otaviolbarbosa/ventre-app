"use client";

import { Button } from "@ventre/ui/button";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import ventreIcon from "@/assets/ventre-icon-light-p-0.png";
import ventreLogo from "@/assets/ventre-light.png";
import { useAuth } from "@/providers/auth-provider";

const HIDE_WELCOME_PAGE = "hide_welcome_page";

export default function LandingScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/home");
    }
  }, [loading, user, router]);

  const handleStart = () => {
    const showWelcomePage = !localStorage.getItem(HIDE_WELCOME_PAGE);
    router.replace(showWelcomePage ? "/welcome" : "/login");
  };

  return (
    <div className="relative flex h-svh w-full flex-col overflow-hidden bg-[#7f2d2c]">
      {/* Bottom-left decorative icon, bleeding off the corner */}
      <div className="pointer-events-none absolute bottom-0 left-0 h-56 w-56 translate-x-[-36%] translate-y-[44%] sm:h-64 sm:w-64">
        <Image
          src={ventreIcon}
          alt=""
          className="h-full w-full rotate-[25deg] object-contain opacity-50"
        />
      </div>
      {/* Ambient glow */}
      <div className="-translate-x-1/2 absolute top-[18%] left-1/2 h-72 w-72 rounded-full bg-[#e09c03]/10 blur-[100px]" />

      {/* Center lockup */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-10">
        <div className="w-full max-w-[280px] animate-intro-logo-in">
          <Image src={ventreLogo} alt="Ventre" priority className="h-auto w-full" />
        </div>

        {/* progess bar */}
        {/* <div className="mt-8 h-1.5 w-full max-w-[280px] overflow-hidden rounded-full bg-[#a36552]">
					<div className="h-full w-full origin-left animate-intro-progress rounded-full bg-[#e09c03]" />
				</div> */}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 mx-auto flex max-w-[500px] flex-col items-center justify-center gap-8 p-8">
        <p className="relative z-10 text-center font-medium font-poppins text-[#f4e3d3] text-lg">
          Organize gestantes e toda a jornada de cuidado em um só lugar.
        </p>

        <Button
          variant="secondary"
          size="xl"
          className="w-full font-semibold text-xl"
          onClick={handleStart}
          disabled={loading || !!user}
        >
          {(loading || !!user) && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
          Iniciar
        </Button>
      </div>

      <style>{`
        @keyframes intro-logo-in {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes intro-progress {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes intro-icon-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-intro-logo-in {
          animation: intro-logo-in 2.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .animate-intro-progress {
          animation: intro-progress 2.2s cubic-bezier(0.65, 0, 0.35, 1) 0.3s both;
        }
      `}</style>
    </div>
  );
}
