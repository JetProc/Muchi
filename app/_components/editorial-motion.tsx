"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  type AnchorHTMLAttributes,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
} from "react";

export type MotionIntent =
  | "forward"
  | "back"
  | "tab"
  | "modal"
  | "replace"
  | "shared";

type ViewTransitionHandle = {
  finished: Promise<void>;
  ready?: Promise<void>;
  updateCallbackDone?: Promise<void>;
  skipTransition?: () => void;
};

type TransitionDocument = Document & {
  startViewTransition?: (
    update: () => void | Promise<void>,
  ) => ViewTransitionHandle;
};

const ROUTE_COMMIT_TIMEOUT_MS = 600;
let activeTransition: ViewTransitionHandle | null = null;
let fallbackTimer: number | null = null;
let navigationSequence = 0;

function clearSharedTransitionElements() {
  document.querySelectorAll<HTMLElement>(".has-shared-transition")
    .forEach((element) => element.classList.remove("has-shared-transition"));
}

function findSharedTransitionCandidate(
  sharedId?: string,
  sourceElement?: HTMLElement,
) {
  const key = sharedArtworkKey(sharedId);
  if (!key) return null;

  const matches = (element: Element | null | undefined): element is HTMLElement => (
    element instanceof HTMLElement
    && element.dataset.sharedTransitionId === key
  );
  const closestCandidate = sourceElement?.closest<HTMLElement>("[data-shared-transition-id]");
  if (matches(closestCandidate)) return closestCandidate;

  const sourceScope = sourceElement?.closest<HTMLElement>(
    ".track-line, .chapter-library-card, .album-feature, .child-chapter-row, article, section",
  );
  const scopedCandidate = sourceScope
    ? Array.from(sourceScope.querySelectorAll<HTMLElement>("[data-shared-transition-id]"))
      .find(matches)
    : null;
  if (scopedCandidate) return scopedCandidate;

  return Array.from(document.querySelectorAll<HTMLElement>("[data-shared-transition-id]"))
    .find(matches) ?? null;
}

function markSharedTransitionElement(
  sharedId?: string,
  sourceElement?: HTMLElement,
) {
  clearSharedTransitionElements();
  const candidate = findSharedTransitionCandidate(sharedId, sourceElement);
  candidate?.classList.add("has-shared-transition");
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function setMotionIntent(intent: MotionIntent, sharedId?: string) {
  document.documentElement.dataset.motionIntent = intent;
  if (sharedId) document.documentElement.dataset.sharedMotionId = sharedId;
  else delete document.documentElement.dataset.sharedMotionId;
}

function cancelActiveTransition() {
  activeTransition?.skipTransition?.call(activeTransition);
  activeTransition = null;
  document.documentElement.classList.remove("has-native-transition");
  clearSharedTransitionElements();
  if (fallbackTimer !== null) {
    window.clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
}

function consumeTransitionRejections(transition: ViewTransitionHandle) {
  void transition.ready?.catch(() => undefined);
  void transition.updateCallbackDone?.catch(() => undefined);
}

function canUseNativeTransition(transitionDocument: TransitionDocument) {
  return Boolean(transitionDocument.startViewTransition);
}

function focusDestination() {
  const target = document.querySelector<HTMLElement>(".route-stage [data-route-autofocus]")
    ?? Array.from(document.querySelectorAll<HTMLElement>(
      ".route-stage h1, .route-stage h2",
    )).find((candidate) => !candidate.closest(".sr-only"))
    ?? document.querySelector<HTMLElement>("#main-content");
  if (!target) return;

  const temporaryTabIndex = !target.hasAttribute("tabindex");
  if (temporaryTabIndex) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  if (temporaryTabIndex) {
    target.addEventListener("blur", () => target.removeAttribute("tabindex"), {
      once: true,
    });
  }
}

function clearTransitionState(root: HTMLElement, sequence: number): boolean {
  if (sequence !== navigationSequence) return false;
  root.classList.remove("is-navigating");
  root.classList.remove("has-native-transition");
  clearSharedTransitionElements();
  activeTransition = null;
  fallbackTimer = null;
  return true;
}

function finishNavigation(root: HTMLElement, sequence: number) {
  if (!clearTransitionState(root, sequence)) return;
  focusDestination();
}

function navigateAndWaitForRouteCommit(navigate: () => void): Promise<void> {
  const previousStage = document.querySelector(".route-stage");
  const previousRouteKey = previousStage?.getAttribute("data-route-key");

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = 0;
    const observer = new MutationObserver(() => checkForCommit());

    const settle = () => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearTimeout(timeoutId);
      resolve();
    };

    const checkForCommit = () => {
      const currentStage = document.querySelector(".route-stage");
      const currentRouteKey = currentStage?.getAttribute("data-route-key");
      if (
        !previousStage
        || !previousStage.isConnected
        || currentStage !== previousStage
        || currentRouteKey !== previousRouteKey
      ) {
        settle();
      }
    };

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-route-key"],
    });
    timeoutId = window.setTimeout(settle, ROUTE_COMMIT_TIMEOUT_MS);
    navigate();
    window.requestAnimationFrame(checkForCommit);
  });
}

function runNavigation(
  navigate: () => void,
  intent: MotionIntent,
  sharedId?: string,
  sourceElement?: HTMLElement,
) {
  const root = document.documentElement;
  const reduced = root.dataset.reduceMotion === "true";
  const transitionDocument = document as TransitionDocument;

  cancelActiveTransition();
  const sequence = ++navigationSequence;
  setMotionIntent(intent, sharedId);
  root.classList.add("is-navigating");

  if (!reduced && canUseNativeTransition(transitionDocument)) {
    try {
      root.classList.add("has-native-transition");
      markSharedTransitionElement(sharedId, sourceElement);
      const transition = transitionDocument.startViewTransition(async () => {
        await navigateAndWaitForRouteCommit(navigate);
        markSharedTransitionElement(sharedId);
      });
      consumeTransitionRejections(transition);
      activeTransition = transition;
      void transition.finished
        .catch(() => undefined)
        .finally(() => finishNavigation(root, sequence));
      return;
    } catch {
      activeTransition = null;
      root.classList.remove("has-native-transition");
    }
  }

  window.requestAnimationFrame(() => {
    navigate();
    fallbackTimer = window.setTimeout(
      () => finishNavigation(root, sequence),
      reduced ? 140 : 560,
    );
  });
}

export function MotionProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const handleHistoryNavigation = () => {
      cancelActiveTransition();
      const sequence = ++navigationSequence;
      const root = document.documentElement;
      setMotionIntent("back");
      root.classList.add("is-navigating");
      fallbackTimer = window.setTimeout(
        () => finishNavigation(root, sequence),
        root.dataset.reduceMotion === "true" ? 140 : 560,
      );
    };
    window.addEventListener("popstate", handleHistoryNavigation);
    return () => window.removeEventListener("popstate", handleHistoryNavigation);
  }, []);

  return children;
}

export function transitionEditorialUI(
  update: () => void,
  intent: MotionIntent = "modal",
  sharedId?: string,
) {
  const root = document.documentElement;
  const transitionDocument = document as TransitionDocument;
  const reduced = root.dataset.reduceMotion === "true";

  cancelActiveTransition();
  const sequence = ++navigationSequence;
  setMotionIntent(intent);
  root.classList.add("is-navigating");

  if (!reduced && canUseNativeTransition(transitionDocument)) {
    try {
      root.classList.add("has-native-transition");
      markSharedTransitionElement(sharedId);
      const transition = transitionDocument.startViewTransition(() => {
        update();
        markSharedTransitionElement(sharedId);
      });
      consumeTransitionRejections(transition);
      activeTransition = transition;
      void transition.finished
        .catch(() => undefined)
        .finally(() => clearTransitionState(root, sequence));
      return;
    } catch {
      activeTransition = null;
      root.classList.remove("has-native-transition");
    }
  }

  update();
  fallbackTimer = window.setTimeout(
    () => clearTransitionState(root, sequence),
    reduced ? 140 : 480,
  );
}

export function useMotionRouter() {
  const router = useRouter();

  const push = useCallback(
    (href: string, intent: MotionIntent = "forward", sharedId?: string) => {
      runNavigation(() => router.push(href), intent, sharedId);
    },
    [router],
  );

  const replace = useCallback(
    (href: string, intent: MotionIntent = "replace", sharedId?: string) => {
      runNavigation(() => router.replace(href), intent, sharedId);
    },
    [router],
  );

  const back = useCallback(() => {
    runNavigation(() => router.back(), "back");
  }, [router]);

  return useMemo(
    () => ({ ...router, push, replace, back }),
    [back, push, replace, router],
  );
}

export type MotionRouter = ReturnType<typeof useMotionRouter>;

type MotionLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  children: ReactNode;
  href: string;
  intent?: MotionIntent;
  sharedId?: string;
};

export function MotionLink({
  children,
  href,
  intent = "forward",
  sharedId,
  onClick,
  target,
  ...props
}: MotionLinkProps) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      isModifiedClick(event) ||
      target === "_blank" ||
      !href.startsWith("/")
    ) return;

    event.preventDefault();
    runNavigation(() => router.push(href), intent, sharedId, event.currentTarget);
  }

  return (
    <a {...props} href={href} target={target} onClick={handleClick}>
      {children}
    </a>
  );
}

export function RouteStage({
  children,
  view,
  queryKey,
}: {
  children: ReactNode;
  view: string;
  queryKey?: string | null;
}) {
  const pathname = usePathname();
  return (
    <div
      className="route-stage"
      data-route={view}
      data-route-key={`${pathname}:${queryKey ?? ""}`}
      key={`${pathname}:${queryKey ?? ""}`}
    >
      {children}
    </div>
  );
}

export function sharedArtworkStyle(id?: string | null) {
  const key = sharedArtworkKey(id);
  return key
    ? { "--shared-transition-name": `art-${key}` } as CSSProperties
    : undefined;
}

export function sharedArtworkKey(id?: string | null) {
  return id?.replace(/[^a-zA-Z0-9_-]/g, "-") || undefined;
}
