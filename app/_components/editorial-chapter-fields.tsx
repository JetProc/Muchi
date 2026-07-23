"use client";

import { useState, type ChangeEvent } from "react";
import { Lock, Unlock } from "lucide-react";
import {
  ARCHIVE_LIMITS,
  type ChapterVisibility,
} from "@/lib/archive";
import { uploadChapterCover } from "@/lib/client/chapter-cover-api";

async function prepareCoverImage(file: File): Promise<Blob> {
  if (!/^image\/(?:jpeg|png|webp)$/.test(file.type)) {
    throw new Error("JPG, PNG, WEBP 이미지만 사용할 수 있어요.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("8MB 이하 이미지를 선택해 주세요.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    await image.decode();
    const maxSide = 960;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이미지를 처리하지 못했어요.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let outputCanvas = canvas;
    let quality = 0.8;
    const createBlob = async () => new Promise<Blob>((resolve, reject) => {
      outputCanvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("이미지를 처리하지 못했어요.")), "image/jpeg", quality);
    });
    let result = await createBlob();
    if (result.size > ARCHIVE_LIMITS.chapterCoverDataUrl) {
      const retryScale = Math.min(1, 720 / Math.max(canvas.width, canvas.height));
      const retry = document.createElement("canvas");
      retry.width = Math.max(1, Math.round(canvas.width * retryScale));
      retry.height = Math.max(1, Math.round(canvas.height * retryScale));
      retry.getContext("2d")?.drawImage(canvas, 0, 0, retry.width, retry.height);
      outputCanvas = retry;
      quality = 0.72;
      result = await createBlob();
    }
    if (result.size > ARCHIVE_LIMITS.chapterCoverDataUrl) {
      throw new Error("이미지가 너무 커요. 더 작은 이미지를 선택해 주세요.");
    }
    return result;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function ChapterFields({
  idPrefix,
  name,
  description,
  coverImageUrl,
  nameLabel = "챕터 이름 *",
  descriptionLabel = "짧은 설명",
  showDescription = true,
  namePlaceholder,
  descriptionPlaceholder,
  onNameChange,
  onDescriptionChange,
  onCoverImageChange,
  visibility,
  onVisibilityChange,
}: {
  idPrefix: string;
  name: string;
  description: string;
  coverImageUrl?: string | null;
  nameLabel?: string;
  descriptionLabel?: string;
  showDescription?: boolean;
  namePlaceholder?: string;
  descriptionPlaceholder?: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCoverImageChange?: (value: string | null) => void;
  visibility?: ChapterVisibility;
  onVisibilityChange?: (value: ChapterVisibility) => void;
}) {
  const [coverError, setCoverError] = useState<string | null>(null);
  const [coverLoading, setCoverLoading] = useState(false);
  const nameId = `${idPrefix}-name`;
  const descriptionId = `${idPrefix}-description`;

  async function changeCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !onCoverImageChange) return;
    setCoverError(null);
    setCoverLoading(true);
    try {
      onCoverImageChange(await uploadChapterCover(await prepareCoverImage(file)));
    } catch (error) {
      setCoverError(error instanceof Error ? error.message : "이미지를 불러오지 못했어요.");
    } finally {
      setCoverLoading(false);
    }
  }

  return (
    <div className="form-stack" style={{ marginTop: 24 }}>
      <div className="field">
        <label htmlFor={nameId}>{nameLabel}</label>
        <input
          className="input"
          id={nameId}
          maxLength={ARCHIVE_LIMITS.cubeName}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder={namePlaceholder}
          value={name}
        />
      </div>
      {showDescription ? (
        <div className="field">
          <label htmlFor={descriptionId}>{descriptionLabel}</label>
          <textarea
            className="textarea"
            id={descriptionId}
            maxLength={ARCHIVE_LIMITS.cubeDescription}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder={descriptionPlaceholder}
            value={description}
          />
        </div>
      ) : null}
      {onCoverImageChange ? (
        <div className="field chapter-cover-field">
          <span className="field-label">대표 이미지</span>
          <div className="chapter-cover-picker">
            {coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverImageUrl} alt="선택한 챕터 대표 이미지" />
            ) : <span className="chapter-cover-picker-empty">앨범 콜라주</span>}
            <div className="chapter-cover-picker-actions">
              <label className="button button-ghost" htmlFor={`${idPrefix}-cover`}>
                {coverLoading ? "처리 중" : coverImageUrl ? "이미지 변경" : "이미지 선택"}
              </label>
              {coverImageUrl ? <button className="text-button" type="button" onClick={() => onCoverImageChange(null)}>기본으로</button> : null}
            </div>
          </div>
          <input
            className="sr-only"
            id={`${idPrefix}-cover`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={coverLoading}
            onChange={changeCover}
          />
          {coverError ? <p className="field-error" role="alert">{coverError}</p> : null}
        </div>
      ) : null}
      {visibility && onVisibilityChange ? (
        <div className="field">
          <span className="field-label">챕터 공개 상태</span>
          <button
            aria-label={`챕터 ${visibility === "public" ? "공개" : "비공개"}`}
            aria-pressed={visibility === "public"}
            className={`text-button memory-record-visibility ${visibility === "public" ? "is-public" : "is-private"}`}
            onClick={() => onVisibilityChange(visibility === "public" ? "private" : "public")}
            type="button"
          >
            {visibility === "public" ? <Unlock size={14} aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />}
            <span>{visibility === "public" ? "공개" : "비공개"}</span>
          </button>
          <p className="field-hint">공개하면 탐색과 내 공간 방문자 보기에서 볼 수 있어요.</p>
        </div>
      ) : null}
    </div>
  );
}
