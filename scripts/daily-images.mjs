import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export const approvedReferenceCommit = "2a48e5221580dfc634660b6d88b8a5afe8b75688";
const digest = value => createHash("sha256").update(value).digest("hex");
export const imageDigest = buffer => digest(buffer);
export function contentDigest(post) {
  const { coverImage, ...content } = post;
  return digest(JSON.stringify(content));
}
const text = (value, context) => assert.ok(typeof value === "string" && value.trim(), `${context} 필요`);

// Check container structure and declared dimensions; decoding and style/content checks remain visual QA.
export function webpSize(buffer) {
  assert.ok(buffer.length >= 20 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP", "WebP 파일 필요");
  assert.equal(buffer.readUInt32LE(4) + 8, buffer.length, "WebP 파일 길이 오류");
  let size;
  let raster = false;
  for (let offset = 12; offset < buffer.length;) {
    assert.ok(offset + 8 <= buffer.length, "WebP 청크 헤더 오류");
    const kind = buffer.toString("ascii", offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + length;
    assert.ok(end + (length % 2) <= buffer.length, "WebP 청크 길이 오류");
    if (kind === "VP8X") {
      assert.ok(length >= 10, "WebP VP8X 헤더 오류");
      size = { width: buffer.readUIntLE(start + 4, 3) + 1, height: buffer.readUIntLE(start + 7, 3) + 1 };
    } else if (kind === "VP8L") {
      assert.ok(length >= 5 && buffer[start] === 0x2f, "WebP VP8L 헤더 오류");
      const bits = buffer.readUInt32LE(start + 1);
      size ??= { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
      raster = true;
    } else if (kind === "VP8 ") {
      assert.ok(length >= 10 && buffer.subarray(start + 3, start + 6).equals(Buffer.from([0x9d, 0x01, 0x2a])), "WebP VP8 헤더 오류");
      size ??= { width: buffer.readUInt16LE(start + 6) & 0x3fff, height: buffer.readUInt16LE(start + 8) & 0x3fff };
      raster = true;
    }
    offset = end + (length % 2);
  }
  assert.ok(raster && size?.width > 0 && size?.height > 0, "WebP 정적 이미지 데이터 필요");
  return size;
}

export async function validateDailyImages(posts, manifest, loadImage = src => readFile(new URL(`../${src}`, import.meta.url))) {
  assert.equal(manifest.schemaVersion, 1, "이미지 검토 schemaVersion 오류");
  assert.ok(Array.isArray(manifest.reviews), "이미지 reviews 배열 필요");
  const records = new Map();
  for (const review of manifest.reviews) {
    assert.ok(!records.has(review.date), `중복 이미지 검토: ${review.date}`);
    records.set(review.date, review);
  }
  const imageDates = new Map();
  for (const post of posts.filter(item => item.type === "daily" && item.published !== false)) {
    const cover = post.coverImage;
    assert.ok(cover && typeof cover === "object", `${post.id}: 공개 daily coverImage 필수`);
    assert.equal(cover.date, post.date, `${post.id}: 이미지 날짜 불일치`);
    assert.equal(cover.src, `assets/daily/${post.date}.webp`, `${post.id}: 날짜별 이미지 경로 필요`);
    const buffer = await loadImage(cover.src);
    assert.deepEqual(webpSize(buffer), { width: cover.width, height: cover.height }, `${post.id}: 이미지 실제 크기 불일치`);
    const hash = imageDigest(buffer);
    assert.ok(!imageDates.has(hash), `${post.id}: 같은 이미지 재사용 (${imageDates.get(hash)})`);
    imageDates.set(hash, post.date);
    const review = records.get(post.date);
    assert.ok(review, `${post.id}: 이미지 검토 기록 필요`);
    assert.equal(review.imageSha256, hash, `${post.id}: 이미지가 검토 이후 변경됨`);
    assert.equal(review.contentSha256, contentDigest(post), `${post.id}: 본문이 검토 이후 변경됨`);
    assert.equal(review.reference?.commit, approvedReferenceCommit, `${post.id}: 승인 기준 commit 필요`);
    assert.equal(review.reference.path, "assets/daily/2026-10-30.webp", `${post.id}: 승인 그림체 기준은 10월 30일 원본으로 고정`);
    assert.ok(["generated", "edited", "preserved"].includes(review.provenance?.method), `${post.id}: 이미지 작업 이력 필요`);
    for (const key of ["tool", "details"]) text(review.provenance[key], `${post.id}: provenance ${key}`);
    for (const role of ["authorReview", "independentReview"]) {
      const record = review[role];
      assert.equal(record?.result, "pass", `${post.id}: ${role} 직접 시각검토 미완료`);
      for (const key of ["reviewer", "notes", "reviewedAt"]) text(record[key], `${post.id}: ${role} ${key}`);
      assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(record.reviewedAt) && Number.isFinite(Date.parse(record.reviewedAt)), `${post.id}: 검토 시각 오류`);
    }
    assert.notEqual(review.authorReview.reviewer, review.independentReview.reviewer, `${post.id}: 별도 검토자 필요`);
  }
}
