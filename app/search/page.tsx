import { Suspense } from "react";
import { MusicWorldApp } from "../_components/muchi-app";

export default function SearchPage() {
  return (
    <Suspense>
      <MusicWorldApp view="search" />
    </Suspense>
  );
}
