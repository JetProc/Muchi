import type { Metadata } from "next";
import "./globals.css";
import "./apple-theme.css";

export const metadata: Metadata = {
  title: {
    default: "MUMU — 나만의 음악 매거진",
    template: "%s · MUMU",
  },
  description:
    "좋아했던 음악에 태그와 기억을 더해 나만의 챕터로 엮는 개인 음악 아카이브.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
  },
  applicationName: "MUMU",
  openGraph: {
    title: "MUMU — 나만의 음악 매거진",
    description: "음악을 들었던 순간을 나만의 언어로 편집하는 개인 아카이브",
    type: "website",
    locale: "ko_KR",
    images: [
      {
        url: "/og.png",
        width: 1738,
        height: 905,
        alt: "MUMU 개인 음악 매거진의 앨범 아트와 기억",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MUMU — 나만의 음악 매거진",
    description: "음악을 들었던 순간을 나만의 언어로 편집하는 개인 아카이브",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
