import { Suspense } from "react";
import { MusicWorldApp } from "./_components/music-world-app";

export default function Home() {
  return (
    <Suspense>
      <MusicWorldApp view="home" />
    </Suspense>
  );
}
