"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

export type BottomSheetSnap = "collapsed" | "middle" | "expanded";
type BottomSheetHeight = number | `${number}%`;

type UseSwipeableBottomSheetOptions = {
  initialSnap: BottomSheetSnap;
  snapPoints: BottomSheetSnap[];
  snapHeights: Partial<Record<BottomSheetSnap, BottomSheetHeight>>;
  onDismiss?: () => void;
  onSnapChange?: (snap: BottomSheetSnap) => void;
  dragLimit?: number;
  dismissThreshold?: number;
};

const TEXT_ENTRY_SELECTOR = [
  "input",
  "textarea",
  "select",
  "[data-bottom-sheet-interactive='true']",
].join(",");

function resolveHeight(height: BottomSheetHeight | undefined, availableHeight: number): number {
  if (typeof height === "number") return height;
  if (typeof height === "string" && height.endsWith("%")) {
    return availableHeight * (Number.parseFloat(height) / 100);
  }
  return availableHeight * 0.56;
}

function getSheetFrame(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".app-shell");
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(TEXT_ENTRY_SELECTOR));
}

function hasHandle(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("[data-bottom-sheet-handle]"));
}

function getScrollContainer(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element
    ? target.closest<HTMLElement>("[data-bottom-sheet-scroll='true']")
    : null;
}

export function useSwipeableBottomSheet({
  initialSnap,
  snapPoints,
  snapHeights,
  onDismiss,
  onSnapChange,
  dragLimit = 48,
  dismissThreshold = 104,
}: UseSwipeableBottomSheetOptions) {
  const [snap, setSnap] = useState<BottomSheetSnap>(initialSnap);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTranslate, setDragTranslate] = useState<number | null>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const gestureRef = useRef<{
    pointerId: number;
    startY: number;
    baseTranslate: number;
    scrollContainer: HTMLElement | null;
    captured: boolean;
    dragged: boolean;
  } | null>(null);
  const draggedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const dragTranslateRef = useRef<number | null>(null);
  const bodyStylesRef = useRef<{ overscrollBehavior: string; touchAction: string } | null>(null);

  useEffect(() => {
    const appShell = getSheetFrame();
    if (!appShell) return;
    const updateFrame = () => setFrame({
      width: appShell.getBoundingClientRect().width,
      height: appShell.getBoundingClientRect().height,
    });
    updateFrame();
    const observer = new ResizeObserver(updateFrame);
    observer.observe(appShell);
    window.visualViewport?.addEventListener("resize", updateFrame);
    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener("resize", updateFrame);
    };
  }, []);

  const enabled = frame.width > 0 && frame.width <= 480;
  const availableHeight = frame.height || (typeof window === "undefined" ? 0 : window.innerHeight);
  const heights = useMemo(() => Object.fromEntries(
    snapPoints.map((point) => [point, Math.min(availableHeight, resolveHeight(snapHeights[point], availableHeight))]),
  ) as Record<BottomSheetSnap, number>, [availableHeight, snapHeights, snapPoints]);
  const maxHeight = Math.max(...snapPoints.map((point) => heights[point]), 0);
  const minHeight = Math.min(...snapPoints.map((point) => heights[point]), 0);
  const translateForSnap = useCallback((point: BottomSheetSnap) => Math.max(0, maxHeight - heights[point]), [heights, maxHeight]);
  const activeTranslate = dragTranslate ?? translateForSnap(snap);

  const updateSnap = useCallback((nextSnap: BottomSheetSnap) => {
    setSnap(nextSnap);
    onSnapChange?.(nextSnap);
  }, [onSnapChange]);

  const releaseBodyDrag = useCallback(() => {
    const previous = bodyStylesRef.current;
    if (!previous) return;
    document.body.style.overscrollBehavior = previous.overscrollBehavior;
    document.body.style.touchAction = previous.touchAction;
    bodyStylesRef.current = null;
  }, []);

  useEffect(() => releaseBodyDrag, [releaseBodyDrag]);

  function beginDrag(event: ReactPointerEvent<HTMLElement>) {
    if (!enabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    const onHandle = hasHandle(event.target);
    if (!onHandle && isTextEntryTarget(event.target)) return;
    gestureRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      baseTranslate: activeTranslate,
      scrollContainer: onHandle ? null : getScrollContainer(event.target),
      captured: false,
      dragged: false,
    };
  }

  function moveDrag(event: ReactPointerEvent<HTMLElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || !enabled) return;
    const delta = event.clientY - gesture.startY;

    if (!gesture.captured) {
      const shouldKeepScrolling = gesture.scrollContainer
        && snap === "expanded"
        && (gesture.scrollContainer.scrollTop > 0 || delta < 0);
      if (shouldKeepScrolling || Math.abs(delta) < 4) return;
      gesture.captured = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      bodyStylesRef.current = {
        overscrollBehavior: document.body.style.overscrollBehavior,
        touchAction: document.body.style.touchAction,
      };
      document.body.style.overscrollBehavior = "none";
      document.body.style.touchAction = "none";
      setIsDragging(true);
    }

    gesture.dragged = true;
    draggedRef.current = true;
    event.preventDefault();
    const minTranslate = -dragLimit;
    const maxTranslate = Math.max(0, maxHeight - minHeight) + dragLimit;
    const nextTranslate = Math.min(maxTranslate, Math.max(minTranslate, gesture.baseTranslate + delta));
    dragTranslateRef.current = nextTranslate;
    setDragTranslate(nextTranslate);
  }

  function endDrag(event: ReactPointerEvent<HTMLElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    if (!gesture.captured) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    releaseBodyDrag();
    setIsDragging(false);
    const releasedTranslate = dragTranslateRef.current ?? gesture.baseTranslate;
    const distance = releasedTranslate - gesture.baseTranslate;
    dragTranslateRef.current = null;
    setDragTranslate(null);

    if (distance > dismissThreshold && onDismiss) {
      onDismiss();
    } else {
      const nearest = snapPoints.reduce((current, candidate) => (
        Math.abs(releasedTranslate - translateForSnap(candidate)) < Math.abs(releasedTranslate - translateForSnap(current))
          ? candidate
          : current
      ));
      updateSnap(nearest);
    }
    suppressClickRef.current = gesture.dragged;
    window.setTimeout(() => {
      draggedRef.current = false;
      suppressClickRef.current = false;
    }, 0);
  }

  function suppressDraggedClick(event: ReactMouseEvent<HTMLElement>) {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function cycleSnap(event: ReactMouseEvent<HTMLElement>) {
    if (!enabled || draggedRef.current) {
      event.preventDefault();
      return;
    }
    const currentIndex = snapPoints.indexOf(snap);
    updateSnap(snapPoints[(currentIndex + 1) % snapPoints.length] ?? initialSnap);
  }

  const sheetStyle = useMemo<CSSProperties>(() => {
    if (!enabled || !maxHeight) return {};
    return {
      height: `${maxHeight}px`,
      transform: `translate3d(0, ${activeTranslate}px, 0)`,
    };
  }, [activeTranslate, enabled, maxHeight]);

  return {
    snap,
    isDragging,
    sheetStyle,
    sheetProps: {
      onPointerDownCapture: beginDrag,
      onPointerMoveCapture: moveDrag,
      onPointerUpCapture: endDrag,
      onPointerCancelCapture: endDrag,
      onClickCapture: suppressDraggedClick,
    } satisfies HTMLAttributes<HTMLElement>,
    dragHandleProps: {
      "data-bottom-sheet-handle": true,
      onClick: cycleSnap,
    },
  };
}
