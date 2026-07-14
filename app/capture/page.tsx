import { Suspense } from "react";
import { MusicWorldApp } from "../_components/music-world-app";

export default function CapturePage() {
  return (
    <Suspense>
      <MusicWorldApp view="capture" />
    </Suspense>
  );
}
