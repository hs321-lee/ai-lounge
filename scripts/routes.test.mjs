import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const code = await readFile(new URL("../assets/app.js", import.meta.url), "utf8");
const data = JSON.parse(await readFile(new URL("../data/posts.json", import.meta.url), "utf8"));
const actualIssue = data.posts.find(post => post.type === "monthly");
const publicDailies = data.posts.filter(post => post.type === "daily" && post.published !== false);
const fixtureNow = `${publicDailies.map(post => post.date).sort().at(-1)}T00:00:00Z`;

async function open(hash, posts = data.posts, now = fixtureNow) {
  const classes = new Set();
  const listeners = {};
  const stats = { mounts: 0, cleanups: 0, mediaMounts: 0, mediaCleanups: 0 };
  const node = () => ({ innerHTML: "", addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, focus() {}, scrollIntoView() {} });
  const main = node();
  const nav = node();
  const brand = node();
  const footer = node();
  const document = { title: "", body: { classList: { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); } } }, querySelector(selector) { return selector === "main" ? main : selector === ".menu-bar nav" ? nav : selector === ".wordmark" ? brand : selector === "footer" ? footer : null; } };
  const location = { hash };
  const window = {
    addEventListener(name, callback) { listeners[name] = callback; },
    scrollTo() {}, matchMedia() { return { matches: true }; },
    MonthlyMotion: { mount() { stats.mounts++; return () => stats.cleanups++; } },
    MonthlyMedia: { mount() { stats.mediaMounts++; return () => stats.mediaCleanups++; } }
  };
  const Clock = class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return new Date(now).getTime(); } };
  vm.runInNewContext(code, { document, window, location, URL, Date: Clock, fetch: async () => ({ ok: true, json: async () => ({ posts }) }) });
  await new Promise(resolve => setImmediate(resolve));
  return { main, nav, classes, stats, go(next) { location.hash = next; listeners.hashchange(); } };
}

test("월간 탭은 실제 발행 월을 모으고 발표 동작을 시작하지 않는다", async () => {
  const page = await open("#monthly");
  assert.match(page.main.innerHTML, /<h1>함께 보기<\/h1>/);
  assert.match(page.main.innerHTML, /href="#monthly\/2026-10"/);
  assert.doesNotMatch(page.main.innerHTML, /class="monthly-story"/);
  assert(page.classes.has("monthly-archive-view"));
  assert(!page.classes.has("monthly-view"));
  assert.equal(page.stats.mounts, 0);
  assert.match(page.nav.innerHTML, /href="#monthly" aria-current="page">함께 보기<\/a>/);
});

test("선택한 월과 기존 공유 주소가 동일한 발표와 원본 장면을 연다", async () => {
  const canonical = await open("#monthly/2026-10");
  const legacy = await open(`#post/${actualIssue.id}`);
  assert.equal(canonical.main.innerHTML, legacy.main.innerHTML);
  assert(canonical.classes.has("monthly-view"));
  assert(!canonical.classes.has("monthly-archive-view"));
  assert.equal((canonical.main.innerHTML.match(/id="scene-/g) || []).length, actualIssue.sections.length);
  assert.match(canonical.main.innerHTML, /data-jump=/);
  assert.match(canonical.main.innerHTML, /data-media=/);
  assert.match(canonical.main.innerHTML, /class="story-viewer"/);
  assert.match(canonical.main.innerHTML, /href="#monthly"/);
});

test("없는 월·잘못된 월은 최신 발표로 바뀌지 않는다", async () => {
  for (const hash of ["#monthly/2025-12", "#monthly/2026-13", "#monthly/%E0%A4%A", "#monthly/2026-10/extra"]) {
    const page = await open(hash);
    assert.match(page.main.innerHTML, /해당 월의 자료가 없습니다/);
    assert.doesNotMatch(page.main.innerHTML, /class="monthly-story"/);
    assert.equal(page.stats.mounts, 0);
    assert(!page.classes.has("monthly-view"));
  }
});

test("목록은 실제 월만 누적하고 같은 달의 여러 자료도 남긴다", async () => {
  const earlier = { ...actualIssue, id: "monthly-test-earlier", date: "2026-09-30", title: "테스트용 이전 월" };
  const duplicate = { ...actualIssue, id: "monthly-test-same-month", date: "2026-10-01", title: "테스트용 같은 월" };
  const page = await open("#monthly", [...data.posts, earlier, duplicate]);
  assert.match(page.main.innerHTML, /테스트용 이전 월/);
  assert.match(page.main.innerHTML, /테스트용 같은 월/);
  assert.match(page.main.innerHTML, /href="#monthly\/2026-09"/);
  assert.match(page.main.innerHTML, /href="#post\/monthly-test-same-month"/);
  assert(page.main.innerHTML.indexOf(actualIssue.title) < page.main.innerHTML.indexOf(earlier.title));
  page.go("#monthly/2026-10");
  assert.match(page.main.innerHTML, new RegExp(actualIssue.title));
  assert.doesNotMatch(page.main.innerHTML, /<h1>테스트용 같은 월/);
});

test("발표→목록→다른 탭→기존 공유 주소 전환 시 발표 상태를 정리한다", async () => {
  const page = await open("#monthly/2026-10");
  assert.equal(page.stats.mounts, 1);
  page.go("#monthly");
  assert.equal(page.stats.cleanups, 1);
  assert.equal(page.stats.mediaCleanups, 1);
  assert(!page.classes.has("monthly-view"));
  page.go("#daily");
  assert(!page.classes.has("monthly-archive-view"));
  page.go(`#post/${actualIssue.id}`);
  assert.equal(page.stats.mounts, 2);
  assert.equal(page.stats.mediaMounts, 2);
  page.go("#library");
  assert.equal(page.stats.cleanups, 2);
  assert.equal(page.stats.mediaCleanups, 2);
});

test("월간 자료가 없으면 빈 목록을 안내한다", async () => {
  const page = await open("#monthly", data.posts.filter(post => post.type !== "monthly"));
  assert.match(page.main.innerHTML, /첫 월간 자료를 준비하고 있습니다/);
  assert.doesNotMatch(page.main.innerHTML, /undefined/);
  assert.equal(page.stats.mounts, 0);
});

test("네 탭의 이름과 순서는 목록과 발표에서 같고 현재 탭만 달라진다", async () => {
  const page = await open("#home");
  const normalize = html => html.replaceAll(' aria-current="page"', "");
  const navigation = normalize(page.nav.innerHTML);
  assert.deepEqual([...navigation.matchAll(/href="#([^"]+)"/g)].map(match=>match[1]), ["home", "daily", "library", "monthly"]);
  assert.deepEqual([...navigation.matchAll(/>([^<]+)<\/a>/g)].map(match=>match[1]), ["홈", "AI 소식", "인사이트", "함께 보기"]);
  assert.match(page.main.innerHTML, /href="#monthly"/);
  for (const hash of ["#daily", "#library", "#monthly", "#monthly/2026-10"]) {
    page.go(hash);
    assert.equal(normalize(page.nav.innerHTML), navigation);
  }
});

test("월별 표지는 사진 대신 실제 월·제목·목차를 타이포로 표시한다", async () => {
  const page = await open("#monthly");
  assert.match(page.main.innerHTML, /class="monthly-cover"/);
  assert.match(page.main.innerHTML, /class="monthly-cover-month" aria-hidden="true">2026.10/);
  assert.match(page.main.innerHTML, /class="monthly-cover-title" aria-hidden="true">동네 치과의 AX 전환기/);
  assert.match(page.main.innerHTML, /다음 소개 Herdr/);
  assert.doesNotMatch(page.main.innerHTML, /<img|<figure|has-preview/);
  const textOnly = { ...actualIssue, title: "사진 없는 새 월의 긴 제목", sections: [] };
  const fallback = await open("#monthly", [textOnly]);
  assert.match(fallback.main.innerHTML, /사진 없는 새 월의 긴 제목/);
  assert.doesNotMatch(fallback.main.innerHTML, /undefined|<img/);
});

test("치과 원문은 편 번호와 다른 이전 주소를 정확히 연결한다", async () => {
  const originals = ["https://dentaldev.tistory.com/3", "https://dentaldev.tistory.com/4", "https://dentaldev.tistory.com/5", "https://dentaldev.tistory.com/1"];
  const dental = data.posts.find(post => post.id === "dental-ax-workflow-2026-10-29");
  for (const post of [dental, actualIssue]) {
    assert.deepEqual(post.sources.filter(source => source.url.startsWith("https://dentaldev.tistory.com/")).map(source => source.url), originals);
  }
  const page = await open("#monthly/2026-10");
  const noScript = await readFile(new URL("../index.html", import.meta.url), "utf8");
  for (const url of originals) {
    assert(page.main.innerHTML.includes(`href="${url}"`));
    assert(noScript.includes(`href="${url}"`));
  }
  assert.doesNotMatch(JSON.stringify(data), /https:\/\/arca\.live\/b\/aihomelab\/(?:185810092|186115260|186465322)/);
});

test("4편은 후속 소개 한 장에서 기존 인사이트와 원문으로 연결한다", async () => {
  const followups = actualIssue.sections.filter(section => section.insightId !== undefined);
  assert.equal(followups.length, 1);
  assert.equal(followups[0].part, "4편 · 후속 소개");
  assert.equal(followups[0].insightId, "dental-ax-workflow-2026-10-29");
  assert.equal(followups[0].url, "https://dentaldev.tistory.com/1");
  const sceneIndex = actualIssue.sections.indexOf(followups[0]);
  assert.equal(actualIssue.sections[sceneIndex + 1].part, "다음 소개");
  const page = await open("#monthly/2026-10");
  const scene = page.main.innerHTML.split(`id="scene-${sceneIndex}"`)[1].split('</section>')[0];
  assert.match(scene, /href="#post\/dental-ax-workflow-2026-10-29">인사이트 보기/);
  assert.match(scene, /href="https:\/\/dentaldev\.tistory\.com\/1" target="_blank" rel="noopener">원문 보기/);
  page.go("#post/dental-ax-workflow-2026-10-29");
  assert.match(page.main.innerHTML, /4편 부록/);
  assert(!page.classes.has("monthly-view"));
  assert.equal(page.stats.cleanups, 1);
  const invalid = structuredClone(actualIssue);
  invalid.sections[sceneIndex].insightId = "unpublished-or-missing";
  const fallback = await open("#monthly/2026-10", data.posts.map(post => post.id === actualIssue.id ? invalid : post));
  assert.doesNotMatch(fallback.main.innerHTML, /href="#post\/unpublished-or-missing"/);
});

test("홈과 인사이트 대표 표지는 상세 글을 열고 원문 버튼은 별도로 남긴다", async () => {
  const published = data.posts.filter(post => post.type === "guide" && post.published);
  for (const hash of ["#home", "#library"]) {
    const page = await open(hash);
    const covers = [...page.main.innerHTML.matchAll(/<figure class="source-preview"><a ([^>]+)>/g)];
    assert.equal(covers.length, hash === "#home" ? Math.min(3, published.length) : published.length);
    for (const [, attributes] of covers) {
      assert.match(attributes, /href="#post\/[^"]+"/);
      assert.match(attributes, /aria-label="[^"]+ · 상세보기"/);
      assert.doesNotMatch(attributes, /target=|https:/);
    }
    assert.doesNotMatch(page.main.innerHTML, /· 원문에서 보기/);
    for (const guide of published) {
      if (hash === "#library") assert(page.main.innerHTML.includes(`href="#post/${guide.id}"`));
      if (hash === "#library" || guide.id === "ai2027-delegation-2026-10-29") {
        assert(page.main.innerHTML.includes(`href="${guide.sources[0].url}" target="_blank" rel="noopener"`));
      }
    }
  }
});

test("모든 날짜의 선택값·목차 대상·확대 이미지가 실제 기록과 연결된다", async () => {
  const reports = publicDailies;
  for (const report of reports) {
    const page = await open(`#post/${report.id}`);
    const expectedLink = report.date < new Date(new Date(fixtureNow).getTime() - 9 * 86400000).toISOString().slice(0, 10) ? `#daily/${report.date.slice(0, 7)}/${report.date.slice(8)}` : `#post/${report.id}`;
    assert(page.main.innerHTML.includes(`href="${expectedLink}" aria-current="page"`));
    assert.equal(page.main.innerHTML.match(/aria-current="page"/g)?.length, 1);
    for (const [, target] of page.main.innerHTML.matchAll(/data-scroll="([^"]+)"/g)) {
      assert(page.main.innerHTML.includes(`id="${target}"`), `${report.id}: ${target}`);
    }
    if (report.editionKind === "practice-note") {
      assert.match(page.main.innerHTML, /class="daily-practice-summary"/);
      assert.match(page.main.innerHTML, /활용 노트/);
      assert.equal(report.highlights.length, 3);
      assert(report.sources.length > 0);
      assert(report.recipe?.prompt);
    }
    assert(report.coverImage, `${report.id}: every daily requires its cover`);
    assert.match(page.main.innerHTML, /class="daily-cover"/);
    assert(page.main.innerHTML.includes(`href="assets/daily/${report.date}.webp" target="_blank" rel="noopener"`));
    assert.equal(page.main.innerHTML.includes('class="daily-columns has-radar"'), Boolean(report.radar?.length));
    assert.match(page.main.innerHTML, /class="copy-prompt">프롬프트 복사/);
  }
});

test("각 화면의 내부 글 링크는 공개된 글로 연결되고 외부 링크는 새 탭을 명시한다", async () => {
  const publicPosts = data.posts.filter(post => post.published !== false && (post.type !== "guide" || post.published));
  for (const hash of ["#home", "#library", "#monthly", ...publicPosts.map(post => `#post/${post.id}`)]) {
    const page = await open(hash);
    for (const [, attributes] of page.main.innerHTML.matchAll(/<a\b([^>]+)>/g)) {
      const href = attributes.match(/href="([^"]+)"/)?.[1];
      if (href?.startsWith("#post/")) {
        assert(publicPosts.some(post => post.id === decodeURIComponent(href.slice(6))), `${hash}: ${href}`);
        assert.doesNotMatch(attributes, /target="_blank"/);
      }
      if (href?.startsWith("https:")) {
        assert.match(attributes, /target="_blank"/);
        assert.match(attributes, /rel="noopener"/);
      }
    }
  }
});


const fixtureDaily = date => ({ ...data.posts.find(post => post.type === "daily"), id: `daily-${date}`, date, title: `테스트 ${date}`, coverImage: undefined });
const datedFixtures = ["2026-10-01", "2026-10-22", "2026-10-23", "2026-10-31", "2026-11-01", "2026-11-02"].map(fixtureDaily);
const dateStrip = page => page.main.innerHTML.match(/<nav class="daily-dates"[^>]*>([\s\S]*?)<\/nav>/)?.[1] || "";
// 운영 단계 안내와 기사 안의 실제 제품 출시 단계를 구분한다.
const dailyOperationChrome = html => [
  ...html.matchAll(/<header class="editorial-masthead daily-page-head">[\s\S]*?<\/header>/g),
  ...html.matchAll(/<div class="daily-edition-meta">[\s\S]*?<\/div>/g),
  ...html.matchAll(/<p class="daily-period">[\s\S]*?<\/p>/g)
].map(match => match[0]).join("\n");

test("최근 10일은 한국 날짜 기준 오늘을 포함하고 미래·이전 기록을 제외한다", async () => {
  const page = await open("#daily", datedFixtures, "2026-11-01T00:00:00Z");
  const dates = dateStrip(page);
  for (const date of ["2026-10-23", "2026-10-31", "2026-11-01"]) assert(dates.includes(`#post/daily-${date}`));
  for (const date of ["2026-10-01", "2026-10-22", "2026-11-02"]) assert(!dates.includes(`#post/daily-${date}`));
  assert.match(page.main.innerHTML, /최근 10일/);
  assert.match(page.main.innerHTML, /2026.10.23 — 2026.11.01/);
  assert.match(page.main.innerHTML, /href="#daily\/2026-10"/);
  assert.doesNotMatch(dailyOperationChrome(page.main.innerHTML), /베타|beta|BETA|정식 운영/);
  const beforeMidnight = await open("#daily", datedFixtures, "2026-10-31T14:59:59Z");
  assert(dateStrip(beforeMidnight).includes("#post/daily-2026-10-22"));
  assert(!dateStrip(beforeMidnight).includes("#post/daily-2026-11-01"));
  const afterMidnight = await open("#daily", datedFixtures, "2026-10-31T15:00:00Z");
  assert(dateStrip(afterMidnight).includes("#post/daily-2026-11-01"));
  assert(!dateStrip(afterMidnight).includes("#post/daily-2026-10-22"));
});

test("월별 보관함은 최근 범위와 겹쳐도 해당 월 전체를 남기고 선택·페이저 범위를 유지한다", async () => {
  const page = await open("#daily/2026-10", datedFixtures, "2026-11-01T00:00:00Z");
  assert.match(page.main.innerHTML, /2026년 10월 전체 · 4편/);
  for (const day of ["01", "22", "23", "31"]) assert(dateStrip(page).includes(`#daily/2026-10/${day}`));
  assert(!dateStrip(page).includes("2026-11"));
  page.go("#daily/2026-10/23");
  assert.match(page.main.innerHTML, /href="#daily\/2026-10\/23" aria-current="page"/);
  assert.match(page.main.innerHTML, /href="#daily\/2026-10\/22" rel="prev"/);
  assert.match(page.main.innerHTML, /href="#daily\/2026-10\/31" rel="next"/);
  page.go("#daily");
  assert.match(page.main.innerHTML, /href="#post\/daily-2026-11-01" aria-current="page"/);
  assert(!dateStrip(page).includes("2026-10-01"));
});

test("이전 공유 주소는 해당 월에서 선택되고 없는 월·날짜는 최신으로 바뀌지 않는다", async () => {
  const old = await open("#post/daily-2026-10-01", datedFixtures, "2026-11-01T00:00:00Z");
  assert.match(old.main.innerHTML, /href="#daily\/2026-10\/01" aria-current="page"/);
  for (const path of ["2026-09", "2026-13", "2026-10/32", "2026-10/02", "2026-11/02", "%E0%A4%A", "2026-10/01/extra"]) {
    const page = await open(`#daily/${path}`, datedFixtures, "2026-11-01T00:00:00Z");
    assert.match(page.main.innerHTML, /해당 날짜의 AI 소식이 없습니다/);
    assert.doesNotMatch(page.main.innerHTML, /class="daily-edition"/);
  }
  const empty = await open("#daily", [fixtureDaily("2026-10-01")]);
  assert.match(empty.main.innerHTML, /최근 10일 동안 발행한 AI 소식이 없습니다/);
  assert.doesNotMatch(empty.main.innerHTML, /class="daily-edition"/);
  assert.match(empty.main.innerHTML, /href="#daily\/2026-10"/);
});


test("활용 노트도 날짜별 그림과 핵심 요약·출처·복사 프롬프트를 표시한다", async () => {
  const note = { ...fixtureDaily("2026-10-01"), editionKind: "practice-note", coverImage: { src: "assets/daily/2026-10-01.webp", date: "2026-10-01", alt: "이날의 핵심 그림", width: 100, height: 150 }, highlights: ["첫 번째 요약", "두 번째 요약", "세 번째 요약"], radar: [] };
  const page = await open("#daily/2026-10/01", [note]);
  assert.match(page.main.innerHTML, /활용 노트/);
  assert.match(page.main.innerHTML, /class="daily-practice-summary"/);
  for (const line of note.highlights) assert(page.main.innerHTML.includes(line));
  assert.match(page.main.innerHTML, /class="copy-prompt">프롬프트 복사/);
  assert.match(page.main.innerHTML, /원문과 참고 자료/);
  assert.match(page.main.innerHTML, /class="daily-cover"/);
  assert.match(page.main.innerHTML, /href="assets\/daily\/2026-10-01\.webp"/);
});


test("운영 단계 안내를 제거하고 모든 AI 소식에서 중립적인 활용 노트 명칭을 쓴다", async () => {
  for (const hash of ["#daily", "#daily/2026-10", ...publicDailies.map(post => `#post/${post.id}`)]) {
    const page = await open(hash);
    assert.doesNotMatch(dailyOperationChrome(page.main.innerHTML), /베타|beta|BETA|정식 운영/);
    assert.doesNotMatch(page.main.innerHTML, /class="daily-operation"|10월 1[~–-]20|활용 노트 20편/);
  }
  const notes = publicDailies.filter(post => post.editionKind === "practice-note");
  assert.equal(notes.length, 20);
});

test("제품 베타 소식은 보존하면서 운영 단계 안내는 계속 차단한다", async () => {
  const article = { ...fixtureDaily("2026-11-01"), title: "제품 Beta 출시", summary: "실제 제품의 베타 제공 조건입니다." };
  const page = await open("#daily", [article], "2026-11-01T00:00:00Z");
  assert.match(page.main.innerHTML, /제품 Beta 출시/);
  assert.match(page.main.innerHTML, /실제 제품의 베타 제공 조건입니다/);
  assert.doesNotMatch(dailyOperationChrome(page.main.innerHTML), /베타|beta|BETA|정식 운영/);
  for (const [before, after] of [
    ["<h1>AI 소식</h1>", "<h1>AI 소식 베타</h1>"],
    ["<span>이날의 핵심</span>", "<span>정식 운영</span>"],
    ["<p class=\"daily-period\">최근 10일", "<p class=\"daily-period\">BETA 최근 10일"]
  ]) {
    assert(page.main.innerHTML.includes(before), `운영 안내 검증 대상: ${before}`);
    const forbidden = page.main.innerHTML.replace(before, after);
    assert.throws(() => assert.doesNotMatch(dailyOperationChrome(forbidden), /베타|beta|BETA|정식 운영/), assert.AssertionError);
  }
});

test("미완성 비공개 daily는 목록·보관함·직접 주소에 노출하지 않는다", async () => {
  const draft = { ...fixtureDaily("2026-10-01"), title: "미완성 비공개 노트", published: false };
  const visible = fixtureDaily("2026-11-01");
  for (const hash of ["#daily", "#daily/2026-10", `#post/${draft.id}`]) {
    const page = await open(hash, [visible, draft]);
    assert.doesNotMatch(page.main.innerHTML, /미완성 비공개 노트/);
    assert(!dateStrip(page).includes("2026-10/01"));
  }
});
