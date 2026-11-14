// 리더 엔진 — reader.html 의 <script> 를 그대로 옮기고, 저장·나가기·클리어만 앱 콜백으로 뺐다.
// 조판 규칙(480px 열 · 17px · 행송 32px · 도판 자동 배치 · 각주 · 툴팁 · 문제 6면 · 수확 면)은 손대지 않는다.
// mountReader(root, EP, {progress, fs, onSave, onClear, onExit, onAnswer}) → {destroy()}
window.mountReader = function (root, EP, opts = {}) {
  root.classList.add("reader");
  root.innerHTML = `
  <div class="prog" id="prog"></div>
  <div class="bar">
    <button class="ic" id="back" aria-label="나가기 (읽던 곳을 저장)"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
    <span class="ttl" id="ttl"></span>
    <button class="pg" id="pg" aria-live="polite"></button>
    <button class="ic" id="fs" aria-label="글자 크기" aria-haspopup="true" aria-expanded="false">가</button>
  </div>
  <div class="book" id="book">
    <div class="rail" id="rail"><div class="track" id="track"><div class="spread" id="spread"></div></div></div>
    <div class="gutter"></div>
    <div class="fn l" id="fnl" aria-label="왼쪽 면의 낱말 풀이"></div><div class="fn r" id="fnr" aria-label="오른쪽 면의 낱말 풀이"></div>
  </div>
  <div class="sr" id="live" aria-live="polite"></div>`;
  const S = { ...(opts.progress || {}), fs: opts.fs || 0, hinted: opts.hinted ?? !!opts.progress, glossHinted: !!opts.glossHinted };
  const $ = (s, r = root) => r.querySelector(s);
    const $$ = (s, r = root) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  // 도판 — 원고 빌드가 그 편의 그림이 실제로 있는지 확인해 `b.src` 에 박아 둔다(없으면 빈 문자열).
  // ⚠ 전에는 3편 그림 셋이 여기 하드코딩돼 있어 **모든 편이 환웅·웅녀 그림을 보여 줬다**.
  //   그렇다고 리더가 경로를 조립하면 빌더가 못 찾아 오프라인 아티팩트에서 그림이 통째로 사라진다.
  //   그래서 경로를 정하는 곳은 build-episode.mjs 한 곳이다.
  // 인물 카드는 편마다 다르다 — app.html 이 season.js 에서 뽑아 넘긴다.
  // ⚠ 전에는 여기 3편 세 사람이 박혀 있어 1편을 읽어도 환웅·웅녀·단군왕검이 떴다 (DECISIONS 63)
  const HV = opts.harvest || {};   // harvest — 한 글자 H 는 이미 SVG 높이다
  const CARDS = Object.fromEntries((HV.cards || []).map((c) => [c.n, c]));
  const SIZES = [["작게", 17, 32], ["보통", 19, 35], ["크게", 21.5, 39]];
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const Q = { solved: S.solved || 0, phase: S.phase || "story", wrong: 0, back: null };
  let tip = null, pop = null, toast = null, hintov = null, FS = S.fs || 0, destroyed = false;



  /* ── 조판 ── */
  const fr = root, sp = $("#spread"), track = $("#track"), rail = $("#rail");
  // 판면 기하는 **reader.css 의 --colw/--gap/--colh 하나에서만** 나온다. 여기서 숫자를 다시 적으면
  // 1px 어긋나는 날 열이 쪼개지거나 잘린다 — 그래서 computed style 로 되읽는다.
  // COLS = 한 면에 든 열 수. 가로 2(펼친 책), 세로 1(폰). layout() 이 매번 다시 잰다(회전 대응).
  let COLW = 480, GAP = 100, COL = 580, COLS = 2, PITCH = 1160, COLH = 672;
  function readGeom() {
    const cs = getComputedStyle(sp);
    COLW = parseFloat(cs.columnWidth) || 480;
    GAP = parseFloat(cs.columnGap) || 100;
    COL = COLW + GAP;
    COLH = rail.clientHeight || 672;
    COLS = Math.max(1, Math.round((rail.clientWidth + GAP) / COL));
    PITCH = COLS * COL;
  }
  // ⚠ 여기 `replace(/^一章/, "1장")` 가 박혀 있었다 — 一章 하나만 아는 코드였다.
  //   DECISIONS 27 이 한자 장 표기를 금지하므로 **원고가 「1장 새벽」으로 적는다.** 기계 검사가 막는다
  const chapterLabel = EP.chapter;
  function spotHTML(b, ai, bi) {
    return `<figure class="spot${b.cut ? " spot-cut" : ""}${b.src ? "" : " nodraw"}"${b.cut && b.width ? ` style="--spot-ratio:${b.width}/${b.height};--spot-aspect:${b.width / b.height}"` : ""} data-size="${!b.cut && b.size === "large" ? "large" : "normal"}" data-k="a${ai}-b${bi}">${b.src ? `<img src="${b.src}"${b.cut && b.width ? ` width="${b.width}" height="${b.height}"` : ""} alt="${esc(b.cap)}" decoding="async">` : ""}<figcaption>${b.cap}</figcaption></figure>`;
  }
  let body = EP.acts.map((a, ai) => `<section class="act"><h2 data-k="a${ai}">${a.heading}</h2><div class="prose">${
    a.blocks.map((b, bi) => b.t === "p" ? `<p class="${b.dlg ? "dlg" : ""}" data-k="a${ai}-b${bi}">${b.html}</p>`
      : b.t === "spot" ? spotHTML(b, ai, bi)   // 끼움 그림 — 단락처럼 흐른다
      : `</div></section><figure class="plate${b.src ? "" : " nodraw"}" data-k="a${ai}-b${bi}" data-n="${b.n}" data-cap="${esc(b.cap)}">${b.src ? `<img src="${b.src}" alt="${esc(b.cap)}" decoding="async">` : ""}<figcaption>그림 ${b.n} · ${b.cap}</figcaption></figure><section class="act"><div class="prose">`).join("")}</div></section>`).join("");
  // 인물 이름은 본문 단락 안에서 첫 등장만 진하게 (제목·캡션은 건드리지 않는다)
  const seen = new Set();
  body = body.replace(/<p\b[^>]*>[\s\S]*?<\/p>/g, (p) => {
    for (const nm of Object.keys(CARDS)) if (!seen.has(nm) && p.includes(nm)) { seen.add(nm); p = p.replace(nm, `<b class="who" role="button" tabindex="0" aria-expanded="false" data-n="${nm}">${nm}</b>`); }
    return p;
  });
  body = body.replace(/<em class="(dot|hint)">/g, '<em class="$1" role="button" tabindex="0" aria-expanded="false">');
  sp.innerHTML = `
    <div class="panshim"><span class="l">${chapterLabel}</span><span class="c"></span><span>${EP.no}편 · ${EP.when.split("(")[0]}${HV.ago ? ` · ${HV.ago}` : ""}</span></div>
    <h1 class="epttl">${EP.title}</h1><p class="epsub">${EP.subtitle}</p>
    ${EP.intro ? `<aside class="yeoneun"><span class="label">여는 말</span><p>${EP.intro}</p></aside>` : ""}
    ${body}
    <div class="endmark">오늘 이야기 끝</div>
    <section class="people" data-sec="오늘 만난 사람들">
      <span class="label">오늘 만난 사람들</span>
      ${Object.keys(CARDS).length ? `<h3>이야기에서 만난 ${Object.keys(CARDS).length}명</h3>
      <div class="row" style="--n:${Math.max(3, Object.keys(CARDS).length)}">${Object.entries(CARDS).map(([n, c]) => `<button class="pcard" data-n="${n}" aria-expanded="false"><div class="band"></div><img src="${c.img}" alt="${n}"><span class="nm">${n}</span><div class="ln">${c.d}</div></button>`).join("")}</div>
      <div class="note">탭하면 자세히 볼 수 있어요.<br>다섯 문제를 맞히면 역사책에 들어가요.</div>`
      /* ⚠ 카드가 없는 편이 훨씬 많다(1장은 열 편 가운데 3편 하나뿐). 전에는 이 면이 「이야기에서 만난 0명」
         한 줄만 띄운 빈 면이었다 — 아이에게는 제가 무엇을 놓친 것처럼 읽힌다. 왜 없는지를 말한다 (DECISIONS 58) */
      : `<h3>이야기 속 사람들</h3>
      <div class="note">이 편에서는 인물 카드가 나오지 않아요.<br>카드는 옛 기록에 이름이 또렷이 남은 사람에게만 드리거든요.<br>오늘 만난 사람들이 어디까지 진짜인지는 「진짜일까?」가 말해 줘요.</div>`}
    </section>
    <div class="lpage">
      <div class="blk"><div class="hooju" data-sec="그 뒤 이야기"><span class="label">그 뒤 이야기</span><div class="h">${EP.after.title}</div>${EP.after.html.map((p) => `<p>${p}</p>`).join("")}</div></div>
      <div class="blk"><div class="ifme"><div class="q">${EP.ifme.q}</div>${EP.ifme.html.map((p) => `<p>${p}</p>`).join("")}</div></div>
    </div>
    <div class="rpage">
      <div class="blk"><div class="truth"><span class="stamp">${EP.truth.verdict}</span><span class="label">진짜일까?</span><div class="h">${EP.truth.title}</div>${EP.truth.html.map((p) => `<p>${p}</p>`).join("")}</div></div>
    </div>`;
  const BODY = sp.innerHTML;                                // 원고 순서 원본. 재조판마다 여기서 다시 시작한다(도판 자리 옮김을 되돌리기 위해)

  // 가상 면: 문제 5 + 다음 이야기 1
  const NUM = "①②③④⑤";
  EP.quiz.forEach((q, i) => {
    const v = document.createElement("div"); v.className = "vpage quiz"; v.dataset.qi = i;
    v.innerHTML = `<div class="qp l"><span class="label">읽기 확인 · ${i + 1} / ${EP.quiz.length}</span><div class="kind">${q.kind}</div>
        <div class="q"><span class="no">${NUM[i]}</span><span>${q.q}</span></div>
        <div class="opts">${q.opts.map((o, j) => `<button class="opt" data-i="${j}"><span class="rd"></span><span class="tx">${o}</span><span class="mark"></span></button>`).join("")}</div><div class="nx"></div></div>
      <div class="qp r"><span class="label">진행</span><div class="dots">${EP.quiz.map(() => "<i></i>").join("")}</div>
        <div class="fb" aria-live="polite"></div><p class="wait">답은 이야기 속에 있어요. ${document.body.classList.contains("portrait") ? "위에서" : "왼쪽에서"} 하나를 고르세요.</p><div class="lockmsg">답을 고르면 다음 면으로 넘어가요</div></div>`;
    track.append(v);
  });
  // 마지막 면 = 오늘의 수확 + 다음 이야기 (시안 B: 시간의 강이 양면을 가로지르고, 3편 자리에 오늘 그림이 걸린다)
  const CH_EPS = HV.chapEps || 10, CUR = EP.no;
  function harvestHTML() {
    const T = HV.terr;
    // ⚠ 강의 점은 **장 안의 순서**로 찍는다. 1장에서만 「편 번호 = 장 안 순서」였다 —
    //   2장 12편에서 pts[11] 을 찾다가 죽었다. 「첫 사례의 값이 코드에 박힌다」의 일곱 번째다 (09-05)
    const first = HV.chapFirst || 1;                    // 이 장의 첫 편 번호
    const HERE = Math.min(Math.max(CUR - first + 1, 1), CH_EPS);   // 장 안에서 몇 번째인가
    const W = 1060, H = 150, x0 = 44, dx = (W - 88) / (CH_EPS - 1);
    const pts = Array.from({ length: CH_EPS }, (_, i) => [x0 + i * dx, 78 - Math.sin(i / (CH_EPS - 1) * Math.PI) * 22]);
    // ⚠ 이름표는 **열 편에 맞춰 만든 것**이다. 2장은 마흔 편이라 점 간격이 24.9px 인데
    //   `.tx` 는 12px 중앙 정렬이라 「11편」 하나가 30px — 「11편12편13편…」으로 다 붙어 못 읽었다.
    //   → 장이 길면 **다섯 편마다** 이름을 단다. 장의 첫 편과 끝 편은 언제나 단다 (읽는 사람의 두 끝점이다).
    //   지금 읽는 편은 위쪽 큰 제목이 대신하므로 아래 이름표를 달지 않는다.
    const sparse = CH_EPS > 14, named = (k, n) => !sparse || k === 1 || k === CH_EPS || n % 5 === 0;
    // 큰 제목은 점 위에 가운데로 서는데, 장의 끝 편에서는 판면(1060) 밖으로 밀려 잘렸다.
    // ⚠ 글자 폭을 어림해 물리려 했더니 **한글은 한 자가 글자 크기만큼 넓어서**(13px 글자면 약 13px)
    //   라틴 기준 어림(6.6px)으로는 절반도 못 맞췄다. 어림하지 말고 **정렬 기준을 바꾼다** — 재지 않아도 정확하다
    //   문턱은 **제목 반쪽의 최대치(170px)**로 잡는다 — 제목이 스무 자 안팎이라 「NN편 · 」까지 340px 을 넘지 않는다.
    //   가운데 구간을 넓게 두어 1장 열 편은 전처럼 점 위에 가운데로 선다. 어긋나 봐야 끝으로 붙을 뿐 잘리지는 않는다
    const bcx = pts[HERE - 1][0], HALF = 170;
    const bigAnchor = bcx > W - HALF ? "end" : bcx < HALF ? "start" : "middle";
    const bigX = bigAnchor === "end" ? W - x0 : bigAnchor === "start" ? x0 : bcx;
    const river = `<svg viewBox="0 0 ${W} ${H}" class="riv"><path d="M${pts.map((p) => p.join(",")).join(" L")}" class="river" pathLength="1"/>
      <!-- ⚠ y=14: 30 이면 장 가운데~오른쪽 편(142편 등)의 큰 제목(가장 높을 때 y=32, 윗변 21)과 한 줄에 포개졌다 -->
      <text x="${W - x0}" y="14" class="chap" text-anchor="end">${chapterLabel} · ${CH_EPS}편 가운데 ${HERE}편째</text>
      ${pts.map(([x, y], i) => { const k = i + 1, n = first + i;   // k = 장 안 순서 · n = 화면에 뜨는 편 번호
        const tag = named(k, n) ? `<text x="${x}" y="${y + 26}" class="tx dim">${n}편</text>` : "";
        return k < HERE ? `<circle cx="${x}" cy="${y}" r="7" class="done"/>${tag}`
        // ⚠ `text-anchor="…"` **속성**은 `.tx{text-anchor:middle}` 규칙에 진다(표현 속성은 CSS보다 약하다). 인라인 스타일로 준다
        : k === HERE ? `<circle cx="${x}" cy="${y}" r="13" class="new"/><text x="${bigX}" y="${y - 24}" style="text-anchor:${bigAnchor}" class="tx big">${n}편 · ${EP.title}</text>`
        : `<circle cx="${x}" cy="${y}" r="5" class="todo"/>${tag}`; }).join("")}</svg>`;
    const thumbX = pts[HERE - 1][0], thumbY = pts[HERE - 1][1];
    const thumbL = Math.max(8, Math.min(W - 116 - 8, thumbX - 58));   // 판면 밖으로 나가지 않게 — 장의 첫 편은 thumbX 가 44라 left 가 -14였다
    // 별자리 — 카드가 둘 이상일 때만. 이름은 이 편의 카드에서 온다
    const cn = (HV.cards || []).map((c) => c.n);
    // ⚠ 자리를 넷만 손으로 박아 두면 카드가 다섯인 편에서 spot[4] 가 undefined 라 수확 면이 통째로 죽는다.
    //   1장 3편(카드 셋)에 맞춘 값이었다 — 「첫 사례의 값이 박힌다」. 몇 장이든 타원에 고르게 돌려 놓는다
    const spot = cn.map((_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / cn.length;
      return [120 + Math.cos(a) * 76, 75 + Math.sin(a) * 46];
    });
    const stars = cn.length < 2 ? "" : `<svg viewBox="0 0 240 150" class="stars">${
      cn.flatMap((_, i) => cn.slice(i + 1).map((_, j) => {
        const [x1, y1] = spot[i], [x2, y2] = spot[i + j + 1];
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="edge"/>`;
      })).join("")}${cn.map((n, i) => `<circle cx="${spot[i][0]}" cy="${spot[i][1]}" r="7" class="node"/><text x="${spot[i][0]}" y="${spot[i][1] - 14}" class="tx">${n}</text>`).join("")}</svg>`;
    // ⚠ **도읍이 없는 나라가 있다.** 50편의 「당의 관청」이 그렇다 — 나라가 아니라 관청이라 도읍을 찍지 않는다.
    //   전에는 핀이 반드시 있다고 보고 `MAP.pins[T.pin]` 을 그대로 `pin[0]` 으로 읽었다.
    //   50편에서 수확 면이 죽으면서 **리더가 통째로 안 섰다**(문제 면 다섯만 서고 쪽수도 안 떴다).
    //   1장 고조선/아사달로 만들 때 박힌 가정이다. 이름표도 같은 병이 날 수 있으니 함께 막는다
    /* ── 살아있는 지도 ─────────────────────────────────────────────────────────
       **모든 편에 선다** (Matto 2026-09-16 — DECISIONS 63 「영토가 바뀌는 편만」을 뒤집는다).
       전에는 영토가 안 바뀌는 편(50편 가운데 30편)에서 오른쪽 면이 비어, 낱말 곳간이 그 빈 면을 메우러
       건너갔다 — 아이 눈에는 편마다 물건 자리가 바뀌었다. 이제 오른쪽은 늘 지도다.

       한 장에 둘을 겹쳐 읽힌다:
         · 지금까지 새긴 나라 = 연한 점선(`.old`)  · 오늘 편에서 바뀐 곳 = 진한 실선
       창은 **역사책 지도와 같은 MAP_VIEW 를 박아 둔다.** 편마다 창이 움직이면(옛 코드가 그랬다)
       같은 땅이 편마다 다른 크기로 보여 「자란 것」과 「확대된 것」을 못 가른다. 고정하면 나라가 늘어나는 것만 보인다.
       ⚠ 도읍이 없는 나라(50편 「당의 관청」)·이름표가 없는 키가 있다 — 둘 다 없어도 죽지 않게 각각 막는다. */
    const LIVE = HV.live || [];
    const map = (() => {   // 새긴 나라가 없어도(1·2·10편) 빈 땅을 그린다 — 칸이 통째로 사라지면 편마다 면 모양이 바뀐다
      /* ⚠ **도읍은 오늘 바뀐 나라 것만 찍는다.** 넷을 다 찍어 보니 남쪽에 금성·김해·한성이 몰려
         「시라금성가야김해」로 뭉갰다 — 이 지도는 256px 라 역사책 지도(512px)의 반이다. 도읍을 다 보려면 역사책으로 간다.
         재는 단위가 **화면 px 이 아니라 뷰박스 단위**인 것도 여기서 한 번 틀렸다: 40단위는 화면에서 13.6px 라
         겹침을 하나도 못 걸렀다. 역사책이 512px 에서 36단위를 썼으니 여기는 그 두 배(85)가 같은 거리다. */
      /* 두 문턱은 **재서** 잡았다 (뷰박스 단위. 이 지도는 264px/750단위 = 0.352배라 30단위가 화면 11px 이다):
         · MUTE 30 — 이름표 쌍의 실제 거리를 다 재 보면 **0 · 18 · 26 단위**에 뭉쳐 있고(같은 나라가 자란 자리:
           고려↔고려_993↔고려_1107…, 조선↔대한, 신라↔대한민국) 그 위로는 51단위(서라벌↔구야)로 뛴다.
           30 은 그 골짜기다. 85 로 잡았더니 **이웃한 신라까지 지워** 「나라 4」인데 이름이 셋이었다.
         · NUDGE 60 — 제 도읍 핀과 겹치는 이름을 위로 올리는 거리 (졸본은 제 이름표와 11단위 차이였다) */
      const MUTE = 30, NUDGE = 60;
      const seen = new Set();
      const shownPins = LIVE.filter((e) => e.ep === CUR)
        .flatMap((e) => (e.pins || []).filter((n) => { if (!MAP.pins[n] || seen.has(n)) return false; seen.add(n); return true; }));
      // 이름표가 겹치면 **나중 것만** 남긴다 (한 나라가 자란 자리는 이름이 둘 겹친다 — 역사책 지도와 같은 규칙)
      const put = [], mute = new Set();
      for (let i = LIVE.length - 1; i >= 0; i--) {
        const lb = MAP.labels[LIVE[i].terr]; if (!lb) { mute.add(LIVE[i].terr); continue; }
        if (put.some(([x, y]) => Math.hypot(x - lb[0], y - lb[1]) < MUTE)) mute.add(LIVE[i].terr); else put.push(lb);
      }
      // 오늘 바뀐 것을 **나중에** 그려 위에 오게 한다 (연한 것 위에 진한 것)
      const draw = (e) => {
        const isNew = e.ep === CUR, k = isNew ? "" : " old", d = MAP.territories[e.terr];
        if (!d) return "";
        let lb = !mute.has(e.terr) && MAP.labels[e.terr];
        // 제 도읍 핀과 겹치면 나라 이름을 위로 올린다 — 작은 나라는 이름 자리가 도읍과 거의 같다(졸본은 11단위 차이였다)
        if (lb && shownPins.some((n) => Math.hypot(MAP.pins[n][0] - lb[0], MAP.pins[n][1] - lb[1]) < NUDGE)) lb = [lb[0], lb[1] - 46];
        // 나라마다 제 색(--nc) — app.html 이 core.nationColor 로 실어 보낸다. 없으면 옛 색(--ch·--frame)으로 내려앉는다
        return `<g class="tgrp${k}"${e.color ? ` style="--nc:${e.color}"` : ""}><path d="${d}" class="terr${k}" pathLength="1"/>`
          + (lb ? `<text x="${lb[0]}" y="${lb[1]}" class="tname${k}">${e.name}</text>` : "")
          + `</g>`;
      };
      // ⚠ 핀은 **여기서 한 번만** 그린다. 나라마다 그렸더니 한 편에 나라가 둘인 편(176·178)에서
      //   같은 오늘의 핀이 두 벌 겹쳐 찍혔다(「서울 평양 서울 평양」).
      const pinSVG = shownPins.map((n) => { const [x, y] = MAP.pins[n];
        return `<circle cx="${x}" cy="${y}" r="8" class="pin"/><text x="${+x + 15}" y="${+y + 8}" class="pname">${n}</text>`; }).join("");
      const body = LIVE.filter((e) => e.ep !== CUR).map(draw).join("") + LIVE.filter((e) => e.ep === CUR).map(draw).join("") + pinSVG;
      return `<svg viewBox="150 300 750 936" class="map" preserveAspectRatio="xMidYMid meet">
        <path d="${MAP.land.context}" class="ctx"/><path d="${MAP.land.korea}" class="land"/>
        ${Object.values(MAP.rivers || {}).map((d) => `<path d="${d}" class="mriv"/>`).join("")}${body}</svg>`;
    })();
    // 지도 옆 글 — 오늘 바뀐 게 있으면 그 편의 한 줄, 없으면 「그대로」라고 분명히 말한다(아이가 고장으로 읽지 않게)
    const mapSide = !map ? "" : `<div class="mapside">
      <span class="label">살아있는 지도 <b>나라 ${LIVE.length}</b></span>
      ${LIVE.length ? `<div class="legend">${T ? `<span><i class="sw new"></i>오늘 바뀐 곳</span>` : ""}<span><i class="sw old"></i>지금까지 새긴 나라</span></div>` : ""}
      <div class="cap">${T ? T.cap : HV.terrCap || (LIVE.length ? "오늘은 지도가 그대로예요. 지금까지 새긴 나라를 다시 봅니다." : "아직 지도에 이름을 새긴 나라가 없어요.")}</div></div>`;
    /* 낱말 곳간은 **카드가 있든 없든 늘 왼쪽 아래**다. 카드와 낱말은 둘 다 오늘의 수확이지 양자택일이 아니다.
       ~~전에는 지도가 없는 편에서 빈 오른쪽 면을 메우려고 낱말 곳간이 건너갔다(`toRight`).~~
       (2026-09-16 삭제) 지도가 모든 편에 서게 되어 오른쪽이 빌 일이 없다. 물건은 편마다 같은 자리에 있어야 한다 —
       자리가 바뀌면 아이는 어제 본 것을 오늘 다시 찾아야 한다. 이것이 Matto 가 「원래 좌측 하단 아니었나」로 알아챈 그 병이다. */
    const words = `<span class="label">낱말 곳간 <b>+${EP.words.length}개</b></span>
        <div class="wordbag tight${EP.words.length >= 9 ? " dense" : ""}">${EP.words.map((w) => `<span><b>${w.w}</b>${w.d}</span>`).join("")}</div>`;
    // 카드를 안 내주는 편이 훨씬 많다(1장은 열 편 가운데 3편 하나뿐). 왜 없는지 한 줄을 남긴다 — DECISIONS 58
    const nocard = `<div class="nocard"><b>오늘은 카드 대신 낱말을 얻었어요.</b>
        인물 카드는 옛 기록에 이름이 또렷이 남은 사람에게만 드려요.
        지어낸 사람에게도 카드를 주면 그 사람을 진짜 역사 속 인물로 기억하게 되니까요.
        오늘 만난 사람들이 어디까지 진짜인지는 「진짜일까?」 면에서 이야기했어요.</div>`;
    return `<div class="river-band">${river}</div>
      ${HV.thumb ? `<img class="thumb" src="${HV.thumb}" alt="" style="left:${thumbL}px; top:${thumbY + 16}px">` : ""}
      <div class="col l${EP.words.length >= 10 ? " many" : ""}">
        ${cn.length ? `<div class="haul${stars ? " starred" : ""}">
          <div><span class="label">인물 카드 <b>+${cn.length}장</b></span>
          <div class="cards" style="--n:${Math.max(3, cn.length)}">${Object.entries(CARDS).map(([n, c], i) => `<button class="card" data-n="${n}" aria-expanded="false" style="--i:${i}"><div class="band"></div><img src="${c.img}" alt=""><span class="nm">${n}</span></button>`).join("")}</div></div>
          ${stars ? `<div><span class="label">별자리 <b>+${cn.length * (cn.length - 1) / 2}선</b></span>${stars}<div class="cap">${cn.length}명이 선으로 이어졌어요</div></div>` : ""}
        </div>` : nocard}
        ${words}
        <button class="home">홈으로</button>
      </div>
      <div class="col r">
        ${map ? `<div class="mapwrap">${map}${mapSide}</div>` : ""}
        <div class="peek"><div class="page"><span class="stamp">내일<br>아침</span><span class="no">${CUR + 1}편</span><p>${EP.bait[0]}</p></div><div class="fade"></div></div>
      </div>`;
  }
  {
    const v = document.createElement("div"); v.className = "vpage bait";
    v.innerHTML = harvestHTML();
    track.append(v);
  }
  const vpages = $$(".vpage", track);
  const OK_MARK = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>';
  const NO_MARK = '<svg viewBox="0 0 24 24"><path d="M17.5 5.5L6.5 18.5"/></svg>';
  function renderQ(i) {                                    // 푼 문제는 ○ 표시로 풀린 채 보인다
    const v = vpages[i], q = EP.quiz[i], done = i < Q.solved;
    $$(".opt", v).forEach((o) => { o.dataset.s = done ? (+o.dataset.i === q.answer ? "ok" : "done") : ""; $(".mark", o).innerHTML = done && +o.dataset.i === q.answer ? OK_MARK : ""; if (!done) o.removeAttribute("data-s"); });
    $$(".dots i", v).forEach((d, j) => d.className = j < Q.solved ? "ok" : j === i ? "cur" : "");
    $(".fb", v).className = done ? "fb yes" : "fb"; $(".fb", v).innerHTML = done ? "맞힌 문제예요" + evHTML(q) : "";
    $(".nx", v).innerHTML = done ? nextBtn(i) : "";
  }
  // renderQ 는 evHTML·pageOf 를 쓰므로 그것들이 선언된 뒤(첫 조판 직전)에 부른다 — 여기서 부르면 푼 문제가 저장된 브라우저에서 TDZ 로 죽는다

  /* ── 면 계산 ── */
  const R = { page: 0, P: 1, N: 1, story: 1, words: {}, caps: {}, ticks: [], secs: [], anchor: S.k || null };
  const colOf = (el, last = false) => { const box = sp.getBoundingClientRect(), s = box.width / sp.clientWidth || 1, rs = el.getClientRects(), r = rs[last ? rs.length - 1 : 0] || el.getBoundingClientRect(); return Math.floor((r.left - box.left + r.width / 2) / s / COL); };   // 중심으로 잰다 (열 경계의 부동소수 오차 방지)
  const pageOf = (el) => Math.floor(colOf(el) / COLS);
  function blankBefore(fig) {                               // 도판 앞 열에서 마지막 글줄 아래 남는 공백(px)
    const col = colOf(fig) - 1; if (col < 0) return 0;
    const box = sp.getBoundingClientRect(), s = box.width / sp.clientWidth || 1;
    let bottom = 0;
    for (const el of $$(".prose p, .act > h2, .epsub", sp)) for (const r of el.getClientRects())
      if (Math.floor((r.left - box.left + r.width / 2) / s / COL) === col) bottom = Math.max(bottom, (r.bottom - box.top) / s);
    return COLH - bottom;
  }
  function placePlates(win = 10, fwd = 24) {                // 도판은 원고 자리에 못 박지 않고, 앞 면이 비지 않는 가까운 단락 경계에 끼운다 (별지 관례)
    const LH = parseFloat(getComputedStyle(fr).getPropertyValue("--lh")) || 32;
    for (const fig of $$("figure.plate", sp)) {
      const prev = fig.previousElementSibling?.querySelector(".prose"), next = fig.nextElementSibling?.querySelector(".prose");
      if (!prev || !next) continue;
      const move = (d) => { for (let i = 0; i < d; i++) next.firstElementChild && prev.append(next.firstElementChild); for (let i = 0; i < -d; i++) prev.lastElementChild && next.prepend(prev.lastElementChild); };
      const na = Math.min(fwd, next.children.length - 1), nb = Math.min(win, prev.children.length), ds = [0];
      for (let i = 1; i <= na; i++) ds.push(i); for (let i = 1; i <= nb; i++) ds.push(-i);
      // 끼움 그림은 자기 장면 단락에 붙어 다닌다 — 통그림 경계가 둘 사이를 가르면(끼움 그림이 통그림 뒤 첫머리가 되면) 그 자리는 버린다 (2026-10-14)
      const all = ds.map((d) => { move(d); const blank = blankBefore(fig), split = !!next.firstElementChild?.matches("figure.spot"); move(-d); return { d, blank, split }; }).filter((r, _, xs) => !r.split || xs.every((x) => x.split));
      // 그림 뒤를 비우지 않는다 — 원고 끝 그림 뒤가 비면 「오늘 이야기 끝」만 한 면에 홀로 남았다 (147편, 2026-09-18)
      // ⚠ **마지막 막에서만.** 다른 막 끝 그림 뒤에는 다음 막 제목이 온다. 모든 막에 걸었더니 막 끝 그림이 일곱 단락씩 앞으로 당겨졌다 (2026-10-02)
      const lastAct = next.closest(".act") === [...sp.querySelectorAll("section.act")].pop();
      const keep = lastAct ? all.filter((r) => next.children.length - r.d >= 1) : all, res = keep.length ? keep : all;
      // 그림은 장면 **뒤** 경계를 먼저 찾는다. 앞으로 당기면(d<0) 원고에서 그림 앞에 있던 장면 단락이 그림 뒤로 밀려
      // 아이가 장면을 읽기도 전에 그림을 본다 — 539장 중 160장이 그랬다 (Matto 제보 42편, 2026-10-02).
      // 전에는 「빈 줄 2줄 이하 중 가장 가까운 곳, 없으면 빈칸 최소」였는데, 단락 끝이 면 맨 밑 두 줄에 걸리는 일이 드물어
      // 거의 늘 빈칸 최소로 떨어져 방향 없이 열 단락까지 당겨졌다. → 점수: 빈 줄 수 + 당기면 3 + 당긴 단락마다 0.5 + 미룬 단락마다 0.15
      const cost = (r) => r.blank / LH + (r.d < 0 ? 3 + 0.5 * -r.d : 0.15 * r.d);
      move(res.reduce((a, b) => (cost(b) < cost(a) ? b : a)).d);
    }
  }
  function prepareSpots() {
    // 오림 그림의 장면과 바로 뒤 단락은 낱말을 중간에 쪼개지 않는다.
    for (const f of $$("figure.spot-cut", sp)) {
      [f.previousElementSibling, f.nextElementSibling].filter(p => p?.matches("p"))
        .forEach(p => p.classList.add("spot-scene"));
    }
  }
  function limitSpots() {
    // 폭으로 높이를 제한한다. 기존 폭 상한 안에 드는 가로 그림은 그대로 둔다.
    for (const f of $$("figure.spot", sp)) {
      const img = $("img", f), cap = $("figcaption", f);
      if (!img) continue;
      const cut = f.classList.contains("spot-cut"), cs = getComputedStyle(f);
      const ratio = cut ? (img.naturalWidth || img.width) / (img.naturalHeight || img.height) : 3 / 2;
      const extra = parseFloat(cs.marginTop) + parseFloat(cs.marginBottom) +
        cap.offsetHeight + parseFloat(getComputedStyle(cap).marginTop);
      const height = cut ? Math.min(COLH * .55, COLH - extra - 1) : COLH - extra - 1;
      f.style.setProperty("--spot-height-width", Math.max(1, height * ratio) + "px");
    }
  }
  // 원고 순서는 바꾸지 않는다. 줄여도 안 들어가면 그림 전체를 다음 단 맨 위로 보낸다.
  function fitSpots(spots = $$("figure.spot", sp)) {
    const box = sp.getBoundingClientRect(), s = box.width / sp.clientWidth || 1;
    for (const f of spots) {
      const img = $("img", f), prev = f.previousElementSibling;
      // 오림은 높이 상한 안의 폭을 유지하며 설명까지 통째로 다음 단으로 보낸다.
      if (f.classList.contains("spot-cut")) {
        if (img && prev && colOf(f) !== colOf(prev, true)) f.style.breakBefore = "column";
        continue;
      }
      if (!img || !prev) continue;
      f.style.breakBefore = "";
      img.style.width = "";
      if (colOf(f) === colOf(prev, true)) continue;
      const rs = prev.getClientRects(), pb = ((rs[rs.length - 1] || prev.getBoundingClientRect()).bottom - box.top) / s;
      const fb = f.getBoundingClientRect(), ir = img.getBoundingClientRect();
      const ih = ir.height / s, nh = ih - (fb.height / s - (COLH - pb)) - 12;
      if (nh >= ih * 0.6) {
        img.style.width = (ir.width / s) * (nh / ih) + "px";
        if (colOf(f) === colOf(prev, true)) continue;
        img.style.width = "";
      }
      f.style.breakBefore = "column";
    }
  }
  // 끝 도판 뒤에 짧은 본문 면이 남으면, 끝 글과 끝 표시를 왼쪽, 도판을 오른쪽에 놓아 본다.
  // 실제로 한 단에 다 들어간 경우만 유지한다. 한 단 화면과 넘치는 경우는 기존 배치를 보존한다.
  function closeEndSpread() {
    if (COLS !== 2) return;
    const fig = $$("figure.plate", sp).pop(), em = $(".endmark", sp);
    const prev = fig?.previousElementSibling?.querySelector(".prose");
    const next = fig?.nextElementSibling?.querySelector(".prose");
    if (!prev || !next || next.closest(".act") !== $$("section.act", sp).pop()) return;
    const fc = colOf(fig), remaining = [...next.children], paragraphs = $$("p", next);
    if (!paragraphs.length) return;
    const rows = [];
    for (const p of paragraphs) {
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        if (!walker.currentNode.data.trim()) continue;
        const range = document.createRange(); range.selectNodeContents(walker.currentNode);
        for (const r of range.getClientRects()) if (r.width && !rows.some(top => Math.abs(top - r.top) < 2)) rows.push(r.top);
      }
    }
    if (rows.length > 6 || remaining.some(el => el.tagName !== "P")) return;
    // 왼쪽 도판과 오른쪽 끝 글이 같은 펼친 면에 있으면 두 자리만 맞바꾼다.
    // 다음 막 전체와 끝 표시가 왼쪽 한 단에 들어가는 경우에만 유지한다.
    if (fc % 2 === 0 && pageOf(em) === Math.floor(fc / 2)) {
      const act = next.closest(".act"), actBreak = act.style.breakBefore;
      const emParent = em.parentElement, emNext = em.nextSibling, tight = em.classList.contains("tight");
      fig.before(act); act.style.breakBefore = "column"; next.append(em); em.classList.remove("tight");
      const fits = () => colOf(fig) === fc + 1 && colOf(em) === fc &&
        remaining.every(el => colOf(el) === fc && colOf(el, true) === fc);
      if (!fits()) em.classList.add("tight");
      if (fits()) { fig.dataset.endSpread = "paired"; return; }
      fig.after(act); act.style.breakBefore = actBreak;
      emParent.insertBefore(em, emNext); em.classList.toggle("tight", tight);
      return;
    }
    if (fc % 2 !== 1 || pageOf(em) !== Math.floor(fc / 2) + 1) return;
    const emParent = em.parentElement, emNext = em.nextSibling;
    const breaks = remaining.map(el => el.style.breakBefore);
    const tight = em.classList.contains("tight");
    remaining.forEach(el => { el.style.breakBefore = ""; prev.append(el); });
    prev.append(em); em.classList.remove("tight");
    const fits = () => colOf(fig) === fc && colOf(em) === fc - 1 &&
      remaining.every(el => colOf(el) === fc - 1 && colOf(el, true) === fc - 1);
    // 끝 표시가 표준 여백으로 넘치면 기존의 좁은 여백도 시험한다.
    if (!fits()) em.classList.add("tight");
    if (fits()) { next.closest(".act").remove(); fig.dataset.endSpread = "closed"; return; }
    remaining.forEach((el, i) => { el.style.breakBefore = breaks[i]; next.append(el); });
    emParent.insertBefore(em, emNext); em.classList.toggle("tight", tight);
  }
  function endingLines() {
    const ps = $$(".prose p", sp), last = ps.at(-1);
    if (!last) return 0;
    const box = sp.getBoundingClientRect(), scale = box.width / sp.clientWidth || 1;
    const col = colOf(last, true), rows = [];
    for (const p of ps) {
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        if (!walker.currentNode.data.trim()) continue;
        const range = document.createRange(); range.selectNodeContents(walker.currentNode);
        for (const r of range.getClientRects()) if (r.width &&
          Math.floor((r.left - box.left + r.width / 2) / scale / COL) === col &&
          !rows.some(y => Math.abs(y - r.top) < 2)) rows.push(r.top);
      }
    }
    return rows.length;
  }
  function shortEnding() {
    const lastP = $$(".prose p", sp).at(-1);
    const lastPicture = Math.max(...$$("figure.spot, figure.plate", sp).map(f => colOf(f, true)));
    return lastP && endingLines() <= 6 && lastPicture < colOf(lastP, true);
  }
  function layout() {
    if (destroyed) return;
    readGeom();                                             // 회전·글자 크기로 판면이 바뀌었을 수 있다
    sp.classList.add("placing");
    sp.innerHTML = BODY; sp.style.width = (PITCH - GAP) + "px";
    prepareSpots();
    $$(".lpage, .rpage", sp).forEach((pg) => {
      if (pg.scrollHeight <= COLH + 1) return;
      pg.classList.add("flow");
      // flex 면의 기존 단 조각을 재사용하지 않고, 흐름 면으로 처음부터 조판한다.
      pg.replaceWith(pg.cloneNode(true));
    });
    placePlates();
    fitSpots();
    const selectedBody = sp.innerHTML;
    // 기존 끝 펼침 보정을 먼저 반영한 길이를 축소 전 기준으로 삼는다.
    {
      const em = $(".endmark", sp), lastP = $$(".prose p", sp).pop();
      const alone = () => lastP && colOf(em) !== colOf(lastP, true);
      if (alone()) { em.classList.add("tight"); if (alone()) { em.classList.remove("tight"); lastP.style.breakBefore = "column"; } }
      closeEndSpread();
    }
    const originalShortEnding = shortEnding();
    sp.innerHTML = selectedBody;
    // 크기를 줄여도 기존 도판 경계와 가로 그림의 고른 폭은 유지한다.
    // 먼저 원래 크기로 자리를 고르고, 높이 상한이 걸린 오림만 줄여 다시 흐르게 한다.
    limitSpots();
    sp.classList.remove("placing");
    $$("figure.spot-cut", sp).forEach(f => { f.style.breakBefore = ""; });
    sp.replaceChildren(...[...sp.childNodes].map(n => n.cloneNode(true)));
    fitSpots($$("figure.spot-cut", sp));
    // 「오늘 이야기 끝」이 홀로 새 면에 서지 않게 — 여백을 줄여 앞 면에 붙이고, 그래도 안 되면 마지막 단락을 데리고 넘긴다 (7·11·102·177편, 2026-09-18)
    const em = $(".endmark", sp), lastP = $$(".prose p", sp).pop();
    const alone = () => lastP && colOf(em) !== colOf(lastP, true);
    if (alone()) { em.classList.add("tight"); if (alone()) { em.classList.remove("tight"); lastP.style.breakBefore = "column"; } }
    closeEndSpread();
    // 축소로 새로 생긴 짧은 끝 단만 막는다. 기존의 짧은 끝 단은 유지한다.
    const keptEndings = new Set();
    while (!originalShortEnding && shortEnding()) {
      const endCol = colOf(lastP, true);
      const first = $$(".prose p", sp).find(p => colOf(p, true) === endCol);
      const state = first.dataset.k + ":" + colOf(first) + ":" + first.getAttribute("style");
      if (keptEndings.has(state)) break;
      keptEndings.add(state);
      if (colOf(first) < endCol) { first.style.widows = "7"; first.style.breakInside = "avoid"; }
      else if (first.previousElementSibling?.matches("p")) first.style.breakBefore = "avoid";
      else {
        // 마지막 도판을 줄인 흐름에서 끝 두세 줄만 떨어졌으면 앞 문단도 함께 넘긴다.
        const fig = $$("figure.plate", sp).at(-1);
        const prev = fig?.previousElementSibling?.querySelector(".prose");
        const next = fig?.nextElementSibling?.querySelector(".prose");
        if (next?.contains(first)) while (shortEnding() && prev?.lastElementChild?.matches("p")) {
          next.prepend(prev.lastElementChild);
        }
      }
    }
    // 인물 면은 늘 오른쪽 면 (1단에는 오른쪽이 없다). 이야기가 오른쪽 면에서 끝나면 그 사이에 한 면이 남는다 —
    // 뒤따르는 면이 셋(사람들 · 그 뒤 이야기 | 진짜일까)이라 **어떻게 놓아도 한 면은 남는다.** ~~빈 면으로 둔다~~ (2026-09-11, Matto: 빈 면은 고장처럼 보인다)
    // → 그 편의 그림 한 장으로 닫는다. 썸네일(480×250)이 판면 폭(480)과 같아 흐리지 않다
    // ⚠ 썸네일은 삽화를 가로 480×250 으로 **잘라 낸** 것이라 이 면에서는 머리·발이 잘려 보였다 (Matto 제보, 2026-09-17).
    //   → 그 편의 첫 삽화(세로 원본)를 자르지 않고 통째로 건다
    const tailSrc = EP.acts.flatMap((a) => a.blocks).find((b) => b.t !== "p" && b.src)?.src;
    const storyEndCol = Math.max(colOf(em), ...$$("figure.plate", sp).map(f => colOf(f)));
    if (COLS === 2 && storyEndCol % 2 === 1) $(".people", sp).insertAdjacentHTML("beforebegin", tailSrc
      ? `<figure class="spacer tail"><img src="${tailSrc}" alt=""><figcaption>${EP.no}편 · ${EP.title}</figcaption></figure>`
      : '<div class="spacer"></div>');
    R.caps = {};
    $$("figure.plate", sp).forEach((f) => { R.caps[colOf(f)] = `<span class="cap"><b>그림 ${f.dataset.n}</b>${f.dataset.cap}</span>`; });
    // Chromium의 다단 scrollWidth는 글자를 줄여도 이전의 긴 폭을 남길 수 있다.
    // 실제 마지막 내용의 열로 세어, 비어 있는 옛 폭이 쪽 수에 들어가지 않게 한다.
    const lastCol = Math.max(...[...sp.children].map(el => colOf(el, true)));
    R.P = Math.max(1, Math.ceil((lastCol + 1) / COLS));
    // 조판 뒤 다단 폭을 바꾸면 단 경계가 다시 바뀔 수 있다.
    // 한 펼침 폭을 유지하고, 넘친 단만큼 여백을 두어 문제 면을 잇는다.
    sp.style.marginRight = ((R.P - 1) * PITCH) + "px";
    R.N = R.P + vpages.length;
    R.words = {};
    $$(".dot", sp).forEach((el) => { const w = EP.words.find((k) => k.w === el.textContent); if (w) (R.words[colOf(el)] ||= []).push(w); });
    R.story = Math.floor(storyEndCol / COLS) + 1;
    R.ticks = $$(".act > h2", sp).slice(1).map(pageOf);
    R.secs = $$("[data-sec]", sp).map((el) => [pageOf(el), el.dataset.sec]);
    $$(".tick", fr).forEach((t) => t.remove());
    R.ticks.forEach((p) => { const t = document.createElement("i"); t.className = "tick"; t.style.left = (p / R.story * 100) + "%"; fr.append(t); });
    let p = R.page;
    if (R.anchor) { const el = sp.querySelector(`[data-k="${R.anchor}"]`); if (el) p = pageOf(el); }
    if (Q.phase === "exam" && !R.ready) p = R.P + Math.min(Q.solved, EP.quiz.length - 1);
    if (Q.phase === "clear" && !R.ready) p = 0;
    const first = !R.ready; R.ready = true;
    go(p, true);
    if (Q.back !== null && Q.markQ) markEvidence(Q.markQ);   // 재조판으로 DOM 이 새로 생겼으니 표시도 다시
    if (first && p > 0) showToast("읽던 곳에서 다시 시작해요", "처음부터 읽기", () => go(0));
  }
  const fnHTML = (ws) => ws.map((w) => `<button class="w" data-w="${esc(w.w)}" aria-expanded="false"><b>${w.w}</b>${w.d}</button>`).join("");
  function bump(dir) { rail.classList.remove("bump-l", "bump-r"); void rail.offsetWidth; rail.classList.add("bump-" + dir); }
  function go(i, instant = false) {
    closeTip(); closePop();
    const to = Math.max(0, Math.min(R.N - 1, i));
    if (!instant) {
      if (to === R.page && i !== R.page) { bump(i < 0 ? "l" : "r"); return; }
      if (to > R.page && R.page >= R.P) {                    // 문제 면: 답을 골라야 다음으로
        const qi = R.page - R.P;
        if (qi >= EP.quiz.length || Q.solved <= qi) { bump("r"); if (qi < EP.quiz.length) showLock(qi); return; }
      }
      if (hintov) hideHint();
    }
    R.page = to;
    track.style.transition = (instant || REDUCED) ? "none" : "";
    track.style.transform = `translateX(${-to * PITCH}px)`;
    if (instant) void track.offsetHeight;
    if (!instant && to < R.P) { const el = $$("[data-k]", sp).find((e) => pageOf(e) === to); if (el) R.anchor = el.dataset.k; }   // 앵커는 사람이 넘길 때만 갱신 (재조판이 앵커를 앞으로 끌지 않게)
    if (to >= R.P && Q.phase === "story") Q.phase = "exam";
    if (Q.back !== null && to === Q.back) { Q.back = null; clearMark(); }
    const pg = $("#pg"); pg.textContent = Q.back !== null ? (Q.back < R.P + EP.quiz.length ? "문제로 돌아가기" : "수확으로 돌아가기") : `${to + 1} / ${R.N}`; pg.classList.toggle("back", Q.back !== null);
    $("#prog").style.width = Math.min(1, (to + 1) / R.story) * 100 + "%";
    const sec = R.secs.filter(([p]) => p <= to).pop();
    $("#ttl").textContent = to >= R.P ? (to - R.P < EP.quiz.length ? `읽기 확인 ${to - R.P + 1} / ${EP.quiz.length}` : "오늘의 수확") : (sec ? sec[1] : EP.title);
    if (to === R.N - 1 && !instant) { const b = $(".vpage.bait"); b.classList.remove("play"); void b.offsetWidth; b.classList.add("play"); }   // 도착 연출
    $("#fnl").innerHTML = to < R.P ? (R.caps[to * COLS] || "") + fnHTML(R.words[to * COLS] || []) : "";
    $("#fnr").innerHTML = to < R.P && COLS === 2 ? (R.caps[to * 2 + 1] || "") + fnHTML(R.words[to * 2 + 1] || []) : "";
    $$(".fn").forEach((f) => { f.style.visibility = f.innerHTML ? "" : "hidden"; f.scrollTop = 0; });
    $(".gutter").hidden = to === R.N - 1;                  // 다음 이야기 면은 먹지 밴드가 양면을 가로지른다
    // 보조 풀이는 눌러 볼 줄 알아야 쓸모가 있다 — 밑줄 친 말이 있는 면에 처음 오면 한 번만 알린다 (넘김 안내를 본 뒤에)
    if (!S.glossHinted && S.hinted && !toast && to < R.P && $$(".hint", sp).some((h) => pageOf(h) === to)) {
      S.glossHinted = true; showToast("점선 밑줄 친 말을 누르면 뜻이 나와요");
    }
    save();
  }
  function save() { opts.onSave?.({ k: R.anchor, phase: Q.phase, solved: Q.solved, fs: FS, hinted: S.hinted, glossHinted: S.glossHinted, pct: R.story ? Math.min(1, (R.page + 1) / R.story) : 0 }); }
  function showLock(qi) { const m = $(".lockmsg", vpages[qi]); m.classList.add("show"); clearTimeout(m._t); m._t = setTimeout(() => m.classList.remove("show"), 1600); }

  /* ── 넘김: 탭 · 쓸기 · 키보드 ── */
  let px = null, py = null, swiped = false;
  $("#book").addEventListener("pointerdown", (e) => { if (!e.isPrimary) return; px = e.clientX; py = e.clientY; swiped = false; });
  $("#book").addEventListener("pointerup", (e) => {
    if (px === null) return; const dx = e.clientX - px, dy = e.clientY - py; px = py = null;
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy)) { swiped = true; go(R.page + (dx < 0 ? 1 : -1)); }
  });
  $("#book").addEventListener("pointercancel", () => { px = py = null; });
  rail.addEventListener("scroll", () => { rail.scrollLeft = 0; });      // 포커스 이동이 rail 을 밀지 못하게
  $("#book").addEventListener("click", (e) => {
    const d = e.target.closest(".dot, .hint");   // .hint = 보조 풀이 — 풍선만 뜬다 (각주·곳간은 .dot 만 모은다)
    if (d) { const w = (d.classList.contains("hint") ? EP.hints || [] : EP.words).find((k) => k.w === d.textContent); if (w) showTip(d, wordTip(w)); return; }
    const who = e.target.closest(".who, .pcard, .bait .card");
    if (who) { showTip(who, personTip(who.dataset.n), "person"); return; }
    const th = e.target.closest(".bait .thumb");             // 강에 걸린 오늘 그림 = 그 도판 면으로
    if (th) { Q.back = R.page; go(pageOf($("figure.plate", sp))); return; }
    const fw = e.target.closest(".fn .w");
    if (fw) { showTip(fw, wordTip(EP.words.find((k) => k.w === fw.dataset.w))); return; }
    if (e.target.closest(".tip, button")) return;          // 문제 면의 버튼(보기·다시 찾기·그 면 보기·홈)은 넘김이 아니다
    if (swiped) { swiped = false; return; }
    if (tip) { closeTip(); return; }                       // 툴팁이 떠 있으면 첫 탭은 닫기만
    if (pop) { closePop(); return; }
    const fb = fr.getBoundingClientRect(), s = fb.width / fr.offsetWidth, x = (e.clientX - fb.left) / s, y = (e.clientY - fb.top) / s;
    if (y > 52 + 16 + COLH) return;                        // 각주 띠는 넘김 금지 구역
    const mid = fr.offsetWidth / 2;
    if (COLS === 2 && Math.abs(x - mid) <= GAP / 2) { showHint(1200); return; }   // 홈통 = 안내 (1단에는 홈통이 없다)
    go(R.page + (x < mid ? -1 : 1));
  });
  // ⚠ 키는 **문서 전체**에서 듣는다. 전에는 fr(#rbox)에 걸었는데 #rbox 는 초점을 못 받는 div 라
  //   글을 눌러도 초점이 body 에 머물러 PC 에서 화살표·스페이스가 먹지 않았다(2026-10-14 의뢰).
  //   destroy() 에서 뗀다 — 안 떼면 홈에서도 책장이 넘어간다
  const onKey = (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
    if (!fr.contains(e.target) && e.target.closest?.("button, a, [role=button], [role=dialog]")) return;   // 책 밖 단추·창은 제 키를 쓴다
    if (e.target.matches(".dot, .hint, .who") && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.target.click(); return; }
    if (e.target.matches("button") && (e.key === "Enter" || e.key === " ")) return;
    const k = e.key;
    if ((k === " " && e.shiftKey) || k === "ArrowLeft" || k === "PageUp" || k === "Backspace") { e.preventDefault(); go(R.page - 1); }
    else if (k === "ArrowRight" || k === " " || k === "PageDown") { e.preventDefault(); go(R.page + 1); }
    else if (k === "Home") { e.preventDefault(); go(0); }
    else if (k === "End") { e.preventDefault(); go(R.story - 1); }
    else if (k === "Escape") { closeTip(); closePop(); }
  };
  document.addEventListener("keydown", onKey);
  const onDocumentClick = (e) => { if (!fr.contains(e.target)) { closeTip(); closePop(); } };
  document.addEventListener("click", onDocumentClick);
  fr.addEventListener("focusin", (e) => { const el = e.target.closest(".dot, .hint, .who"); if (el && R.ready) { const p = pageOf(el); if (p !== R.page) go(p, true); } rail.scrollLeft = 0; });

  /* ── 읽기 확인 ── */
  track.addEventListener("click", (e) => {
    if (e.target.closest(".home")) { save(); opts.onExit?.({ k: R.anchor, phase: Q.phase, solved: Q.solved }); return; }
    const nx = e.target.closest(".next");
    if (nx) { go(R.P + +nx.closest(".vpage").dataset.qi + 1); return; }
    const again = e.target.closest(".again, .goto");
    if (again) { const q = EP.quiz[+again.closest(".vpage").dataset.qi]; Q.back = R.page; Q.markQ = q; go(findPage(q), false); markEvidence(q); return; }
    const b = e.target.closest(".opt"); if (!b || b.dataset.s) return;
    const v = b.closest(".vpage"), i = +v.dataset.qi; if (i !== Q.solved) return;
    const q = EP.quiz[i], j = +b.dataset.i, fb = $(".fb", v);
    if (j === q.answer) {
      b.dataset.s = "ok"; $(".mark", b).innerHTML = OK_MARK; $(".mark", b).classList.add("stamped");
      fb.className = "fb yes"; fb.innerHTML = ["정답!", "그렇죠", "정확해요", "맞아요", "훌륭해요"][i] + evHTML(q); markQuotes();
      $(".nx", v).innerHTML = nextBtn(i);
      $$(".opt", v).forEach((o) => { if (!o.dataset.s) o.dataset.s = "done"; });
      opts.onAnswer?.({ i, first: Q.wrong === 0 });   // 내 마을(DECISIONS 51): 첫 시도 정답만 셈한다. 되풀이 규칙은 그대로
      Q.solved++; Q.wrong = 0; vpages.forEach((p, n) => $$(".dots i", p).forEach((d, k) => d.className = k < Q.solved ? "ok" : k === n ? "cur" : ""));
      $("#live").textContent = `정답. ${Q.solved} / ${EP.quiz.length}`;
      // 넘어가는 것은 [다음 문제] 단추가 한다 — 전에는 0.9초 뒤 저절로 넘어갔다
      if (Q.solved === EP.quiz.length) { Q.phase = "clear"; save(); opts.onClear?.(); }
      else save();
    } else {
      b.dataset.s = "no"; $(".mark", b).innerHTML = NO_MARK; $(".mark", b).classList.add("stamped"); Q.wrong++;
      fb.className = "fb no";
      fb.innerHTML = "다시 한번! 답은 이야기 속에 있어요" + `<span class="why">${q.why[j] || ""}</span>` + (Q.wrong >= 2 ? '<br><button class="again">이야기에서 다시 찾기</button>' : "");
      $("#live").textContent = "다시 한번. " + (q.why[j] || "");
    }
  });
  // 근거 = 원고의 '근거:' 문장. 그 문장이 든 단락과 문장을 찾는다 (없으면 정답 낱말이 가장 많이 나온 단락의 문장)
  const norm = (s) => s.replace(/[\s"“”'‘’「」]/g, "");
  function evidence(q) {
    const blocks = $$(".prose p, .hooju p, .truth p", sp);
    let el = null, text = "";
    if (q.ref) { const k = norm(q.ref); el = blocks.find((p) => norm(p.textContent).includes(k)); if (el) text = q.ref; }
    if (!el) {
      const toks = q.opts[q.answer].split(/[\s,·과와의은는이가을를]+/).filter((t) => t.length >= 2);
      let best = 0;
      blocks.forEach((p) => { const sc = toks.filter((t) => p.textContent.includes(t)).length; if (sc > best) { best = sc; el = p; } });
      if (el) { const sents = el.textContent.match(/[^.!?。]+[.!?。]?/g) || [el.textContent]; text = sents.sort((a, b) => toks.filter((t) => b.includes(t)).length - toks.filter((t) => a.includes(t)).length)[0].trim(); }
    }
    return { el, text };
  }
  // 면은 단락이 아니라 **문장**의 첫 줄로 찾는다 — 단락이 면 경계에 걸리면 단락의 첫 줄은 앞 면에 있다
  const findPage = (q) => {
    const { el, text } = evidence(q); if (!el) return 0;
    const r = rangeIn(el, text), rect = r && r.getClientRects()[0];
    if (!rect) return pageOf(el);
    const box = sp.getBoundingClientRect(), s = box.width / sp.clientWidth || 1;
    return Math.floor(Math.floor((rect.left - box.left + rect.width / 2) / s / COL) / COLS);
  };
  // 그 면에서 근거 문장에 밑줄·연한 인주색을 입힌다 (CSS Highlight API — DOM 을 건드리지 않아 조판이 안 흔들린다)
  function clearMark() { CSS.highlights?.delete("ev"); }
  function rangeIn(el, text) {                             // el 안에서 text(공백·따옴표 무시)에 해당하는 Range
    if (!el || !text) return null;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), map = []; let s = "";
    for (let n = walker.nextNode(); n; n = walker.nextNode()) for (let i = 0; i < n.data.length; i++) { if (/[\s"“”'‘’「」]/.test(n.data[i])) continue; s += n.data[i]; map.push([n, i]); }
    const k = norm(text), i = s.indexOf(k); if (i < 0) return null;
    const r = new Range(); r.setStart(map[i][0], map[i][1]); const e = map[i + k.length - 1]; r.setEnd(e[0], e[1] + 1);
    return r;
  }
  function markEvidence(q) {
    clearMark(); if (!("highlights" in CSS)) return;
    const { el, text } = evidence(q), r = rangeIn(el, text);
    if (r) CSS.highlights.set("ev", new Highlight(r));
  }
  // 정답 면에는 그 문장이 든 단락을 통째로 옮겨 오고(문장은 밑줄), 아래에 [그 면 보기]
  const moreHTML = (q) => q.more ? `<span class="more"><span class="src">더 알아보기</span><p>${q.more}</p></span>` : "";
  const evHTML = (q) => { const { el, text } = evidence(q); return !el && !q.more ? "" :
    `<span class="ev">${el ? `<span class="src">이야기에서</span><div class="para" data-qi="${q.n - 1}">${el.innerHTML}</div><button class="goto">그 면 보기</button>` : ""}${moreHTML(q)}</span>`; };
  // ③ 다음 문제로는 손으로 넘어간다 — 전에는 0.9초 뒤 저절로 넘어가 오른쪽 설명을 읽을 새가 없었다
  // ⚠ 단추는 **보기 바로 밑(.nx)**에 선다. 전에는 설명 끝에 붙어서, 설명이 긴 5번(근거 단락 + 더 알아보기)에서는
  //   면 밖으로 밀려 잘렸다 — 가로는 아예 닿을 수 없었고 세로는 스크롤해야 나왔다. 아이들은 다음이 있는 줄 몰랐다 (Matto 제보, 2026-09-11)
  const nextBtn = (i) => `<button class="next">${i + 1 < EP.quiz.length ? `다음 문제<b>${i + 2}/${EP.quiz.length}</b>` : "오늘의 수확"}</button>`;
  function markQuotes() {                                  // 옮겨 온 단락 안의 근거 문장에 표시 (렌더할 때마다 다시 건다)
    if (!("highlights" in CSS)) return;
    const hl = new Highlight();
    $$(".vpage .para").forEach((p) => { const r = rangeIn(p, evidence(EP.quiz[+p.dataset.qi]).text); if (r) hl.add(r); });
    CSS.highlights.set("evq", hl);
  }
  $("#pg").addEventListener("click", () => { if (Q.back !== null) go(Q.back); });
  function finish() { go(R.P + EP.quiz.length); }          // 마지막 면(수확 + 다음 이야기)으로

  /* ── 툴팁 (아침신문의 mountVocabTooltips 와 같은 방식) ── */
  function closeTip() { if (tip) { tip._for.setAttribute("aria-expanded", "false"); tip._for.removeAttribute("aria-describedby"); tip.remove(); tip = null; } }
  function showTip(anchor, html, cls = "") {
    if (!html) return;
    if (tip && tip._for === anchor) { if (performance.now() - tip._t > 250) closeTip(); return; }   // 같은 낱말 다시 탭 = 닫기 (더블탭은 무시)
    closeTip(); closePop();
    const fb = fr.getBoundingClientRect(), s = fb.width / fr.offsetWidth;
    tip = document.createElement("div"); tip.className = "tip " + cls; tip.id = "tip"; tip.setAttribute("role", "tooltip"); tip.innerHTML = html; tip._for = anchor; tip._t = performance.now();
    fr.append(tip); anchor.setAttribute("aria-expanded", "true"); anchor.setAttribute("aria-describedby", "tip");
    const r = anchor.getClientRects()[0] || anchor.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    const cx = (r.left - fb.left + r.width / 2) / s;
    const left = Math.max(12, Math.min(cx - tw / 2, fr.offsetWidth - tw - 12));
    const above = (r.top - fb.top) / s - th - 4, below = above < 56;
    tip.classList.toggle("below", below);
    tip.style.left = left + "px";
    tip.style.top = (below ? (r.bottom - fb.top) / s + 4 : above) + "px";
    tip.style.setProperty("--arrow", Math.max(14, Math.min(cx - left, tw - 14)) + "px");
    $("#live").textContent = tip.textContent;
  }
  const wordTip = (w) => w ? `<b class="tw">${w.w}</b>${w.d}` : "";
  const personTip = (n) => { const c = CARDS[n]; return c ? `<img src="${c.img}" alt=""><div><b class="tw">${n}</b>${c.d}<span class="rel">${c.rel}</span></div>` : ""; };

  /* ── 상단 바: 나가기 · 글자 크기 ── */
  $("#back").addEventListener("click", () => { save(); opts.onExit?.({ k: R.anchor, phase: Q.phase, solved: Q.solved }); });
  function applyFS() { fr.style.setProperty("--fs", SIZES[FS][1] + "px"); fr.style.setProperty("--lh", SIZES[FS][2] + "px"); }
  function closePop() { if (pop) { pop.remove(); pop = null; $("#fs").setAttribute("aria-expanded", "false"); } }
  $("#fs").addEventListener("click", () => {
    if (pop) { closePop(); return; }
    closeTip();
    pop = document.createElement("div"); pop.className = "pop";
    pop.innerHTML = `<span class="label">본문 글자 크기</span><div class="opts">${SIZES.map((s, i) => `<button data-i="${i}" aria-pressed="${i === FS}" style="font-size:${s[1]}px">${s[0]}</button>`).join("")}</div>`;
    pop.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; FS = +b.dataset.i; applyFS(); layout(); });
    fr.append(pop); $("#fs").setAttribute("aria-expanded", "true");
  });
  applyFS();
  // 화면 폭·높이가 바뀌면 그림 상한과 실제 마지막 단을 다시 잰다.
  const resize = new ResizeObserver(() => {
    const cs = getComputedStyle(sp);
    if (R.ready && (parseFloat(cs.columnWidth) !== COLW ||
        parseFloat(cs.columnGap) !== GAP || rail.clientHeight !== COLH)) layout();
  });
  resize.observe(rail);

  /* ── 토스트 · 첫 사용 힌트 ── */
  function showToast(msg, act, fn) {
    if (toast) toast.remove();
    toast = document.createElement("div"); toast.className = "toast"; toast.innerHTML = `<span>${msg}</span>${act ? `<button>${act}</button>` : ""}`;
    if (act) $("button", toast).addEventListener("click", () => { toast.remove(); toast = null; fn(); });
    fr.append(toast); const t = toast; setTimeout(() => { if (toast === t) { t.remove(); toast = null; } }, 3200);
  }
  function showHint(ms) {
    if (hintov) return;
    hintov = document.createElement("div"); hintov.className = "hintov";
    hintov.innerHTML = `<div><span>‹</span>왼쪽은 이전 면이에요</div><div><span>›</span>오른쪽을 탭하면 다음 면으로 넘어가요</div>`;
    fr.append(hintov); setTimeout(hideHint, ms);
  }
  function hideHint() { if (!hintov) return; const h = hintov; hintov = null; h.classList.add("out"); setTimeout(() => h.remove(), 160); S.hinted = true; save(); }


  // 첫 그리기는 웹폰트 뒤로 미룬다 (대체 서체로 그렸다 바꾸면 면 경계가 옮겨지고 도판 자리 탐색이 두 번 돈다). 2초 안에 안 오면 그냥 그린다
  root.style.visibility = "hidden";
  // 끼움 그림도 2초까지만 기다린다. 크기는 aspect-ratio·width/height 로 이미 정해져 있어 늦게 와도 면이 안 바뀐다.
  // 한 장이 안 받아지면 decode() 가 실패하는데, 그걸 그대로 두면 책이 끝내 안 보였다 (2026-10-17 검수)
  const spotReady = Promise.race([Promise.all($$("figure.spot img", sp).map(img => img.decode().catch(() => {}))),
    new Promise((r) => setTimeout(r, 2000))]);
  Promise.all([Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2000))]), spotReady]).then(() => {
    if (destroyed) return;
    EP.quiz.forEach((_, i) => renderQ(i)); markQuotes();
    layout(); root.style.visibility = "";
    document.fonts.ready.then(() => { if (R.ready) layout(); });
    if (!S.hinted) setTimeout(() => { if (!destroyed && R.page === 0) showHint(4000); }, 600);
  });
  return { destroy() {
    destroyed = true;
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("click", onDocumentClick);
    resize.disconnect();
    closeTip(); closePop(); hideHint();
    root.innerHTML = ""; root.classList.remove("reader"); root.style.visibility = "";
  } };
};
