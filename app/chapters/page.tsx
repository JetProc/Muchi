import { Suspense } from "react";
import { MusicWorldApp } from "../_components/music-world-app";

export default function ChaptersPage() {
  return (
    <Suspense>
      <MusicWorldApp view="chapters" />
    </Suspense>
  );
}
