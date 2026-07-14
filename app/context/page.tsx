import { Suspense } from "react";
import { MusicWorldApp } from "../_components/music-world-app";

export default function ContextPage() {
  return (
    <Suspense>
      <MusicWorldApp view="context" />
    </Suspense>
  );
}
