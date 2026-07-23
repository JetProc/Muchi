import type { ArchiveEnvelopeV1 } from "@/lib/archive";

export type AppView =
  | "home"
  | "space"
  | "capture"
  | "inbox"
  | "chapters"
  | "chapter"
  | "chapterShare"
  | "memory"
  | "playlist"
  | "discover"
  | "discoverChapter"
  | "discoverProfile"
  | "search"
  | "recap"
  | "tags"
  | "settings"
  | "guide";

export type ArchiveCommit = (
  next: ArchiveEnvelopeV1,
  message?: ToastMessage,
  force?: boolean,
) => boolean;

export type ToastKind = "success" | "info" | "error";

export type ToastAction = {
  label: string;
  href?: string;
  external?: boolean;
  onActivate?: () => void;
};

export type ToastNotice = {
  text: string;
  kind?: ToastKind;
  action?: ToastAction;
  /** Keep important state, such as an unsynced save, visible until it resolves. */
  persistent?: boolean;
  /** Override the default lifetime for action-oriented notices. */
  durationMs?: number;
  /** Allow a confirmed save to replace an existing persistent notice. */
  replacePersistent?: boolean;
};

export type ToastMessage = string | ToastNotice;

export type Notify = (message: ToastMessage) => void;
