import { Suspense } from "react";
import { MusicWorldApp } from "../_components/muchi-app";

export default function InboxPage() {
  return (
    <Suspense>
      <MusicWorldApp view="inbox" />
    </Suspense>
  );
}
