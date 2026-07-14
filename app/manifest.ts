import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "음악 세계 아카이브",
    short_name: "음악 세계",
    description:
      "좋아했던 음악에 태그와 기억을 더해 나만의 음악 세계로 보존하는 아카이빙 서비스",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0B1021",
    theme_color: "#0B1021",
    lang: "ko-KR",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
