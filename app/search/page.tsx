import { Suspense } from "react";
import { MusicWorldApp } from "../_components/music-world-app";

export default function SearchPage() {
  return (
    <Suspense>
      <MusicWorldApp view="search" />
    </Suspense>
  );
}
