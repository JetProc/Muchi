import { Suspense } from "react";
import { MusicWorldApp } from "../_components/music-world-app";

export default function InboxPage() {
  return (
    <Suspense>
      <MusicWorldApp view="inbox" />
    </Suspense>
  );
}
