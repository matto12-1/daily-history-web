// DOM 없는 순수 로직. 홈·역사책·리더가 전부 이 함수들만 믿는다. (테스트: tools/app-core.test.mjs)
// 클래식 스크립트다(모듈 아님) — 아티팩트 빌더가 <script src>를 그대로 인라인해야 하므로.
(function () {
const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const addDays = (isoStr, n) => iso(new Date(isoStr + "T00:00:00Z").getTime() + n * DAY);

// 해금은 주중(월~금)만 쌓인다. 방학·휴일은 holidays로 뺀다.
// **첫날은 FIRST_DAY 편, 그 뒤로는 평일마다 PER_DAY 편.** 첫날에 1~4편이 열리고 이튿날 5~6편이 열린다.
// ~~180편 ≈ 60 수업일~~ → 하루 두 편, 180편 ≈ 89 수업일 (Matto, 2026-09-09):
//   세 편은 아이가 하루에 읽기엔 너무 많고, 한 학기가 끝나기 전에 시리즈가 동나 버린다.
const PER_DAY = 2, FIRST_DAY = 4;
function unlockedMax(startISO, todayISO, holidays = []) {
  if (todayISO < startISO) return 0;
  let n = 0;
  for (let d = startISO; d <= todayISO; d = addDays(d, 1)) {
    const wd = new Date(d + "T00:00:00Z").getUTCDay();
    if (wd === 0 || wd === 6 || holidays.includes(d)) continue;
    n++;
  }
  return n === 0 ? 0 : FIRST_DAY + PER_DAY * (n - 1);
}

// **오늘 열린 편의 첫 번호.** 어제 열린 편에까지 「오늘」을 찍으면 도장이 거짓말을 한다
// (Matto 제보, 2026-09-09). 어제까지의 해금선 + 1 이다 — 주말·휴일이면 오늘 새로 열린 것이
// 없으므로 unlocked + 1 이 되어 아무 편도 「오늘」이 아니게 된다. 그게 맞다.
function todayFirst(startISO, todayISO, holidays = []) {
  return unlockedMax(startISO, addDays(todayISO, -1), holidays) + 1;
}

function nextToRead(cleared) {
  const set = new Set(cleared);
  let n = 1;
  while (set.has(n)) n++;
  return n;
}

// next = 홈이 고른 큰 카드 자리(focusIn). 없으면 1편부터의 첫 빈틈
// reading = 편마다 읽던 자리 { [편]: { k, phase, solved, pct } }
function episodeStatus(no, { unlocked, cleared, reading, next }) {
  if (cleared.includes(no)) return "cleared";
  if (no > unlocked) return "locked";
  const r = reading?.[no];
  if (r && r.phase !== "clear") return r.phase === "exam" ? "quiz" : "reading";
  return no === (next ?? nextToRead(cleared)) ? "today" : "late";
}

// 밀린 편 = 순번 첫 편(오늘 자리) 뒤로 남아 있는 해금된 미클리어
function lateList({ unlocked, cleared, next }) {
  const out = [];
  for (let n = (next ?? nextToRead(cleared)) + 1; n <= unlocked; n++) if (!cleared.includes(n)) out.push(n);
  return out;
}

// 홈 큰 카드가 설 편 — **장 안에서** 고른다. nos = 그 장의 편 번호들(오름차순).
// 앞 장을 다 읽어야 다음 장이 열리지 않는다 (Matto, 2026-09-11): 이 사이트를 늦게 찾은 교사의 반은
// 오늘 진도에서 시작한다. 1편부터의 빈틈(nextToRead)을 보면 그 반은 영영 1편에 묶인다. 그래서
//   ① 이 장에서 마지막으로 깬 편 뒤 ② 없으면 — 앞 장에서 이어 온 아이는 장 첫 편, 처음 온 아이는 오늘 열린 편
//   ③ 그 뒤가 다 찼으면 이 장에서 처음 깬 편 뒤로 남은 빈틈 (합류 전 편은 끌어오지 않는다)
// 열린 것을 다 읽었으면 null.
function focusIn(nos, { unlocked, fresh, cleared }) {
  const open = (n) => n <= unlocked && !cleared.includes(n);
  const done = nos.filter((n) => cleared.includes(n));
  const start = Math.min(fresh, unlocked);
  const base = done.length ? Math.max(...done)
    : cleared.some((n) => n < nos[0]) || start > nos.at(-1) ? nos[0] - 1
    : Math.max(nos[0], start) - 1;
  return nos.find((n) => n > base && open(n))
    ?? (done.length ? nos.find((n) => n > done[0] && open(n)) : undefined)
    ?? null;
}

// 홈이 여는 편 = 마지막으로 깬 편 뒤의 첫 열린 미클리어. **장을 건너 밀려도 거기로** (Matto, 2026-09-17 — DECISIONS 202).
// 30편에서 멈췄다가 3장이 열린 날에 돌아오면 51편이 아니라 31편이다. 읽은 기록이 없으면 null — 오늘 열린 장이 정한다(177)
function resumeAt({ unlocked, cleared }) {
  if (!cleared.length) return null;
  for (let n = Math.max(...cleared) + 1; n <= unlocked; n++) if (!cleared.includes(n)) return n;
  return null;
}

// 연속 기록 = 오늘(아직 안 읽었으면 어제)부터 거꾸로 이어진 날 수. 하루에 몇 편을 읽어도 1회.
function streak(readDays, todayISO) {
  const days = new Set(readDays);
  let d = days.has(todayISO) ? todayISO : addDays(todayISO, -1), n = 0;
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

// 오늘 카드의 버튼·보조 문구 (UX §7 표 그대로)
function ctaFor(status, ctx = {}) {
  switch (status) {
    case "reading": return { label: "이어 읽기", sub: ctx.sub || "읽던 곳부터", link: "처음부터 읽기" };
    case "quiz": return { label: "문제 풀러 가기", sub: "다 읽었어요 · 다섯 문제가 기다려요", link: "본문 다시 읽기" };
    // 완료는 도장과 "다섯 문제 모두 통과"가 말한다 — 버튼은 살아 있는 길이어야 한다(DECISIONS 47)
    case "cleared": return { label: "다시 읽기", sub: "다섯 문제 모두 통과", link: null };
    case "holiday": return {
      label: "내 역사책 구경하기",
      sub: `지금은 ${ctx.name}, 강물도 쉬어 가요. ${ctx.opens}에 새 이야기가 열려요`,
      link: ctx.late ? `기다리는 이야기 ${ctx.late}편, 이어서 읽어요` : null,
    };
    // 잠긴 편(내일 열림)에도 살아 있는 길을 준다 — 죽은 버튼을 두지 않는다(DECISIONS 47)
    case "locked": return {
      label: "내 역사책 구경하기",
      sub: "",                                        // "내일 아침에 열려요"는 카드의 wait 줄이 말한다 — 두 번 쓰지 않는다
      link: ctx.late ? `기다리는 이야기 ${ctx.late}편, 이어서 읽어요` : null,
    };
    case "weekend": return {
      label: "내 역사책 구경하기",
      sub: "이번 주 이야기를 다 읽었어요",
      link: ctx.late ? `기다리는 이야기 ${ctx.late}편, 이어서 읽어요` : null,
    };
    default: return { label: "읽으러 가기", sub: ctx.sub || "", link: null };
  }
}

// 강의 돌 좌표. 가운데가 살짝 위로 부푼 완만한 곡선.
function riverLayout(count, { x0 = 120, dx = 180, y = 470, amp = 40 } = {}) {
  return Array.from({ length: count }, (_, i) => ({
    no: i + 1,
    x: x0 + i * dx,
    y: Math.round(y - Math.sin(count > 1 ? (i / (count - 1)) * Math.PI : 0) * amp),
  }));
}

// 정박: 오늘 카드 왼쪽이 뷰포트 40% 지점에 오도록
function anchorScrollLeft(todayX, viewportW) {
  return Math.max(0, Math.round(todayX - viewportW * 0.4));
}

// 밤하늘: 장마다 별자리 하나가 군집으로 떠 있다. 군집은 왼쪽(옛날)에서 오른쪽(오늘)으로 가되 위아래로 엇갈린다.
// 별은 군집 안에 황금각으로 흩뿌리고, 가까우면 서로 밀어낸다 — 같은 입력이면 언제나 같은 자리(하늘은 매번 움직이면 안 된다).
const GOLDEN = 137.5 * Math.PI / 180, MIN_GAP = 56;
function skyLayout(chapters, people, width = 1180, height = 640) {
  const N = chapters.length, GAP = 64, EDGE = 24;
  const clusters = chapters.map((c) => {
    const mine = people.filter((p) => p.chapter === c.n).length;
    // ⚠ 전에는 `16 * Math.min(8, mine)` — **여덟 명에서 군집이 자라기를 멈췄다.**
    //   1장은 카드가 셋뿐이라 티가 안 났는데, 2장 열여섯 장을 넣자 이름표가 겹쳐 못 읽게 됐다.
    //   2장은 끝까지 53장이고 4·5장은 그보다 크다 — 넓이가 사람 수를 따르게 sqrt 로 준다
    //   (여덟 명 자리에서 옛 값과 같다: 70 + 46*√8 ≈ 200 = 70 + 16*8).
    return { n: c.n, r: 70 + 46 * Math.sqrt(mine), read: !!c.read, people: mine, cx: 0, cy: 0 };
  });
  // 왼쪽(옛날)에서 오른쪽(오늘)으로, 군집끼리 겹치지 않게 반지름만큼 자리를 준다
  let x = EDGE;
  for (const cl of clusters) { cl.cx = x + cl.r; x += cl.r * 2 + GAP; }
  const needed = x - GAP + EDGE;
  const W = Math.max(width, needed);
  if (W > needed && N > 1) { const extra = (W - needed) / (N - 1); clusters.forEach((cl, i) => { cl.cx += extra * i; }); }
  // 세로는 장 이름 해시로 불규칙하게 — 한 줄로 늘어서면 하늘이 아니라 띠가 된다
  for (const cl of clusters) {
    const h = (hashName("chapter" + cl.n) * 2654435761) >>> 0;   // 곱셈 섞기 — 장 번호가 순서대로면 해시도 순서대로라 한 줄이 된다
    const lo = cl.r + 30, hi = height - cl.r - 64;
    cl.cy = Math.max(lo, Math.min(hi, height * 0.5 + (((h % 181) - 90) / 90) * (height * 0.22)));
  }

  const stars = [];
  for (const cl of clusters) {
    const mine = people.filter((p) => p.chapter === cl.n).sort((a, b) => a.ep - b.ep || a.hash - b.hash);
    mine.forEach((p, i) => {
      const a = p.hash * GOLDEN;                        // 황금각 — 이름마다 다른 방향
      const d = cl.r * Math.sqrt((i + 0.5) / mine.length);  // 원반에 고르게
      stars.push({ id: p.id, x: cl.cx + Math.cos(a) * d, y: cl.cy + Math.sin(a) * d, c: cl });
    });
  }
  // 겹침 완화 — 가까운 별끼리 밀어내고, 군집 밖으로 나가면 중심 쪽으로 당긴다
  for (let k = 0; k < 6; k++) {
    for (let i = 0; i < stars.length; i++) for (let j = i + 1; j < stars.length; j++) {
      const a = stars[i], b = stars[j], dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.01;
      if (d >= MIN_GAP) continue;
      const push = (MIN_GAP - d) / 2, ux = dx / d, uy = dy / d;
      a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push;
    }
    for (const s of stars) {
      const dx = s.x - s.c.cx, dy = s.y - s.c.cy, d = Math.hypot(dx, dy);
      if (d > s.c.r) { s.x = s.c.cx + (dx / d) * s.c.r; s.y = s.c.cy + (dy / d) * s.c.r; }
    }
  }
  return { width: W, clusters, stars: stars.map(({ id, x, y }) => ({ id, x, y })) };
}

// v = 저장 판번호. 칸이 늘어나면 올린다(옛 저장은 loadProgress 가 기본값으로 채운다)
// v2 (DECISIONS 51): answers = 편마다 { first: 첫 시도에 맞힌 문항 번호[], recall: { 문항: 맞혔나 } },
//                    recallDay = 되새김 문제에 마지막으로 답한 날(하루 한 터)
// reading (2026-09-11): 전에는 한 칸({ no, k, phase, … })이라 다른 편을 열면 앞 편의 읽던 자리가 지워졌다.
//   이제 편마다 { [편]: { k, phase, solved, pct } }. 옛 한 칸은 loadProgress 가 편 번호 칸으로 옮긴다
const DEFAULT_PROGRESS = Object.freeze({
  v: 2, cleared: [], reading: {}, readDays: [], fs: 0, name: "", clearedAt: {},
  answers: {}, recallDay: "",
  hinted: {}, seen: { cards: [], sky: false, map: false },
});

const spots = (r) => (!r || typeof r !== "object" ? {} : "no" in r ? (({ no, ...s }) => ({ [no]: s }))(r) : r);

function loadProgress(storage) {
  const base = structuredClone(DEFAULT_PROGRESS);
  try {
    const p = JSON.parse(storage.getItem("dh.progress") || "null");
    if (!p || !Array.isArray(p.cleared)) return base;
    return { ...base, ...p, v: 2, reading: spots(p.reading), hinted: { ...base.hinted, ...(p.hinted || {}) },
      seen: { ...base.seen, ...(p.seen || {}) }, clearedAt: { ...base.clearedAt, ...(p.clearedAt || {}) },
      answers: { ...(p.answers || {}) }, recallDay: p.recallDay || "" };
  } catch {
    return base;
  }
}

/* ── 내 마을 (DECISIONS 51) — 마을은 저장하지 않는다. 진행에서 계산한다 ── */
const RANKS = ["수습 사관", "사관", "태사"];
const rankOf = (life) => (life >= 40 ? 2 : life >= 10 ? 1 : 0);

// 되새김은 편을 깬 날로부터 **이틀 뒤**에 열린다(간격 반복).
// ⚠ 이 2를 두 군데 적으면 한쪽만 고쳐 어긋난다 — 여는 쪽(nextRecall)과 「언제 열리는지」를
//   화면에 알리는 쪽(firstRecall)이 같은 값을 봐야 한다
const RECALL_GAP = 2;

// 되새김 대기줄 — 아직 안 푼 문제가 남은 클리어 편을, 깬 날(=열리는 날) 순으로.
function recallQueue(p, quizEps, nq = 5) {
  return p.cleared
    .filter((no) => quizEps.includes(no) && p.clearedAt[no])
    .map((no) => {
      const done = p.answers[no]?.recall || {};
      const qi = Array.from({ length: nq }, (_, i) => i).find((i) => !(i in done));
      return qi === undefined ? null : { no, qi, at: p.clearedAt[no], opens: addDays(p.clearedAt[no], RECALL_GAP) };
    })
    .filter(Boolean)
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.no - b.no));
}

// 하루 한 터. 오늘 이미 답했으면 없다. 이틀 이상 지난 클리어 편 가운데
// 안 푼 문제가 남은 가장 오래된 편의, 가장 앞 문제 하나. (되새김은 한 번뿐 — 맞히든 틀리든 소진)
function nextRecall(p, todayISO, quizEps, nq = 5) {
  if (p.recallDay === todayISO) return null;
  const cand = recallQueue(p, quizEps, nq).find((c) => c.opens <= todayISO);
  return cand ? { no: cand.no, qi: cand.qi } : null;
}

// 가장 먼저 열리는 되새김. 마을에 **사람이 0명일 때 「언제 오는지」**를 화면이 말하려면 이게 필요하다 —
// 집은 섰는데 사람만 없는 화면은 아이에게 「내가 뭘 잘못했나」로 읽힌다.
function firstRecall(p, quizEps, nq = 5) {
  return recallQueue(p, quizEps, nq)[0] || null;
}

// 마을의 지금. 문제를 맞힌 것이 건물(builds)이고, 되새김이 사람(life)이다.
function villageState(p, season, todayISO, quizEps = []) {
  const episodes = season.chapters.flatMap((c) => c.episodes);
  const epOf = (no) => episodes.find((e) => e.no === no);
  const eraOf = (no) => season.eras.find((e) => no >= e.eps[0] && no <= e.eps[1])?.n || 1;
  const range = (e) => Array.from({ length: e.eps[1] - e.eps[0] + 1 }, (_, i) => e.eps[0] + i);
  const recallOK = (no) => Object.values(p.answers[no]?.recall || {}).filter(Boolean).length;
  return {
    // 시대 = **읽은 편 수** — 「N편 읽었으면 1편부터 차례로 읽었을 때 닿았을 시대」 (Matto, 2026-09-11, DECISIONS 185).
    //   마을은 **성실하게 읽은 보상**이다. 어디서 시작했느냐가 아니라 몇 편을 읽었느냐로 자란다 —
    //   늦게 합류한 반도 막집 터에서 시작해 제 손으로 키우고, 앞을 건너뛰고 한 편만 깨도 한 편만큼이다.
    //   ⚠ 거쳐 온 규칙: `Math.max(...cleared.map(eraOf))`(마지막 한 편만 깨도 뛰었다, 09-09 제보)
    //     → 1편부터 빈틈없이 온 데까지(늦게 온 반은 영영 막집 터) → 처음 읽은 편부터(앞으로 건너뛴 아이가 뛰었다, 배포 안 함)
    era: eraOf(Math.max(1, p.cleared.length)),
    // 다음 시대까지 남은 편 — 마을 머리에 띄운다. 마지막 시대면 null
    next: (() => { const e = season.eras.find((x) => x.n === eraOf(Math.max(1, p.cleared.length)) + 1);
      return e ? { n: e.n, name: e.name, left: e.eps[0] - p.cleared.length } : null; })(),
    builds: Object.values(p.answers).reduce((n, a) => n + (a.first || []).length, 0),
    life: Object.keys(p.answers).reduce((n, no) => n + recallOK(no), 0),
    marks: [...p.cleared].sort((a, b) => a - b).filter((no) => epOf(no)?.mark).map((no) => ({ no, kind: epOf(no).mark })),
    stamps: season.eras.filter((e) => range(e).every((no) => p.cleared.includes(no))).map((e) => e.n),
    steles: season.eras.filter((e) => range(e).every((no) => recallOK(no) >= 3)).map((e) => e.n),
    rank: rankOf(Object.keys(p.answers).reduce((n, no) => n + recallOK(no), 0)),
    lot: nextRecall(p, todayISO, quizEps),
  };
}

// 이어보기 코드 = 마지막 클리어 회차 + 글자 크기 (순차 강제 덕분에 이만큼이면 된다, UX §9).
// 헷갈리는 글자(0/O·1/I)는 뺐다. 만드는 쪽과 읽는 쪽이 한 파일에 있어야 어긋나지 않는다.
const CODE_A = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function resumeCode(p) {
  const n = (nextToRead(p.cleared) - 1) * 8 + (p.fs || 0);
  let out = "";
  for (let v = n, i = 0; i < 3; i++, v = Math.floor(v / 32)) out = CODE_A[v % 32] + out;
  const sum = [...out].reduce((a, c) => a + CODE_A.indexOf(c), 0) % 32;
  return "HANSA-" + out + CODE_A[sum];
}
function decodeCode(str) {
  const s = String(str).toUpperCase().replace(/\s/g, "");
  if (!/^HANSA-.{4}$/.test(s)) return null;
  const idx = [...s.slice(6)].map((c) => CODE_A.indexOf(c));
  if (idx.some((i) => i < 0)) return null;
  const [a, b, c, chk] = idx;
  if ((a + b + c) % 32 !== chk) return null;                 // 손으로 옮겨 적다 한 글자 틀리면 여기서 걸린다
  const n = (a * 32 + b) * 32 + c, lastCleared = n >> 3, fs = n & 7;
  return lastCleared > 180 || fs > 2 ? null : { lastCleared, fs };
}

// 읽기 달력: 월요일로 시작하는 7열 격자. 그 달이 아닌 칸은 null, 빈 줄은 두지 않는다.
function monthGrid(isoStr) {
  const [y, m] = isoStr.split("-").map(Number);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) => {
    const d = i - lead + 1;
    return d >= 1 && d <= days ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;
  });
  return { title: `${m}월`, cells };
}

// 두 기록을 합친다 — 옛 주소(daily-history-ebon.vercel.app)의 기록을 새 주소로 옮길 때 (2026-09-11).
// 브라우저는 저장소를 주소마다 따로 두어서, 주소를 바꾸면 기록이 옛 주소 칸에 남는다.
// cur = 이 주소의 기록, inc = 옮겨 온 기록(둘 다 loadProgress 를 거친 모양).
// ⚠ 같은 기록을 두 번 합쳐도 결과가 같아야 한다 — 옛 주소로 다시 들어올 때마다 또 넘어온다.
//   그래서 모으는 칸(깬 편·읽은 날·맞힌 문항)은 합집합이고, 하나뿐인 칸(글자 크기·읽던 자리)은 이 주소 것이 이긴다.
function mergeProgress(cur, inc) {
  const empty = (p) => !p.cleared.length && !p.readDays.length && !Object.keys(p.answers).length;
  if (empty(cur)) return structuredClone(inc);
  if (empty(inc)) return structuredClone(cur);
  const union = (a, b) => [...new Set([...a, ...b])].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
  const clearedAt = { ...inc.clearedAt };
  for (const [no, d] of Object.entries(cur.clearedAt)) if (!clearedAt[no] || d < clearedAt[no]) clearedAt[no] = d;
  const answers = {};
  for (const no of new Set([...Object.keys(inc.answers), ...Object.keys(cur.answers)])) {
    const a = inc.answers[no] || {}, b = cur.answers[no] || {};
    answers[no] = { ...a, ...b, first: union(a.first || [], b.first || []), recall: { ...(a.recall || {}), ...(b.recall || {}) } };
  }
  return {
    ...inc, ...cur,
    cleared: union(inc.cleared, cur.cleared), readDays: union(inc.readDays, cur.readDays), clearedAt, answers,
    recallDay: cur.recallDay > inc.recallDay ? cur.recallDay : inc.recallDay,
    hinted: { ...inc.hinted, ...cur.hinted },
    seen: { ...inc.seen, ...cur.seen, cards: union(inc.seen.cards || [], cur.seen.cards || []),
      sky: !!(inc.seen.sky || cur.seen.sky), map: !!(inc.seen.map || cur.seen.map) },
    reading: { ...inc.reading, ...cur.reading }, name: cur.name || inc.name, fs: cur.fs || inc.fs,
  };
}

function saveProgress(storage, p) {
  try { storage.setItem("dh.progress", JSON.stringify(p)); } catch { /* 사파리 비공개 모드 등 */ }
}

const hashName = (s) => [...String(s)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);

/* ── 살아있는 지도의 나라 색 (2026-09-23) ──
   Matto: 「고구려·백제·신라·가야가 다 같은 색이라 구분이 안 된다」. 전에는 역사책 지도가 --ch1 한 색,
   수확 면이 --frame 한 색으로 모든 나라를 칠했다.
   **색은 나라를, 선은 오늘/누적을 말한다** — 수확 면의 진한 실선·연한 점선(DECISIONS 187)은 그대로다.
   역사책 지도와 수확 면이 이 표 한 벌만 본다. 전통 안료 계열이라 시대색(--ch1..8)과 한 벌로 읽힌다.
   같은 때 지도에 서는 나라끼리(최대 넷) 칠한 농도에서 ΔE 8.5 이상, 맞닿은 나라는 적록색약에서도 갈린다.
   ⚠ 대한민국·북한은 파랑·빨강을 쓰지 않는다 — 정치적으로 예민한 두 색이다 (Matto). 테스트가 막는다. */
const NATION_COLORS = {
  고조선: "#8E5B3A",        // 석간주
  고구려: "#B0473A",        // 주홍
  백제: "#B8892F",          // 황토
  신라: "#3A5F99",          // 쪽 — 서라벌도 이 색(같은 나라가 이름만 바뀐다)
  가야: "#3F7E5A",          // 녹청
  "당의 관청": "#7A6F62",   // 먹회 — 나라가 아니라 관청이다
  발해: "#8C3F5A",          // 연지 — 고구려를 이은 붉은 계열
  고려: "#4A968B",          // 청자
  조선: "#2E4D72",          // 남
  "대한 제국": "#B2852A",   // 치자 — 황제의 노랑
  대한민국: "#6F8544",      // 쑥
  북한: "#806090",          // 보라
};
const NATION_ALIAS = { 서라벌: "신라", 후백제: "백제" };
// 색표에 없는 나라는 null — 그리는 쪽이 옛 한 색으로 내려앉는다(지도가 죽지는 않는다). 테스트가 빠진 나라를 잡는다
const nationColor = (name) => NATION_COLORS[NATION_ALIAS[name] || name] || null;

window.CORE = {
  PER_DAY, FIRST_DAY, unlockedMax, todayFirst, nextToRead, episodeStatus, lateList, focusIn, resumeAt, streak, ctaFor,
  riverLayout, anchorScrollLeft, skyLayout, loadProgress, saveProgress, mergeProgress,
  DEFAULT_PROGRESS, hashName, resumeCode, decodeCode, monthGrid,
  RANKS, rankOf, nextRecall, firstRecall, RECALL_GAP, villageState, nationColor,
};
})();
