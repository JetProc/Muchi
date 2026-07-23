"use client";

import { ArrowRight, Download, Link2, Search, Smartphone } from "lucide-react";
import { MotionLink as Link } from "./editorial-motion";
import { PageHeader } from "./editorial-ui";

export function Guide() {
  return (
    <div className="page-content guide-view">
      <PageHeader eyebrow="GUIDE" title="뮤키 시작하기" description="곡을 찾고, 기억을 남기고, 챕터에 모으는 세 단계만 알면 돼요." />
      <section className="guide-section" aria-labelledby="guide-start-title">
        <div className="guide-section-heading">
          <span>첫 기록</span>
          <h2 id="guide-start-title">곡 하나로 시작하세요</h2>
          <p>처음부터 완벽하게 정리하지 않아도 괜찮아요. 떠오르는 만큼만 남겨 보세요.</p>
        </div>
        <ol className="guide-steps">
          <li><span>01</span><SearchStep /></li>
          <li><span>02</span><TagStep /></li>
          <li><span>03</span><ChapterStep /></li>
        </ol>
      </section>
      <section className="guide-section" aria-labelledby="guide-link-title">
        <div className="guide-section-heading">
          <span>곡 가져오기</span>
          <h2 id="guide-link-title">편한 방법을 골라 쓰세요</h2>
        </div>
        <div className="guide-methods">
          <article>
            <Search aria-hidden="true" size={19} />
            <div><strong>뮤키에서 바로 검색</strong><p>하단의 <b>기록</b>에서 곡명이나 아티스트를 검색하세요.</p></div>
          </article>
          <article>
            <Link2 aria-hidden="true" size={19} />
            <div><strong>음악 앱 링크 붙여넣기</strong><p>YouTube Music이나 Apple Music의 곡 링크를 <b>링크로 가져오기</b>에 붙여 넣으세요.</p></div>
          </article>
        </div>
        <p className="guide-tip"><strong>Android에서는 더 간단해요.</strong> 음악 앱의 공유 메뉴에서 뮤키를 선택하면 바로 기록 화면으로 이어져요.</p>
      </section>
      <section className="guide-section" aria-labelledby="guide-pwa-title">
        <div className="guide-section-heading">
          <span>빠른 실행</span>
          <h2 id="guide-pwa-title">홈 화면에 두면 더 편해요</h2>
        </div>
        <div className="guide-install">
          <Download aria-hidden="true" size={20} />
          <div>
            <strong>브라우저 메뉴에서 추가할 수 있어요.</strong>
            <p><b>Android Chrome</b>은 ‘앱 설치’, <b>iPhone Safari</b>는 공유 버튼의 ‘홈 화면에 추가’를 선택하세요.</p>
          </div>
        </div>
      </section>
      <section className="guide-cta" aria-label="첫 기록 시작">
        <Smartphone aria-hidden="true" size={20} />
        <div><span>이제 한 곡을 골라 볼까요?</span><strong>첫 기록은 짧아도 충분해요.</strong></div>
        <Link className="button button-primary" href="/capture?guide=1" intent="forward">첫 곡 기록해 보기 <ArrowRight aria-hidden="true" size={17} /></Link>
      </section>
    </div>
  );
}

function SearchStep() { return <div><strong>곡 찾기</strong><p>곡명·아티스트를 검색하거나 음악 앱 링크를 가져오세요.</p></div>; }
function TagStep() { return <div><strong>기억 남기기</strong><p>감상 날짜와 태그를 고르고, 메모나 사진을 더하세요.</p></div>; }
function ChapterStep() { return <div><strong>챕터에 모으기</strong><p>같이 떠올리고 싶은 곡들을 하나의 챕터로 묶어 보세요.</p></div>; }
