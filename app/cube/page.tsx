import { Suspense } from "react";
import { MusicWorldApp } from "../_components/music-world-app";

export default function CubePage() {
  return (
    <Suspense>
      <MusicWorldApp view="cube" />
    </Suspense>
  );
}
