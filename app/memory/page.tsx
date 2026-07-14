import { Suspense } from "react";
import { MusicWorldApp } from "../_components/music-world-app";

export default function MemoryPage() {
  return (
    <Suspense>
      <MusicWorldApp view="memory" />
    </Suspense>
  );
}
