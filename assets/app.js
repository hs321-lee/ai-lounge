"use strict";
const main = document.querySelector("main");
// Keep the native skip link within the active reading/presentation route.
document.querySelector(".skip")?.addEventListener("click", event => {
  event.preventDefault();
  main.focus();
  main.scrollIntoView({ behavior: "auto", block: "start" });
});
let issues = [];
let dailyReports = [];
const escape = value => String(value).replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));
const safeUrl = value => { try { const url = new URL(value); return url.protocol === "https:" ? escape(url.href) : "#"; } catch { return "#"; } };
let monthlyMotionCleanup = () => {};
function renderMedia(section, sectionIndex) {
  const list = section.media || [];
  if (!list.length) return "";
  return `<div class="scene-gallery count-${Math.min(list.length,3)}">${list.map((media,mediaIndex)=>`<figure class="story-media"><a class="story-media-open" href="${escape(media.src)}" data-media="${sectionIndex}-${mediaIndex}" target="_blank" rel="noopener" aria-label="${escape(media.alt)} · 크게 보기"><img src="${escape(media.src)}" width="${media.width}" height="${media.height}" alt="${escape(media.alt)}" loading="${sectionIndex<2 ? "eager" : "lazy"}" decoding="async"><span class="story-zoom-hint" aria-hidden="true">크게 보기 ↗</span></a><figcaption>${escape(media.caption)}</figcaption></figure>`).join("")}</div>`;
}
function renderScene(section, index) {
  const text = section.kind === "chapter"
    ? `<p class="chapter-part">${escape(section.part)}</p><h2>${escape(section.heading)}</h2><p class="scene-body">${escape(section.body)}</p><p class="chapter-meta">${section.date ? `<time datetime="${escape(section.date)}">${escape(section.date.replaceAll("-","."))}</time>` : ""}<a href="${safeUrl(section.url)}" target="_blank" rel="noopener">${section.part === "다음 소개" ? "홈페이지" : "원문"} 보기 ↗</a></p>`
    : `<h2>${escape(section.heading)}</h2>${section.body ? `<p class="scene-body">${escape(section.body)}</p>` : ""}
      ${section.stats ? `<ul class="scene-stats">${section.stats.map(stat=>`<li><strong>${escape(stat.value)}</strong><span>${escape(stat.label)}</span></li>`).join("")}</ul>` : ""}
      ${section.points ? `<ul class="scene-points">${section.points.map(point=>`<li>${escape(point)}</li>`).join("")}</ul>` : ""}
      ${section.steps ? `<ol class="scene-steps">${section.steps.map(step=>`<li>${escape(step)}</li>`).join("")}</ol>` : ""}
      ${section.code ? `<pre class="scene-code">${section.code.map(line=>`<span>$ </span>${escape(line)}`).join("\n")}</pre>` : ""}`;
  return `<section class="story-scene${section.kind === "chapter" ? " story-chapter" : ""}${section.media?.length ? " has-media" : ""}" id="scene-${index}" data-scene aria-label="${escape(section.part ? `${section.part} · ${section.heading}` : section.heading)}"><div class="scene-grid"><div class="scene-text">${text}</div>${renderMedia(section,index)}</div></section>`;
}
function renderIssue(issue) {
  document.title = `${issue.title} — AI 라운지`;
  const chapters = issue.sections.map((section,index)=>({ section, index })).filter(item=>item.section.kind === "chapter");
  main.innerHTML = `<div class="monthly-story"><section class="story-scene story-cover" data-scene aria-label="표지"><p class="story-edition">${escape(issue.date.slice(0,7).replace("-","."))} · 월간 AI 라운지</p><h1>${escape(issue.title)}</h1><p class="story-deck">${escape(issue.summary)}</p>
  ${chapters.length ? `<ol class="story-chapters">${chapters.map(({section,index})=>`<li><span class="chapter-part">${escape(section.part)}</span><strong>${escape(section.heading)}</strong><span class="chapter-actions"><button type="button" class="story-jump" data-jump="${index}">바로 가기</button><a href="${safeUrl(section.url)}" target="_blank" rel="noopener">${section.part === "다음 소개" ? "홈페이지" : "원문"} ↗</a></span></li>`).join("")}</ol>` : ""}
  <p class="story-hint">발표할 때는 <kbd>→</kbd> <kbd>←</kbd> 키로 장면을 넘기고, 화면을 누르면 크게 봅니다.</p></section>
  <div class="story-progress" aria-hidden="true"><span></span></div>
  ${issue.sections.map(renderScene).join("")}
  <section class="story-sources"><h2>출처</h2>${issue.sourceNote ? `<p>${escape(issue.sourceNote)}</p>` : ""}<ul>${issue.sources.map(source=>`<li><a href="${safeUrl(source.url)}" target="_blank" rel="noopener">${escape(source.title)} ↗</a></li>`).join("")}</ul></section>
  <dialog class="story-viewer" aria-labelledby="screen-viewer-title"><div class="story-viewer-bar"><h2 id="screen-viewer-title">화면 크게 보기</h2><button type="button" data-viewer-close autofocus>닫기 ×</button></div><img class="story-viewer-image" alt=""></dialog>
  ${issues.length > 1 ? `<section class="monthly-archive"><h2>다른 월간 소개</h2>${issues.filter(item=>item.id!==issue.id).map(item=>`<p><a href="#post/${encodeURIComponent(item.id)}">${escape(item.title)} →</a></p>`).join("")}</section>` : ""}</div>`;
  const disposeMotion = window.MonthlyMotion?.mount(main) || (() => {});
  const disposeMedia = window.MonthlyMedia?.mount(main, issue.sections) || (() => {});
  monthlyMotionCleanup = () => { disposeMedia(); disposeMotion(); };
}
function setView(monthly) {
  document.body.classList.toggle("monthly-view", monthly);
  const target = monthly ? "monthly" : "home";
  document.querySelector(".brand").href = `#${target}`;
  document.querySelector("nav").innerHTML = `<a href="#${target}" aria-current="page">${monthly ? "월간 소개" : "데일리 읽기"}</a>`;
  document.querySelector("footer").innerHTML = monthly
    ? '<span><strong>AI 라운지</strong> · 한 달에 한 번, 쓸 만한 경험을 나눕니다.</span><span>나는 이렇게 쓴다.</span>'
    : '<span><strong>AI 라운지</strong> · 매일 읽고, 쓸 만한 내용을 쌓습니다.</span>';
}
function renderDaily(report) {
  document.title = "나의 AI 데일리 — AI 라운지";
  main.innerHTML = `<header class="daily-heading"><p class="eyebrow">MY DAILY AI</p><h1>나의 AI 데일리</h1><p>아침 브리핑의 AI 소식을, 여기서 바로 읽습니다.</p></header>
    ${report ? `<article class="daily-reading"><header><time datetime="${escape(report.date)}">${escape(report.date.replaceAll("-","."))}</time><h2>${escape(report.title)}</h2><p class="summary">${escape(report.summary)}</p></header>
    ${report.sections.map(section=>`<section><h3>${escape(section.heading)}</h3><p>${escape(section.body)}</p></section>`).join("")}
    <section class="daily-sources"><h3>원문과 참고 자료</h3><ul>${report.sources.map(source=>`<li><a href="${safeUrl(source.url)}">${escape(source.title)} ↗</a></li>`).join("")}</ul></section></article>` : '<section class="empty"><h2>아직 쌓인 데일리 기록이 없어요.</h2><p>다음 아침 브리핑의 AI 소식부터 이곳에서 바로 읽을 수 있도록 채워갑니다.</p></section>'}
    ${dailyReports.length > 1 ? `<section class="daily-history"><label for="report-date">지난 브리핑 읽기</label><select id="report-date">${dailyReports.map(item=>`<option value="${escape(item.id)}"${item.id===report?.id ? " selected" : ""}>${escape(item.date)} · ${escape(item.title)}</option>`).join("")}</select></section>` : ""}`;
  document.querySelector("#report-date")?.addEventListener("change",event=>{location.hash=`post/${encodeURIComponent(event.target.value)}`;});
}
function route() {
  monthlyMotionCleanup();
  monthlyMotionCleanup = () => {};
  const hash = location.hash.slice(1) || "home";
  let selected;
  if (hash.startsWith("post/")) {
    try { const id=decodeURIComponent(hash.slice(5)); selected=issues.find(item=>item.id===id)||dailyReports.find(item=>item.id===id); } catch {}
  }
  const monthly = hash === "monthly" || selected?.type === "monthly";
  setView(monthly);
  if (monthly) {
    const issue=selected||issues[0];
    if (issue) renderIssue(issue);
    else main.innerHTML='<section class="page-heading"><p class="eyebrow">MONTHLY AI LOUNGE</p><h1>첫 월간 소개를 준비하고 있어요.</h1><p class="lede">함께 나누고 싶은 사용 경험과 작은 팁을 골라 곧 소개하겠습니다.</p></section>';
  } else renderDaily(selected||dailyReports[0]);
}
fetch("data/posts.json", { cache: "no-cache" }).then(response=>{if(!response.ok) throw new Error("Content unavailable");return response.json();}).then(data=>{
  // Daily reading and monthly presentations are independent views, sharing one content source.
  issues = data.posts.filter(post=>post.type==="monthly").sort((a,b)=>b.date.localeCompare(a.date));
  dailyReports = data.posts.filter(post=>post.type==="daily").sort((a,b)=>b.date.localeCompare(a.date));
  route();
  window.addEventListener("hashchange",()=>{route();main.focus();window.scrollTo(0,0);});
}).catch(()=>{
  main.innerHTML='<section class="page-heading"><h1>기록을 불러오지 못했어요.</h1><p>연결을 확인하고 페이지를 새로고침해 주세요.</p><button class="button" id="retry">다시 불러오기</button></section>';
  document.querySelector("#retry").addEventListener("click",()=>location.reload());
});
