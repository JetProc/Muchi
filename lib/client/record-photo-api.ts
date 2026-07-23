"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createOwnedRecordPhotoUrl,
  parseRecordPhotoStoragePath,
  RECORD_PHOTO_BUCKET,
} from "@/lib/record-photo-contract";

const MAX_SOURCE_FILE_SIZE = 8 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 3_000_000;
const MAX_OUTPUT_SIDE = 1600;
const FALLBACK_OUTPUT_SIDE = 1280;

export type RecordPhotoUploadResult = {
  customImagePath: string;
  customImageVersion: string;
  displayUrl: string;
};

function ensureCubeTrackId(value: string): string {
  const cubeTrackId = value.trim();
  if (!cubeTrackId || cubeTrackId.includes("/")) {
    throw new Error("기록 사진을 저장할 위치가 올바르지 않습니다.");
  }
  return cubeTrackId;
}

async function fileToNormalizedJpeg(file: File): Promise<Blob> {
  if (!/^image\/(?:jpeg|png|webp)$/i.test(file.type)) {
    throw new Error("JPG, PNG, WEBP 이미지만 사용할 수 있어요.");
  }
  if (file.size > MAX_SOURCE_FILE_SIZE) {
    throw new Error("8MB 이하 이미지를 선택해 주세요.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    await image.decode();

    const canvas = document.createElement("canvas");
    const scale = Math.min(1, MAX_OUTPUT_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이미지를 처리하지 못했어요.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    let outputCanvas = canvas;
    let quality = 0.82;
    const renderBlob = async () => new Promise<Blob>((resolve, reject) => {
      outputCanvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("이미지를 처리하지 못했어요.")),
        "image/jpeg",
        quality,
      );
    });

    let result = await renderBlob();
    if (result.size > MAX_OUTPUT_BYTES) {
      const retry = document.createElement("canvas");
      const retryScale = Math.min(1, FALLBACK_OUTPUT_SIDE / Math.max(canvas.width, canvas.height));
      retry.width = Math.max(1, Math.round(canvas.width * retryScale));
      retry.height = Math.max(1, Math.round(canvas.height * retryScale));
      retry.getContext("2d")?.drawImage(canvas, 0, 0, retry.width, retry.height);
      outputCanvas = retry;
      quality = 0.74;
      result = await renderBlob();
    }
    if (result.size > MAX_OUTPUT_BYTES) {
      throw new Error("이미지가 너무 커요. 더 작은 이미지를 선택해 주세요.");
    }
    return result;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function uploadRecordPhoto(file: File, cubeTrackIdInput: string): Promise<RecordPhotoUploadResult> {
  const cubeTrackId = ensureCubeTrackId(cubeTrackIdInput);
  const normalized = await fileToNormalizedJpeg(file);
  const supabase = createSupabaseBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("기록 사진을 저장하려면 로그인이 필요해요.");

  const assetId = crypto.randomUUID();
  const objectName = `${session.user.id}/${cubeTrackId}/${assetId}.jpg`;
  const { error } = await supabase.storage.from(RECORD_PHOTO_BUCKET).upload(objectName, normalized, {
    cacheControl: "31536000",
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error("기록 사진을 업로드하지 못했어요. 네트워크를 확인해 주세요.");

  return {
    customImagePath: `${RECORD_PHOTO_BUCKET}/${objectName}`,
    customImageVersion: assetId,
    displayUrl: createOwnedRecordPhotoUrl(cubeTrackId, assetId)!,
  };
}

export async function deleteUploadedRecordPhoto(path: string): Promise<void> {
  const parsed = parseRecordPhotoStoragePath(path);
  if (!parsed) throw new Error("삭제할 기록 사진 경로가 올바르지 않습니다.");
  const supabase = createSupabaseBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user || session.user.id !== parsed.ownerId) {
    throw new Error("기록 사진을 삭제할 권한이 없습니다.");
  }
  const objectName = path.slice(`${RECORD_PHOTO_BUCKET}/`.length);
  const { error } = await supabase.storage.from(RECORD_PHOTO_BUCKET).remove([objectName]);
  if (error) throw new Error("사용하지 않는 기록 사진을 정리하지 못했어요.");
}
