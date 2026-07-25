"use client";

import { useEffect, useState } from "react";

const DEFAULT_WORDS = ["obstetras", "enfermeiras", "doulas", "gestantes"];

const TYPING_MS = 85;
const DELETING_MS = 40;
const PAUSE_AFTER_TYPED_MS = 1600;
const PAUSE_AFTER_DELETED_MS = 350;

interface RotatingHeroWordProps {
	words?: string[];
}

export function RotatingHeroWord({
	words = DEFAULT_WORDS,
}: RotatingHeroWordProps) {
	const [wordIndex, setWordIndex] = useState(0);
	const [charCount, setCharCount] = useState(0);
	const [isDeleting, setIsDeleting] = useState(false);

	const currentWord = words[wordIndex] ?? "";

	useEffect(() => {
		// Each tick advances the caret by one character; the pauses happen at the
		// two turning points (word fully typed / fully erased).
		const isFullyTyped = !isDeleting && charCount === currentWord.length;
		const isFullyErased = isDeleting && charCount === 0;

		let delay = isDeleting ? DELETING_MS : TYPING_MS;
		if (isFullyTyped) delay = PAUSE_AFTER_TYPED_MS;
		if (isFullyErased) delay = PAUSE_AFTER_DELETED_MS;

		const timeout = setTimeout(() => {
			if (isFullyTyped) {
				setIsDeleting(true);
				return;
			}
			if (isFullyErased) {
				setIsDeleting(false);
				setWordIndex((current) => (current + 1) % words.length);
				return;
			}
			setCharCount((count) => count + (isDeleting ? -1 : 1));
		}, delay);

		return () => clearTimeout(timeout);
	}, [charCount, isDeleting, currentWord.length, words.length]);

	const longestWord = words.reduce(
		(longest, word) => (word.length > longest.length ? word : longest),
		"",
	);

	return (
		<span className="relative inline-grid align-bottom">
			{/* Reserves the widest word's footprint so the headline never reflows */}
			<span aria-hidden className="invisible col-start-1 row-start-1">
				{longestWord}
			</span>
			<span
				aria-live="polite"
				className="col-start-1 row-start-1 justify-self-start text-left"
			>
				{currentWord.slice(0, charCount)}
				<span
					aria-hidden
					className="animate-caret-blink ml-0.5 font-normal text-primary"
				>
					|
				</span>
			</span>
		</span>
	);
}
