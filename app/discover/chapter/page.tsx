import { Suspense } from "react";
import { MusicWorldApp } from "../../_components/music-world-app";

export default function DiscoverChapterPage() {
  return (
    <Suspense>
      <MusicWorldApp view="discoverChapter" />
    </Suspense>
  );
}
