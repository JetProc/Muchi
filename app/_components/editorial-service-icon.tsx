export type MusicServiceId = "apple" | "spotify" | "youtube";

const SERVICE_ICON_PATH: Record<MusicServiceId, string> = {
  apple: "/assets/services/apple-music.svg",
  spotify: "/assets/services/spotify.svg",
  youtube: "/assets/services/youtube-music.svg",
};

export function MusicServiceIcon({
  service,
  size = 28,
  className = "",
}: {
  service: MusicServiceId;
  size?: number;
  className?: string;
}) {
  return (
    <img
      className={`music-service-mark${className ? ` ${className}` : ""}`}
      src={SERVICE_ICON_PATH[service]}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      decoding="async"
    />
  );
}
