// products.js: MattoLAB이 만든 것들과 연락처. **여기가 원본이다.**
//
// 새 제품이 생기면 이 배열에 한 줄만 넣고 각 사이트에서 `node ../mattolab-brand/sync.mjs .`
// 를 돌린다. 푸터 격자는 2행을 유지한 채 오른쪽으로 자란다(6개면 3열, 12개면 6열).
//
// name은 각 사이트의 SITE_NAME과 글자까지 같아야 한다. 그래야 "지금 보고 있는 제품"을
// 알아내 코랄로 칠하고 자기 자신으로 가는 링크를 빼 준다.
// desc는 짧게: 이름만으론 "쫑알쫑알"이 뭔지 아무도 모른다.

export const PRODUCTS = [
  {
    name: "매일 읽는 고전",
    desc: "초등 5·6학년 · 평일 연재",
    url: "https://classics.matto.kr/",
  },
  {
    name: "마또의 아침신문",
    desc: "초등 1~6학년 · 평일 연재",
    url: "https://news.matto.kr/",
  },
  {
    name: "이야기 한국사",
    desc: "초등 5·6학년 · 하루 두 편",
    url: "https://history.matto.kr/",
  },
];

export const LAB_TAGLINE = "선생님이 만드는 교실 도구";

// website가 null이면 링크 대신 "준비 중이에요"가 옅게 뜬다. (2026-09-10 matto.kr 개설)
export const CONTACT = {
  email: "wodb0410@gmail.com",
  instagram: "Matto__lab",
  indischool: "Matto",   // 링크 없이 이름만 (인디스쿨은 로그인해야 보이는 데가 많다)
  website: "https://matto.kr/",
};
