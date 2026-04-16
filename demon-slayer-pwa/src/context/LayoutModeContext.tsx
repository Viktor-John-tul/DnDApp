import { createContext, useContext, useEffect, useState } from "react";

type LayoutMode = "desktop" | "touch";

const LayoutModeContext = createContext<LayoutMode>("desktop");

const getLayoutMode = (): LayoutMode => {
  if (typeof window === "undefined") return "desktop";

  const ua = navigator.userAgent || "";
  const isMobileUa = /Android|iPhone|iPad|iPod/i.test(ua);
  const isDesktopUa = /Macintosh|Windows|Linux/i.test(ua) && !isMobileUa;
  const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
  const canHover = window.matchMedia("(hover: hover)").matches;
  const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  if (isDesktopUa || (hasFinePointer && canHover)) return "desktop";
  if (isMobileUa || hasCoarsePointer || maxTouchPoints > 0) return "touch";
  return "desktop";
};

export function LayoutModeProvider({ children }: { children: React.ReactNode }) {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => getLayoutMode());

  useEffect(() => {
    const update = () => setLayoutMode(getLayoutMode());
    const queries = [
      window.matchMedia("(pointer: fine)"),
      window.matchMedia("(pointer: coarse)"),
      window.matchMedia("(hover: hover)")
    ];

    queries.forEach((query) => query.addEventListener("change", update));
    window.addEventListener("resize", update);

    return () => {
      queries.forEach((query) => query.removeEventListener("change", update));
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.layout = layoutMode;
  }, [layoutMode]);

  return (
    <LayoutModeContext.Provider value={layoutMode}>
      {children}
    </LayoutModeContext.Provider>
  );
}

export function useLayoutMode() {
  return useContext(LayoutModeContext);
}
