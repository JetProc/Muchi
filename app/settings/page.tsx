import { Suspense } from "react";
import { MusicWorldApp } from "../_components/muchi-app";

export default function SettingsPage() {
  return (
    <Suspense>
      <MusicWorldApp view="settings" />
    </Suspense>
  );
}
