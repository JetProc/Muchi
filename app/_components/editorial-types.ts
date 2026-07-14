import type { ArchiveEnvelopeV1 } from "@/lib/archive";

export type AppView =
  | "home"
  | "capture"
  | "inbox"
  | "chapters"
  | "chapter"
  | "memory"
  | "search"
  | "recap"
  | "settings";

export type ArchiveCommit = (
  next: ArchiveEnvelopeV1,
  message?: string,
  force?: boolean,
) => boolean;

export type Notify = (message: string) => void;
