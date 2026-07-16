"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function useModalFocus<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
): RefObject<T | null> {
  const containerRef = useRef<T>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const container = containerRef.current;
    if (!container) return;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    const scrollViewport = container.closest(".app-shell")
      ?.querySelector<HTMLElement>(".shell-main") ?? null;
    const fallbackFocus = scrollViewport;
    const previousViewportOverflow = scrollViewport?.style.overflowY ?? "";
    document.body.style.overflow = "hidden";
    if (scrollViewport) scrollViewport.style.overflowY = "hidden";

    const getFocusable = () => Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter((element) => element.getClientRects().length > 0);

    const focusFrame = window.requestAnimationFrame(() => {
      const first = getFocusable()[0];
      if (first) first.focus({ preventScroll: true });
      else {
        container.setAttribute("tabindex", "-1");
        container.focus({ preventScroll: true });
      }
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (scrollViewport) scrollViewport.style.overflowY = previousViewportOverflow;
      if (container.getAttribute("tabindex") === "-1") {
        container.removeAttribute("tabindex");
      }
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      else fallbackFocus?.focus({ preventScroll: true });
    };
  }, [open]);

  return containerRef;
}
