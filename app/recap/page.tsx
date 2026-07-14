import { Suspense } from "react";
import { MusicWorldApp } from "../_components/music-world-app";

export default function RecapPage() {
  return (
    <Suspense>
      <MusicWorldApp view="recap" />
    </Suspense>
  );
}
