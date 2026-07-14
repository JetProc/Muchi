import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MUMU — 음악 기억 아카이브",
    short_name: "MUMU",
    description:
      "좋아했던 음악에 태그와 기억을 더해 나만의 챕터로 보존하는 음악 아카이브",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F1E8D8",
    theme_color: "#17130F",
    lang: "ko-KR",
    icons: [
      {
        src: "/favicon.png",
        sizes: "64x64",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/favicon.png",
        sizes: "64x64",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
