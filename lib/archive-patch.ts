import { parseArchive, type ArchiveEnvelopeV1 } from "./archive";

export type ArchivePatchOperation =
  | { op: "set"; path: string; value: unknown }
  | { op: "remove"; path: string };

const MAX_OPERATIONS = 1_000;
const MAX_PATH_LENGTH = 500;
const FORBIDDEN_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function equal(left: unknown, right: unknown): boolean {
  return Object.is(left, right);
}

function encodeSegment(value: string): string {
  return value.replace(/~/g, "~0").replace(/\//g, "~1");
}

function decodePath(path: string): string[] {
  if (!path.startsWith("/") || path.length > MAX_PATH_LENGTH) throw new Error("변경 경로가 올바르지 않습니다.");
  const segments = path.slice(1).split("/").map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
  if (!segments.length || segments.some((segment) => !segment || FORBIDDEN_SEGMENTS.has(segment))) {
    throw new Error("변경 경로가 올바르지 않습니다.");
  }
  return segments;
}

function clone(value: unknown): unknown {
  return structuredClone(value);
}

function diffValue(before: unknown, after: unknown, path: string, operations: ArchivePatchOperation[]) {
  if (equal(before, after)) return;
  if (!isRecord(before) || !isRecord(after)) {
    operations.push({ op: "set", path, value: clone(after) });
    return;
  }

  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    const nextPath = `${path}/${encodeSegment(key)}`;
    if (!(key in after)) operations.push({ op: "remove", path: nextPath });
    else if (!(key in before)) operations.push({ op: "set", path: nextPath, value: clone(after[key]) });
    else diffValue(before[key], after[key], nextPath, operations);
  }
}

/** Produces a small, replayable patch for an archive domain transition. */
export function createArchivePatch(before: ArchiveEnvelopeV1, after: ArchiveEnvelopeV1): ArchivePatchOperation[] {
  const operations: ArchivePatchOperation[] = [];
  diffValue(before, after, "", operations);
  if (operations.length > MAX_OPERATIONS) return [{ op: "set", path: "/data", value: clone(after.data) }, { op: "set", path: "/updatedAt", value: after.updatedAt }];
  return operations;
}

export function applyArchivePatch(archive: ArchiveEnvelopeV1, operations: ArchivePatchOperation[]): ArchiveEnvelopeV1 {
  if (!Array.isArray(operations) || operations.length > MAX_OPERATIONS) throw new Error("변경 수가 너무 많습니다.");
  const next = clone(archive) as Record<string, unknown>;
  for (const operation of operations) {
    if (!operation || (operation.op !== "set" && operation.op !== "remove")) throw new Error("변경 형식이 올바르지 않습니다.");
    const segments = decodePath(operation.path);
    let target: Record<string, unknown> = next;
    for (const segment of segments.slice(0, -1)) {
      const child = target[segment];
      if (!isRecord(child)) {
        if (operation.op === "remove") {
          target = {};
          break;
        }
        target[segment] = {};
      }
      target = target[segment] as Record<string, unknown>;
    }
    const key = segments.at(-1)!;
    if (operation.op === "remove") delete target[key];
    else target[key] = clone(operation.value);
  }
  const parsed = parseArchive(JSON.stringify(next));
  if (parsed.status !== "ok") throw new Error("변경된 음악 기록 형식이 올바르지 않습니다.");
  return parsed.archive;
}
