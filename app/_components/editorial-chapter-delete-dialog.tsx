import type { RefObject } from "react";
import type { Cube } from "@/lib/archive";

export function ChapterDeleteDialog({
  chapter,
  memoryCount,
  childCount,
  dialogRef,
  titleId,
  onCancel,
  onDelete,
}: {
  chapter: Cube;
  memoryCount: number;
  childCount: number;
  dialogRef: RefObject<HTMLDivElement | null>;
  titleId: string;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="dialog chapter-removal-dialog"
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="alertdialog"
      >
        <span className="section-label">챕터 삭제</span>
        <h2 id={titleId}>‘{chapter.name}’을 지울까요?</h2>
        <p>
          이 챕터의 {memoryCount}개 기억은 삭제됩니다. 다른 챕터의 같은 곡과 기억은 그대로 남습니다.
          {childCount ? ` 하위 챕터 ${childCount}개는 한 단계 위로 이동해 그대로 남습니다.` : ""}
        </p>
        <div className="dialog-actions">
          <button className="button" type="button" onClick={onCancel}>취소</button>
          <button className="button button-danger" type="button" onClick={onDelete}>삭제하기</button>
        </div>
      </div>
    </div>
  );
}
