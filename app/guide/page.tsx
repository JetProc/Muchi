import { Suspense } from "react";
import { MusicWorldApp } from "../_components/muchi-app";

export default function GuidePage() {
  return <Suspense><MusicWorldApp view="guide" /></Suspense>;
}
