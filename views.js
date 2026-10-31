// views.js — 조회수. 표 두 개를 읽고 올린다(사이트 전체 · 편별).
//   사이트 전체 = 앱에 들어온 사람. 탭 하나당 한 번.
//   편별       = 그 편을 **읽으러 들어간** 사람. 홈만 훑고 지나간 것은 안 센다.
// 스키마·함수는 docs/supabase-views.sql 이 원본이다. Matto 가 Supabase 에 수동 적용한다.
//
// ⚠ 조회수를 못 가져와도 앱은 그대로 떠야 한다. 실패는 전부 조용히 삼킨다 —
//   학교 망이 외부 도메인을 막는 일이 흔하고, 그때 아이가 보는 것은 「이야기가 안 열린다」여선 안 된다.
// 클래식 스크립트다(모듈 아님) — 아티팩트 빌더가 <script src>를 그대로 인라인해야 하므로.
(function () {
const URL_ = "https://wyoojgbtutwveouhexiw.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5b29qZ2J0dXR3dmVvdWhleGl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNDY4MDAsImV4cCI6MjA5NzcyMjgwMH0.u1Im8LHGNTRCNJv8EI0EFBgtIw2WCUK25n3HUXZNS8k";

const rpc = (fn, body = {}) =>
  fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));

// sessionStorage 는 사파리 사생활 보호 모드 등에서 던진다.
// 읽기가 실패하면 '아직 안 셈'으로 보고 넘어간다(최악이라도 숫자가 조금 부풀 뿐).
const seen = (k) => { try { return !!sessionStorage.getItem(k); } catch { return false; } };
const mark = (k) => { try { sessionStorage.setItem(k, "1"); } catch { /* 무시 */ } };

const fmt = (n) => Number(n || 0).toLocaleString("ko-KR");

// 로봇(검색·공유 미리보기)과 자동으로 모는 브라우저는 세지 않고 읽기만 한다 — 편마다 원래 화면을 주소로 미리 찍어 두면서
// 로봇도 이 화면을 연다(2026-10-29 DECISIONS 「검색」 (2)). 화면에는 아무 차이 없다
const BOT = (() => {
  try { return /bot|crawl|spider|slurp|yeti|daum\/|daumoa|scrap|externalhit|bingpreview|headless|lighthouse/i.test(navigator.userAgent || "") || navigator.webdriver === true; }
  catch { return false; }
})();

// ── 사이트 전체 ──
// 한 번 부른 결과를 재사용한다. 화면을 다시 그릴 때마다 네트워크를 타지 않게(그리고 두 번 세지 않게).
let sitePending = null;
function site() {
  if (!sitePending) {
    const first = !BOT && !seen("dh-counted");
    sitePending = rpc(first ? "dh_bump_view" : "dh_get_views")
      .then(([row]) => { mark("dh-counted"); return { today: +(row?.today || 0), total: +(row?.total || 0) }; });
  }
  return sitePending;
}

// ── 편별 ──
const epCache = new Map();                       // ep → {today, total}

// 이 장 서른 편을 **한 번에** 읽는다. 편마다 부르면 강을 훑는 동안 요청이 마흔 번 나간다.
function loadEps(eps) {
  const need = eps.filter((n) => !epCache.has(n));
  if (!need.length) return Promise.resolve(epCache);
  return rpc("dh_get_eps", { p_eps: need })
    .then((rows) => { for (const r of rows) epCache.set(+r.ep, { today: +r.today, total: +r.total }); return epCache; })
    .catch(() => epCache);                       // 못 받아도 캐시는 그대로 (숫자만 안 뜬다)
}

// 그 편을 읽으러 들어갈 때. 탭 하나당 편마다 한 번만 센다.
function bumpEp(no) {
  const k = `dh-ep-${no}`;
  const p = BOT || seen(k) ? Promise.resolve(null) : rpc("dh_bump_ep", { p_ep: no }).then(([row]) => { mark(k); return row; });
  return p.then((row) => {
    if (row) epCache.set(+row.ep, { today: +row.today, total: +row.total });
    return epCache.get(no) || null;
  }).catch(() => null);
}

const epOf = (no) => epCache.get(no) || null;

// ⚠ 이름이 VIEWS 가 아니다 — app.html 이 화면 라우팅 표로 `const VIEWS` 를 이미 쓰고 있다.
// 같은 이름을 쓰면 app.html 안의 맨몸 VIEWS 가 라우팅 표를 가리켜 조용히 엉뚱한 것을 부른다.
window.HITS = { site, loadEps, bumpEp, epOf, fmt };
})();
