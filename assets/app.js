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
function setView(view) {
  document.body.classList.toggle("monthly-view", view === "monthly");
  document.body.classList.toggle("home-view", view === "home");
  document.querySelector(".brand").href = "#home";
  document.querySelector(".site-header nav").innerHTML = [["home", "홈"], ["daily", "데일리"], ["library", "인사이트"], ["monthly", "Monthly"]]
    .map(([id, label]) => `<a href="#${id}"${view === id ? ' aria-current="page"' : ""}>${label}</a>`).join("");
  document.querySelector("footer").innerHTML = '<span><strong>AI 라운지</strong> · 매일 읽고, 쓸 만한 내용을 쌓습니다.</span>';
}
function renderHome() {
  document.title = "AI 라운지 — 함께 읽고 쌓는 AI 이야기";
  const daily = dailyReports[0];
  const issue = issues[0];
  const cover = daily?.coverImage;
  const hasCover = cover && cover.date === daily.date && cover.src === `assets/daily/${daily.date}.webp`;
  main.innerHTML = `<div class="editorial-lounge lounge-home"><header class="editorial-masthead"><h1>함께 읽고 쌓는<br>AI 이야기</h1><p>매일의 AI 소식부터 깊이 읽을 자료까지.<br>원문을 살펴보고, 핵심을 정리해 나눕니다.</p></header>
    <section class="home-daily" aria-labelledby="home-daily-title"><div class="home-section-heading"><h2 id="home-daily-title">최신 데일리</h2><a href="#daily">데일리 읽기 →</a></div>
    ${daily ? `<article class="home-daily-feature${hasCover ? " has-cover" : ""}">${hasCover ? `<a class="home-daily-art" href="#post/${encodeURIComponent(daily.id)}" aria-label="${escape(daily.title)} · 데일리 읽기"><img src="${escape(cover.src)}" alt="${escape(cover.alt)}" width="${cover.width}" height="${cover.height}" loading="eager" decoding="async"></a>` : ""}<div class="home-daily-text"><p class="editorial-story-meta"><span>DAILY</span><time datetime="${escape(daily.date)}">${escape(daily.date.replaceAll("-", "."))}</time></p><h3><a href="#post/${encodeURIComponent(daily.id)}">${escape(daily.title)}</a></h3><p>${escape(daily.summary)}</p><a class="editorial-read" href="#post/${encodeURIComponent(daily.id)}">오늘의 요약 읽기 <span aria-hidden="true">↗</span></a></div></article>` : '<p class="empty">첫 데일리를 준비하고 있습니다.</p>'}</section>
    <section class="home-insights" aria-labelledby="home-insights-title"><div class="home-section-heading"><h2 id="home-insights-title">깊이 읽을 인사이트</h2><a href="#library">인사이트 모두 보기 →</a></div><div class="home-insight-list">${guides.slice(0,3).map(guide => `<article class="home-insight"><p class="editorial-story-meta"><span>${escape(guide.sourceLabel || "공개 자료")}</span><time datetime="${escape(guide.sourceMonth || guide.date)}">${escape((guide.sourceMonth || guide.date).replaceAll("-", "."))}</time></p><h3><a href="#post/${encodeURIComponent(guide.id)}">${escape(guide.title)}</a></h3><p>${escape(guide.highlights?.[0] || guide.summary)}</p><a class="editorial-read" href="#post/${encodeURIComponent(guide.id)}">핵심 세 가지 <span aria-hidden="true">↗</span></a></article>`).join("") || '<p class="empty">첫 인사이트를 준비하고 있습니다.</p>'}</div></section>
    <section class="home-monthly" aria-labelledby="home-monthly-title"><div><p class="eyebrow">MONTHLY${issue ? ` · ${escape(issue.date.slice(0,7).replace("-", "."))}` : ""}</p><h2 id="home-monthly-title">${issue ? escape(issue.title) : "한 달의 경험을 함께 나눕니다"}</h2><p>${issue ? escape(issue.summary) : "첫 월간 소개를 준비하고 있습니다."}</p></div><a href="#monthly">Monthly 자료 보기 <span aria-hidden="true">↗</span></a></section></div>`;
  const dailyImage = main.querySelector(".home-daily-art img");
  if (dailyImage) {
    const hideBrokenCover = () => { dailyImage.closest("a").hidden = true; dailyImage.closest("article").classList.remove("has-cover"); };
    dailyImage.addEventListener("error", hideBrokenCover, { once: true });
    if (dailyImage.complete && !dailyImage.naturalWidth) hideBrokenCover();
  }
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
  return `<figure class="daily-cover"><a href="${escape(cover.src)}" target="_blank" rel="noopener" aria-label="${escape(report.date)} AI 데일리 요약 이미지 크게 보기"><img src="${escape(cover.src)}" alt="${escape(cover.alt)}" width="${cover.width}" height="${cover.height}" loading="eager" fetchpriority="high" decoding="async"></a><figcaption>AI로 만든 오늘의 요약 이미지 · <a href="${escape(cover.src)}" target="_blank" rel="noopener">크게 보기 ↗</a><span>이미지 속 표현과 작은 글씨는 아래 본문·원문 링크로 확인하세요.</span></figcaption></figure>`;
}
function renderDaily(report) {
  document.title = "나의 AI 데일리 — AI 라운지";
  const history = dailyReports.length > 1 ? `<div class="daily-history"><label for="report-date">지난 데일리</label><select id="report-date">${dailyReports.map(item=>`<option value="${escape(item.id)}"${item.id===report?.id ? " selected" : ""}>${escape(item.date)}</option>`).join("")}</select></div>` : "";
  const contents = report ? [...report.sections.map((section,index)=>({id:`daily-insight-${index}`,title:section.heading,type:"AI"})),...(report.radar || []).map((repo,index)=>({id:`daily-repo-${index}`,title:repo.headline || repo.repo,type:"GitHub"})),...(report.recipe ? [{id:"daily-recipe",title:report.recipe.heading,type:"실전"}] : [])] : [];
  main.innerHTML = `<header class="daily-masthead"><h1>나의 AI 데일리</h1>${history}</header>
    ${report ? `<article class="daily-edition"><header class="daily-lead"><div class="daily-edition-meta"><time datetime="${escape(report.date)}">${escape(report.date.replaceAll("-","."))}</time><span>오늘의 핵심</span></div><h2>${escape(report.title)}</h2></header>
    ${renderDailyCover(report)}
    <nav class="daily-headlines" aria-label="오늘의 목차"><p class="eyebrow">오늘 읽을 ${contents.length}가지</p><ol>${contents.map((item,index)=>`<li><button type="button" data-scroll="${item.id}"><span class="toc-number">${String(index+1).padStart(2,"0")}</span><strong>${escape(item.title)}</strong><span class="toc-type">${item.type}</span></button></li>`).join("")}</ol></nav>
    <details class="daily-details edition-overview"><summary>오늘의 브리핑 소개</summary><p>${escape(report.summary)}</p>${report.highlights?.length ? `<ul>${report.highlights.map(item=>`<li>${escape(item)}</li>`).join("")}</ul>` : ""}</details>
    <div class="daily-columns"><section class="daily-insights" id="daily-insights"><div class="daily-section-title"><p class="eyebrow">WHAT CHANGED</p><h2>AI 인사이트</h2></div>${report.sections.map(renderInsight).join("")}</section>
    ${report.radar?.length ? `<aside class="daily-radar" id="daily-radar"><div class="daily-section-title"><p class="eyebrow">WORTH A LOOK</p><h2>GitHub · 스킬 발견</h2></div>${report.radar.map((repo,index)=>renderRadar(repo,index,report.sections.length)).join("")}</aside>` : ""}</div>
    ${report.recipe ? `<section class="daily-recipe daily-item" id="daily-recipe" tabindex="-1"><div class="daily-section-title"><p class="eyebrow">${String(contents.length).padStart(2,"0")} / TRY IT TODAY</p><h2>${escape(report.recipe.heading)}</h2><p>${escape(report.recipe.description)}</p></div><div class="recipe-grid"><ol>${report.recipe.steps.map(step=>`<li>${escape(step)}</li>`).join("")}</ol><div><div class="recipe-prompt-header"><p class="recipe-prompt-label">에이전트에 이렇게 요청해 보세요</p><button type="button" class="copy-prompt">프롬프트 복사</button></div><pre class="recipe-prompt" tabindex="0" aria-label="복사할 프롬프트">${escape(report.recipe.prompt)}</pre><p class="copy-status" role="status"></p><p class="recipe-limit">${escape(report.recipe.limitation)}</p></div></div></section>` : ""}
    <details class="daily-sources daily-details" id="daily-sources"><summary>원문과 참고 자료 · ${report.sources.length}개</summary><ul>${report.sources.map(source=>`<li><a href="${safeUrl(source.url)}" target="_blank" rel="noopener">${escape(source.title)} ↗</a></li>`).join("")}</ul></details></article>` : '<section class="empty"><h2>첫 데일리를 준비하고 있어요.</h2><p>AI 소식과 주목할 저장소, 직접 해볼 방법을 이곳에 쌓습니다.</p></section>'}`;
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
  const stories = guides.map((guide,index)=>`<article class="source-story" aria-labelledby="source-title-${index}">${renderSourcePreview(guide,index === 0)}<div class="source-story-text"><p class="editorial-story-meta"><span>${escape(guide.sourceLabel || "공개 자료")}</span><time datetime="${escape(guide.sourceMonth || guide.date)}">${dateText(guide.sourceMonth || guide.date)}</time></p><h2 id="source-title-${index}"><a href="${guideLink(guide)}">${escape(guide.title)}</a></h2><p class="source-story-deck">${escape(guide.summary)}</p><p class="source-original-title">원자료 · ${escape(guide.sourcePreview?.title || guide.sources[0]?.title || guide.title)}</p><div class="source-story-actions"><a class="editorial-read" href="${guideLink(guide)}">핵심 요약 <span aria-hidden="true">↗</span></a><a class="source-original-link" href="${safeUrl(guide.sources[0]?.url)}" target="_blank" rel="noopener">원문 보기 ↗</a></div></div></article>`).join("");
  main.innerHTML = `<div class="editorial-lounge"><header class="editorial-masthead"><h1>인사이트 모음</h1><p>AI 크루 활동으로 시작한 개인 사이드 프로젝트입니다.<br>원자료로 살펴보고, 핵심 세 가지로 다시 읽습니다.</p></header><section class="source-index" aria-label="원자료와 핵심 요약">${stories || '<p class="empty">첫 인사이트를 준비하고 있습니다.</p>'}</section><div class="editorial-close"><p>AI 라운지</p><span>원자료로 읽기 · 핵심 요약으로 읽기</span></div></div>`;
  bindSourcePreviewErrors();
}
function renderSourcePreview(guide, eager = false) {
  const preview = guide.sourcePreview;
  const title = preview?.title || guide.sources[0]?.title || guide.title;
  const byline = preview?.byline || guide.sourceLabel || "공개 원자료";
  const image = preview?.src && /^assets\/(?:dental|sources)\/[a-z0-9-]+\.webp$/.test(preview.src);
  return `<figure class="source-preview"><a href="${safeUrl(guide.sources[0]?.url)}" target="_blank" rel="noopener" aria-label="${escape(title)} · 원문 보기"><div class="source-preview-art${image ? " has-image" : ""}">${image ? `<img src="${escape(preview.src)}" width="${preview.width}" height="${preview.height}" alt="${escape(preview.alt)}" loading="${eager ? "eager" : "lazy"}" decoding="async">` : ""}<div class="source-text-cover"${image ? " hidden" : ""}><span>원자료 안내</span><strong>${escape(title)}</strong><small>${escape(byline)}</small><span class="source-cover-arrow" aria-hidden="true">↗</span></div></div></a><figcaption>${escape(image ? preview.caption : "원자료 제목으로 구성한 안내 표지 · 원문에서 실제 표지를 볼 수 있습니다.")}</figcaption></figure>`;
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
    ${guide.sections.map((section,index)=>`<section class="guide-section"><p class="eyebrow">${String(index+1).padStart(2,"0")} / ${escape(section.label || "INSIGHT")}</p><h2>${escape(section.heading)}</h2><p class="guide-body">${escape(section.body)}</p>${section.takeaway ? `<div class="guide-interpretation"><h3>업무에 연결하면</h3><p>${escape(section.takeaway)}</p></div>` : ""}${section.action ? `<div class="guide-action"><h3>적용 예시</h3><p>${escape(section.action)}</p></div>` : ""}${section.url ? `<a class="daily-source-link" href="${safeUrl(section.url)}" target="_blank" rel="noopener">원자료에서 확인 ↗</a>` : ""}</section>`).join("")}
    <section class="guide-sources"><h2>출처와 읽는 기준</h2>${guide.sourceNote ? `<p>${escape(guide.sourceNote)}</p>` : ""}<ul>${guide.sources.map(source=>`<li><a href="${safeUrl(source.url)}" target="_blank" rel="noopener">${escape(source.title)} ↗</a></li>`).join("")}</ul></section></article>`;
  bindGuideNoteErrors();
}
function route() {
  monthlyMotionCleanup();
  monthlyMotionCleanup = () => {};
  const hash = location.hash.slice(1) || "home";
  document.body.classList.toggle("library-view", hash === "library");
  let selected;
  if (hash.startsWith("post/")) {
    try { const id=decodeURIComponent(hash.slice(5)); selected=issues.find(item=>item.id===id)||dailyReports.find(item=>item.id===id)||guides.find(item=>item.id===id); } catch {}
  }
  const monthly = hash === "monthly" || selected?.type === "monthly";
  const view = monthly ? "monthly" : hash === "library" || selected?.type === "guide" ? "library" : hash === "daily" || selected?.type === "daily" ? "daily" : "home";
  setView(view);
  if (view === "home") renderHome();
  else if (hash === "library") renderLibrary();
  else if (selected?.type === "guide") renderGuide(selected);
  else if (monthly) {
    const issue=selected||issues[0];
    if (issue) renderIssue(issue);
    else main.innerHTML='<section class="page-heading"><p class="eyebrow">MONTHLY AI LOUNGE</p><h1>첫 월간 소개를 준비하고 있어요.</h1><p class="lede">함께 나누고 싶은 사용 경험과 작은 팁을 골라 곧 소개하겠습니다.</p></section>';
  } else renderDaily(selected||dailyReports[0]);
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
