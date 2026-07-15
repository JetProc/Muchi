import { Suspense } from "react";
import { MusicWorldApp } from "../_components/music-world-app";

export default function PlaylistPage() {
  return (
    <Suspense>
      <MusicWorldApp view="playlist" />
    </Suspense>
  );
}
