import type { ArchiveEnvelopeV1 } from "@/lib/archive";

export type AppView =
  | "home"
  | "space"
  | "capture"
  | "inbox"
  | "chapters"
  | "chapter"
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

export type ToastAction = {
  label: string;
  href: string;
  external?: boolean;
};

export type ToastMessage =
  | string
  | {
    text: string;
    action?: ToastAction;
  };

export type Notify = (message: ToastMessage) => void;
