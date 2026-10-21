"use strict";
const main = document.querySelector("main");
const repo = "https://github.com/hs321-lee/ai-lounge";
let posts = [];
const types = {guide: "시작 가이드", monthly: "월간 공유", daily: "데일리 리포트"};
const escape = value => String(value).replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));
const safeUrl = value => { try { const url = new URL(value); return url.protocol === "https:" ? escape(url.href) : "#"; } catch { return "#"; } };
const formatDate = value => value.replaceAll("-", ".");
const meta = post => `<div class="meta"><span class="badge">${types[post.type]}</span><time datetime="${escape(post.date)}">${formatDate(post.date)}</time><span>${escape(post.author)}</span></div>`;
const card = post => `<article class="note">${meta(post)}<h3><a href="#post/${encodeURIComponent(post.id)}">${escape(post.title)} ↗</a></h3><p>${escape(post.summary)}</p><div class="meta">${post.tags.map(tag=>`<span>#${escape(tag)}</span>`).join("")}</div></article>`;
const empty = (type, filtered=false) => filtered ? `<div class="empty"><h3>조건에 맞는 기록이 없어요.</h3><p>다른 검색어나 주제로 다시 찾아보세요.</p><button class="button secondary" id="reset-search">검색 초기화</button></div>` : `<div class="empty"><h3>${type === "monthly" ? "첫 번째 월간 공유를 준비하고 있어요." : "아직 발행된 데일리 리포트가 없어요."}</h3><p>${type === "monthly" ? "직접 써본 사례와 소개할 소식을 모아 첫 호를 채워갑니다." : "기존 아침 브리핑의 AI 소식을 날짜와 원문 출처를 붙여 쌓을 공간입니다."}</p><a href="${repo}/blob/main/templates/${type}.json">작성 양식 살펴보기 ↗</a></div>`;
function home() {
 const monthly = posts.filter(p=>p.type === "monthly"), daily = posts.filter(p=>p.type === "daily");
 const recent = posts.slice(0,3);
 main.innerHTML = `<section class="hero"><div><p class="eyebrow">A SMALL PLACE FOR SHARED DISCOVERY</p><h1>AI 소식부터,<br><em>나는 이렇게 쓴다</em>까지.</h1><p class="lede">새로운 도구를 쫓기보다, 우리 일에 쓸 만한 것을 찾습니다.<br>매일 모으고, 매달 고르고, 직접 써본 경험을 나눕니다.</p><div class="hero-actions"><a class="button" href="#monthly">월간 공유 보기 <span aria-hidden="true">→</span></a><a class="button secondary" href="#daily">데일리 리포트</a></div></div><aside class="issue" aria-label="첫 월간 공유 준비"><p class="eyebrow">MONTHLY LOUNGE</p><span class="issue-number" aria-hidden="true">01</span><h2>첫 모임의 주제는<br>‘나는 이렇게 쓴다’</h2><p>작은 사용 팁 하나, 직접 해본 사례 하나.<br>거창한 발표보다 바로 따라 할 수 있는 경험으로.</p><div class="issue-line"><span>첫 호 준비 중</span><a href="#post/welcome">어떻게 나누나요? ↗</a></div></aside></section>
 <section class="status-strip" aria-label="발행 현황"><div class="stat"><strong>월간 ${monthly.length}호</strong><span>발행된 월간 공유</span></div><div class="stat"><strong>데일리 ${daily.length}건</strong><span>발행된 리포트</span></div><div class="stat"><strong>함께 시작해요</strong><span>작은 사용 경험부터</span></div></section>
 <div class="content-grid"><section><div class="section-title"><h2>최근 올라온 기록</h2><a href="${repo}/blob/main/README.md">작성 안내 ↗</a></div>${recent.map(card).join("")}</section><aside><div class="section-title"><h2>다음 공유, 이렇게</h2></div><div class="aside-note"><h3>딱 세 가지만 가져오세요.</h3><ol><li><strong>어떤 일이었나요?</strong><br>반복되거나 막혔던 상황.</li><li><strong>어떻게 썼나요?</strong><br>쓴 도구와 실제 프롬프트.</li><li><strong>무엇이 달라졌나요?</strong><br>좋았던 점, 아쉬웠던 점.</li></ol><a href="${repo}/blob/main/templates/monthly.json">월간 공유 양식 열기 ↗</a></div></aside></div>
 <section class="flow" aria-label="라운지 운영 흐름"><div><small>01 / COLLECT</small><br><strong>매일, 눈여겨볼 변화</strong><p>출처를 붙여 모으는 데일리 리포트.<br>${daily.length ? `브리핑 AI 소식 ${daily.length}건 발행` : "기존 브리핑 연계 · 첫 발행 대기"}</p></div><div><small>02 / CURATE</small><br><strong>매달, 소개할 것만</strong><p>함께 알아두면 좋을 소식과 팁을<br>추려서 월간 공유로 정리합니다.</p></div><div><small>03 / SHARE</small><br><strong>직접 써본 경험</strong><p>상황, 사용 방법, 결과를 기록해<br>다음 사람이 따라 해보게 합니다.</p></div></section>`;
}
function listing(type) {
 const list = posts.filter(post=>post.type === type);
 main.innerHTML = `<header class="page-heading"><p class="eyebrow">${type === "monthly" ? "CURATED ONCE A MONTH" : "COLLECTED DAY BY DAY"}</p><h1>${types[type]}</h1><p class="lede">${type === "monthly" ? "한 달의 변화 중 소개할 것만. 직접 써본 경험과 함께 나눕니다." : "AI 도구와 활용의 변화를 출처와 함께 쌓습니다."}</p></header><div class="content-grid"><section><div class="toolbar"><div class="field"><label for="search">기록 검색</label><input type="search" id="search" placeholder="제목, 내용, 태그로 찾기" autocomplete="off"></div><div class="field small"><label for="topic">주제</label><select id="topic"><option value="">모든 주제</option>${[...new Set(list.flatMap(p=>p.tags))].sort().map(tag=>`<option value="${escape(tag)}">${escape(tag)}</option>`).join("")}</select></div></div><p class="result-count" id="count" role="status" aria-live="polite"></p><div id="results"></div></section><aside class="aside-note"><h3>${type === "monthly" ? "월간 공유에 담을 것" : "데일리 리포트 운영"}</h3><p>${type === "monthly" ? "주목할 변화 · 나는 이렇게 쓴다 · 바로 써볼 작은 팁. 소식의 원문 링크와 실제 사용의 맥락을 함께 남깁니다." : "기존 아침 브리핑의 AI 부분을 모읍니다. 발행 날짜, 원문 출처, 한 줄 의미를 갖춘 기록으로 쌓습니다."}</p><a href="${repo}/blob/main/templates/${type}.json">작성 양식 열기 ↗</a></aside></div>`;
 const search = document.querySelector("#search"), topic = document.querySelector("#topic");
 const update = () => {
  const query = search.value.trim().toLocaleLowerCase("ko");
  const matches = list.filter(p=>(!topic.value || p.tags.includes(topic.value)) && [p.title,p.summary,p.author,...p.tags,...p.sections.flatMap(s=>[s.heading,s.body])].join(" ").toLocaleLowerCase("ko").includes(query));
  document.querySelector("#count").textContent = `총 ${list.length}건 · 검색 결과 ${matches.length}건`;
  document.querySelector("#results").innerHTML = matches.length ? matches.map(card).join("") : empty(type, list.length > 0);
  document.querySelector("#reset-search")?.addEventListener("click",()=>{search.value="";topic.value="";update();search.focus();});
 };
 search.addEventListener("input",update); topic.addEventListener("change",update); update();
}
function article(id) {
 const post = posts.find(p=>p.id === id);
 if (!post) { main.innerHTML = '<section class="page-heading"><h1>기록을 찾을 수 없어요.</h1><p>주소가 바뀌었거나 아직 발행되지 않은 기록입니다.</p><a href="#home">대시보드로 돌아가기 →</a></section>'; return; }
 main.innerHTML = `<article class="article"><a class="back" href="#${post.type === "guide" ? "home" : post.type}">← ${post.type === "guide" ? "대시보드" : types[post.type]}</a><h1>${escape(post.title)}</h1>${meta(post)}<p class="summary">${escape(post.summary)}</p>${post.sections.map(s=>`<section><h2>${escape(s.heading)}</h2><p>${escape(s.body)}</p></section>`).join("")}${post.sources.length ? `<section><h2>원문과 참고 자료</h2><ul>${post.sources.map(s=>`<li><a href="${safeUrl(s.url)}">${escape(s.title)} ↗</a></li>`).join("")}</ul></section>` : ""}</article>`;
 document.title = `${post.title} — AI 라운지`;
}
function route() {
 const hash = location.hash.slice(1) || "home";
 document.title = "AI 라운지 — AI를 쓰는 우리의 기록";
 document.querySelectorAll("nav a").forEach(a=>{ if (a.hash === `#${hash}`) a.setAttribute("aria-current","page"); else a.removeAttribute("aria-current"); });
 if (hash === "home") home();
 else if (["monthly","daily"].includes(hash)) listing(hash);
 else if (hash.startsWith("post/")) { try { article(decodeURIComponent(hash.slice(5))); } catch { article(""); } }
 else main.innerHTML = '<section class="page-heading"><h1>페이지를 찾을 수 없어요.</h1><a href="#home">대시보드로 돌아가기 →</a></section>';
}
fetch("data/posts.json").then(response=>{if (!response.ok) throw new Error("Content unavailable");return response.json();}).then(data=>{posts=data.posts.sort((a,b)=>b.date.localeCompare(a.date));route();window.addEventListener("hashchange",()=>{route();main.focus();window.scrollTo(0,0);});}).catch(()=>{main.innerHTML='<section class="page-heading"><h1>기록을 불러오지 못했어요.</h1><p>연결을 확인하고 페이지를 새로고침해 주세요. 파일을 직접 열었다면 로컬 서버로 실행해 주세요.</p><button class="button" onclick="location.reload()">다시 불러오기</button></section>';});
