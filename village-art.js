// 내 마을 — 그림. village.js(엔진·기하) 뒤에 실려 VILLAGE.ART 의 조각을 채운다.
// 엔진과 그림을 나눈 이유: 자리·카메라·길은 한 벌의 기하이고, 집·나무·사람은 서로 독립된 그림이라
// 각각 따로 손볼 수 있어야 하기 때문이다. 아티팩트 빌더가 <script src> 를 그대로 인라인한다.
//
// 규칙 (village.js 의 ART 주석과 같다)
//   · 배열·객체는 칸을 바꾼다: A.HOUSE[2] = … · A.MARK.dolmen = …
//   · A.tree / A.person / A.animal / A.fire / A.scenery 는 마을이 ART. 를 거쳐 부르므로 통째로 바꾼다
//   · 좌표 원점은 그 칸의 바닥 앞 꼭짓점, -y 가 위. 한 칸 = 가로 46 · 세로 23
//   · 먹은 세 단뿐이다: ink(농묵) · mid(중묵) · thin(담묵). 면은 fillp/side/dark, 지붕은 roof/roofd
//   · opacity 로 흐리게 만들지 않는다 — 농도는 클래스로 정한다

/* ══ 집 · 지붕 · 마을회관 ══════════════════════════════════════════════ */
// _bench/roofs.js — 집 · 지붕 · 마을 한가운데 (HOUSE · HALL) 다시 그리기
// village.js 뒤에 실려 VILLAGE.ART 의 칸만 갈아 끼운다. village.js · village.css 는 건드리지 않는다.
//
// 무엇을 고쳤나
//  ① 초가에 능선이 없었다 — 꼭짓점에서 내려오는 삼각형 둘뿐이라 텐트였다.
//     우진각으로 바꿔 용마루를 칸의 c 축(화면 오른쪽아래)으로 눕혔다. 뿔이 아니라 등성이다.
//     이엉이 배부르고(처마가 Q 로 부푼다), 처마 밑에 그늘 한 줄(mid), 결은 담묵 셋.
//  ② 기와가 기와로 안 보였다 — 골이 담묵이라 46px 에서 사라졌다. 골을 중묵 넷으로,
//     용마루는 두께 있는 띠로. 처마 끝 치미는 살렸다.
//  ③ 벽이 넷 다 같은 box 였다 — 막집(벽 없음) · 움집(낮은 흙벽에 결 한 줄과 문)
//     · 초가(기둥 둘) · 기와(기단 · 판벽 · 문 한 짝).
//  ④ 마을회관이 그냥 큰 집이었다 — 크기 말고 '울 안'으로 세운다.
//     마당 · 담(또는 말뚝 울) · 문 · 솟대. 폭은 2.1칸(97px) 그대로 두고
//     안의 집은 1.4~1.6칸이라 이웃(0.74~1)보다 크되 궁궐이 되지 않는다.
(function () {
  const A = window.VILLAGE.ART;
  const { P, dia, box, cone, smokeCol, TW, TH } = A;

  const r = (v) => Math.round(v * 10) / 10;
  const pt = (p) => `${r(p[0])},${r(p[1])}`;
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const G = (dy, s) => `<g transform="translate(0,${r(dy)})">${s}</g>`;
  const shad = (w, dy = 0) => P(dia(0, 2 + dy, w * 1.04), "shadow");
  // 칸 한가운데를 지면 cy 에 두고 바닥을 fl 만큼 띄운 상자의 원점
  const seat = (cy, fl, w) => cy + TH * w / 2 - fl;

  /* ── 지붕의 뼈대 ─────────────────────────────────────────────────────
     우진각. 처마 세 모서리(L 왼 · F 앞 · R 오른)와 용마루 두 끝(a 뒤 · b 앞).
     k 를 .5 로 하면 용마루가 한 점으로 오므라들어 옛 모임지붕(뿔)이 된다 — 그게 문제였다.
     보이는 면은 둘뿐이다: 왼앞으로 앉는 긴 비탈(roof)과 오른앞의 짧은 추녀(roofd).
     rise 는 칸 배수에 따라 커진다 — 안 그러면 넓은 집(마을회관)에서 용마루 앞끝이
     옆 처마보다 낮게 앉아 지붕이 날개처럼 뻗는다. 화면에서 용마루가 처마보다 확실히 위여야 한다. */
  function bones(H, rise, w, ov, k) {
    const hw = TW * w * ov / 2, hh = TH * w * ov / 2, rz = rise * w;
    return { hw, hh,
      L: [-hw, -hh - H], F: [0, -H], R: [hw, -hh - H],
      a: [hw * (k - .5), -H - hh * (1.5 - k) - rz],
      b: [hw * (.5 - k), -H - hh * (.5 + k) - rz] };
  }

  /* 초가 — 이엉이 둥글게 부풀고 용마루가 눕는다.
     ⚠ 전에는 「작은 기와집」으로 읽혔다 (Matto, 09-05). 범인은 둘이었다:
       ① 처마까지 곧게 그은 결 셋 = 기와 골  ② 각진 마름모 용마루 = 기와 용마루.
     초가와 기와를 46px 에서 가르는 것은 딱 하나, **삐죽한 처마 끝**이다.
     그래서 결은 용마루 아래에서 흘러내리다 말고, 처마 끝은 잘게 물결친다.
     ⚠ 그래도 기와와 실루엣이 닮았다 (Matto, 09-04). 처마만 물결쳤을 뿐
     능선 셋(추녀 둘 · 용마루)이 자로 그은 직선이라 각진 지붕이었다.
     이엉은 짚을 켜켜이 쌓아 얹은 것이라 밖으로 부푼다 — 바깥 능선 셋을 활로 휜다.
     안쪽 접힘선(F–b)은 두 면이 나눠 쓰므로 직선으로 둔다. 휘면 면끼리 어긋난다. */
  function thatch(H, rise, w) {
    const B = bones(H, rise, w, 1.40, .17), { hw, L, F, R, a, b } = B;   // 처마를 더 깊이 내민다
    const cL = [-hw / 2, (L[1] + F[1]) / 2 + 4.8];        // 처마가 배부르다 — 이엉은 두껍다
    const cR = [hw / 2, (R[1] + F[1]) / 2 + 4.8];
    const qp = (p0, c, p1, t) => lerp(lerp(p0, c, t), lerp(c, p1, t), t);   // 이차 곡선 위의 점 (t 를 벗어나면 연장선)
    // p→q 를 그 선의 바깥쪽(o 의 반대편)으로 amt 만큼 부풀리는 조종점
    const bow = (p, q, o, amt) => {
      const c = lerp(p, q, .5), dx = c[0] - o[0], dy = c[1] - o[1];
      const d = Math.hypot(dx, dy) || 1;
      return [c[0] + dx / d * amt * 2, c[1] + dy / d * amt * 2];   // 이차 곡선은 조종점의 절반만 간다
    };
    const o1 = [(L[0] + F[0] + b[0] + a[0]) / 4, (L[1] + F[1] + b[1] + a[1]) / 4];   // 긴 비탈의 한가운데
    const o2 = [(F[0] + R[0] + b[0]) / 3, (F[1] + R[1] + b[1]) / 3];                 // 짧은 추녀의 한가운데
    const kBA = bow(b, a, o1, 2.2), kAL = bow(a, L, o1, 2.2), kRB = bow(R, b, o2, 1.9);
    // 처마 끝 — 이엉을 잘라 놓은 자리라 들쭉날쭉하다
    const hem = (p0, c, p1) => {
      let d = `M${pt(p0)}`;
      for (let i = 1; i <= 7; i++) { const u = qp(p0, c, p1, i / 7); d += ` L${pt([u[0], u[1] + (i % 2 ? 1.7 : -.3)])}`; }
      return d + " ";
    };
    let grain = "";                                       // 이엉 결 — 용마루 쪽에서만, 짧게
    for (const t of [.2, .38, .56, .74]) {
      const s = qp(b, kBA, a, 1 - t), e = qp(L, cL, F, t);   // 결도 휜 용마루에서 내려온다
      grain += `M${pt(lerp(s, e, .16))} L${pt(lerp(s, e, .54))} `;
    }
    // 마루띠는 휜 용마루 **위에** 얹힌다. 곧은 a–b 에 얹으면 등성이가 솟은 만큼 떠서 따로 논다
    const rm = qp(b, kBA, a, .5), a2 = qp(b, kBA, a, 1.1), b2 = qp(b, kBA, a, -.1);
    const rope = (t) => { const p = qp(b, kBA, a, t); return `M${pt([p[0], p[1] - 2.2])} L${pt([p[0], p[1] + 1.4])} `; };
    return P(`M${pt(L)} Q${pt(cL)} ${pt(F)} L${pt(b)} Q${pt(kBA)} ${pt(a)} Q${pt(kAL)} ${pt(L)} Z`, "roof")
         + P(`M${pt(F)} Q${pt(cR)} ${pt(R)} Q${pt(kRB)} ${pt(b)} Z`, "roofd")
         + P(grain.trim(), "thin")
         + P((hem(L, cL, F) + hem(F, cR, R)).trim(), "mid")
         // 용마루 — 새끼줄로 눌러 놓은 둥근 등성이. 각진 마름모가 아니다
         + P(`M${pt(a2)} Q${pt([rm[0], rm[1] - 3.4])} ${pt(b2)} Q${pt([rm[0], rm[1] + 2.3])} ${pt(a2)} Z`, "fillp")
         + P((rope(.32) + rope(.64)).trim(), "thin");
  }

  // 기와 — 골은 중묵 넷, 용마루는 두께 있는 띠, 처마 끝은 들린다(치미)
  function tiled(H, rise, w) {
    const B = bones(H, rise, w, 1.34, .12), { hw, a, b } = B;
    // 치미는 따로 그은 수염이 아니라 지붕 면이 그대로 솟는 것이다 — 모서리째 들어올린다
    const L = [B.L[0] - 3, B.L[1] - 5.5], R = [B.R[0] + 3, B.R[1] - 5.5], F = [0, B.F[1] - .5];
    const cL = [(L[0] + F[0]) / 2, (L[1] + F[1]) / 2 + 4.6];   // 처마 가운데는 처진다
    const cR = [(R[0] + F[0]) / 2, (R[1] + F[1]) / 2 + 4.6];
    const a2 = lerp(a, b, -.1), b2 = lerp(a, b, 1.1);
    let flute = "";
    for (const t of [.18, .39, .61, .82]) {
      const s = lerp(a, b, t), e = lerp(L, F, t);
      flute += `M${pt(lerp(s, e, .12))} L${pt(lerp(s, e, .95))} `;
    }
    return P(`M${pt(L)} Q${pt(cL)} ${pt(F)} L${pt(b)} L${pt(a)} Z`, "roof")
         + P(`M${pt(F)} Q${pt(cR)} ${pt(R)} L${pt(b)} Z`, "roofd")
         + P(flute.trim(), "mid")
         + P(`M${pt([a2[0], a2[1] - 1.9])} L${pt([b2[0], b2[1] - 1.9])} L${pt([b2[0], b2[1] + 1.9])} L${pt([a2[0], a2[1] + 1.9])} Z`, "roofd");
  }

  /* ── 벽 ─────────────────────────────────────────────────────────────
     왼쪽 면이 집의 앞이다(긴 비탈이 그쪽으로 앉으므로). fp 는 그 밑변 위의 점,
     sp 는 오른쪽 면 밑변 위의 점. */
  const fp = (t, w) => [-TW * w / 2 * (1 - t), -TH * w / 2 * (1 - t)];
  const sp = (s, w) => [TW * w / 2 * s, -TH * w / 2 * s];
  const earthLine = (h, w) => P(`M${pt([-TW * w / 2, -TH * w / 2 - h])} L0,${r(-h)} L${pt([TW * w / 2, -TH * w / 2 - h])}`, "thin");
  const posts = (H, w) => P([.3, .72].map((t) => { const p = fp(t, w); return `M${pt(p)} L${pt([p[0], p[1] - H])}`; }).join(" "), "ink");
  const planks = (H, w) => P([.34, .68].map((s) => { const p = sp(s, w); return `M${pt([p[0], p[1] - 1.5])} L${pt([p[0], p[1] - H + 1.5])}`; }).join(" "), "thin");
  const doorway = (t1, t2, h, w) => { const p = fp(t1, w), q = fp(t2, w);
    return P(`M${pt(p)} L${pt(q)} L${pt([q[0], q[1] - h])} L${pt([p[0], p[1] - h])} Z`, "dark"); };

  /* ── 집 — 시대 넷 ───────────────────────────────────────────────── */
  A.HOUSE[0] = (w) => shad(w) + cone(3, 22, w);                                   // 1 막집 — 벽이 없다
  A.HOUSE[1] = (w) => shad(w) + box(7, w) + earthLine(3.4, w)                     // 2 움집 — 낮은 흙벽
                    + doorway(.44, .72, 5, w) + cone(7, 20, w);
  A.HOUSE[2] = (w) => shad(w) + box(15, w) + posts(15, w) + thatch(15, 11, w);    // 3 초가집 — 흙벽에 기둥 둘
  A.HOUSE[3] = (w) => {                                                           // 4 기와집 — 기단 위에 앉는다
    const hp = 4, wp = w * 1.16, dy = TH * (wp - w) / 2;
    return shad(wp, dy) + G(dy, box(hp, wp))
      + G(-hp, box(17, w) + doorway(.38, .74, 11, w) + planks(17, w) + tiled(17, 11, w));
  };

  /* ── 마을 한가운데 ───────────────────────────────────────────────────
     크기로 세우면 궁궐이 된다. 울 · 마당 · 문 · 솟대로 세운다.
     둘레는 2.1칸(97px), 안의 집은 1.4~1.6칸. 그리는 차례는 뒤에서 앞으로:
     마당 → 뒤 울 → 집 → 앞 울 → 문기둥 · 솟대. */
  const CW = 2.1, CX = TW * CW / 2, CY = TH * CW / 2;                             // 48.3 · 24.2
  const CL = [-CX, -CY], CR = [CX, -CY], CB = [0, -2 * CY], CF = [0, 0];
  const GL = lerp(CF, CL, .3), GR = lerp(CF, CR, .3);                             // 앞 꼭짓점이 문이다
  const yard = P(dia(0, 0, CW), "earth");
  const backRail = (h) => P(`M${pt([CL[0], CL[1] - h])} L${pt([CB[0], CB[1] - h])} L${pt([CR[0], CR[1] - h])}`, "mid");

  // 담 — 앞 두 변만 면으로 세운다. 말뚝 울도 그려 봤지만 46px 마을에서는 그냥 잡음이 됐다
  function wall(h) {
    return P(`M${pt(CL)} L${pt(GL)} L${pt([GL[0], GL[1] - h])} L${pt([CL[0], CL[1] - h])} Z`, "side")
         + P(`M${pt(GR)} L${pt(CR)} L${pt([CR[0], CR[1] - h])} L${pt([GR[0], GR[1] - h])} Z`, "dark");
  }
  // 장대 — 1.15px 선은 마을 전경에서 사라진다. 가는 면으로 세워야 멀리서도 보인다
  const mast = (h) => P(`M-1.3,0 L-1.3,${r(-h)} L1.3,${r(-h)} L1.3,0 Z`, "fillp");
  const sotdae = (p, h) => `<g transform="translate(${pt(p)})">${mast(h)}`         // 솟대 — 장대 위의 새
    + P(`M-5,${r(-h + 2)} q4,-4.5 11,-3 q-4,3.5 -11,1.5 Z`, "fillp") + `</g>`;
  const gatepost = (h) => P(`M${pt(GL)} L${pt([GL[0], GL[1] - h])} M${pt(GR)} L${pt([GR[0], GR[1] - h])}`, "ink");
  function ring(w) {                                                              // 돌 두름 (구석기 — 담이 없다)
    let d = "";
    for (let i = 0; i < 8; i++) {
      const th = i / 8 * Math.PI * 2 + .4;
      const x = Math.cos(th) * TW * w / 2, y = -TH * w / 2 + Math.sin(th) * TH * w / 2;
      d += `M${r(x - 4.4)},${r(y)} q4.4,-4.4 8.8,0 z `;
    }
    return P(d.trim(), "fillp");
  }

  A.HALL[0] = () => shad(CW) + yard + ring(1.94)                                  // 1 큰 막집 — 돌 두름 안의 큰 원뿔
    + G(seat(-CY, 0, 1.7), cone(4, 36, 1.7))
    + `<g transform="translate(0,-60)">${smokeCol()}</g>`;

  A.HALL[1] = () => shad(CW) + yard + backRail(7)                                 // 2 큰 움집 — 흙담 두른 마당
    + G(seat(-CY, 0, 1.55), box(8, 1.55) + earthLine(4, 1.55) + cone(8, 30, 1.55))
    + `<g transform="translate(0,-53)">${smokeCol()}</g>`
    + wall(7) + sotdae(lerp(CL, CF, .5), 44);

  // 3 신단과 제단 — 돌 기단 위에 신단이 앉고 마당 앞에 제단이 놓인다. 솟대 둘이 문을 지킨다
  A.HALL[2] = () => shad(CW) + yard + backRail(7)
    + G(seat(-CY - 5, 0, 1.6), box(7, 1.6))                                       // 신단의 돌 기단
    + G(seat(-CY - 5, 7, 1.15), box(13, 1.15) + posts(13, 1.15) + thatch(13, 11, 1.15))
    + G(seat(-7, 0, .95), box(4.5, .95))                                          // 제단
    + P(dia(0, seat(-7, 4.5, .62), .62), "dark")                                  // 제단 위의 돌판
    + wall(7) + sotdae(GL, 64) + sotdae(GR, 58);

  // 4 마을의 큰 집 — 담 두른 마당 · 기단 · 문기둥 · 깃대. 집 자체는 1.3칸이라 궁궐이 되지 않는다
  A.HALL[3] = () => {
    const wb = 1.3, cy = -CY - 3;
    return shad(CW) + yard + backRail(9)
      + G(seat(cy, 0, 1.5), box(5, 1.5))                                          // 기단
      + G(seat(cy, 5, wb), box(20, wb) + doorway(.4, .72, 13, wb) + planks(20, wb) + tiled(20, 11, wb))
      + wall(9) + gatepost(15)
      + `<g transform="translate(${pt(lerp(CL, CF, .45))})">${mast(58)}`           // 깃대 — 마당 앞에 선다
      + P("M0,-58 l15,5 l-15,5 Z", "fillp") + `</g>`;
  };

  /* 시대 5~12(삼국~오늘)를 그리는 블록이 같은 부품을 쓴다.
     베껴 두면 지붕을 한 번 고칠 때 두 벌이 어긋난다 — 초가 지붕을 둥글게 고친 것이 그 예다. */
  A.PARTS = { bones, thatch, tiled, posts, planks, doorway, earthLine, G, seat, lerp, pt, r, fp, sp,
    CW, CX, CY, CL, CR, CB, CF, GL, GR, yard, backRail, wall, mast, sotdae, gatepost, ring };
})();

/* ══ 나무 · 밭 · 상징물 · 산수 ══════════════════════════════════════════════ */
// _bench/nature.js — 자연: 나무 · 밭 · 상징물 · 산수
// village.js 뒤에 실려 VILLAGE.ART 의 칸을 갈아 끼운다. village.js·village.css 는 건드리지 않는다.
//
// 고친 것
//  ① 나무 — 막대에 덩이 둘(버섯)을 버리고 소나무·활엽수 두 종으로. 멀면 결을 빼고 실루엣만 남긴다.
//     ★ 스케일 버그도 여기서 푼다: .tree 의 CSS 애니메이션(transform:rotate)이 같은 <g> 의
//       transform="scale(s)" 를 통째로 덮어써서 지금까지 **모든 나무가 1.0 으로 그려지고 있었다**.
//       (벤치의 '나무 0.72 / 0.9 / 1.1' 이 셋 다 29×36 으로 찍힌 것이 증거다.)
//       그래서 겉에 scale 만 하는 <g> 를 한 겹 더 두고, 흔들리는 <g class="tree"> 는 그 안에 넣는다.
//       transform-origin 도 인라인으로 줄기 밑동(50% 100%)에 못 박는다 — 안 그러면 viewBox 원점을
//       중심으로 도는 바람에 먼 나무가 16px 씩 미끄러진다.
//  ② 밭 — 마름모 하나 + 사선 몇 개를 버리고 시대마다 다른 결(화전·밭이랑·논)로. 결은 전부 c 축을 따른다.
//  ③ 상징물 — 흙 두둑·디딤돌·낮은 울로 땅에 앉힌다. 고인돌·신단수는 편의 얼굴이라 크게 짓는다. 가마를 새로 넣는다.
//  ④ 산 — 무지개 아치를 버리고 삼원(三遠): 먼 산은 옅고 부드럽고, 앞산은 진하고 뾰족하고 주름이 있다.
(function () {
  const A = window.VILLAGE.ART;
  const { P, dia, box, hip, tiled, shad, smokeCol, TW, TH } = A;
  const n = (v) => (Math.round(v * 10) / 10);

  /* ══ ① 나무 ═══════════════════════════════════════════════════════
     획 굵기는 vector-effect 때문에 줄지 않는다(1.15px 고정). 그래서 나무를 0.6 배로 줄이면
     모양만 작아지고 선은 그대로라 안이 새까매진다 — 먼 나무에 결을 넣으면 안 되는 이유다.
     멀리서 살아남는 것은 실루엣뿐이니, 소나무는 '가로로 층진 것' · 활엽수는 '울퉁불퉁한 덩이'로 갈린다. */

  // 소나무 — 굽은 줄기에 솔잎 덩이 넷. 덩이를 층층이 **가지런히** 쌓으면 크리스마스 트리가 되므로
  // 좌우로 어긋나게 놓고 크기를 달리한다. 그게 굽은 적송의 인상이다
  function pine(k, near) {
    const l = (k % 3) - 1;                                    // 줄기가 기우는 쪽 (-1·0·1)
    const j = ((k % 7) / 7 - .5);                             // 덩이의 좌우 비대칭
    // 솔잎 한 덩이 — 좌우 끝이 뾰족하고 밑이 처진 판. 둥근 Q 를 안 쓴다(둥글면 버섯이 된다)
    const clump = (cx, cy, hw, th, s) => P(
      `M${n(cx - hw)},${n(cy + th * .18)}`
      + ` L${n(cx - hw * .58)},${n(cy - th * .68)} L${n(cx - hw * .2)},${n(cy - th * .3)}`
      + ` L${n(cx + hw * .08 + s * 2)},${n(cy - th)}`
      + ` L${n(cx + hw * .44)},${n(cy - th * .42)} L${n(cx + hw * .76)},${n(cy - th * .64)}`
      + ` L${n(cx + hw)},${n(cy + th * .24)}`
      + ` L${n(cx + hw * .48)},${n(cy + th * .9)} L${n(cx + s)},${n(cy + th * .5)} L${n(cx - hw * .46)},${n(cy + th)} Z`, "fillp");
    return P(`M0,1 C${n(l * 2 - 1)},-6 ${n(l * 4)},-13 ${n(l * 2.6)},-24`, "ink")
      + P(`M${n(l * 3.2)},-16 q${n(5 - l)},0 ${n(9 - l)},-3`, "ink")          // 옆으로 뻗은 가지
      + clump(l * 2.6 + 1, -24.5, 6.4, 4.2, j)
      + clump(l * 2 - 8.5, -19.5, 6.6, 4.2, j * .7)
      + clump(l * 2.6 + 9, -18, 7.4, 4.4, -j)
      + clump(l + 1, -12, 10.4, 5.2, j * .5)
      + (near ? P("M-10,-9.5 l-3.5,2 M9.5,-10.5 l3.5,2 M-1.5,-15.5 l-2,2.5", "thin") : "");
  }

  // 활엽수 — 둥근 잎덩이. 줄기를 굵게 채워 넣어야 0.6 배로 줄여도 '떠 있는 구름'이 안 된다
  function broad(k, near) {
    const l = (k % 3) - 1;
    const crown = k % 2
      ? "M-13,-15 Q-16.5,-22 -9,-26 Q-5,-32 4,-30 Q12,-31 13.5,-24 Q16.5,-18 10,-14 Q5,-11 1,-13.5 Q-5,-10.5 -13,-15 Z"
      : "M-12,-13 Q-16.5,-20 -9.5,-25 Q-4,-32 5,-29 Q13,-30 14,-22 Q15.5,-16 8.5,-13 Q3,-10 -2,-12.5 Q-7.5,-10 -12,-13 Z";
    return P(`M-2.8,1 C-1.8,-5 ${n(l * 1.1 - 2)},-9 ${n(l * 1.5 - 1.7)},-15`
      + ` L${n(l * 1.5 + 1.7)},-15 C${n(l * 1.1 + 2)},-9 1.8,-5 2.8,1 Z`, "side")
      + P(`M${n(l * 1.5)},-14 q-4.5,-2.5 -8,-6.5 M${n(l * 1.5)},-14 q5,-3 8,-7`, "ink")
      + P(crown, "fillp")
      + (near ? P("M-6,-16 q4.5,-6.5 10.5,-6 M2.5,-25 q4,3 6,7.5", "mid")
              + P("M-9.5,-20 q3.5,-3.5 7.5,-3", "thin") : "");
  }

  // s 는 실루엣 크기, k 는 종·흔들림. 먼 숲은 s≈.56~.78 로 들어온다
  A.tree = (s = 1, k = 0) => {
    const K = Math.abs(Math.round(k)) || 0;
    const near = s >= .85;                                    // 가까운 나무에만 결을 넣는다
    const body = K % 5 < 3 ? pine(K, near) : broad(K, near);   // 다섯에 셋은 소나무
    return `<g transform="scale(${s.toFixed(3)})">${P(dia(0, 2, .4), "shadow")}`
      + `<g class="tree" style="--wt:${7 + K % 5}s;transform-box:fill-box;transform-origin:50% 100%">${body}</g></g>`;
  };

  /* ══ ② 밭 ════════════════════════════════════════════════════════
     밭이 색 덩어리로 보이는 까닭은 결이 없어서다. 이랑을 **c 축**(화면 오른쪽아래)에 정확히 실어야
     땅에 눕는다. 아래 FP 가 밭 안의 (c,r) 을 화면 좌표로 바꾼다 — 눈대중 사선을 쓰지 않는다. */
  const FP = (c, r, w) => [(c - r) * TW / 2, (c + r) * TH / 2 - TH * w / 2];
  const row = (u, w, cls, dy = 0) => {                        // r=u*w 자리에 c 축을 따라 한 줄
    const [x0, y0] = FP(-w / 2, u * w, w), [x1, y1] = FP(w / 2, u * w, w);
    return P(`M${n(x0)},${n(y0 + dy)} L${n(x1)},${n(y1 + dy)}`, cls);
  };
  const band = (u0, u1, w, cls) => {                          // 두둑 한 켜 (평행사변형)
    const p = [FP(-w / 2, u0 * w, w), FP(w / 2, u0 * w, w), FP(w / 2, u1 * w, w), FP(-w / 2, u1 * w, w)];
    return P(`M${p.map(([x, y]) => `${n(x)},${n(y)}`).join(" L")} Z`, cls);
  };
  const lip = (w) => P(`M${n(-TW * w / 2)},${n(-TH * w / 2)} L0,0 L${n(TW * w / 2)},${n(-TH * w / 2)}`, "mid");

  // 시대 2 · 화전 — 태운 자리라 반듯하지 않다. 그루터기와 재가 남고 이랑은 듬성하다
  A.FIELD[1] = (k) => {
    const w = 1.4, hw = TW * w / 2, hh = TH * w / 2, o = (k % 3) - 1;
    const burn = `M${n(o)},${n(-TH * w + 3)} L${n(hw - 5)},${n(-hh - 3)} L${n(hw - 8)},${n(-hh + 5)}`
      + ` L2,-1 L${n(-hw + 7)},${n(-hh + 3)} L${n(-hw + 2)},${n(-hh - 4)} Z`;
    const stump = (c, r, h) => {                               // 그루터기 — 낮고 그을려 어둡다
      const [x, y] = FP(c * w, r * w, w);
      return P(`M${n(x - 2.8)},${n(y - h)} q2.8,-1.4 5.6,0 l0,${h} q-2.8,1.4 -5.6,0 z`, "dark")
        + P(`M${n(x - 2.8)},${n(y - h)} q2.8,-1.4 5.6,0 q-2.8,1.4 -5.6,0 z`, "side");
    };
    return P(burn, "crop") + P(burn, "thin")
      + P(`M${n(-hw + 7)},${n(-hh + 3)} L2,-1 L${n(hw - 8)},${n(-hh + 5)}`, "mid")   // 앞 두렁
      + row(-.24, w, "thin", -1) + row(.04, w, "thin", -1) + row(.3, w, "thin", -1)
      + P("M-16,-11 l5,-2.5 M7,-15 l5,-2.5 M-4,-3 l5,-2.5 M-9,-16 l4,-2 M1,-8 l4,-2", "mid")  // 재 자국
      + stump(-.2, -.3, 3.2) + stump(.24, .06, 2.6) + stump(-.08, .3, 3)
      + P("M12,-9 l5,-5 M-21,-6 l4,-4", "ink");                          // 타다 남은 가지
  };

  // 시대 3 · 밭이랑 — 두둑과 고랑이 켜켜이. 두둑은 담채를 한 번 더 먹어 한 단 짙다
  A.FIELD[2] = (k) => {
    const w = 1.55, m = 6;
    let s = P(dia(0, 0, w), "crop") + P(dia(0, 0, w), "thin");
    for (let i = 0; i < m; i++) {
      const u0 = -.5 + i / m, u1 = u0 + .6 / m;
      s += band(u0, u1, w, "crop") + row(u0, w, "mid", -.7) + row(u1, w, "thin", .5);
    }
    // 자란 것 — 두둑 위의 짧은 포기 (가까이서만 보인다)
    for (let i = 0; i < 6; i++) {
      const [x, y] = FP((-.36 + i * .15) * w, (-.3 + (i % 3) * .3) * w, w);
      s += P(`M${n(x)},${n(y - .5)} l-1,-2.5 M${n(x)},${n(y - .5)} l1.5,-2`, "thin");
    }
    return s + lip(w);
  };

  // 시대 4 · 논 — 물을 가둔 두렁. 배미 셋으로 나뉘고 가운데가 깊다
  A.FIELD[3] = (k) => {
    const w = 1.55;
    let s = P(dia(0, 0, w), "wash") + band(-.28, .28, w, "wash") + P(dia(0, 0, w), "thin");
    for (let i = 1; i < 3; i++) {                               // 두렁 둘 — 마루와 발치
      const u = -.5 + i / 3;
      s += row(u, w, "mid", -1.3) + row(u, w, "thin", 1.1);
    }
    s += P("M-20,-15 q6,-3.5 12,0 q6,3.5 12,0", "thin") + P("M-9,-6 q5,-3 10,0", "thin");   // 물빛
    for (let i = 0; i < 6; i++) {                               // 모 — 물 위로 나온 포기
      const [x, y] = FP((-.36 + i * .14) * w, (-.32 + (i % 2) * .34) * w, w);
      s += P(`M${n(x)},${n(y)} l-1,-3 M${n(x)},${n(y)} l1.5,-2.5`, "thin");
    }
    return s + lip(w);
  };

  /* ══ ③ 상징물 ═════════════════════════════════════════════════════
     빈 땅에 떠 있던 까닭은 받침이 없어서다. 셋 중 하나를 깔아 땅에 앉힌다. */

  // 흙 두둑 — 마름모의 뒤쪽만 살짝 부푼 낮은 흙받침.
  // (앞 두 변까지 부풀리면 배·대야처럼 보인다 — 처음에 그렇게 그렸다가 물렀다)
  const berm = (w, r = 4) => {
    const hw = TW * w / 2, hh = TH * w / 2;
    return shad(w * 1.08)
      + P(`M${n(-hw)},${n(-hh)} Q${n(-hw * .45)},${n(-hh - r)} 0,${n(-hh - r * .85)}`
        + ` Q${n(hw * .45)},${n(-hh - r)} ${n(hw)},${n(-hh)} L0,1 Z`, "side")
      + P(`M${n(-hw * .55)},${n(-hh - r * .2)} Q0,${n(-hh - r)} ${n(hw * .55)},${n(-hh - r * .2)}`, "thin");
  };
  // 디딤돌 — 낮은 돌받침 한 단
  const plinth = (w, h = 4) => shad(w * 1.04) + box(h, w);
  // 낮은 울 — 짧은 말뚝과 가로대. 앞 두 변은 중묵, 뒤 두 변은 담묵
  const rail = (w, p = 8) => {
    const hw = TW * w / 2, hh = TH * w / 2;
    return P(`M${n(-hw)},${n(-hh)} l0,${-p} M0,0 l0,${-p} M${n(hw)},${n(-hh)} l0,${-p} M0,${n(-hh * 2)} l0,${-p}`, "ink")
      + P(`M${n(-hw)},${n(-hh - p * .6)} L0,${n(-p * .6)} L${n(hw)},${n(-hh - p * .6)}`, "mid")
      + P(`M${n(-hw)},${n(-hh - p * .6)} L0,${n(-hh * 2 - p * .6)} L${n(hw)},${n(-hh - p * .6)}`, "thin");
  };
  // 여장(女墻) — 두 점 사이의 성가퀴. 톱니가 아니라 '선 블록 + 사이 낮은 담'
  const cren = (x0, y0, x1, y1, m, h) => {
    const dx = (x1 - x0) / m, dy = (y1 - y0) / m;
    let d = `M${n(x0)},${n(y0)}`;
    for (let i = 0; i < m; i++) {
      const ax = x0 + dx * i, ay = y0 + dy * i;
      d += ` L${n(ax)},${n(ay - h)} L${n(ax + dx * .62)},${n(ay + dy * .62 - h)}`
        + ` L${n(ax + dx * .62)},${n(ay + dy * .62 - h * .42)} L${n(ax + dx)},${n(ay + dy - h * .42)}`;
    }
    return d + ` L${n(x1)},${n(y1)} Z`;
  };

  // 뗀석기 더미 — 흙 두둑 위에 각진 돌 여럿. 봉우리처럼 솟으면 산이 되므로 낮고 울퉁불퉁하게
  A.MARK.flint = () => berm(.95, 4)
    + P("M-17,-4 L-12,-10 L-6,-8 L-3,-13 L4,-11 L8,-14 L13,-9 L17,-4 Q0,2 -17,-4 Z", "fillp")
    + P("M-12,-10 L-9,-4 M-6,-8 L-4,-3 M-3,-13 L1,-6 M4,-11 L7,-5 M8,-14 L11,-6", "mid")
    + P("M-14,-5 l3,-3 M14,-5 l2.5,-3", "thin");

  // 빗살무늬 토기 — 뾰족밑이라 혼자 못 선다. 짚 또아리에 앉히고 목에 빗살을 새긴다
  A.MARK.pot = () => plinth(.88, 3)
    + P("M-13,-33 Q-11,-19 -4,-9 Q0,-5 4,-9 Q11,-19 13,-33 Q0,-29 -13,-33 Z", "fillp")
    + P("M-13,-33 Q0,-37 13,-33", "mid")
    + P("M-12.2,-29 q12.2,-3.5 24.4,0 M-11.4,-25 q11.4,-3.5 22.8,0", "thin")
    + P("M-9,-22 l-1.5,5 M-4.5,-23 l-1.5,5 M0,-23.5 l-1.5,5 M4.5,-23 l-1.5,5 M9,-22 l-1.5,5", "thin")
    + P("M-10,-8 q10,-4.5 20,0 q-10,4.5 -20,0 Z", "side");             // 짚 또아리

  // 신단수 — 시대 3 의 얼굴. 돌 제단 + 낮은 울 + 마을에서 제일 큰 나무 + 금줄.
  // 잎을 한 덩이로 그리면 브로콜리가 된다 — 덩이 넷을 겹쳐 그려 사이에 윤곽이 드러나게 한다
  const lobe = (cx, cy, rx, ry) => P(
    `M${n(cx - rx)},${n(cy)} Q${n(cx - rx * .95)},${n(cy - ry * .85)} ${n(cx - rx * .3)},${n(cy - ry)}`
    + ` Q${n(cx + rx * .35)},${n(cy - ry * 1.14)} ${n(cx + rx * .82)},${n(cy - ry * .58)}`
    + ` Q${n(cx + rx * 1.12)},${n(cy + ry * .12)} ${n(cx + rx * .5)},${n(cy + ry * .58)}`
    + ` Q${n(cx - rx * .2)},${n(cy + ry * .88)} ${n(cx - rx * .7)},${n(cy + ry * .46)}`
    + ` Q${n(cx - rx * 1.06)},${n(cy + ry * .2)} ${n(cx - rx)},${n(cy)} Z`, "fillp");
  A.MARK.shrine = () => {
    const w = 1.5, hw = TW * w / 2, hh = TH * w / 2;
    return P(dia(0, 3, w * 1.1), "shadow") + box(6, w)
      + P(`M${n(-hw + 4)},${n(-hh - 3)} L-2,-3 M${n(hw - 4)},${n(-hh - 3)} L2,-3`, "thin")   // 단의 켜
      + `<g transform="translate(0,-6)">${rail(w * .84, 8)}</g>`
      + `<g transform="translate(0,-9)">`
      + P("M-5.5,0 C-4,-13 -5,-25 -3,-39 L3,-39 C5,-25 4,-13 5.5,0 Q0,2.5 -5.5,0 Z", "side")       // 줄기
      + P("M-1.8,-5 C-1,-17 -1.8,-27 -1.2,-37", "thin")
      + P("M-3,-35 q-8,-4 -13,-11 M3,-36 q9,-3 14,-10", "ink")                                     // 가지
      + lobe(-15, -50, 13, 10.5) + lobe(16, -48, 12.5, 10) + lobe(-2, -61, 14.5, 11.5) + lobe(4, -46, 12.5, 10)
      + P("M-19,-53 q7,-7 15,-4 M6,-58 q8,1 10,8", "mid")
      + P("M-7,-22 q7,-3.5 14,0", "mid")                                                           // 금줄
      + P("M-4,-21 l-1,5 M1.5,-22 l0,5 M7,-21 l1,5", "thin")                                       // 늘어뜨린 종이
      + `</g>`;
  };

  // 여덟 가지 법 — 비석이 아니라 마을에 내건 방(榜). 기둥 둘에 널을 걸고 작은 지붕을 얹는다
  A.MARK.law = () => berm(.86, 3)
    + P("M-12,-5 L-12,-16 M12,-5 L12,-16", "ink")
    + P("M-15,-15 L-15,-35 L13,-35 L13,-15 Z", "fillp")
    + P("M13,-35 L17,-32 L17,-12 L13,-15 Z", "dark")                    // 널의 두께
    + P("M-18,-35 L15,-35 L18,-39 L-15,-39 Z", "roofd")                 // 작은 지붕
    + P("M-9,-31 h17 M-9,-27.5 h17 M-9,-24 h17 M-9,-20.5 h17", "thin")
    + P("M2,-35 L2,-15", "thin");

  // 청동 거울 — 막대에 꽂힌 동그라미가 아니라, 세 발 받침에 세운 잔무늬거울
  A.MARK.mirror = () => plinth(.8, 4)
    + P("M-10,-5 L-4,-23 M10,-5 L4,-23 M-10,-5 L10,-5", "ink")
    + `<circle class="fillp" cx="0" cy="-30" r="11.5"/>`
    + `<circle class="thin" cx="0" cy="-30" r="8"/><circle class="thin" cx="0" cy="-30" r="4"/>`
    + P("M-7.5,-30 h15 M0,-37.5 v15 M-5.3,-35.3 l10.6,10.6 M-5.3,-24.7 l10.6,-10.6", "thin")
    + `<circle class="mid" cx="0" cy="-30" r="1.6"/>`;                  // 꼭지

  // 고인돌 — 시대 3 의 얼굴. 탁자식: 세워 놓은 널판 둘 위에 거칠고 두꺼운 덮개돌 한 장.
  // 굄돌을 상자(box)로 그리면 상 다리가 되어 밥상처럼 보인다 — 그래서 '판'으로 세운다
  A.MARK.dolmen = () => P(dia(0, 3, 1.35), "shadow") + berm(1.15, 3)
    + P("M-21,-2 L-21,-22 L-9,-16 L-9,4 Z", "side") + P("M-9,-16 L-5,-18 L-5,2 L-9,4 Z", "dark")
    + P("M21,-2 L21,-22 L9,-16 L9,4 Z", "dark") + P("M9,-16 L5,-18 L5,2 L9,4 Z", "side")
    + P("M-3,-41 L14,-38 L28,-30 L4,-18 L-14,-22 L-28,-31 Z", "fillp")   // 덮개돌 윗면 — 반듯하지 않다
    + P("M-28,-31 L-14,-22 L4,-18 L4,-11 L-14,-15 L-28,-24 Z", "side")   // 앞왼쪽 두께
    + P("M4,-18 L28,-30 L28,-23 L4,-11 Z", "dark")                       // 앞오른쪽 두께
    + P("M-16,-32 q12,4 24,-2 M-7,-26 l9,1.5", "thin");                  // 돌결

  // 대장간 — 앞이 트인 헛간. 문을 크게 뚫으면 뚜껑 열린 궤짝이 되므로 사람 드나들 만큼만
  A.MARK.smith = () => {
    const w = 1.05, hw = TW * w / 2, hh = TH * w / 2, H = 12;
    return shad(w * 1.06) + box(H, w) + hip(H, 12, w)
      + P("M-18,-9 L-18,-19 L-8,-14 L-8,-4 Z", "dark")                   // 문간 — 안이 어둡다
      + P("M-18,-19 L-8,-14", "ink")
      + P("M-15,-8 l3,-1.5 M-13,-11 l3,-1.5", "thin")                    // 화덕 불빛
      + P(`M${n(-hw)},${n(-hh)} L0,0 L${n(hw)},${n(-hh)}`, "mid")        // 돌 밑동
      + `<g transform="translate(16,5)">` + P("M-8,-2 L-2,-5 L6,-2 L0,1 Z", "fillp")
      + P("M-4,-3.5 L-4,-7.5 L3,-10.5 L3,-6.5 Z", "side")
      + P("M-4,-7.5 L2,-10.5 L6,-8.5 L3,-6.5 Z", "fillp") + `</g>`       // 모루
      + `<g transform="translate(0,-6)">${smokeCol()}</g>`;
  };

  // 성문 — 기둥 둘에 얹힌 삿갓이 아니라, 성벽에 뚫린 홍예문 위에 문루가 앉는다
  A.MARK.gate = () => {
    const w = 1.45, hw = TW * w / 2, hh = TH * w / 2, H = 18;
    return P(dia(0, 3, w * 1.06), "shadow") + box(H, w)
      + P("M-24,-12 L-24,-25 Q-17,-30 -10,-18 L-10,-5 Z", "dark")        // 홍예문
      + P("M-23,-24 Q-17,-28.5 -11,-19", "mid")
      + P(`M${n(-hw)},${n(-hh - 6)} L0,-6 M${n(-hw)},${n(-hh - 12)} L0,-12`, "thin")   // 돌 켜
      + P(`M${n(hw)},${n(-hh - 6)} L0,-6 M${n(hw)},${n(-hh - 12)} L0,-12`, "thin")
      + `<g transform="translate(0,-18)">${box(9, .92)}${tiled(9, 10, .92)}`
      + P("M-14,-9 L-14,-2 M0,-15 L0,-8 M14,-9 L14,-2", "thin") + `</g>`;
  };

  // 성벽 — 기단 위에 벽, 그 위에 여장. 앞 두 변에만 성가퀴가 서서 두께가 보인다
  A.MARK.wall = () => {
    const w = 1.5, hw = TW * w / 2, hh = TH * w / 2, H = 15;
    return P(dia(0, 3, w * 1.1), "shadow") + box(3, w * 1.1)
      + `<g transform="translate(0,-3)">` + box(H, w)
      + P(cren(-hw, -hh - H, 0, -H, 3, 8), "fillp")
      + P(cren(0, -H, hw, -hh - H, 3, 8), "fillp")
      + P(`M${n(-hw)},${n(-hh - H + 5)} L0,${n(-H + 5)} L${n(hw)},${n(-hh - H + 5)}`, "thin")
      + P(`M${n(-hw)},${n(-hh - 5)} L0,-5 L${n(hw)},${n(-hh - 5)}`, "thin")
      + P(`M${n(-hw)},${n(-hh - 10)} L0,-10 L${n(hw)},${n(-hh - 10)}`, "thin") + `</g>`;
  };

  // 널무덤 — 봉분 발치에 둘레돌을 두르고 앞에 상석을 놓는다. 그래야 무덤으로 읽힌다
  A.MARK.tomb = () => {
    let s = P(dia(0, 3, 1.4), "shadow")
      + P("M-28,-9 Q-26,-31 0,-31 Q26,-31 28,-9 Q0,3 -28,-9 Z", "fillp")
      + P("M-19,-18 Q0,-26 19,-18 M-12,-24 Q0,-28 12,-24", "thin");
    [-22, -11.5, 0, 11.5, 22].forEach((x, i) => {                        // 둘레돌
      const y = -8.6 + (1 - Math.abs(x) / 26) * 3.2;
      s += P(`M${n(x - 3.4)},${n(y)} q3.4,-3.4 6.8,0 q-3.4,2.2 -6.8,0 z`, "side");
    });
    return s + `<g transform="translate(0,8)">` + P("M-10,0 L0,-5 L10,0 L0,5 Z", "fillp")
      + P("M-10,0 L-10,2.5 L0,7.5 L10,2.5 L10,0", "dark") + `</g>`;      // 상석
  };

  // 숨은 이야기 비석 — 받침돌 위에 두께 있는 비신. 납작한 카드로 보이면 안 된다
  A.MARK.stele = () => plinth(.72, 4)
    + `<g transform="translate(0,-4)">`
    + P("M-8,-2 L-8,-33 Q0,-40 8,-33 L8,-2 Z", "fillp")
    + P("M8,-33 L11.5,-31 L11.5,0 L8,-2 Z", "dark")
    + P("M-8,-33 Q0,-40 8,-33 L11.5,-31 Q3,-38 -4.5,-31.5 Z", "side")
    + P("M-4,-28 h8 M-4,-24 h8 M-4,-20 h8 M-4,-16 h8 M-4,-12 h8", "thin") + `</g>`;

  // 토기 가마 — 시안(village-iso.html KIND.kiln)에서 빠진 것. 시대 2 의 얼굴이라 되살린다.
  // 비탈에 낸 등요(登窯): 앞이 낮은 아궁이, 뒤가 높은 굴뚝, 옆에 구운 토기
  A.MARK.kiln = () => shad(1.25)
    + P("M-25,-4 Q-23,-25 -2,-27 Q19,-29 24,-14 Q4,2 -25,-4 Z", "fillp")
    + P("M-19,-6 q4,-12 12,-5 q-5,6 -12,5 Z", "dark")                    // 아궁이
    + P("M-18,-8 q4,-8 10,-4", "mid")
    + P("M-13,-16 q10,-5 21,-3 M-8,-21 q9,-4 18,-2", "thin")             // 흙 결
    + P("M15,-24 L15,-33 Q18.5,-35 22,-33 L22,-21 Z", "side")            // 굴뚝
    + `<g transform="translate(18,-34)">${smokeCol()}</g>`
    + `<g transform="translate(-28,3)">` + P("M-5,-8 q5,-2.5 10,0 q-1.5,8 -5,9 q-3.5,-1 -5,-9 Z", "fillp")
    + P("M-5,-8 q5,2.5 10,0", "thin") + `</g>`
    + `<g transform="translate(-19,6)">` + P("M-4,-6 q4,-2 8,0 q-1,6 -4,7 q-3,-1 -4,-7 Z", "fillp") + `</g>`;

  A.LABEL.kiln = "토기 가마";

  /* ── 세간 — 나무만 새것으로 갈아 끼운다(DETAIL 은 제 안에서 옛 tree 를 부르므로 통째로 다시 쓴다) ── */
  A.DETAIL[0] = (k) => A.tree(.92 + (k % 3) * .07, k);
  A.DETAIL[1] = (k) => k % 2 ? A.tree(.96, k)
    : `${shad(.6)}${P("M-9,-2 q-6,-13 -1,-19 q9,-4 18,0 q5,6 -1,19 z", "fillp")}${P("M-8,-13 h16 M-7,-9 h14", "thin")}`;
  A.DETAIL[2] = (k) => k % 2 ? A.tree(.98, k)
    : `${P("M-23,-8 L-23,0 M0,-19 L0,-11 M23,-8 L23,0", "ink")}${P("M-23,-4 L0,-15 L23,-4 M-23,0 L0,-11 L23,0", "thin")}`;
  A.DETAIL[3] = (k) => k % 2 ? A.tree(1, k)
    : `${shad(.7)}${P("M-11,-4 L0,-9 L11,-4 L0,1 Z", "fillp")}${P("M-8,-6 L-8,-17 M8,-11 L8,-22", "ink")}${P("M-8,-17 L0,-22 L8,-22", "ink")}`;

  /* ══ ④ 산수 ═══════════════════════════════════════════════════════
     무지개 아치가 된 까닭: 능선을 Q 하나로 이으면서 조절점 높이를 고정했기 때문이다(= 반원).
     삼원(三遠)으로 다시 짠다 — 먼 산은 옅고 부드럽고 넓게, 앞산은 진하고 뾰족하고 주름이 있다.
     지평선(sy)은 그대로 둔다: 마을 좌표가 거기 걸려 있다. */
  A.scenery = function (sy, VW) {
    const k = VW / 1000;
    const rn = (i, s) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };

    // 능선 한 겹의 점들. sharp 면 봉우리 양옆에 어깨를 넣어 각이 서고, 아니면 둥근 마루가 된다
    function pts(h, m, seed, sharp) {
      const W = VW + 80, x0 = -40, out = [[x0, sy - h * .07]];
      for (let i = 0; i < m; i++) {
        const a = x0 + W * i / m, b = x0 + W * (i + 1) / m, sp = b - a;
        const ax = a + sp * (.26 + .46 * rn(i, seed)), ah = h * (.44 + .56 * rn(i + 31, seed));
        if (sharp) out.push([ax - sp * (.15 + .11 * rn(i + 5, seed)), sy - ah * (.38 + .24 * rn(i + 11, seed))]);
        out.push([ax, sy - ah]);
        if (sharp) out.push([ax + sp * (.12 + .1 * rn(i + 17, seed)), sy - ah * (.42 + .22 * rn(i + 23, seed))]);
        out.push([b, sy - h * (.05 + .21 * rn(i + 47, seed))]);          // 골짜기
      }
      return out;
    }
    const smooth = (p) => {                                              // 점들을 부드럽게 잇는다 (먼 산)
      let d = `M${n(p[0][0])},${n(p[0][1])}`;
      for (let i = 1; i < p.length - 1; i++)
        d += ` Q${n(p[i][0])},${n(p[i][1])} ${n((p[i][0] + p[i + 1][0]) / 2)},${n((p[i][1] + p[i + 1][1]) / 2)}`;
      return d + ` L${n(p[p.length - 1][0])},${n(p[p.length - 1][1])}`;
    };
    const facet = (p) => p.map(([x, y], i) => `${i ? "L" : "M"}${n(x)},${n(y)}`).join(" ");   // 각진 능선 (앞산)

    function range(h, m, seed, sharp, o, folds) {
      const p = pts(h, m, seed, sharp), d = sharp ? facet(p) : smooth(p);
      let s = `<path class="hillfill" style="opacity:${o}" d="${d} L${n(VW + 40)},${n(sy)} L-40,${n(sy)} Z"/>`
        + `<path class="hillline" style="opacity:${(o * .85).toFixed(2)}" d="${d}"/>`;
      if (folds) p.forEach(([x, y], i) => {                              // 준(皴) — 봉우리에서 내려오는 주름
        if (y > sy - h * .52) return;
        const dir = i % 2 ? 1 : -1, L = (sy - y) * .62;
        s += `<path class="hillline" style="opacity:${(o * .42).toFixed(2)}" `
          + `d="M${n(x)},${n(y + 4)} q${n(dir * L * .18)},${n(L * .5)} ${n(dir * L * .3)},${n(L)}"/>`;
      });
      return s;
    }
    const cloud = (fx, fy, w, o) =>
      `<path class="thin" style="opacity:${o}" d="M${n(VW * fx)},${n(sy - fy * k)} q${n(w * .3)},-13 ${n(w * .55)},-3`
      + ` q${n(w * .26)},-14 ${n(w * .45)},3 q${n(-w * .36)},8 ${n(-w)},0"/>`;

    return `<circle class="sun" cx="${n(VW * .8)}" cy="${n(sy - 122 * k)}" r="${n(44 * k)}"/>
      ${range(160 * k, 7, .7, false, .30, false)}
      ${range(118 * k, 5, 2.9, true, .44, false)}
      ${range(80 * k, 4, 5.3, true, .60, true)}
      ${cloud(.12, 152, 96 * k, .18)}${cloud(.57, 172, 84 * k, .13)}
      <g class="bird" style="--bd:1s;--bw:${n(VW)}px">${P(`M0,${n(sy - 96 * k)} q8,-6 15,0 q8,-6 15,0`, "thin")}</g>
      <g class="bird" style="--bd:23s;--bw:${n(VW)}px">${P(`M0,${n(sy - 70 * k)} q7,-5 12,0 q7,-5 12,0`, "thin")}</g>`;
  };
})();

/* ══ 사람 · 짐승 · 그 시대의 일 ══════════════════════════════════════════════ */
// _bench/people.js — 사람과 짐승.
// "건물만 있으면 유적이고, 사람이 있어야 마을이다." 사람은 아이가 되새김을 맞혀야 이사 온다 —
// 가장 값진 보상이므로 가장 잘 보여야 한다. 전에는 키 11 단위 막대기였다.
(function () {
  const A = window.VILLAGE.ART;
  const { P, dia, smokeCol, shad, cone, TW, TH } = A;   // 시설(A.FAC)이 shad·cone 을 쓴다

  /* ── 뼈대 ───────────────────────────────────────────────────────────
     집이 46px 이니 사람은 그 셋에 하나 — 발 0 에서 정수리 -16.
     머리(원) · 몸통(면) · 팔(선) · 다리(선) 넷이 각각 구별되게 나눈다.
     15px 에서 읽히는 것은 자세가 아니라 **실루엣**이므로, 동작마다 연장을 하나씩 들려 준다.
     ⚠ village.css 가 회전축을 못 박아 두었다: .chop (0,-9) · .legA/.legB (0,-4) · .stoop (0,0).
       축은 못 옮기고, 도는 <g> 에 transform 을 걸면 CSS 애니메이션이 그것을 덮어쓴다.
       그래서 축이 제자리에 오도록 **겉을 한 겹 더 감싸서** 옮긴다. */
  const R = 2.4, HD = -13.6, SH = -10.9, HIP = -5.8;

  const T = (x, y, s) => `<g transform="translate(${x},${y})">${s}</g>`;
  const S = (k, s) => `<g transform="scale(${k})">${s}</g>`;
  const M = (x, s) => `<g transform="translate(${x},0) scale(-1,1)">${s}</g>`;   // 반대쪽을 보게
  const bod = (s, t) => `<g class="bod"${t ? ` style="--t:${t}s"` : ""}>${s}</g>`;
  const head = (x = 0, y = HD, r = R) => `<circle class="fillp" cx="${x}" cy="${y}" r="${r}"/>`;
  const sh = (w = .3) => P(dia(0, 1.5, w), "shadow");

  // 휘두르는 팔 — 어깨를 (0,-9) 에 두고 그린다. d 는 두 사람이 엇갈려 치게 늦추는 값
  const swing = (s, y = SH, d) =>
    T(0, y + 9, `<g class="chop"${d ? ` style="animation-delay:${d}"` : ""}>${s}</g>`);
  // 걷는 다리 — 엉덩이를 (0,-4) 에 두고 그린다. 벌림은 애니메이션(±16°)이 만든다
  // ⚠ 다리는 쉬지 않고 흔들리므로 **move: 1 인 일에만** 단다. 제자리 일은 stand() —
  //   사냥·그물·괭이·절구·대장장이가 이걸 달아 제자리걸음을 했다 (Matto, 2026-09-21). tools/village-art.test.mjs 가 막는다
  const step = (y = HIP) => T(0, y + 4,
    P("M0,-4 L-.7,-1 L-1.4,1.8", "ink legA") + P("M0,-4 L.7,-1 L1.4,1.8", "ink legB"));
  const stand = () => P(`M-.8,${HIP} L-1.4,-2.9 L-2,0 M.8,${HIP} L1.4,-2.9 L2,0`, "ink");
  const trunk = () => P("M-2.6,-11.1 L2.6,-11.1 L3.2,-5.4 L-3.2,-5.4 Z", "side");
  const rest = () => P("M-2.5,-10.5 L-4.4,-7.4 M2.5,-10.5 L4.4,-7.4", "ink");
  const armBack = () => P("M-2.5,-10.5 L-4.4,-7.4", "ink");

  // 쪼그려 앉은 몸 (불 쬐기 · 토기 굽기) — 어깨 -9.4, 정수리 -14.6
  const crouch = (arm) => P("M0,-4.8 L3.1,-3.4 L3.3,0 M-.2,-4 L2.3,-2.6 L2.5,.2", "ink")
    + P("M-2.5,-9.5 L2.3,-9.5 L2.9,-4.2 L-2.9,-4.2 Z", "side")
    + (arm || P("M2,-8.9 L5.4,-7", "ink")) + head(.2, -12.2, 2.4);

  /* ── 동작 스무 종 — 시대마다 다섯 ─────────────────────────────────── */
  const W = {};

  // 시대 1 구석기 ------------------------------------------------------
  W.hunt = () => ({ svg: sh() + bod(stand() + trunk() + armBack() + head()
    + swing(P("M0,-9 L4.3,-7.4", "ink")
      + P("M-2.6,-12.6 L9,-5.6", "ink")
      + P("M9,-5.6 l3.5,1.9 l-1.1,-3.4 z", "fillp"))) });

  W.knap = () => ({ svg: sh(.34) + bod(                          // 앉아서 돌 떼기
      P("M1,-4.4 L4.9,-4 L6.5,-.2 M1,-3.3 L4.4,-2.9 L5.6,.2", "ink")
    + P("M-2.7,-9.1 L2.4,-9.1 L2.6,-3.6 L-3,-3.6 Z", "side")
    + P("M-2.6,-8.5 L-4.4,-5.4", "ink") + head(-.3, -11.7)
    + swing(P("M0,-9 L3.5,-6.9", "ink") + P("M2,-8.5 q3.2,-2 4.7,.4 q-2.7,2.2 -4.7,-.4 z", "fillp"), -8.9))
    + P("M4.6,-.6 q2.8,-2.8 5.6,0 q-2.8,1.8 -5.6,0 z", "dark")
    + P("M3,-1.5 l1.5,-1.3 M11,-1.8 l1.7,-.8", "thin") });

  W.walk = (k) => (k % 3 === 1)                                  // 마주 선 두 사람 — 혼자 걷는 막대기가 아니다
    ? { svg: T(-6.6, 0, sh(.28) + bod(stand() + trunk()
        + P("M-2.5,-10.5 L-4.4,-7.4 M2.5,-10.5 L4.6,-9", "ink") + head(.3)))
      + M(6.6, sh(.28) + bod(stand() + trunk()
        + P("M-2.5,-10.5 L-4.4,-7.4 M2.5,-10.5 L4.2,-7.8", "ink") + head(.3), 30)) }
    : { move: 1, svg: sh() + bod(step() + trunk() + rest() + head()) };

  W.carry = () => ({ move: 1, svg: sh() + bod(                   // 짐 지기 — 등짐이 실루엣을 바꾼다
      P("M-2.7,-12.8 q-6.9,.6 -6.5,4.6 q.4,4 6.5,3.4 Z", "dark")
    + P("M-8.4,-11.6 q3.2,-.6 5.7,-.2 M-8.6,-9.3 q3.4,-.6 5.9,-.4", "thin")
    + step() + trunk() + P("M2.5,-10.5 L4.4,-7.4 M-2.5,-10.5 L-4.6,-11.8", "ink") + head(.4)) });

  W.warm = () => ({ svg: T(-8.6, 0, sh(.26) + bod(crouch()))     // 둘이 불을 사이에 두고 쬔다
    + M(8.6, sh(.26) + bod(crouch(), 32))
    + P(dia(0, 1.6, .44), "shadow")
    + `<g class="fire">${P("M0,0 q-3.4,-3.4 -1.4,-7.6 q.6,2.8 2,1.4 q-1.4,-4.2 2,-7 q-.8,5.6 2,6.4 q1.4,2.8 -.6,6.8", "fillp")}</g>`
    + T(0, -7.4, smokeCol()) });

  // 시대 2 신석기 ------------------------------------------------------
  W.net = () => ({ svg: sh() + bod(stand() + trunk() + armBack() + head()
    + swing(P("M0,-9 L4,-10.4", "ink")
      + P("M3.8,-10.8 Q9.4,-11.6 12.2,-6.6", "mid")
      + P("M5.4,-5.6 Q9.2,-2.6 12.4,-4.2", "mid")
      + P("M5,-10.6 L5.6,-5.7 M7.2,-11.2 L8.2,-4.6 M9.4,-10.8 L10.6,-4.2 M11.4,-9.2 L12.3,-4.4", "thin"))) });

  W.kiln = () => ({ svg: T(-7.4, 0, sh(.26) + bod(crouch(P("M2,-8.9 L6.4,-6.6", "ink"))))
    + P("M1.6,-9.4 Q5.9,-10.5 10.2,-9.4 L6.6,-.2 Q5.9,.4 5.2,-.2 Z", "fillp")   // 빗살무늬 토기
    + P("M2.6,-7.4 L9.2,-7.4 M3.2,-5.4 L8.6,-5.4", "thin")
    + T(5.9, -10.2, smokeCol()) });

  W.weed = () => ({ svg: sh(.3) + `<g class="stoop">${           // 밭 매기 — 허리를 접는다
      P("M-.4,-6 L-1.5,-3 L-2.7,0 M.7,-5.9 L1.7,-3.2 L2.5,0", "ink")
    + P("M3.6,-10.6 L5.9,-8.8 L1,-4.9 L-1.3,-6.7 Z", "side")
    + P("M5,-9 L6.6,-4.4", "ink") + head(7.1, -11.4)
    + P("M6.6,-4.4 l2.5,-1 M6.6,-4.4 l.5,-2.4", "thin")}</g>`
    + P("M9.6,-1 q2.4,-2 4.6,-.2 M10.8,-.6 q1.4,-2.4 3.2,-2.2", "thin") });

  W.jar = () => ({ move: 1, svg: sh() + bod(step() + trunk()     // 물동이 이기
    + P("M-2.5,-10.5 L-3.6,-13.6 L-2.6,-15.7 M2.5,-10.5 L3.6,-13.6 L2.6,-15.7", "ink")
    + head()
    + P("M-3.6,-16.2 q-2.1,-3.8 .6,-5.2 q3,-1.3 6,0 q2.7,1.4 .6,5.2 z", "fillp")
    + P("M-3.6,-16.2 h7.5", "mid")) });

  // 시대 3 청동기 · 고조선 ----------------------------------------------
  W.farm = () => ({ svg: sh() + bod(stand() + trunk() + armBack() + head()
    + swing(P("M0,-9 L3.9,-7.3", "ink")
      + P("M1,-11.4 L8.4,-4", "ink")
      + P("M8.4,-4 l3.1,1.7 l-1,-3.7 l-2.7,-.6 z", "dark"))) });

  W.pound = () => {                                              // 절구질 — 둘이 마주 서서 번갈아 친다
    const one = (d) => bod(stand() + trunk() + armBack() + head()
      + swing(P("M0,-9 L3.3,-7.5", "ink") + P("M1.4,-13 L6.4,-2.6", "ink") + P("M1.4,-13 l1.9,.7", "ink"), SH, d));
    return { svg: T(-9, 0, sh(.28) + one()) + M(9, sh(.28) + one("-.8s"))
      + P("M-4.3,0 L-3,-6.2 Q0,-7.5 3,-6.2 L4.3,0 Z", "dark")
      + P("M-3,-6.2 Q0,-4.8 3,-6.2", "thin") };
  };

  W.draw = () => ({ move: 1, svg: sh() + bod(step() + trunk()    // 물지게 — 통 둘이 실루엣을 말한다
    + P("M-2.5,-10.5 L-3.9,-11.7 M2.5,-10.5 L3.9,-11.3", "ink") + head()
    + P("M-8.8,-12 L8.8,-11.2", "ink")
    + P("M-6.7,-11.8 L-6.7,-9 M6.7,-11.5 L6.7,-8.4", "thin")
    + P("M-8.8,-9 L-8,-4.5 L-5.4,-4.5 L-4.6,-9 Z", "fillp")
    + P("M4.6,-8.4 L5.4,-3.9 L8,-3.9 L8.8,-8.4 Z", "fillp")) });

  W.pray = () => ({ svg: sh() + bod(stand() + trunk()            // 제사 — 두 손을 이마 앞에 모은다
    + P("M-2.4,-10.5 L2.7,-13.9 M2.4,-10.5 L3.1,-13.7", "ink") + head(-.6)
    + P("M2.6,-14.1 l2.5,-1.5 l1.3,1.9 l-2.5,1.5 z", "fillp"))
    + P("M5,-.4 q2.7,-2.1 5.4,0 q-2.7,1.5 -5.4,0 z", "fillp") });

  // 시대 4 철기 --------------------------------------------------------
  W.forge = () => ({ svg: sh()
    + P("M3.4,0 L4.4,-3.6 L9.4,-3.6 L10.4,0 Z", "dark")          // 모루
    + P("M2.4,-3.6 L11.4,-3.6 L11.4,-5.7 L2.4,-5.7 Z", "side")
    + P("M11.4,-5.7 l3.1,.9 l-3.1,1.2 z", "side")
    + bod(stand() + trunk() + armBack() + head()
      + swing(P("M0,-9 L3.7,-7.7", "ink") + P("M2.2,-8.4 L8.4,-11.6", "ink")
        + P("M7.2,-13.4 l3.7,-1.9 l1.7,3.1 l-3.7,1.9 z", "dark")))
    + P("M6.2,-6.6 l1.9,-1.7 M8.4,-6.4 l2.3,-.8 M7.4,-7.5 l.6,-2.3", "thin") });

  W.drive = () => ({ move: 1, svg: sh() + bod(step() + trunk() + armBack() + head()
    + swing(P("M0,-9 L3.1,-10.3", "ink") + P("M2.7,-10.5 L8.2,-14.6", "mid"), SH))
    + T(15.5, 0, S(.82, P(dia(0, 1.5, .38), "shadow") + bod(ox(), 30))) });

  W.cart = () => ({ move: 1, svg: sh()                           // 짐수레
    + P("M-16.8,-6.2 L-5.4,-6.2 L-6.8,-11.4 L-15.4,-11.4 Z", "dark")
    + P("M-17.4,-6.2 L-4.8,-6.2", "ink")
    + `<circle class="fillp" cx="-11" cy="-3.2" r="3.2"/>`
    + P("M-11,-6.4 L-11,0 M-14.2,-3.2 L-7.8,-3.2", "thin")
    + P("M-5.4,-6.8 L-3.9,-8.6 M-5.4,-8.4 L-3.9,-9.8", "ink")
    + bod(step() + trunk() + P("M-2.5,-10.4 L-4,-9 M2.5,-10.5 L4.4,-7.4", "ink") + head(.6)) });

  W.chop = W.farm; W.stoop = W.weed;                             // 벤치가 옛 이름으로 부른다

  /* ── 짐승 ── 시대 1~2 개·사슴 · 시대 3~4 소·닭 ────────────────────── */
  function dog() {
    return P("M-5,-2.6 q-.6,-3 2.6,-3.2 q3,-.2 5.6,.2 q1.8,.2 1.8,2.2 q0,2 -2,2.2 q-3.6,.4 -6.4,0 q-1.4,-.2 -1.6,-1.4 Z", "fillp")
      + P("M-4.8,-4.4 q-2.9,-1 -2,-3.9", "ink")
      + P("M-3.2,-1.4 L-3.6,1.2 M-1,-1.4 L-.6,1.2 M3,-1.4 L2.6,1.2 M4.6,-1.4 L5,1.2", "ink")
      + head(6.6, -6.6, 1.9)
      + P("M8,-6 l2.7,.4 l-2.5,1.3 z", "fillp")
      + P("M5.6,-8 l-.7,-2.5 l2.3,1.7 z", "fillp");
  }
  function deer() {
    return S(.8, P("M-6.2,-8.8 q1.4,-2.4 4.6,-2.2 q4.2,.2 6.4,1.4 q1.6,.8 1,2.6 q-.8,2 -3,2.2 q-4.6,.4 -7.6,-.4 q-2,-.6 -1.4,-3.6 Z", "fillp")
      + P("M-6.2,-8.6 l-1.7,-1.5", "ink")
      + P("M-3.8,-5 L-4.4,0 M-1.4,-4.8 L-1,0 M2.6,-5.4 L3.2,0 M4.6,-5.2 L4,0", "ink")
      + P("M3.2,-9.8 L5.6,-14.6 L7.6,-14 L5.4,-8.6 Z", "fillp")
      + P("M5.8,-15.2 q3,-1 4,.8 q-1.4,1.8 -4,1.2 z", "fillp")
      + P("M6.2,-16.2 l-1.5,-1.9 l2.1,.7 z", "fillp")
      + P("M7,-16.6 l-.8,-3 M6.2,-19.6 l-2,-1.1 M6.2,-19.6 l1,-1.5 M8,-16.4 l1.5,-2.6 M9.5,-19 l1.9,-.6 M9.5,-19 l-.2,-1.9", "ink"));
  }
  function ox() {
    return P("M-10,-7.4 q0,-4.6 4.6,-5 q5.4,-.4 9.4,.6 q3,.8 2.8,3.8 q-.2,3 -3,3.8 q-5.6,1.2 -11,.2 q-2.6,-.4 -2.8,-3.4 Z", "fillp")
      + P("M-4,-12.1 q4,-1 8,-.4", "thin")
      + P("M-10,-7.6 q-3,2 -2,5.6", "ink")
      + P("M-7,-4.4 L-7.6,1.2 M-3.6,-4 L-3.2,1.2 M3,-4.4 L3.6,1.2 M5.6,-4.6 L5,1.2", "ink")
      + P("M6,-11 L11.6,-10.2 L13,-5.6 L9.4,-4.6 L6.2,-6.6 Z", "fillp")
      + P("M8.4,-11.4 q-1.7,-3 -4.1,-2.6 M11.2,-11 q1.9,-2.8 4.3,-2.2", "ink");
  }
  function hen() {
    return S(.72, P("M-3.4,-4 q-.8,-3.2 2.4,-3.8 q3.2,-.6 4.8,1.4 q1.4,1.8 -.2,3.4 q-2.4,2.2 -5.4,1.2 q-1.4,-.4 -1.6,-2.2 Z", "fillp")
      + P("M-3.2,-5.2 q-3.5,-1.4 -3.3,-5.1 q2.5,2.3 4.3,2.7 z", "fillp")
      + P("M0,-1.8 L-.4,1 M2,-2 L2.4,1", "ink") + P("M-.4,1 l-1.5,.4 M2.4,1 l1.5,.4", "thin")
      + P("M1.4,-6.4 L3.2,-10 L4.8,-9.6 L3.2,-5.8 Z", "fillp")
      + head(4.4, -10.4, 1.6)
      + P("M3.3,-11.8 q.7,-1.7 1.5,-.2 q.8,-1.5 1.4,.2 q-1.5,.7 -2.9,0 z", "fillp")
      + P("M5.8,-10.2 l2.1,.6 l-2.1,.9 z", "fillp"));
  }

  // 멧돼지 — 사슴보다 낮고 두껍다. 등에 뻣뻣한 갈기, 주둥이가 앞으로 길다
  function boar() {
    return S(.86, P("M-8.4,-5.2 q-.4,-4 4,-4.4 q5,-.4 8.4,.8 q2.4,.8 2.2,3.2 q-.2,2.6 -2.6,3.2 q-5,1 -9.6,.2 q-2.2,-.4 -2.4,-3 Z", "fillp")
      + P("M-6.4,-9.4 l-.6,-2.4 M-3.6,-9.9 l-.4,-2.6 M-.8,-10 l-.2,-2.6 M2,-9.8 l.2,-2.4", "ink")
      + P("M-8.4,-5.4 q-2.4,1.4 -1.8,4", "ink")
      + P("M-5.6,-2.6 L-6,1.2 M-2.6,-2.4 L-2.2,1.2 M2.6,-2.8 L3,1.2 M5,-2.8 L4.6,1.2", "ink")
      + P("M6.4,-9 L11.4,-8.2 L13.8,-4.8 L9.4,-3.4 L6.6,-5.4 Z", "fillp")
      + P("M12.6,-5.2 q1.8,.4 2.2,-.8", "ink")
      + P("M8.2,-9.4 l-.6,-2.6 l2.2,1.6 z", "fillp"));
  }
  // 돼지 — 둥글고 짧다. 코가 뭉툭하고 꼬리가 말린다
  function pig() {
    return S(.8, P("M-7.4,-5.6 q-.6,-4.2 4,-4.6 q5,-.4 8,.8 q2.4,.9 2.2,3.4 q-.2,2.8 -2.6,3.4 q-4.8,1 -9.2,.2 q-2.2,-.4 -2.4,-3.2 Z", "fillp")
      + P("M-7.6,-6.4 q-2.8,-.4 -2.6,-3 q1.6,1.4 2.8,1.4", "ink")
      + P("M-4.6,-2.4 L-5,1.2 M-1.6,-2.2 L-1.2,1.2 M3.4,-2.6 L3.8,1.2 M5.6,-2.6 L5.2,1.2", "ink")
      + P("M6.6,-9.4 q3.6,-.4 4.8,1.6 q1.2,2 -.6,3.2 q-2.4,1.4 -4.4,-.2 z", "fillp")
      + P("M10.6,-7 a1.1,1.1 0 1,0 .1,0", "ink")
      + P("M5.4,-10 l-.4,-2.4 l1.8,1.4 z", "fillp"));
  }
  // 말 — 다리가 길고 목이 선다. 갈기와 꼬리가 흐른다
  function horse() {
    return P("M-9,-9.4 q0,-3.8 4.4,-4.2 q5,-.4 8.4,.6 q2.6,.8 2.4,3.4 q-.2,2.8 -2.6,3.4 q-5.4,1.2 -10.2,.2 q-2.4,-.4 -2.4,-3.4 Z", "fillp")
      + P("M-9,-9.6 q-3.4,1.6 -3.6,5.6", "ink")
      + P("M-6.2,-6.4 L-7,1.2 M-2.8,-6 L-2.4,1.2 M3.2,-6.4 L3.8,1.2 M5.8,-6.4 L5.2,1.2", "ink")
      + P("M5.6,-12.4 L8.6,-19.4 L11.4,-18.6 L9.4,-11.2 Z", "fillp")
      + P("M8.8,-19.8 q3.4,-.6 4.2,1.6 q-1.8,1.8 -4.4,1 z", "fillp")
      + P("M9.4,-21 l-1.2,-2.2 l2.2,1 z", "fillp")
      + P("M6.2,-13.4 q1.4,-4.2 3.2,-6.6 M5,-11.6 q1.6,-4.4 3.4,-7", "thin");
  }

  /* ── 마을이 부르는 자리 ─────────────────────────────────────────── */
  A.person = (k, work) => {
    // 왕복 한 바퀴. ~~20 + (k%13)*2 (20~44초)~~ → 13~29초 (Matto, 2026-09-09: 「좀 움직였으면」).
    // 걸음 폭(1~2칸)은 그대로다 — 더 넓히면 집 벽을 뚫고 지나간다
    const t = 13 + (k % 9) * 2;
    const dx = (k % 2 ? 1 : -1) * (40 + (k % 4) * 20), dy = (k % 2 ? 1 : -1) * (20 + (k % 3) * 10);
    const g = (W[work] || W.walk)(k);
    return g.move
      ? `<g class="mover" style="--t:${t}s;--dx:${dx}px;--dy:${dy}px">${g.svg}</g>`
      : `<g style="--t:${t}s">${g.svg}</g>`;
  };

  // 짐승도 시대를 탄다. 전에는 시대마다 두 종뿐이라 개와 소만 번갈아 보였다 (Matto, 09-05)
  const BEAST = [
    [["개", dog], ["사슴", deer], ["멧돼지", boar]],                          // 1 구석기 — 사냥과 사냥감
    [["개", dog], ["멧돼지", boar], ["사슴", deer], ["돼지", pig]],           // 2 신석기 — 기르기 시작한다
    [["소", ox], ["닭", hen], ["돼지", pig], ["개", dog]],                    // 3 청동기 — 농사 짐승
    [["소", ox], ["말", horse], ["닭", hen], ["돼지", pig]],                  // 4 철기 — 말이 온다
  ];
  // ⚠ 전에는 4 로 못 박혀 있었다 — 시대 5~12 를 그려도 짐승만 철기 마을에 남는다.
  //   BEAST.length 를 보게 해서 아래 시대를 더하면 저절로 따라오게 한다
  const beastAt = (k, era) => { const row = BEAST[Math.min(Math.max(era, 1), BEAST.length) - 1]; return row[k % row.length]; };

  A.animal = (k, era) => {
    const t = 18 + (k % 7) * 3;                                 // 사람과 같이 느려 있었다 (26~44초 → 18~36초)
    const dx = (k % 2 ? 1 : -1) * 30, dy = (k % 2 ? 1 : -1) * 15;
    return `<g class="mover" style="--t:${t}s;--dx:${dx}px;--dy:${dy}px">${P(dia(0, 1.5, .34), "shadow")}${bod(beastAt(k, era)[1]())}</g>`;
  };
  A.ANIMAL_NAME = (k, era) => beastAt(k, era)[0];

  // 불도 시대를 탄다 — 구석기는 맨 땅의 모닥불, 신석기부터 돌로 두른 화덕
  A.fire = (e = 0) => {
    const flame = `<g class="fire">${P("M0,0 q-5,-5 -2,-11 q1,4 3,2 q-2,-6 3,-10 q-1,8 3,9 q2,4 -1,10", "fillp")}</g>`;
    if (!e) return P(dia(0, 2, .5), "shadow") + P("M-9,1 l3,-2 M9,1 l-3,-2 M-4,3 l2,-2 M5,3 l-2,-2", "thin") + flame + smokeCol();
    return P(dia(0, 2, .58), "shadow")
      + P(dia(0, 1, .5), "fillp") + P(dia(0, 1, .5), "mid")     // 돌로 두른 화덕 자리
      + P("M-10,0 l2.6,-1.4 M-6,2.2 l2.4,-1.4 M0,3.4 l2.6,-1.4 M7,1 l2.4,-1.4 M4,-2 l2.4,-1.4 M-3,-3.4 l2.4,-1.4", "ink")
      + flame + smokeCol();
  };

  // 칸을 바꾼다 — 배열을 새로 만들면 마을이 옛 것을 계속 본다.
  // ⚠ **0번 칸은 반드시 걷는 일이어야 한다.** 마을은 사람 하나로 시작하고(되새김 한 문제),
  //   village.js 가 `WORK[e][i % len]` 으로 읽으므로 **첫 사람이 곧 0번 칸**이다.
  //   여기가 제자리 일이면 마을에 사람이 하나뿐인 동안 아무도 안 움직인다 —
  //   「제자리에서만 사냥하는 사람 하나만 있어서 어색」 (Matto, 2026-09-09).
  //   그 시대의 얼굴은 1번 칸이 맡는다. 0번도 시대에 맞는 일로 고른다(짐·물동이·소·수레).
  A.WORK[0] = ["carry", "hunt", "knap", "walk", "warm"];       // 1 구석기 — 짐을 지고 옮겨 다닌다
  A.WORK[1] = ["jar", "net", "kiln", "walk", "weed"];          // 2 신석기 — 강에서 물을 인다
  A.WORK[2] = ["draw", "farm", "pound", "walk", "pray"];       // 3 청동기 — 우물에서 물을 긷는다
  A.WORK[3] = ["drive", "forge", "walk", "cart", "farm"];      // 4 철기 — 소를 몬다
  // ⚠ village.js 의 ART 는 WORK_NAME 을 아직 내주지 않는다(village.js 359줄). 없으면 만들어 둔다 —
  //   합칠 때 ART 에 WORK_NAME 한 칸만 얹으면 말풍선 이름표가 바로 붙는다.
  A.WORK_NAME = A.WORK_NAME || {};
  Object.assign(A.WORK_NAME, {
    hunt: "사냥하는 사람", knap: "돌을 떼는 사람", walk: "마을 사람", carry: "짐을 진 사람", warm: "불을 쬐는 사람",
    net: "그물을 던지는 사람", kiln: "토기를 굽는 사람", weed: "밭을 매는 사람", jar: "물동이를 인 사람",
    farm: "괭이질하는 사람", pound: "절구질하는 사람", draw: "물 긷는 사람", pray: "제사 지내는 사람",
    forge: "망치질하는 대장장이", drive: "소를 모는 사람", cart: "짐수레 끄는 사람",
    chop: "괭이질하는 사람", stoop: "밭을 매는 사람",
  });

  /* ── 시설 ── 편을 풀어서 서는 상징물과 다르다. **마을이 자라면 저절로 생기는 것**들이다.
     상징물이 「무엇을 배웠나」라면 시설은 「몇 사람이 사나」다 (Matto, 09-05) ── */
  const A_FAC = A.FAC = {};

  // 우물 — 돌을 둘러 쌓고 두레박이 걸린다. 신석기부터
  A_FAC.well = () => shad(.62)
    + P(dia(0, 0, .5), "fillp") + P(dia(0, 0, .5), "mid")
    + P("M-11,-2 L-11,-7 M11,-2 L11,-7 M-11,-7 L11,-7", "ink")          // 두레박 틀
    + P("M0,-7 L0,-13 M-4,-13 L4,-13", "ink")
    + P("M2,-7 l0,4", "thin") + P("M-1.6,-3.2 l3.2,0 l-.5,2.6 l-2.2,0 z", "side");  // 두레박

  // 장독대 — 낮은 단 위에 항아리 넷. 신석기부터(그릇을 만들 줄 알게 된 뒤)
  const jar = (x, s) => `<g transform="translate(${x},0) scale(${s})">`
    + P("M-4.4,-6 q4.4,-2.4 8.8,0 q-.8,7.6 -4.4,8.4 q-3.6,-.8 -4.4,-8.4 Z", "fillp")
    + P("M-4.4,-6 q4.4,2.4 8.8,0", "thin") + P("M-5.2,-6.4 q5.2,-2 10.4,0", "mid") + `</g>`;
  A_FAC.jars = () => shad(.68) + P(dia(0, 0, .56), "fillp") + P(dia(0, 0, .56), "thin")
    + jar(-9, .9) + jar(0, 1.15) + jar(9, .85) + jar(-3.5, .7) ;

  // 나루터 — 통나무배가 매인 자리. 강가에만 선다
  A_FAC.dock = () => P(dia(0, 2, .5), "shadow")
    + P("M-16,-2 L14,-2 L14,1 L-16,1 Z", "fillp") + P("M-16,-2 L14,-2", "mid")
    + P("M-12,1 l0,5 M-2,1 l0,5 M8,1 l0,5", "ink")                       // 말뚝
    + P("M2,4 q9,-3.5 18,0 q-9,3.5 -18,0 Z", "side") + P("M2,4 q9,-3.5 18,0", "mid")   // 통나무배
    + P("M14,-2 l4,-6", "thin");                                         // 매인 줄

  // 짐승 우리 — 낮은 울과 여물통. 청동기부터(기르기 시작한 뒤)
  A_FAC.pen = () => {
    const hw = TW * .86 / 2, hh = TH * .86 / 2, p = 7;
    return shad(.9)
      + P(`M${-hw},${-hh} l0,${-p} M0,0 l0,${-p} M${hw},${-hh} l0,${-p} M0,${-hh * 2} l0,${-p}`, "ink")
      + P(`M${-hw},${-hh - p * .6} L0,${-p * .6} L${hw},${-hh - p * .6}`, "mid")
      + P(`M${-hw},${-hh - p * .6} L0,${-hh * 2 - p * .6} L${hw},${-hh - p * .6}`, "thin")
      + P("M-6,-1 l12,0 l-1.5,3.4 l-9,0 z", "side") + P("M-6,-1 l12,0", "mid")
      + P("M-2,-4 q2,-2.4 4,0", "thin");
  };

  // 솟대 — 긴 장대 끝의 새. 청동기부터
  A_FAC.sotdae = () => shad(.42)
    + P("M0,0 L0,-34", "ink") + P("M-4,0 L0,-3 L4,0", "thin")
    + P("M-7,-34 q4,-3.4 8.6,-1.4 q3.4,1.4 5.4,-1 q-1,4 -5,4.4 q-5,.4 -9,-2 Z", "fillp")
    + P("M6.6,-36 l3,-.6 l-2.6,1.8 z", "fillp") + P("M-7,-34 q4,1.4 8.6,0", "thin");

  // 망루 — 네 기둥 위의 작은 지붕. 철기부터(지킬 것이 생긴 뒤)
  A_FAC.tower = () => shad(.78)
    + P("M-10,-2 L-7,-24 M10,-2 L7,-24 M-5,-5 L-3.5,-25 M5,-5 L3.5,-25", "ink")
    + P("M-9,-12 L9,-12 M-8,-19 L8,-19", "thin")                          // 가로대
    + P("M-11,-24 L11,-24 L8,-27 L-8,-27 Z", "side")                      // 바닥
    + cone(3, 13, .52) + `<g transform="translate(0,-26)">${P("M-2,0 l0,-4", "thin")}</g>`;

  // 이름만 여기서 준다 — **자리와 조건(FAC_WHEN)은 village.js 가 갖는다.**
  // 집터를 고르는 mkSlots 가 그 자리를 비워야 하는데, village-art 는 그보다 늦게 실린다
  A.FAC_NAME = { well: "우물", jars: "장독대", dock: "나루터", pen: "짐승 우리", sotdae: "솟대", tower: "망루" };

  /* 시대 5~12 를 그리는 블록이 같은 뼈대로 사람을 그린다 — W 에 칸을 더하고 BEAST 에 줄을 민다.
     사람 뼈대를 베끼면 시대 5 사람만 키가 달라진다. */
  A.POSE = { T, S, M, bod, head, sh, swing, step, stand, trunk, rest, armBack, crouch, W, R, HD, SH, HIP };
  A.BEAST = BEAST;
})();

/* ══ 시대 5~12 — 삼국부터 오늘까지 ═══════════════════════════════════════════
   왜 있나: village.js 가 `Math.min(state.era, 4)` 로 잠겨 있어 **시대 5(11편)부터
   12(180편)까지 여덟 시대가 통째로 철기 마을의 옷**을 입고 있었다. 2장이 열리는
   11편부터 이미 어긋난 화면이다. 「첫 사례의 값이 코드에 박힌다」의 또 한 자리.

   46px 에서 시대를 가르는 것은 **지붕의 꼴**과 **벽의 재료**뿐이다. 그래서 이렇게 잡았다:
     3 초가 (우진각 · 이엉)      → 5 귀틀 (맞배 · 통나무 결)
     4 기와 (우진각 · 기단)      → 6 기와 민가 (맞배 · 낮고 넓다)
     7 담 두른 집 → 8 초가와 기와가 섞인 마을 → 9 ㄱ자 한옥 → 10 차양 친 초가
     11 얕은 맞배에 유리창 → 12 평지붕 양옥
   **맞배와 우진각을 번갈아** 놓은 것은 실루엣이 한 칸씩 바뀌게 하려는 것이다.

   마을 한가운데는 크기가 아니라 **무엇이 서 있느냐**로 시대를 말한다:
     솟대 → 절과 석탑 → 관아의 솟을대문 → 장터의 차양 → 학교의 창.

   ⚠ 밭은 시대 6부터 시대 4의 논을 그대로 쓴다. **논은 천오백 년 동안 논이었다** —
     굳이 다르게 그리면 거짓말이 된다. 시대를 말하는 것은 세간(DETAIL)이 맡는다. */
(function () {
  const A = window.VILLAGE.ART;
  const { P, dia, box, cone, shad, smokeCol, TW, TH } = A;
  const { thatch, tiled, posts, planks, doorway, earthLine, G, seat, lerp, pt, r, fp, sp,
    CW, CL, CR, CF, GL, GR, yard, backRail, wall, mast, sotdae, gatepost } = A.PARTS;
  const { T, S, M, bod, head, sh, swing, step, stand, trunk, rest, armBack, crouch, W } = A.POSE;

  /* ── 맞배지붕 ────────────────────────────────────────────────────────────
     우진각(초가·기와집)과 갈리는 자리는 딱 하나 — **추녀가 없다.**
     용마루가 처마 끝까지 곧게 나가고, 양 끝은 지붕이 아니라 **삼각 벽(박공)** 이 선다.
     보이는 면은 둘: 왼앞으로 앉는 지붕 한 장 + 오른앞의 박공 삼각형. */
  const qp = (p0, c, p1, t) => lerp(lerp(p0, c, t), lerp(c, p1, t), t);

  /* ⚠ 처음에는 우진각처럼 사방을 똑같이(ov) 내밀었더니 **박공이 벽 밖으로 통째로 떠서
     깃발처럼 붙어 나왔다.** 맞배는 처마(용마루와 나란한 두 변)만 내밀고, 박공 쪽은
     거의 안 내민다(풍판만큼). 그래서 내밂을 둘로 나눈다: ev = 처마, gu = 박공. */
  function gable(H, rise, w, kind, ov) {
    const ev = ov ? (ov - 1) / 2 : (kind === "thatch" ? .17 : kind === "tin" ? .10 : .14);
    const gu = kind === "thatch" ? .07 : .05;
    const hw = TW * w / 2, hh = TH * w / 2, rz = rise * w;
    const U = [hw, hh], V = [hw, -hh];                    // U = 용마루 방향 · V = 처마가 내려가는 방향
    const at = (u, v) => [-hw + u * U[0] + v * V[0], -hh - H + u * U[1] + v * V[1]];
    const L = at(-gu, -ev), F = at(1 + gu, -ev), R = at(1 + gu, 1 + ev);
    const a = [at(-gu, .5)[0], at(-gu, .5)[1] - rz];      // 용마루 뒤끝
    const b = [at(1 + gu, .5)[0], at(1 + gu, .5)[1] - rz];// 용마루 앞끝
    const sag = kind === "thatch" ? 4.4 : kind === "tin" ? 1.4 : 2.8;
    const cL = [(L[0] + F[0]) / 2, (L[1] + F[1]) / 2 + sag];
    const a2 = a, b2 = b;                                 // 용마루는 지붕 밖으로 안 삐져나온다
    let s = P(`M${pt(L)} Q${pt(cL)} ${pt(F)} L${pt(b)} L${pt(a)} Z`, "roof")     // 비탈 한 장
          + P(`M${pt(F)} L${pt(R)} L${pt(b)} Z`, "roofd");                       // 박공
    let d = "";                                            // 결 — 이엉은 짧게, 기와 골은 처마까지
    const N = kind === "tile" ? 5 : 4;
    for (let i = 1; i <= N; i++) {
      const t = i / (N + 1), s0 = lerp(a, b, t), e0 = qp(L, cL, F, t);
      d += kind === "thatch" ? `M${pt(lerp(s0, e0, .18))} L${pt(lerp(s0, e0, .58))} `
                             : `M${pt(lerp(s0, e0, .06))} L${pt(lerp(s0, e0, .96))} `;
    }
    s += P(d.trim(), kind === "tile" ? "mid" : "thin");
    if (kind === "thatch") {                               // 처마 끝이 들쭉날쭉하다
      let h = `M${pt(L)}`;
      for (let i = 1; i <= 7; i++) { const u = qp(L, cL, F, i / 7); h += ` L${pt([u[0], u[1] + (i % 2 ? 1.6 : -.3)])}`; }
      s += P(h, "mid");
    }
    const th = kind === "thatch" ? 2.3 : kind === "tile" ? 1.9 : 1.1;
    s += P(`M${pt([a2[0], a2[1] - th])} L${pt([b2[0], b2[1] - th])} L${pt([b2[0], b2[1] + th])} L${pt([a2[0], a2[1] + th])} Z`,
      kind === "tile" ? "roofd" : "fillp");
    return s;
  }

  /* ── 벽 · 세간 부품 ───────────────────────────────────────────────────── */
  // 귀틀 — 통나무를 우물 정(井)자로 쌓는다. 결이 가로고, 앞 꼭짓점에서 나무 끝이 엇갈려 나온다
  const logWall = (H, w) => {
    let s = "";
    for (const f of [.28, .52, .76]) s += earthLine(H * f, w);
    return s + P([.28, .52, .76].map((f) => `M-3.2,${r(-H * f - 1.1)} L3.2,${r(-H * f - 1.1)}`).join(" "), "ink");
  };
  // 왼앞 면의 네모 (창 · 문). t 는 왼 꼭짓점 0 → 앞 꼭짓점 1
  const pane = (t0, t1, y0, y1, w, cls) => {
    const p = fp(t0, w), q = fp(t1, w);
    return P(`M${pt([p[0], p[1] - y0])} L${pt([q[0], q[1] - y0])} L${pt([q[0], q[1] - y1])} L${pt([p[0], p[1] - y1])} Z`, cls);
  };
  const chimney = (x, y, h) => T(x, y, P(`M-2.1,0 L-2.1,${r(-h)} L2.1,${r(-h)} L2.1,0 Z`, "side")
    + P(`M-2.7,${r(-h)} L2.7,${r(-h)} L2.7,${r(-h - 1.5)} L-2.7,${r(-h - 1.5)} Z`, "dark"))
    + T(x, y - h - 2, smokeCol());
  // 다락 기둥 — 바닥을 h 만큼 띄운다 (부경 · 원두막)
  const stilts = (h, w) => P([[-TW * w / 2, -TH * w / 2], [TW * w / 2, -TH * w / 2], [0, 0]]
    .map(([x, y]) => `M${r(x)},${r(y - h)} L${r(x)},${r(y)}`).join(" "), "ink");
  // 석탑 — 층마다 몸돌 위에 지붕돌이 넓게 얹힌다. 위로 갈수록 줄어든다
  const pagoda = (tiers, h0, w0) => {
    let s = "", y = 0;
    for (let i = 0; i < tiers; i++) {
      const bh = h0 * Math.pow(.87, i), bw = w0 * Math.pow(.85, i);
      s += P(`M${r(-bw)},${r(y)} L${r(-bw)},${r(y - bh)} L${r(bw)},${r(y - bh)} L${r(bw)},${r(y)} Z`, "side")
         + P(`M${r(-bw * 1.75)},${r(y - bh)} L${r(bw * 1.75)},${r(y - bh)} L${r(bw * 1.3)},${r(y - bh - 2.4)} L${r(-bw * 1.3)},${r(y - bh - 2.4)} Z`, "fillp");
      y -= bh + 2.4;
    }
    return s + P(`M0,${r(y)} L0,${r(y - 4)}`, "ink") + P(`M-2,${r(y - 4)} q2,-2.4 4,0 q-2,1.6 -4,0 z`, "fillp");
  };
  // 석등 — 받침 · 화사석(불 들어가는 자리) · 옥개석
  const lantern = (h) => P(`M-2.6,0 L-1.8,${r(-h * .38)} L1.8,${r(-h * .38)} L2.6,0 Z`, "side")
    + P(`M-4,${r(-h * .38)} L4,${r(-h * .38)} L3.2,${r(-h * .5)} L-3.2,${r(-h * .5)} Z`, "fillp")
    + P(`M-3.2,${r(-h * .5)} L-3.2,${r(-h * .78)} L3.2,${r(-h * .78)} L3.2,${r(-h * .5)} Z`, "dark")
    + P(`M-4.8,${r(-h * .78)} L4.8,${r(-h * .78)} L2.6,${r(-h)} L-2.6,${r(-h)} Z`, "fillp");
  // 장승 — 몸은 나무 기둥, 머리는 넓적하고 눈·입이 있다
  const jangseung = (h) => P(`M-2.4,0 L-2.4,${r(-h)} L2.4,${r(-h)} L2.4,0 Z`, "side")
    + P(`M-3.4,${r(-h)} L3.4,${r(-h)} L3.4,${r(-h - 8)} L-3.4,${r(-h - 8)} Z`, "fillp")
    + P(`M-2,${r(-h - 3.4)} l1.3,0 M.7,${r(-h - 3.4)} l1.3,0`, "ink")
    + P(`M-1.7,${r(-h - 6)} q1.7,1.6 3.4,0`, "ink");
  // 전봇대 — 가로대 둘에 늘어진 전선
  const utilPole = (h) => P(`M-1.1,0 L-1.1,${r(-h)} L1.1,${r(-h)} L1.1,0 Z`, "side")
    + P(`M-6,${r(-h + 4)} L6,${r(-h + 4)} M-4.6,${r(-h + 9)} L4.6,${r(-h + 9)}`, "ink")
    + P(`M-9,${r(-h + 6)} q9,5 18,0`, "thin");
  // 가로등 — 굽은 목에 등
  const streetLamp = (h) => P(`M-1,0 L-1,${r(-h)} L1,${r(-h)} L1,0 Z`, "side")
    + P(`M0,${r(-h)} q0,-5 6,-5`, "ink")
    + P(`M4,${r(-h - 5)} L8.6,${r(-h - 5)} L7.4,${r(-h - 1.6)} L5.2,${r(-h - 1.6)} Z`, "fillp");
  // 평지붕 — 슬래브 위에 난간. 양옥의 실루엣은 이 한 줄이 만든다
  const flatRoof = (H, w) => {
    const hw = TW * w / 2, hh = TH * w / 2, o = 1.5;
    return P(`M0,${r(-TH * w - H - o)} L${r(hw + o)},${r(-hh - H - o)} L0,${r(-H - o)} L${r(-hw - o)},${r(-hh - H - o)} Z`, "fillp")
      + P(`M${r(-hw - o)},${r(-hh - H - o)} L0,${r(-H - o)} L${r(hw + o)},${r(-hh - H - o)}`, "mid")
      + P([[-hw, -hh], [0, 0], [hw, -hh]].map(([x, y]) => `M${r(x)},${r(y - H - o)} L${r(x)},${r(y - H - o - 4)}`).join(" "), "ink")
      + P(`M${r(-hw)},${r(-hh - H - o - 4)} L0,${r(-H - o - 4)} L${r(hw)},${r(-hh - H - o - 4)}`, "mid");
  };
  // 툇마루 — 앞면에 낮게 걸친 마루. 살림집이 마루를 갖는 것은 실루엣을 바꾼다
  const porch = (w, h = 4.5, d = 5) => {
    const p0 = fp(.08, w), q0 = fp(.92, w);
    const A0 = [p0[0], p0[1] - h], B0 = [q0[0], q0[1] - h];
    const A1 = [A0[0] - d, A0[1] + d * .5], B1 = [B0[0] - d, B0[1] + d * .5];
    return P(`M${pt(A0)} L${pt(B0)} L${pt(B1)} L${pt(A1)} Z`, "fillp")
      + P(`M${pt(A1)} L${pt(B1)} L${pt([B1[0], B1[1] + 2.4])} L${pt([A1[0], A1[1] + 2.4])} Z`, "side")
      + P(`M${pt([A1[0] + 1, A1[1] + 2.4])} l0,3 M${pt([B1[0] - 1, B1[1] + 2.4])} l0,3`, "ink");
  };
  // 낮은 흙담 — 집 앞을 가로지른다. 마당이 생겼다는 표시.
  // ⚠ 처음에 box() 로 세웠더니 **속이 찬 덩어리**가 되어 마당에 놓인 판처럼 보였다.
  //   담은 두 면과 마루선뿐이다 — 마을회관의 wall() 과 같은 규율
  const yardWall = (w, h = 6, d = 7) => {
    const hw = TW * w * .92 / 2, hh = TH * w * .92 / 2;
    const L0 = [-hw, -hh + d], F0 = [0, d], R0 = [hw, -hh + d];
    const up = (q) => [q[0], q[1] - h];
    return P(`M${pt(L0)} L${pt(F0)} L${pt(up(F0))} L${pt(up(L0))} Z`, "side")
      + P(`M${pt(F0)} L${pt(R0)} L${pt(up(R0))} L${pt(up(F0))} Z`, "dark")
      + P(`M${pt(up(L0))} L${pt(up(F0))} L${pt(up(R0))}`, "mid");
  };
  // 차양 — 앞 처마에 매단 한 폭. 장시의 시대를 말한다
  const awning = (w) => {
    const p = fp(.2, w), q = fp(.8, w), h = 9;
    return P(`M${pt([p[0], p[1] - h])} L${pt([q[0], q[1] - h])} L${pt([q[0] - 4, q[1] - h + 5])} L${pt([p[0] - 4, p[1] - h + 5])} Z`, "side")
      + P(`M${pt([p[0] - 4, p[1] - h + 5])} L${pt([p[0] - 4, p[1] + 1])} M${pt([q[0] - 4, q[1] - h + 5])} L${pt([q[0] - 4, q[1] + 1])}`, "ink");
  };

  /* ── 집 — 시대 5~12 ───────────────────────────────────────────────────── */
  A.HOUSE[4] = (w) => shad(w) + box(16, w) + logWall(16, w)                       // 5 귀틀집
    + doorway(.42, .70, 8, w) + gable(16, 10, w, "thatch");
  A.HOUSE[5] = (w) => shad(w) + box(13, w) + planks(13, w)                        // 6 기와집 — 낮고 넓다
    + doorway(.40, .72, 8, w) + gable(13, 9, w, "tile");
  A.HOUSE[6] = (w) => shad(w * 1.1) + box(14, w) + planks(14, w)                  // 7 담 두른 집 — 마당이 생겼다
    + doorway(.40, .72, 8, w) + gable(14, 9, w, "tile") + yardWall(w);
  A.HOUSE[7] = (w) => {                                                           // 8 초가와 기와가 섞인 마을
    // ⚠ 처음에 초가 쪽을 귀틀집과 같은 벽으로 그렸더니 **시대 5와 한 획도 다르지 않았다.**
    //   여기 살림집은 판벽에 툇마루가 걸린다 — 마루가 이 시대의 실루엣이다
    const straw = Math.round(w * 100) % 2 === 0;
    return shad(w) + box(14, w) + planks(14, w)
      + doorway(.40, .72, 8, w) + gable(14, straw ? 10 : 9, w, straw ? "thatch" : "tile") + porch(w);
  };
  A.HOUSE[8] = (w) => {                                                           // 9 ㄱ자 한옥 — 꺾인 실루엣
    const hp = 3.4, wb = w * .8;
    return shad(w * 1.06) + G(0, box(hp, w))
      + G(-hp, box(15, wb) + posts(15, wb) + pane(.34, .70, 4, 11, wb, "dark") + gable(15, 9, wb, "tile"))
      + `<g transform="translate(${r(TW * w * .24)},${r(TH * w * .24 - hp)})">`
      + box(12, w * .58) + planks(12, w * .58) + gable(12, 7, w * .58, "tile") + `</g>`
      + chimney(-TW * w * .34, -TH * w * .34 - hp, 12);
  };
  A.HOUSE[9] = (w) => shad(w) + box(14, w) + logWall(14, w)                        // 10 차양 친 초가
    + doorway(.44, .72, 8, w) + gable(14, 10, w, "thatch") + awning(w);
  A.HOUSE[10] = (w) => shad(w) + box(15, w) + planks(15, w)                        // 11 함석집 — 유리창이 온다
    + pane(.18, .40, 5, 11, w, "dark") + pane(.52, .74, 5, 11, w, "dark")
    + gable(15, 6, w, "tin") + chimney(-TW * w * .3, -TH * w * .3, 10);
  A.HOUSE[11] = (w) => shad(w) + box(18, w)                                        // 12 양옥 — 평지붕에 난간
    + pane(.14, .44, 6, 13, w, "dark") + pane(.56, .86, 6, 13, w, "dark")
    + P(`M${pt(sp(.3, w))} L${pt([sp(.3, w)[0], sp(.3, w)[1] - 18])} M${pt(sp(.7, w))} L${pt([sp(.7, w)[0], sp(.7, w)[1] - 18])}`, "thin")
    + flatRoof(18, w);

  A.HOUSE_NAME[4] = "귀틀집"; A.HOUSE_NAME[5] = "기와집"; A.HOUSE_NAME[6] = "담 두른 기와집";
  A.HOUSE_NAME[7] = "초가와 기와"; A.HOUSE_NAME[8] = "한옥"; A.HOUSE_NAME[9] = "초가집";
  A.HOUSE_NAME[10] = "함석집"; A.HOUSE_NAME[11] = "양옥";

  /* ── 마을 한가운데 — 크기가 아니라 「무엇이 서 있느냐」로 세운다 ────────── */
  const CY = TH * CW / 2;

  A.HALL[4] = () => shad(CW) + yard + backRail(9)                                  // 5 우두머리의 집
    + G(seat(-CY - 3, 0, 1.5), box(5, 1.5))
    + G(seat(-CY - 3, 5, 1.3), box(18, 1.3) + logWall(18, 1.3) + doorway(.4, .72, 11, 1.3) + gable(18, 11, 1.3, "thatch"))
    // ⚠ 솟대를 62·56 으로 세웠더니 **장대가 지붕을 뚫고 올라가** 비계처럼 보였다.
    //   아이소메트릭에서는 가까운 것을 나중에 그려도 「높은 것」이 뒤엣것을 덮는다. 키를 낮추고 옆으로 물린다
    + wall(9) + gatepost(15)
    + sotdae(lerp(CL, CF, .3), 42) + sotdae(lerp(CR, CF, .3), 38);

  // 6·7·8 은 절이다. 기단이 두 단이고 앞마당에 탑이 선다 — 크기가 아니라 탑이 이 집을 세운다
  const temple = (tiers, tw) => shad(CW) + yard + backRail(9)
    + G(seat(-CY - 4, 0, 1.55), box(4, 1.55))
    + G(seat(-CY - 4, 4, 1.42), box(4, 1.42))
    + G(seat(-CY - 4, 8, 1.25), box(17, 1.25) + planks(17, 1.25) + doorway(.36, .74, 12, 1.25) + tiled(17, 11, 1.25))
    + wall(9) + gatepost(15)
    + `<g transform="translate(${pt(lerp(CF, CL, .42))})">${P(dia(0, 2, .5), "shadow")}${pagoda(tiers, 7, tw)}</g>`;

  A.HALL[5] = () => temple(3, 5.4);                                                // 6 절 — 석탑 하나
  A.HALL[6] = () => temple(3, 5.4)                                                 // 7 절 — 석등이 더 선다
    + `<g transform="translate(${pt(lerp(CF, CR, .42))})">${P(dia(0, 2, .42), "shadow")}${lantern(20)}</g>`;
  A.HALL[7] = () => temple(5, 5.0);                                                // 8 절 — 탑이 높아진다

  A.HALL[8] = () => {                                                              // 9 관아 — 솟을대문이 세운다
    const wb = 1.35;
    return shad(CW) + yard + backRail(10)
      + G(seat(-CY - 4, 0, 1.5), box(5, 1.5))
      + G(seat(-CY - 4, 5, wb), box(19, wb) + posts(19, wb) + pane(.34, .70, 5, 13, wb, "dark") + gable(19, 11, wb, "tile"))
      + wall(10)
      // 솟을대문 — 가운데 한 칸만 지붕이 솟는다. 조선 관아의 표시
      + `<g transform="translate(${pt(lerp(GL, GR, .5))})">${P("M-13,0 L-13,-15 L13,-15 L13,0", "ink")}`
      + P("M-15,-15 L15,-15 L15,-18 L-15,-18 Z", "side")
      + P("M-9,-18 L-9,-25 L9,-25 L9,-18 Z", "fillp") + P("M-12,-25 L12,-25 L9,-29 L-9,-29 Z", "roofd") + `</g>`;
  };

  A.HALL[9] = () => {                                                              // 10 장터와 주막
    const wb = 1.2;
    // 좌판 하나 — 다리 · 판 · 차양. ⚠ 선만으로 그렸더니 46px 마을에서 잡음이 됐다. 면으로 채운다
    const stall = (p, k) => `<g transform="translate(${pt(p)})">${P(dia(0, 1, .9), "shadow")}`
      + P("M-12,0 L-12,-6 M12,0 L12,-6", "ink")                       // 다리
      + P("M-14,-6 L14,-6 L14,-8 L-14,-8 Z", "fillp")                 // 좌판
      + P("M-11,-8 L-11,-15 M11,-8 L11,-15", "ink")                   // 차양 기둥
      + P(`M-15,-15 L15,-15 L${12 + k},-20 L${-12 + k},-20 Z`, "side") // 차양
      + P("M-8,-8 q3,-3 6,0 q3,-3 6,0", "thin") + `</g>`;
    return shad(CW) + yard + backRail(8)
      + G(seat(-CY - 2, 0, 1.4), box(4, 1.4))
      + G(seat(-CY - 2, 4, wb), box(15, wb) + logWall(15, wb) + doorway(.4, .72, 10, wb) + gable(15, 10, wb, "thatch"))
      + stall(lerp(CF, CL, .5), -2) + stall(lerp(CF, CR, .5), 2)
      // 주막 등 — 장대 끝에 매단 초롱 하나
      + `<g transform="translate(${pt(GL)})">${mast(30)}${P("M-4,-30 L4,-30 L3,-22 L-3,-22 Z", "fillp")}${P("M-3,-27 L3,-27", "thin")}</g>`;
  };

  A.HALL[10] = () => {                                                             // 11 학교 — 길고 낮은 벽돌 건물
    const wb = 1.75;
    let win = "";
    for (const t of [.14, .3, .46, .62, .78]) win += pane(t, t + .09, 5, 12, wb, "dark");
    return shad(CW) + yard + backRail(7)
      + G(seat(-CY - 3, 0, 1.85), box(3, 1.85))
      + G(seat(-CY - 3, 3, wb), box(16, wb) + win + planks(16, wb) + gable(16, 5, wb, "tin"))
      + P(`M${pt(lerp(CL, CF, .5))} L${pt(lerp(CR, CF, .5))}`, "mid")             // 운동장 앞 금
      + `<g transform="translate(${pt(lerp(CF, CR, .72))})">${mast(32)}</g>`;    // 깃대 — 깃발은 달지 않는다(어느 깃발이든 이 시대에서는 말을 얹는다)
  };

  A.HALL[11] = () => {                                                             // 12 학교 — 오늘의 것
    const wb = 1.8;
    let win = "";
    for (let row = 0; row < 3; row++) for (const t of [.12, .28, .44, .60, .76])
      win += pane(t, t + .1, 3 + row * 7, 8 + row * 7, wb, "dark");
    return shad(CW) + yard + backRail(6)
      + G(seat(-CY - 2, 0, 1.9), box(2, 1.9))
      + G(seat(-CY - 2, 2, wb), box(24, wb) + win + flatRoof(24, wb))
      + P(dia(0, 0, 1.3), "earth")                                                 // 운동장
      + `<g transform="translate(${pt(lerp(CF, CR, .55))})">${streetLamp(26)}</g>`;
  };

  A.HALL_NAME[4] = "우두머리의 집"; A.HALL_NAME[5] = "절"; A.HALL_NAME[6] = "절과 석등";
  A.HALL_NAME[7] = "절"; A.HALL_NAME[8] = "관아"; A.HALL_NAME[9] = "장터와 주막";
  A.HALL_NAME[10] = "학교"; A.HALL_NAME[11] = "학교";

  /* ── 세간 — 홀수 칸은 나무, 짝수 칸은 그 시대의 물건 ────────────────────── */
  const bugyeong = () => {                                                          // 부경 — 고구려의 다락 창고
    const w = .74, ph = 10;
    return shad(w) + stilts(ph, w) + G(-ph, box(8, w) + logWall(8, w) + gable(8, 6, w, "thatch"));
  };
  A.DETAIL[4] = (k) => k % 2 ? A.tree(1, k) : bugyeong();
  A.DETAIL[5] = (k) => k % 2 ? A.tree(1, k) : `${P(dia(0, 2, .7), "shadow")}${pagoda(3, 6, 4.4)}`;
  A.DETAIL[6] = (k) => k % 2 ? A.tree(1, k) : `${P(dia(0, 2, .6), "shadow")}${lantern(19)}`;
  A.DETAIL[7] = (k) => k % 2 ? A.tree(1, k) : A.MARK.kiln();                        // 청자 가마
  A.DETAIL[8] = (k) => k % 2 ? A.tree(1, k) : A.FAC.jars();                         // 장독대
  A.DETAIL[9] = (k) => k % 2 ? A.tree(1, k) : `${P(dia(0, 2, .5), "shadow")}${jangseung(15)}`;
  A.DETAIL[10] = (k) => k % 2 ? A.tree(1, k) : `${P(dia(0, 2, .4), "shadow")}${utilPole(30)}`;
  A.DETAIL[11] = (k) => k % 2 ? A.tree(1, k) : `${P(dia(0, 2, .4), "shadow")}${streetLamp(28)}`;

  A.DETAIL_NAME[4] = "부경(다락 창고)"; A.DETAIL_NAME[5] = "석탑"; A.DETAIL_NAME[6] = "석등";
  A.DETAIL_NAME[7] = "청자 가마"; A.DETAIL_NAME[8] = "장독대"; A.DETAIL_NAME[9] = "장승";
  A.DETAIL_NAME[10] = "전봇대"; A.DETAIL_NAME[11] = "가로등";

  /* ── 밭 ──────────────────────────────────────────────────────────────────
     시대 5 는 소가 간 굵은 고랑을 밭이랑에 더한다. 그 뒤는 시대 4의 논 그대로 —
     논은 천오백 년 동안 논이었다. */
  A.FIELD[4] = (k) => A.FIELD[2](k) + P("M-28,-13 L4,-29 M-22,-6 L10,-22", "mid");
  for (let e = 5; e <= 11; e++) A.FIELD[e] = (k) => A.FIELD[3](k);
  A.FIELD_NAME[4] = "소가 가는 밭";
  for (let e = 5; e <= 11; e++) A.FIELD_NAME[e] = "논";

  /* ── 사람 — 시대마다 다섯 가지 일 ────────────────────────────────────────
     뼈대를 새로 만들지 않는다. 있는 것을 골라 쓰고, 시대를 말하는 것만 새로 그린다. */
  const horse = A.BEAST[3].find(([n]) => n === "말")[1];

  W.ride = () => ({ move: 1, svg: sh(.5) + bod(horse())                             // 말 탄 사람 — 삼국은 기마의 시대
    + T(-1, -9.5, S(.82, P("M-.9,-5.6 L-3,-2.4 M.9,-5.6 L3,-2.4", "ink")
      + trunk() + P("M2.6,-10.6 L5.4,-8.4", "ink") + head())) });

  W.weave = () => ({ svg: sh(.34)                                                   // 베 짜는 사람 — 베틀 앞에 앉는다
    + P("M-8,0 L-8,-13 M8,-2 L8,-15 M-8,-13 L8,-15", "ink")
    + P("M-7,-8.5 L7,-10.5", "mid") + P("M-6,-5 L6,-7", "thin")
    + bod(crouch(P("M2,-8.9 L6.2,-7.4", "ink"))) });

  W.trade = () => ({ svg: T(-8, 0, sh(.28) + bod(crouch()))                         // 장수와 손님 — 좌판을 사이에 두고
    + P("M-4,-1 L-4,-6 L12,-6 L12,-1 Z", "side")
    + P("M-5,-6 L13,-6 L11,-9 L-3,-9 Z", "fillp")
    + M(14, sh(.28) + bod(stand() + trunk() + rest() + head(), 26)) });

  W.study = () => ({ move: 1, svg: sh() + bod(step() + trunk()                      // 책보 멘 아이
    + P("M-2.8,-12.4 q-5.6,.6 -5.2,3.8 q.4,3.2 5.2,2.8 Z", "dark")
    + P("M-7.6,-11 q2.6,-.5 4.6,-.2", "thin")
    + P("M2.5,-10.5 L4.4,-7.4", "ink") + head(.3)) });

  W.read = () => ({ svg: sh(.3) + bod(stand() + trunk()                             // 글 읽는 사람 — 책을 펴 든다
    + P("M-2.5,-10.5 L-5,-9 M2.5,-10.5 L5,-9", "ink") + head()
    + P("M-5.6,-9.6 L0,-8.2 L5.6,-9.6 L5.6,-7.4 L0,-6 L-5.6,-7.4 Z", "fillp")
    + P("M0,-8.2 L0,-6", "thin")) });

  W.play = (k) => (k % 2                                                            // 뛰노는 아이 둘
    ? { move: 1, svg: sh(.28) + bod(S(.86, step() + trunk() + P("M-2.5,-10.5 L-4.8,-13.4 M2.5,-10.5 L4.8,-13.4", "ink") + head())) }
    : { move: 1, svg: sh(.28) + bod(S(.86, step() + trunk() + rest() + head()), 22) });

  Object.assign(A.WORK_NAME, {
    ride: "말 탄 사람", weave: "베 짜는 사람", trade: "장을 보는 사람",
    study: "학교 가는 아이", read: "글 읽는 사람", play: "뛰노는 아이",
  });

  A.WORK[4] = ["ride", "farm", "walk", "cart", "draw"];        // 5 삼국 앞 — 말이 온다
  A.WORK[5] = ["ride", "farm", "walk", "carry", "pray"];       // 6 삼국 뒤 — 절이 선다
  A.WORK[6] = ["carry", "weave", "farm", "walk", "pray"];      // 7 남과 북
  A.WORK[7] = ["cart", "kiln", "farm", "walk", "weave"];       // 8 고려 — 가마와 베틀
  A.WORK[8] = ["jar", "read", "farm", "walk", "weave"];        // 9 조선의 아침 — 글 읽는 소리
  A.WORK[9] = ["carry", "trade", "walk", "cart", "pound"];     // 10 조선의 저녁 — 장이 선다
  A.WORK[10] = ["study", "carry", "walk", "cart", "farm"];     // 11 어둠과 횃불 — 학교에 간다
  A.WORK[11] = ["play", "study", "walk", "carry", "farm"];     // 12 오늘 — 아이가 뛰논다

  /* ── 짐승 ── 소·말·닭·개·돼지는 삼국부터 오늘까지 그대로 산다.
     ⚠ beastAt 이 4로 못 박혀 있어서 시대 5 위로는 짐승이 철기 마을에 남아 있었다(위에서 풀었다). */
  const beast = (n) => A.BEAST.flat().find((x) => Array.isArray(x) && x[0] === n);
  const row = ["소", "말", "닭", "개", "돼지"].map(beast).filter(Boolean);
  for (let e = 5; e <= 12; e++) A.BEAST[e - 1] = row;
})();
