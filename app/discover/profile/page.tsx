import { Suspense } from "react";
import { MusicWorldApp } from "../../_components/muchi-app";

export default function DiscoverProfilePage() {
  return (
    <Suspense>
      <MusicWorldApp view="discoverProfile" />
    </Suspense>
  );
}
