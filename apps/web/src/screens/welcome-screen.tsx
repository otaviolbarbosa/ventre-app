"use client";

import { Button } from "@ventre/ui/button";
import Image, { type StaticImageData } from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ventreLogo from "@/assets/ventre.png";
import welcomeSlide1 from "@/assets/welcome-slide-1.png";
import welcomeSlide2 from "@/assets/welcome-slide-2.png";
import welcomeSlide3 from "@/assets/welcome-slide-3.png";

const TRANSITION_MS = 500;
const FADE_MS = TRANSITION_MS / 2;

type SlideData = { image: StaticImageData; title: string; description: string };

const slides: SlideData[] = [
	{
		image: welcomeSlide1,
		title: "Cuide com organização",
		description:
			"Acompanhe cada gestante com todas as informações centralizadas em um só lugar.",
	},
	{
		image: welcomeSlide2,
		title: "Trabalhe em equipe",
		description:
			"Convide profissionais e colabore no cuidado de cada paciente em tempo real.",
	},
	{
		image: welcomeSlide3,
		title: "Fique por dentro de tudo",
		description:
			"Receba notificações e nunca perca um compromisso ou atualização importante.",
	},
];

const FALLBACK_SLIDE = slides[0];

export default function WelcomeScreen() {
	const router = useRouter();
	const [step, setStep] = useState(0);
	const [displayStep, setDisplayStep] = useState(0);
	const [contentVisible, setContentVisible] = useState(true);
	const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);

	useEffect(() => {
		return () => clearTimeout(fadeTimeoutRef.current);
	}, []);

	function goTo(next: number) {
		if (next === step) return;
		setStep(next);
		setContentVisible(false);
		clearTimeout(fadeTimeoutRef.current);
		fadeTimeoutRef.current = setTimeout(() => {
			setDisplayStep(next);
			setContentVisible(true);
		}, FADE_MS);
	}

	function handleNext() {
		goTo(Math.min(step + 1, slides.length - 1));
	}

	function handleStart() {
		localStorage.setItem("hide_welcome_page", "true");
		router.replace("/login");
	}

	const isLast = displayStep === slides.length - 1;
	const { title, description } = (slides[displayStep] ??
		FALLBACK_SLIDE) as SlideData;

	return (
		<div className="flex h-svh w-full flex-col bg-background">
			<div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden py-8">
				<div className="w-full px-8">
					<Image
						src={ventreLogo}
						alt="logo"
						className="object-contain"
						width={140}
						height={140}
					/>
				</div>
				{/* <div className="absolute top-0 h-[70%] w-[70%] items-center justify-center rounded-b-full bg-secondary/50" /> */}
				{/* Only the icon slides laterally */}

				<div className="flex h-full w-full justify-center overflow-hidden">
					<div
						className="flex transition-transform ease-[cubic-bezier(0.65,0,0.35,1)]"
						style={{
							transform: `translateX(-${step * 100}%)`,
							transitionDuration: `${TRANSITION_MS}ms`,
						}}
					>
						{slides.map(({ image, title: slideTitle }) => (
							<div
								key={slideTitle}
								className="flex w-full shrink-0 items-center justify-center"
							>
								<div className="flex h-[80%] w-[80%] items-center justify-center sm:h-80 sm:w-80">
									<Image
										src={image}
										alt={slideTitle}
										className="object-contain drop-shadow-lg"
										priority
									/>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Fixed text, fades out/in on transition */}
				<div
					className="mt-8 max-w-xs space-y-3 text-center transition-opacity ease-in-out"
					style={{
						opacity: contentVisible ? 1 : 0,
						transitionDuration: `${FADE_MS}ms`,
					}}
				>
					<h1 className="font-bold font-poppins text-2xl text-foreground tracking-tight">
						{title}
					</h1>
					<p className="text-muted-foreground leading-relaxed">{description}</p>
				</div>
			</div>

			<div className="flex items-center justify-between px-8 pb-10">
				{/* Fixed step indicator, animated */}
				<div className="flex items-center gap-2">
					{slides.map((slide, dotIndex) => (
						<span
							key={slide.title}
							className="h-1.5 rounded-full bg-secondary shadow transition-all ease-[cubic-bezier(0.65,0,0.35,1)]"
							style={{
								width: dotIndex === step ? "2.5rem" : "0.375rem",
								backgroundColor:
									dotIndex === step
										? "hsl(var(--primary))"
										: "hsl(var(--secondary))",
								transitionDuration: `${TRANSITION_MS}ms`,
							}}
						/>
					))}
				</div>

				<div className="flex gap-2">
					{isLast ? (
						<Button className="w-full" size="lg" onClick={handleStart}>
							Iniciar
						</Button>
					) : (
						<>
							<Button variant="ghost" onClick={handleStart}>
								Pular
							</Button>
							<Button onClick={handleNext}>Avançar</Button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
