import { Suspense } from "react";
import { MusicWorldApp } from "../../_components/muchi-app";

export default function ChapterSharePage() {
  return (
    <Suspense>
      <MusicWorldApp view="chapterShare" />
    </Suspense>
  );
}
