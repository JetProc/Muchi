import { Suspense } from "react";
import { MusicWorldApp } from "../_components/music-world-app";

export default function ChapterPage() {
  return (
    <Suspense>
      <MusicWorldApp view="chapter" />
    </Suspense>
  );
}
