import { useEffect, useRef, useState } from "react";

export function useScrollDirection() {
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  const lastScrollTop = useRef(0);

  useEffect(() => {
    function handleScroll(e: Event) {
      const target = e.target === document ? document.documentElement : (e.target as HTMLElement);
      const currentScrollTop = target.scrollTop ?? window.scrollY;

      if (target.nodeName !== "MAIN") return;

      if (currentScrollTop > lastScrollTop.current) {
        setIsScrollingDown(true);
      } else if (currentScrollTop < lastScrollTop.current) {
        setIsScrollingDown(false);
      }

      lastScrollTop.current = currentScrollTop;
    }

    // scroll events don't bubble, so listen in the capture phase to catch
    // scrolling from any nested scrollable container (e.g. <main overflow-y-auto>)
    document.addEventListener("scroll", handleScroll, {
      passive: true,
      capture: true,
    });
    return () => document.removeEventListener("scroll", handleScroll, { capture: true });
  }, []);

  return isScrollingDown;
}
