import { useEffect, useRef } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialog(onClose: () => void, initialFocusSelector?: string) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;

    const wanted = initialFocusSelector ? node?.querySelector<HTMLElement>(initialFocusSelector) : null;
    (wanted ?? node?.querySelector<HTMLElement>(FOCUSABLE))?.focus();

    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab" || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const edge = e.shiftKey ? items[0] : items[items.length - 1];
      if (document.activeElement === edge) {
        e.preventDefault();
        (e.shiftKey ? items[items.length - 1] : items[0]).focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = bodyOverflow;
      previous?.focus(); // tanpa ini, setelah dialog ditutup fokus hilang ke awal halaman
    };
  }, [onClose, initialFocusSelector]);

  return ref;
}