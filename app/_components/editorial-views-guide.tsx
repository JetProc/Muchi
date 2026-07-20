"use client";

import { ArrowRight, Download, ExternalLink, Link2, Smartphone, Upload } from "lucide-react";
import { MotionLink as Link } from "./editorial-motion";
import { PageHeader } from "./editorial-ui";

const SUPPORTS = [
  ["YouTube Music", "가져오기", "지원"],
  ["Apple Music", "가져오기", "지원"],
  ["Spotify", "가져오기", "미지원"],
  ["YouTube Music", "내보내기", "준비 중"],
  ["Apple Music", "내보내기", "준비 중"],
  ["Spotify", "내보내기", "준비 중"],
] as const;

export function Guide() {
  return (
    <div className="page-content guide-view">
      <PageHeader eyebrow="GUIDE" title="뮤키 사용 방법" description="좋아한 곡을 그 순간의 언어로 남기고 다시 찾는 방법이에요." />
      <section className="guide-section" aria-labelledby="guide-start-title">
        <h2 id="guide-start-title">처음엔 이렇게 시작하세요</h2>
        <ol className="guide-steps">
          <li><span>01</span><SearchStep /></li>
          <li><span>02</span><TagStep /></li>
          <li><span>03</span><ChapterStep /></li>
        </ol>
      </section>
      <section className="guide-section" aria-labelledby="guide-link-title">
        <h2 id="guide-link-title">음악 앱 링크로 가져오기</h2>
        <div className="guide-panel"><Link2 aria-hidden="true" size={20} /><div><strong>서비스 안에서 검색하는 것과 같은 기록 화면으로 이어져요.</strong><p>곡 링크를 분석한 뒤 태그와 기억을 남기고, 보관함 또는 챕터로 정리할 수 있어요.</p></div></div>
        <div className="guide-platforms">
          <article><Smartphone aria-hidden="true" size={18} /><strong>Android PWA</strong><p>뮤키를 설치한 뒤 YouTube Music에서 곡을 공유하고 <b>뮤키</b>를 선택하세요. 곡 링크가 바로 열려요.</p></article>
          <article><ExternalLink aria-hidden="true" size={18} /><strong>iPhone / iPad</strong><p>공유에서 곡 링크를 복사한 뒤 뮤키의 <b>링크로 가져오기</b>에 붙여 넣어 주세요. 스트리밍 앱에서 뮤키를 직접 선택하는 공유는 아직 지원하지 않아요.</p></article>
        </div>
      </section>
      <section className="guide-section" aria-labelledby="guide-pwa-title">
        <h2 id="guide-pwa-title">PWA 설치</h2>
        <div className="guide-panel"><Download aria-hidden="true" size={20} /><div><strong>브라우저에서 뮤키를 앱처럼 설치해 둘 수 있어요.</strong><p>Android Chrome은 메뉴의 ‘앱 설치’, iPhone Safari는 공유 버튼의 ‘홈 화면에 추가’를 사용해 주세요.</p></div></div>
      </section>
      <section className="guide-section" aria-labelledby="guide-support-title">
        <h2 id="guide-support-title">스트리밍 서비스 지원 현황</h2>
        <div className="guide-support-list" role="list">
          {SUPPORTS.map(([service, action, status]) => <div key={`${service}-${action}`} role="listitem"><strong>{service}</strong><span>{action === "가져오기" ? <Upload aria-hidden="true" size={14} /> : <ExternalLink aria-hidden="true" size={14} />}{action}</span><em className={`is-${status.replace(" ", "-")}`}>{status}</em></div>)}
        </div>
        <p className="guide-footnote">지원하지 않는 링크는 직접 검색으로 같은 곡을 찾아 기록할 수 있어요.</p>
      </section>
      <section className="guide-cta" aria-label="첫 기록 시작">
        <span>이제 한 곡을 골라 볼까요?</span>
        <strong>첫 기록은 짧아도 충분해요.</strong>
        <Link className="button button-primary" href="/capture?guide=1" intent="forward">첫 곡 기록해 보기 <ArrowRight aria-hidden="true" size={17} /></Link>
      </section>
    </div>
  );
}

function SearchStep() { return <div><strong>기억할 곡 찾기</strong><p>곡명·아티스트로 검색하거나 지원하는 음악 앱 링크를 가져와요.</p></div>; }
function TagStep() { return <div><strong>순간을 태그로 남기기</strong><p>‘새벽 러닝’, ‘스무 살 여름’처럼 다시 찾을 단서를 붙여요.</p></div>; }
function ChapterStep() { return <div><strong>챕터로 음악 세계 쌓기</strong><p>기록한 곡들을 한 장면이나 시기별 챕터로 모아 보세요.</p></div>; }
