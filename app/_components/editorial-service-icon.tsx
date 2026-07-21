export type MusicServiceId = "apple" | "youtube" | "spotify";

const SERVICE_ICON_PATH: Record<MusicServiceId, string> = {
  apple: "/assets/services/apple-music.svg",
  youtube: "/assets/services/youtube-music.svg",
  spotify: "/assets/services/spotify.svg",
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
