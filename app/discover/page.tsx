import { Suspense } from "react";
import { MusicWorldApp } from "../_components/music-world-app";

export default function DiscoverPage() {
  return (
    <Suspense>
      <MusicWorldApp view="discover" />
    </Suspense>
  );
}
