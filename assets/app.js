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
let guides = [];
// Display labels are kept here; route IDs stay stable for shared links.
const navigationLabels = Object.freeze({ home: "홈", daily: "AI 소식", library: "인사이트", monthly: "함께 보기" });
const escape = value => String(value).replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));
const safeUrl = value => { try { const url = new URL(value); return url.protocol === "https:" ? escape(url.href) : "#"; } catch { return "#"; } };
let monthlyMotionCleanup = () => {};
let editorialMotionCleanup = () => {};
function renderMedia(section, sectionIndex) {
  const list = section.media || [];
  if (!list.length) return "";
  const gallery = `<div class="scene-gallery count-${Math.min(list.length,3)}">${list.map((media,mediaIndex)=>`<figure class="story-media"><a class="story-media-open" href="${escape(media.src)}" data-media="${sectionIndex}-${mediaIndex}" target="_blank" rel="noopener" aria-label="${escape(media.alt)} · 크게 보기"><img src="${escape(media.src)}" width="${media.width}" height="${media.height}" alt="${escape(media.alt)}" loading="${sectionIndex<2 ? "eager" : "lazy"}" decoding="async"><span class="story-zoom-hint" aria-hidden="true">크게 보기 ↗</span></a><figcaption>${escape(media.caption)}</figcaption></figure>`).join("")}</div>`;
  return list.some(media => media.src === "assets/dental/p2-poster.webp") ? `<details class="original-poster"><summary>원문 패러디 포스터 보기</summary>${gallery}</details>` : gallery;
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
function monthlyIssueLink(issue) {
  const month = issue.date.slice(0, 7);
  return issues.filter(item => item.date.startsWith(month)).length > 1
    ? `#post/${encodeURIComponent(issue.id)}` : `#monthly/${month}`;
}
function renderMonthlyArchive() {
  document.title = `${navigationLabels.monthly} — AI 라운지`;
  const years = [...new Set(issues.map(issue => issue.date.slice(0, 4)))];
  main.innerHTML = `<div class="monthly-index"><header class="editorial-masthead"><h1>${escape(navigationLabels.monthly)}</h1><p>함께 본 자료를 월별로 쌓습니다.<br>원하는 달을 골라 발표 자료와 원문을 다시 살펴보세요.</p></header>${years.map(year=>`<section class="monthly-year" aria-labelledby="monthly-year-${year}"><h2 id="monthly-year-${year}">${escape(year)}년</h2><div class="monthly-entry-list">${issues.filter(issue=>issue.date.startsWith(year)).map(issue=>{
    const preview = issue.sections.flatMap(section=>section.media || [])[0];
    const url = monthlyIssueLink(issue);
    const chapters = issue.sections.filter(section=>section.kind === "chapter");
    return `<article class="monthly-entry${preview ? " has-preview" : ""}">${preview ? `<figure><a href="${url}" aria-label="${escape(issue.date.slice(0,7))} 월간 자료 보기"><img src="${escape(preview.src)}" width="${preview.width}" height="${preview.height}" alt="${escape(preview.alt)}" loading="lazy" decoding="async"></a></figure>` : ""}<div class="monthly-entry-text"><time datetime="${escape(issue.date.slice(0,7))}">${escape(issue.date.slice(0,7).replace("-","."))}</time><h3><a href="${url}">${escape(issue.title)}</a></h3><p>${escape(issue.summary)}</p>${chapters.length ? `<p class="monthly-entry-topics">${chapters.map(section=>escape(section.part)).join(" · ")}</p>` : ""}<a class="editorial-read" href="${url}">발표 자료 보기 <span aria-hidden="true">↗</span></a></div></article>`;
  }).join("")}</div></section>`).join("") || '<section class="empty"><h2>첫 월간 자료를 준비하고 있습니다.</h2><p>발행한 월의 자료를 이곳에 모읍니다.</p></section>'}</div>`;
  main.querySelectorAll(".monthly-entry img").forEach(image=>{
    const hideBrokenPreview = () => { image.closest("figure").hidden = true; image.closest(".monthly-entry").classList.remove("has-preview"); };
    image.addEventListener("error", hideBrokenPreview, { once: true });
    if (image.complete && !image.naturalWidth) hideBrokenPreview();
  });
}
function renderMissingMonth() {
  document.title = `${navigationLabels.monthly} 자료 안내 — AI 라운지`;
  main.innerHTML = `<section class="page-heading"><h1>해당 월의 자료가 없습니다.</h1><p class="lede">발행한 월을 목록에서 다시 골라 주세요.</p><a class="editorial-read" href="#monthly">${escape(navigationLabels.monthly)} 목록으로 →</a></section>`;
}
function renderIssue(issue) {
  document.title = `${issue.title} — AI 라운지`;
  const chapters = issue.sections.map((section,index)=>({ section, index })).filter(item=>item.section.kind === "chapter");
  main.innerHTML = `<div class="monthly-detail-nav"><a href="#monthly">← ${escape(navigationLabels.monthly)} 목록</a><time datetime="${escape(issue.date.slice(0,7))}">${escape(issue.date.slice(0,7).replace("-","."))}</time></div><div class="monthly-story"><section class="story-scene story-cover" data-scene aria-label="표지"><p class="story-edition">${escape(issue.date.slice(0,7).replace("-","."))} · ${escape(navigationLabels.monthly)} · AI 라운지</p><h1>${escape(issue.title)}</h1><p class="story-deck">${escape(issue.summary)}</p><p class="monthly-public-note">PUBLIC CASE STUDY · 본문의 경험은 원문 작성자의 공개 보고입니다.</p>
  ${chapters.length ? `<ol class="story-chapters">${chapters.map(({section,index})=>`<li><span class="chapter-part">${escape(section.part)}</span><strong>${escape(section.heading)}</strong><span class="chapter-actions"><button type="button" class="story-jump" data-jump="${index}">바로 가기</button><a href="${safeUrl(section.url)}" target="_blank" rel="noopener">${section.part === "다음 소개" ? "홈페이지" : "원문"} ↗</a></span></li>`).join("")}</ol>` : ""}
  <p class="story-hint">발표할 때는 <kbd>→</kbd> <kbd>←</kbd> 키로 장면을 넘기고, 화면을 누르면 크게 봅니다.</p></section>
  <div class="story-progress" aria-hidden="true"><span></span></div>
  ${issue.sections.map(renderScene).join("")}
  <section class="story-sources"><h2>출처</h2>${issue.sourceNote ? `<p>${escape(issue.sourceNote)}</p>` : ""}<ul>${issue.sources.map(source=>`<li><a href="${safeUrl(source.url)}" target="_blank" rel="noopener">${escape(source.title)} ↗</a></li>`).join("")}</ul></section>
  <dialog class="story-viewer" aria-labelledby="screen-viewer-title"><div class="story-viewer-bar"><h2 id="screen-viewer-title">화면 크게 보기</h2><button type="button" data-viewer-close autofocus>닫기 ×</button></div><img class="story-viewer-image" alt=""></dialog>
  ${issues.length > 1 ? `<section class="monthly-archive"><h2>다른 달의 자료</h2>${issues.filter(item=>item.id!==issue.id).map(item=>`<p><a href="${monthlyIssueLink(item)}">${escape(item.title)} →</a></p>`).join("")}</section>` : ""}</div>`;
  const disposeMotion = window.MonthlyMotion?.mount(main) || (() => {});
  const disposeMedia = window.MonthlyMedia?.mount(main, issue.sections) || (() => {});
  monthlyMotionCleanup = () => { disposeMedia(); disposeMotion(); };
}
function setView(view, presentation = false) {
  document.body.classList.toggle("monthly-view", presentation);
  document.body.classList.toggle("monthly-archive-view", view === "monthly" && !presentation);
  document.body.classList.toggle("home-view", view === "home");
  document.querySelector(".brand").href = "#home";
  document.querySelector(".site-header nav").innerHTML = Object.entries(navigationLabels)
    .map(([id, label]) => `<a href="#${id}"${view === id ? ' aria-current="page"' : ""}>${label}</a>`).join("");
  document.querySelector("footer").innerHTML = '<span><strong>AI 라운지</strong> · 공개 자료를 읽고 정리하는 개인 프로젝트</span><span>원문 · 직접 작성한 요약 · AI 생성 삽화</span>';
}
function renderHome() {
  document.title = "AI 라운지 — 읽고, 이해하고, 써보는 AI";
  const feature = guides.find(guide => guide.id === "ai2027-delegation-2026-10-29");
  const daily = dailyReports[0];
  const issue = issues[0];
  const cover = daily?.coverImage;
  const hasCover = cover && cover.date === daily.date && cover.src === `assets/daily/${daily.date}.webp`;
  main.innerHTML = `<div class="editorial-lounge lounge-home"><header class="lounge-intro" data-reveal><p class="eyebrow">A PERSONAL AI JOURNAL</p><p>읽고, 이해하고, 써보는 AI.<br>공개 자료에서 발견한 관점을 그림과 글로 남깁니다.</p></header>
    ${feature ? `<section class="home-feature" aria-labelledby="home-feature-title"><div class="home-feature-copy" data-reveal><p class="editorial-story-meta"><span>이번에 함께 읽을 자료</span><time datetime="${escape(feature.sourceMonth || feature.date)}">${escape((feature.sourceMonth || feature.date).replaceAll("-", "."))}</time></p><p class="home-feature-byline">김덕진 · AI 2027 강연</p><h1 id="home-feature-title">AI에 맡기고,<br>핵심은 이해하기</h1><p class="home-feature-deck">AI에 무엇을 맡기고, 사람은 무엇을 이해해야 할까요?<br>공개 강연에서 고른 세 가지 관점으로 읽습니다.</p><ol class="home-feature-points">${feature.highlights.map((point,index)=>`<li><span>${String(index+1).padStart(2,"0")}</span>${escape(point)}</li>`).join("")}</ol><div class="source-story-actions"><a class="signature-button" href="#post/${encodeURIComponent(feature.id)}">핵심 요약 읽기 <span aria-hidden="true">↗</span></a><a class="source-original-link" href="${safeUrl(feature.sources[0]?.url)}" target="_blank" rel="noopener">강연 원문 보기 ↗</a></div><p class="home-feature-credit">원자료 · 김덕진, 2026.10.28 교보문고 강연<br>대표 표지 · 원자료의 실제 첫 장 축소본</p></div><div class="home-feature-art" data-reveal>${renderSourcePreview(feature,true)}</div></section>` : '<header class="editorial-masthead"><h1>AI 라운지</h1><p>첫 인사이트를 준비하고 있습니다.</p></header>'}
    <section class="home-daily" aria-labelledby="home-daily-title" data-reveal><div class="home-section-heading"><div><p class="eyebrow">${escape(navigationLabels.daily)}</p><h2 id="home-daily-title">오늘의 AI, 한 장으로.</h2></div><a href="#daily">지난 ${escape(navigationLabels.daily)}까지 보기 →</a></div>
    ${daily ? `<article class="home-daily-feature${hasCover ? " has-cover" : ""}">${hasCover ? `<a class="home-daily-art" href="#post/${encodeURIComponent(daily.id)}" aria-label="${escape(daily.title)} · 데일리 읽기"><img src="${escape(cover.src)}" alt="${escape(cover.alt)}" width="${cover.width}" height="${cover.height}" loading="lazy" decoding="async"></a>` : ""}<div class="home-daily-text"><p class="editorial-story-meta"><span>${escape(navigationLabels.daily)}</span><time datetime="${escape(daily.date)}">${escape(daily.date.replaceAll("-", "."))}</time></p><h3><a href="#post/${encodeURIComponent(daily.id)}">${escape(daily.title)}</a></h3><p>${escape(daily.summary)}</p><a class="editorial-read" href="#post/${encodeURIComponent(daily.id)}">그림과 함께 읽기 <span aria-hidden="true">↗</span></a><p class="home-small-note">날짜별 원문과 요약을 함께 보관합니다.</p></div></article>` : '<p class="empty">첫 AI 소식을 준비하고 있습니다.</p>'}</section>
    <section class="home-insights" aria-labelledby="home-insights-title"><div class="home-section-heading" data-reveal><div><p class="eyebrow">MORE TO READ</p><h2 id="home-insights-title">다른 관점도 펼쳐보세요.</h2></div><a href="#library">인사이트 모두 보기 →</a></div><div class="home-insight-list">${guides.filter(guide=>guide.id!==feature?.id).slice(0,2).map(guide=>`<article class="home-insight" data-reveal>${renderSourcePreview(guide)}<div class="home-insight-copy"><p class="editorial-story-meta"><span>${escape(guide.sourceLabel || "공개 자료")}</span></p><h3><a href="#post/${encodeURIComponent(guide.id)}">${escape(guide.title)}</a></h3><p>${escape(guide.highlights?.[0] || guide.summary)}</p><a class="editorial-read" href="#post/${encodeURIComponent(guide.id)}">핵심 세 가지 <span aria-hidden="true">↗</span></a></div></article>`).join("")}</div></section>
    <section class="home-monthly" aria-labelledby="home-monthly-title" data-reveal><div><p class="eyebrow">${escape(navigationLabels.monthly)}${issue ? ` · ${escape(issue.date.slice(0,7).replace("-", "."))}` : ""}</p><h2 id="home-monthly-title">${issue ? escape(issue.title) : "한 달의 자료를 함께 읽습니다"}</h2><p>${issue ? escape(issue.summary) : "첫 월간 소개를 준비하고 있습니다."}</p></div><a href="#monthly">${escape(navigationLabels.monthly)} 목록 <span aria-hidden="true">↗</span></a></section><div class="editorial-close"><p>AI 라운지</p><span>공개 자료를 읽고 정리하는 개인 프로젝트입니다.<br>원문, 직접 작성한 요약, AI 생성 삽화를 구분해 표시합니다.</span></div></div>`;
  bindGuideNoteErrors();
  bindSourcePreviewErrors();
  const dailyImage = main.querySelector(".home-daily-art img");
  if (dailyImage) {
    const hideBrokenCover = () => { dailyImage.closest("a").hidden = true; dailyImage.closest("article").classList.remove("has-cover"); };
    dailyImage.addEventListener("error", hideBrokenCover, { once: true });
    if (dailyImage.complete && !dailyImage.naturalWidth) hideBrokenCover();
  }
}
function mountEditorialMotion() {
  const preference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  if (preference?.matches || !("IntersectionObserver" in window)) return () => {};
  const animations = new Set();
  let observer;
  try {
    observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      if (preference?.matches || typeof entry.target.animate !== "function") return;
      try {
        const animation = entry.target.animate([{opacity:0,transform:"translateY(22px)"},{opacity:1,transform:"none"}], {duration:650,easing:"cubic-bezier(.16,1,.3,1)"});
        animations.add(animation);
        animation.onfinish = animation.oncancel = () => animations.delete(animation);
      } catch { /* Progressive enhancement: content remains visible. */ }
    }), {rootMargin:"0px 0px -5% 0px",threshold:.04});
    main.querySelectorAll("[data-reveal]").forEach(element=>observer.observe(element));
  } catch { observer?.disconnect(); return () => {}; }
  const stop = () => { observer.disconnect(); animations.forEach(animation=>animation.cancel()); animations.clear(); };
  preference?.addEventListener?.("change",stop);
  return () => { stop(); preference?.removeEventListener?.("change",stop); };
}
function renderInsight(section, index) {
  const number = String(index + 1).padStart(2, "0");
  const fullText = section.summary ? `<details class="daily-details"><summary>상세 내용 · 적용 방법</summary><p class="insight-body">${escape(section.body)}</p>${section.takeaway ? `<div class="insight-takeaway"><strong>해석</strong><p>${escape(section.takeaway)}</p></div>` : ""}${section.action ? `<div class="insight-action"><strong>써볼 지점</strong><p>${escape(section.action)}</p></div>` : ""}</details>` : "";
  return `<section class="insight daily-item" id="daily-insight-${index}" tabindex="-1"><div class="insight-meta"><span class="item-number">${number}</span><span>${escape(section.label || "AI 인사이트")}</span>${section.date ? `<time datetime="${escape(section.date)}">${escape(section.date)}</time>` : ""}</div><h3>${escape(section.heading)}</h3><p class="insight-body">${escape(section.summary || section.body)}</p>${section.relevance ? `<p class="item-relevance"><strong>왜 중요한가</strong>${escape(section.relevance)}</p>` : ""}${fullText}${!section.summary && section.takeaway ? `<div class="insight-takeaway"><strong>왜 볼까</strong><p>${escape(section.takeaway)}</p></div>` : ""}${!section.summary && section.action ? `<div class="insight-action"><strong>써볼 지점</strong><p>${escape(section.action)}</p></div>` : ""}${section.url ? `<a class="daily-source-link" href="${safeUrl(section.url)}" target="_blank" rel="noopener">공식 원문 ↗</a>` : ""}</section>`;
}
function renderRadar(repo, index, offset) {
  return `<section class="radar-entry daily-item" id="daily-repo-${index}" tabindex="-1"><div class="insight-meta"><span class="item-number">${String(offset + index + 1).padStart(2,"0")}</span><span>${escape(repo.label)}</span></div><h3>${escape(repo.headline || repo.repo)}</h3><a class="repo-name" href="${safeUrl(repo.url)}" target="_blank" rel="noopener">${escape(repo.repo)} ↗</a><p>${escape(repo.description)}</p><p class="item-relevance"><strong>써볼 이유</strong>${escape(repo.why)}</p><details class="daily-details"><summary>시작 방법 · 주의점 · 인기 근거</summary><dl><dt>먼저 해볼 것</dt><dd>${escape(repo.try)}</dd><dt>확인할 제약</dt><dd>${escape(repo.limitation)}</dd></dl><p class="radar-signal">${escape(repo.signal)}<small>확인 ${escape(repo.checkedAt)} · <a href="${safeUrl(repo.sourceUrl)}" target="_blank" rel="noopener">집계 근거 ↗</a></small></p></details></section>`;
}
function renderDailyCover(report) {
  const cover = report.coverImage;
  if (!cover || cover.date !== report.date || cover.src !== `assets/daily/${report.date}.webp`) return "";
  return `<figure class="daily-cover"><a href="${escape(cover.src)}" target="_blank" rel="noopener" aria-label="${escape(report.date)} AI 데일리 요약 이미지 크게 보기"><img src="${escape(cover.src)}" alt="${escape(cover.alt)}" width="${cover.width}" height="${cover.height}" loading="eager" fetchpriority="high" decoding="async"></a><figcaption>AI로 만든 ${escape(report.date)} 요약 이미지 · <a href="${escape(cover.src)}" target="_blank" rel="noopener">크게 보기 ↗</a><span>이미지 속 표현과 작은 글씨는 아래 본문·원문 링크로 확인하세요.</span></figcaption></figure>`;
}
function renderDaily(report) {
  document.title = `${navigationLabels.daily} — AI 라운지`;
  const history = dailyReports.length > 1 ? `<div class="daily-history"><label for="report-date">지난 ${escape(navigationLabels.daily)}</label><select id="report-date">${dailyReports.map(item=>`<option value="${escape(item.id)}"${item.id===report?.id ? " selected" : ""}>${escape(item.date)}</option>`).join("")}</select></div>` : "";
  const contents = report ? [...report.sections.map((section,index)=>({id:`daily-insight-${index}`,title:section.heading,type:"AI"})),...(report.radar || []).map((repo,index)=>({id:`daily-repo-${index}`,title:repo.headline || repo.repo,type:"GitHub"})),...(report.recipe ? [{id:"daily-recipe",title:report.recipe.heading,type:"실전"}] : [])] : [];
  main.innerHTML = `<header class="daily-masthead"><h1>${escape(navigationLabels.daily)}</h1>${history}</header>
    ${report ? `<article class="daily-edition"><header class="daily-lead"><div class="daily-edition-meta"><time datetime="${escape(report.date)}">${escape(report.date.replaceAll("-","."))}</time><span>이날의 핵심</span></div><h2>${escape(report.title)}</h2></header>
    ${renderDailyCover(report)}
    <nav class="daily-headlines" aria-label="선택한 날짜의 목차"><p class="eyebrow">함께 읽을 ${contents.length}가지</p><ol>${contents.map((item,index)=>`<li><button type="button" data-scroll="${item.id}"><span class="toc-number">${String(index+1).padStart(2,"0")}</span><strong>${escape(item.title)}</strong><span class="toc-type">${item.type}</span></button></li>`).join("")}</ol></nav>
    <details class="daily-details edition-overview"><summary>오늘의 브리핑 소개</summary><p>${escape(report.summary)}</p>${report.highlights?.length ? `<ul>${report.highlights.map(item=>`<li>${escape(item)}</li>`).join("")}</ul>` : ""}</details>
    <div class="daily-columns"><section class="daily-insights" id="daily-insights"><div class="daily-section-title"><p class="eyebrow">WHAT CHANGED</p><h2>AI 인사이트</h2></div>${report.sections.map(renderInsight).join("")}</section>
    ${report.radar?.length ? `<aside class="daily-radar" id="daily-radar"><div class="daily-section-title"><p class="eyebrow">WORTH A LOOK</p><h2>GitHub · 스킬 발견</h2></div>${report.radar.map((repo,index)=>renderRadar(repo,index,report.sections.length)).join("")}</aside>` : ""}</div>
    ${report.recipe ? `<section class="daily-recipe daily-item" id="daily-recipe" tabindex="-1"><div class="daily-section-title"><p class="eyebrow">${String(contents.length).padStart(2,"0")} / TRY IT TODAY</p><h2>${escape(report.recipe.heading)}</h2><p>${escape(report.recipe.description)}</p></div><div class="recipe-grid"><ol>${report.recipe.steps.map(step=>`<li>${escape(step)}</li>`).join("")}</ol><div><div class="recipe-prompt-header"><p class="recipe-prompt-label">에이전트에 이렇게 요청해 보세요</p><button type="button" class="copy-prompt">프롬프트 복사</button></div><pre class="recipe-prompt" tabindex="0" aria-label="복사할 프롬프트">${escape(report.recipe.prompt)}</pre><p class="copy-status" role="status"></p><p class="recipe-limit">${escape(report.recipe.limitation)}</p></div></div></section>` : ""}
    <details class="daily-sources daily-details" id="daily-sources"><summary>원문과 참고 자료 · ${report.sources.length}개</summary><ul>${report.sources.map(source=>`<li><a href="${safeUrl(source.url)}" target="_blank" rel="noopener">${escape(source.title)} ↗</a></li>`).join("")}</ul></details></article>` : '<section class="empty"><h2>첫 AI 소식을 준비하고 있습니다.</h2><p>AI 소식과 주목할 저장소, 직접 해볼 방법을 이곳에 쌓습니다.</p></section>'}`;
  const coverImage = main.querySelector(".daily-cover img");
  if (coverImage) {
    const hideBrokenCover = () => { coverImage.closest("figure").hidden = true; };
    coverImage.addEventListener("error", hideBrokenCover, { once: true });
    if (coverImage.complete && !coverImage.naturalWidth) hideBrokenCover();
  }
  document.querySelector("#report-date")?.addEventListener("change",event=>{location.hash=`post/${encodeURIComponent(event.target.value)}`;});
  main.querySelectorAll("[data-scroll]").forEach(button=>button.addEventListener("click",()=>{
    const target = document.getElementById(button.dataset.scroll);
    target?.focus({preventScroll:true});
    target?.scrollIntoView({block:"start"});
  }));
  main.querySelector(".copy-prompt")?.addEventListener("click",async()=>{
    const status = main.querySelector(".copy-status");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(report.recipe.prompt);
      status.textContent = "프롬프트를 복사했습니다.";
    } catch {
      const prompt = main.querySelector(".recipe-prompt");
      prompt.focus();
      const range = document.createRange(); range.selectNodeContents(prompt);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      status.textContent = "자동 복사를 사용할 수 없어 텍스트를 선택했습니다. 복사 메뉴를 이용해 주세요.";
    }
  });
}
function renderGuideNote(guide, detail = false, eager = false) {
  const note = guide.noteImage;
  if (!note || note.src !== `assets/insights/${guide.id}.webp`) return "";
  const target = detail ? escape(note.src) : `#post/${encodeURIComponent(guide.id)}`;
  return `<figure class="guide-note-image"><a href="${target}"${detail ? ' target="_blank" rel="noopener"' : ""} aria-label="${escape(guide.title)} · ${detail ? "요약 이미지 크게 보기" : "본문 읽기"}"><img src="${escape(note.src)}" alt="${escape(note.alt)}" width="${note.width}" height="${note.height}" loading="${detail || eager ? "eager" : "lazy"}" decoding="async"></a>${detail ? `<figcaption>${escape(note.caption)} · <a href="${escape(note.src)}" target="_blank" rel="noopener">크게 보기 ↗</a></figcaption>` : ""}</figure>`;
}
function bindGuideNoteErrors() {
  main.querySelectorAll(".guide-note-image img").forEach(image => {
    const hideBrokenNote = () => { image.closest("figure").hidden = true; image.closest(".editorial-note")?.classList.remove("has-note"); };
    image.addEventListener("error", hideBrokenNote, { once: true });
    if (image.complete && !image.naturalWidth) hideBrokenNote();
  });
}
function renderLibrary() {
  document.title = "인사이트 모음 — AI 라운지";
  const guideLink = guide => `#post/${encodeURIComponent(guide.id)}`;
  const dateText = date => escape(date.replaceAll("-", "."));
  const stories = guides.map((guide,index)=>`<article class="source-story" aria-labelledby="source-title-${index}"><div class="source-story-cover" data-reveal>${renderSourcePreview(guide,index === 0)}</div><div class="source-story-text" data-reveal><p class="editorial-story-meta"><span>${escape(guide.sourceLabel || "공개 자료")}</span><time datetime="${escape(guide.sourceMonth || guide.date)}">${dateText(guide.sourceMonth || guide.date)}</time></p><h2 id="source-title-${index}"><a href="${guideLink(guide)}">${escape(guide.title)}</a></h2><p class="source-story-deck">${escape(guide.summary)}</p><p class="source-original-title">원자료 · ${escape(guide.sourcePreview?.title || guide.sources[0]?.title || guide.title)}</p><div class="source-story-actions"><a class="editorial-read" href="${guideLink(guide)}">핵심 요약 <span aria-hidden="true">↗</span></a><a class="source-original-link" href="${safeUrl(guide.sources[0]?.url)}" target="_blank" rel="noopener">원문 보기 ↗</a></div></div></article>`).join("");
  main.innerHTML = `<div class="editorial-lounge"><header class="editorial-masthead"><h1>인사이트 모음</h1><p>공개 자료를 읽고 정리하는 개인 프로젝트입니다.<br>대표 표지로 자료를 살펴보고, 상세 페이지에서 핵심 세 가지를 읽습니다.</p></header><section class="source-index" aria-label="원자료와 핵심 요약">${stories || '<p class="empty">첫 인사이트를 준비하고 있습니다.</p>'}</section><div class="editorial-close"><p>AI 라운지</p><span>원자료로 읽기 · 핵심 요약으로 읽기</span></div></div>`;
  bindSourcePreviewErrors();
  bindGuideNoteErrors();
}
function renderSourcePreview(guide, eager = false) {
  const preview = guide.sourcePreview;
  const title = preview?.title || guide.sources[0]?.title || guide.title;
  const byline = preview?.byline || guide.sourceLabel || "공개 원자료";
  const image = preview?.src && /^assets\/(?:dental|sources)\/[a-z0-9-]+\.webp$/.test(preview.src);
  const categories = {"ai2027-delegation-2026-10-29":"강의", "dental-ax-workflow-2026-10-29":"공개 사례", "ai-development-principles-2026-10-29":"발표자료"};
  const index = guides.findIndex(item => item.id === guide.id);
  return `<div class="source-cover-card"><div class="source-cover-header"><span>AI 라운지</span>${index >= 0 ? `<span>${String(index + 1).padStart(2,"0")}</span>` : ""}</div><figure class="source-preview"><a href="${safeUrl(guide.sources[0]?.url)}" target="_blank" rel="noopener" aria-label="${escape(title)} · 원문 보기"><div class="source-preview-art${image ? " has-image" : ""}">${image ? `<img src="${escape(preview.src)}" width="${preview.width}" height="${preview.height}" alt="${escape(preview.alt)}" loading="${eager ? "eager" : "lazy"}" decoding="async">` : ""}<div class="source-text-cover"${image ? " hidden" : ""}><span>원자료 안내</span><strong>${escape(title)}</strong><small>${escape(byline)}</small><span class="source-cover-arrow" aria-hidden="true">↗</span></div></div></a><figcaption>${escape(image ? preview.caption : "원자료 제목으로 구성한 안내 표지 · 원문에서 실제 표지를 볼 수 있습니다.")}</figcaption></figure><div class="source-cover-meta"><span class="source-cover-category">${escape(categories[guide.id] || "공개 자료")}</span><strong>${escape(title)}</strong><small>${escape(byline)}</small></div></div>`;
}
function bindSourcePreviewErrors() {
  main.querySelectorAll(".source-preview img").forEach(image => {
    const showTextCover = () => { image.hidden = true; image.parentElement.querySelector(".source-text-cover").hidden = false; image.parentElement.classList.remove("has-image"); image.closest("figure").querySelector("figcaption").textContent = "대표 이미지를 불러오지 못했습니다. 제목을 눌러 원문을 볼 수 있습니다."; };
    image.addEventListener("error", showTextCover, { once: true });
    if (image.complete && !image.naturalWidth) showTextCover();
  });
}
function renderGuide(guide) {
  document.title = `${guide.title} — AI 라운지`;
  main.innerHTML = `<article class="guide-article"><header class="guide-heading"><a href="#library">← 인사이트 모음</a><p class="eyebrow"><time datetime="${escape(guide.date)}">${escape(guide.date)}</time> · AI 라운지 인사이트</p><h1>${escape(guide.title)}</h1><p class="guide-deck">${escape(guide.summary)}</p><a class="daily-source-link" href="${safeUrl(guide.sources[0]?.url)}" target="_blank" rel="noopener">원자료 보기 ↗</a></header>
    ${renderGuideNote(guide, true)}
    ${guide.highlights?.length ? `<aside class="guide-highlights" aria-label="핵심 세 줄"><h2>먼저 읽을 세 줄</h2><ul>${guide.highlights.map(line=>`<li>${escape(line)}</li>`).join("")}</ul></aside>` : ""}
    ${guide.sections.map((section,index)=>`<section class="guide-section"><p class="eyebrow">${String(index+1).padStart(2,"0")} / ${escape(section.label || "INSIGHT")}</p><h2>${escape(section.heading)}</h2><p class="guide-body">${escape(section.body)}</p>${section.takeaway ? `<div class="guide-interpretation"><h3>활용 관점</h3><p>${escape(section.takeaway)}</p></div>` : ""}${section.action ? `<div class="guide-action"><h3>적용 예시</h3><p>${escape(section.action)}</p></div>` : ""}${section.url ? `<a class="daily-source-link" href="${safeUrl(section.url)}" target="_blank" rel="noopener">원자료에서 확인 ↗</a>` : ""}</section>`).join("")}
    <section class="guide-sources"><h2>출처와 읽는 기준</h2>${guide.sourceNote ? `<p>${escape(guide.sourceNote)}</p>` : ""}<ul>${guide.sources.map(source=>`<li><a href="${safeUrl(source.url)}" target="_blank" rel="noopener">${escape(source.title)} ↗</a></li>`).join("")}</ul></section></article>`;
  bindGuideNoteErrors();
}
function route() {
  monthlyMotionCleanup();
  monthlyMotionCleanup = () => {};
  editorialMotionCleanup();
  editorialMotionCleanup = () => {};
  const hash = location.hash.slice(1) || "home";
  document.body.classList.toggle("library-view", hash === "library");
  let selected;
  if (hash.startsWith("post/")) {
    try { const id=decodeURIComponent(hash.slice(5)); selected=issues.find(item=>item.id===id)||dailyReports.find(item=>item.id===id)||guides.find(item=>item.id===id); } catch {}
  }
  const monthPath = hash.startsWith("monthly/");
  const month = monthPath ? hash.slice("monthly/".length) : "";
  const issue = selected?.type === "monthly" ? selected : /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? issues.find(item=>item.date.startsWith(month)) : undefined;
  const monthly = hash === "monthly" || monthPath || selected?.type === "monthly";
  const view = monthly ? "monthly" : hash === "library" || selected?.type === "guide" ? "library" : hash === "daily" || selected?.type === "daily" ? "daily" : "home";
  setView(view, Boolean(issue));
  if (view === "home") renderHome();
  else if (hash === "library") renderLibrary();
  else if (selected?.type === "guide") renderGuide(selected);
  else if (hash === "monthly") renderMonthlyArchive();
  else if (issue) renderIssue(issue);
  else if (monthly) renderMissingMonth();
  else renderDaily(selected||dailyReports[0]);
  if (!issue) editorialMotionCleanup = mountEditorialMotion();
}
fetch("data/posts.json", { cache: "no-cache" }).then(response=>{if(!response.ok) throw new Error("Content unavailable");return response.json();}).then(data=>{
  // Daily reading and monthly presentations are independent views, sharing one content source.
  issues = data.posts.filter(post=>post.type==="monthly").sort((a,b)=>b.date.localeCompare(a.date));
  dailyReports = data.posts.filter(post=>post.type==="daily").sort((a,b)=>b.date.localeCompare(a.date));
  guides = data.posts.filter(post=>post.type==="guide" && post.published === true).sort((a,b)=>(b.sourceMonth || b.date.slice(0,7)).localeCompare(a.sourceMonth || a.date.slice(0,7)) || b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  route();
  window.addEventListener("hashchange",()=>{route();main.focus();window.scrollTo(0,0);});
}).catch(()=>{
  main.innerHTML='<section class="page-heading"><h1>기록을 불러오지 못했어요.</h1><p>연결을 확인하고 페이지를 새로고침해 주세요.</p><button class="button" id="retry">다시 불러오기</button></section>';
  document.querySelector("#retry").addEventListener("click",()=>location.reload());
});
