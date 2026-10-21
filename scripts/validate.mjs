import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const data = JSON.parse(await readFile(new URL("../data/posts.json", import.meta.url), "utf8"));
assert.equal(data.schemaVersion, 1, "지원하는 schemaVersion은 1입니다.");
assert.ok(Array.isArray(data.posts), "posts는 배열이어야 합니다.");
const ids = new Set();
for (const post of data.posts) {
  assert.match(post.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, "id 형식 오류");
  assert.ok(!ids.has(post.id), `중복 id: ${post.id}`); ids.add(post.id);
  assert.ok(["guide", "monthly", "daily"].includes(post.type), `type 오류: ${post.id}`);
  for (const key of ["title", "summary", "author", "date"]) assert.ok(typeof post[key] === "string" && post[key].trim(), `${post.id}: ${key} 필요`);
  assert.match(post.date, /^\d{4}-\d{2}-\d{2}$/);
  const date = new Date(`${post.date}T00:00:00Z`);
  assert.ok(!Number.isNaN(date.valueOf()) && date.toISOString().slice(0,10) === post.date, `잘못된 날짜: ${post.id}`);
  assert.ok(Array.isArray(post.tags) && post.tags.every(tag=>typeof tag === "string" && tag.trim()), `${post.id}: tags 오류`);
  assert.ok(Array.isArray(post.sections) && post.sections.length, `${post.id}: sections 필요`);
  for (const section of post.sections) for (const key of ["heading", "body"]) assert.ok(typeof section[key] === "string" && section[key].trim(), `${post.id}: ${key} 필요`);
  for (const section of post.sections) {
    if (!section.media) continue;
    const media = section.media;
    assert.match(media.src, /^assets\/dental\/[a-z0-9-]+\.(?:webp|png|jpg)$/);
    for (const key of ["alt", "caption"]) assert.ok(typeof media[key] === "string" && media[key].trim(), `${post.id}: media ${key} 필요`);
    for (const key of ["width", "height"]) assert.ok(Number.isInteger(media[key]) && media[key] > 0, `${post.id}: media ${key} 필요`);
    await readFile(new URL(`../${media.src}`, import.meta.url));
    if (media.sourceUrl) assert.equal(new URL(media.sourceUrl).protocol, "https:");
  }
  assert.ok(Array.isArray(post.sources), `${post.id}: sources는 배열이어야 합니다.`);
  if (post.type === "daily") assert.ok(post.sources.length, `${post.id}: 데일리 원문 출처 필요`);
  for (const source of post.sources) {
    assert.ok(typeof source.title === "string" && source.title.trim());
    assert.equal(new URL(source.url).protocol, "https:", `${post.id}: HTTPS 출처만 허용`);
  }
}
console.log(`콘텐츠 검사 통과: ${data.posts.length}건, 고유 ID·날짜·필수 필드·출처 확인`);
