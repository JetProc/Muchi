import { Suspense } from "react";
import { MusicWorldApp } from "../_components/muchi-app";

export default function TagsPage() {
  return (
    <Suspense>
      <MusicWorldApp view="tags" />
    </Suspense>
  );
}
