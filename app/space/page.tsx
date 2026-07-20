import { Suspense } from "react";
import { MusicWorldApp } from "../_components/muchi-app";

export default function SpacePage() {
  return <Suspense><MusicWorldApp view="space" /></Suspense>;
}
