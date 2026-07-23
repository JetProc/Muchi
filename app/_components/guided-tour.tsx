"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { GUIDED_TOUR_STEPS } from "@/lib/guided-tour";
import { useModalFocus } from "./editorial-accessibility";
import { useMotionRouter } from "./editorial-motion";
import { useMuchiData } from "./muchi-data-provider";

type TargetRect = {
  target: string;
  top: number;
  left: number;
  width: number;
  height: number;
  viewportHeight: number;
};

const keepTourOpen = () => undefined;

function currentHref(pathname: string, searchParams: URLSearchParams) {
  const query = searchParams.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}

export function GuidedTourOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useMotionRouter();
  const {
    guidedTourActive,
    guidedTourStep,
    guidedTourSaving,
    guidedTourError,
    setGuidedTourStep,
    completeGuidedTour,
  } = useMuchiData();
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const dialogRef = useModalFocus<HTMLDivElement>(guidedTourActive, keepTourOpen);
  const step = GUIDED_TOUR_STEPS[guidedTourStep] ?? GUIDED_TOUR_STEPS[0];
  const isLast = guidedTourStep === GUIDED_TOUR_STEPS.length - 1;
  const routeHref = useMemo(
    () => currentHref(pathname, new URLSearchParams(searchParams.toString())),
    [pathname, searchParams],
  );

  useEffect(() => {
    if (!guidedTourActive || routeHref === step.href) return;
    router.replace(step.href, "replace");
  }, [guidedTourActive, routeHref, router, step.href]);

  useEffect(() => {
    if (!guidedTourActive || routeHref !== step.href) return;
    let frame = 0;
    const updateTarget = () => {
      const target = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!target) {
        setTargetRect(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      const shellRect = target.closest<HTMLElement>(".app-shell")?.getBoundingClientRect()
        ?? { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
      setTargetRect({
        target: step.target,
        top: Math.max(8, rect.top - shellRect.top - 6),
        left: Math.max(8, rect.left - shellRect.left - 6),
        width: Math.min(shellRect.width - 16, rect.width + 12),
        height: Math.min(shellRect.height - 16, rect.height + 12),
        viewportHeight: shellRect.height,
      });
    };
    const revealTarget = () => {
      const target = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      target?.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
      frame = window.requestAnimationFrame(updateTarget);
    };
    revealTarget();
    const mutationObserver = new MutationObserver(revealTarget);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    const resizeObserver = new ResizeObserver(updateTarget);
    const target = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (target) resizeObserver.observe(target);
    window.addEventListener("resize", updateTarget);
    window.addEventListener("scroll", updateTarget, true);
    return () => {
      window.cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateTarget);
      window.removeEventListener("scroll", updateTarget, true);
    };
  }, [guidedTourActive, routeHref, step.target, step.href]);

  const finish = useCallback(async () => {
    if (await completeGuidedTour()) router.replace("/capture", "replace");
  }, [completeGuidedTour, router]);

  if (!guidedTourActive) return null;

  const visibleTargetRect = routeHref === step.href && targetRect?.target === step.target
    ? targetRect
    : null;
  const spotlightStyle = visibleTargetRect ? {
    "--tour-target-top": `${visibleTargetRect.top}px`,
    "--tour-target-left": `${visibleTargetRect.left}px`,
    "--tour-target-width": `${visibleTargetRect.width}px`,
    "--tour-target-height": `${visibleTargetRect.height}px`,
  } as CSSProperties : undefined;
  const cardPlacement = visibleTargetRect
    && visibleTargetRect.top + visibleTargetRect.height / 2 > visibleTargetRect.viewportHeight / 2
    ? "top"
    : "bottom";

  return (
    <div
      className="guided-tour-layer"
      data-has-target={visibleTargetRect ? "true" : "false"}
      data-card-placement={cardPlacement}
    >
      <div className="guided-tour-shade" aria-hidden="true" />
      {visibleTargetRect ? <div className="guided-tour-spotlight" style={spotlightStyle} aria-hidden="true" /> : null}
      <div
        ref={dialogRef}
        className="guided-tour-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-tour-title"
        aria-describedby="guided-tour-description"
      >
        <div className="guided-tour-progress-row">
          <span>{step.eyebrow}</span>
          <strong>{guidedTourStep + 1} / {GUIDED_TOUR_STEPS.length}</strong>
        </div>
        <div
          className="guided-tour-progress"
          role="progressbar"
          aria-label="기능 둘러보기 진행률"
          aria-valuemin={1}
          aria-valuemax={GUIDED_TOUR_STEPS.length}
          aria-valuenow={guidedTourStep + 1}
        >
          <span style={{ width: `${((guidedTourStep + 1) / GUIDED_TOUR_STEPS.length) * 100}%` }} />
        </div>
        <h2 id="guided-tour-title">{step.title}</h2>
        <p id="guided-tour-description">{step.description}</p>
        {guidedTourError ? (
          <p className="guided-tour-error" role="alert">
            {guidedTourError} <button type="button" onClick={() => void finish()}>투어 다시 시도</button>
          </p>
        ) : null}
        <div className="guided-tour-actions">
          <button
            className="button guided-tour-previous"
            type="button"
            disabled={guidedTourStep === 0 || guidedTourSaving}
            onClick={() => setGuidedTourStep(Math.max(0, guidedTourStep - 1))}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            이전
          </button>
          <button
            className="button button-primary"
            type="button"
            data-modal-autofocus
            disabled={guidedTourSaving}
            onClick={() => {
              if (isLast) void finish();
              else setGuidedTourStep(guidedTourStep + 1);
            }}
          >
            {guidedTourSaving ? "완료 저장 중" : isLast ? "첫 곡 기록하기" : "다음"}
            {!isLast ? <ArrowRight size={16} aria-hidden="true" /> : null}
          </button>
        </div>
      </div>
    </div>
  );
}
