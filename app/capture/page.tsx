import { Suspense } from "react";
import { MusicWorldApp } from "../_components/muchi-app";

export default function CapturePage() {
  return (
    <Suspense>
      <MusicWorldApp view="capture" />
    </Suspense>
  );
}
