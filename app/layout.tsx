import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MUMU — 나만의 음악 세계",
    template: "%s · MUMU",
  },
  description:
    "좋아했던 음악을 나만의 태그와 기억으로 보관하고, 큐브로 이어진 음악 세계를 만드는 개인 아카이브.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  applicationName: "MUMU",
  openGraph: {
    title: "MUMU — 나만의 음악 세계",
    description: "노래가 기억이 되고, 기억이 하나의 세계가 되는 곳",
    type: "website",
    locale: "ko_KR",
    images: [
      {
        url: "/og.png",
        width: 1747,
        height: 909,
        alt: "MUMU 음악 세계의 세 큐브와 캐릭터",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MUMU — 나만의 음악 세계",
    description: "노래가 기억이 되고, 기억이 하나의 세계가 되는 곳",
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
