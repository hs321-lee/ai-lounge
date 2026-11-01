import assert from "node:assert/strict";
import test from "node:test";
import { contentDigest, imageDigest, validateDailyImages } from "./daily-images.mjs";

// Minimal lossless WebP header for structural metadata tests; runtime decoding is a separate visual check.
const image = Buffer.alloc(26);
image.write("RIFF"); image.writeUInt32LE(18, 4); image.write("WEBPVP8L", 8); image.writeUInt32LE(5, 16);
image[20] = 0x2f; image.writeUInt32LE(99 | (149 << 14), 21);
const post = { id: "daily-2026-10-01", type: "daily", date: "2026-10-01", title: "본문", editionKind: "practice-note", sections: [{ heading: "확정 소식", body: "확인한 내용" }], coverImage: { src: "assets/daily/2026-10-01.webp", date: "2026-10-01", alt: "요약", width: 100, height: 150 } };
const review = {
  date: post.date, imageSha256: imageDigest(image), contentSha256: contentDigest(post),
  reference: { commit: "2a48e5221580dfc634660b6d88b8a5afe8b75688", path: "assets/daily/2026-10-30.webp" },
  provenance: { method: "generated", tool: "image_gen", details: "승인 원본을 실제 참조하여 생성" },
  authorReview: { reviewer: "author", reviewedAt: "2026-11-01T03:00:00Z", result: "pass", notes: "본문·날짜·스타일 대조" },
  independentReview: { reviewer: "reviewer", reviewedAt: "2026-11-01T03:10:00Z", result: "pass", notes: "같은 크기로 원본과 직접 대조" }
};
const manifest = () => ({ schemaVersion: 1, reviews: [structuredClone(review)] });
const check = (posts = [post], reviews = manifest(), buffer = image) => validateDailyImages(posts, reviews, async () => buffer);

test("활용 노트도 날짜별 이미지와 별도 검토 기록을 요구한다", async () => {
  await check();
  const missing = structuredClone(post); delete missing.coverImage;
  await assert.rejects(check([missing]), /coverImage 필수/);
  await assert.rejects(check([post], { schemaVersion: 1, reviews: [] }), /검토 기록 필요/);
  await check([{ ...missing, published: false }], { schemaVersion: 1, reviews: [] });
});

test("이미지 및 본문 변경은 이전 검토 기록을 무효화한다", async () => {
  await assert.rejects(check([{ ...post, title: "바뀐 본문" }]), /본문이 검토 이후 변경/);
  const changedImage = Buffer.from(image); changedImage[25] = 1;
  await assert.rejects(check([post], manifest(), changedImage), /이미지가 검토 이후 변경/);
  const changed = { ...post, coverImage: { ...post.coverImage, alt: "설명 정정" } };
  assert.equal(contentDigest(changed), contentDigest(post));
});

test("날짜·경로·실제 WebP 크기와 깨진 파일을 검사한다", async () => {
  for (const cover of [{ date: "2026-10-02" }, { src: "assets/daily/2026-10-02.webp" }, { width: 101 }]) {
    await assert.rejects(check([{ ...post, coverImage: { ...post.coverImage, ...cover } }]), /날짜|경로|실제 크기/);
  }
  await assert.rejects(check([post], manifest(), Buffer.from("not an image")), /WebP/);
});

test("잘못된 기준·미검토·동일 작성자 검토는 차단한다", async () => {
  for (const mutate of [
    item => { item.reference.commit = "fabe066"; },
    item => { item.reference.path = "assets/daily/2026-11-01.webp"; },
    item => { item.reference.path = "assets/daily/2026-10-21.webp"; },
    item => { item.reference.path = "assets/daily/2026-10-27.webp"; },
    item => { item.independentReview.result = "pending"; },
    item => { item.independentReview.reviewer = item.authorReview.reviewer; },
    item => { item.provenance.details = ""; },
    item => { item.authorReview.reviewedAt = "not-a-date"; }
  ]) {
    const record = manifest(); mutate(record.reviews[0]);
    await assert.rejects(check([post], record));
  }
  const duplicate = manifest(); duplicate.reviews.push(structuredClone(review));
  await assert.rejects(check([post], duplicate), /중복/);
});


test("같은 그림으로 여러 날짜를 채우는 작업은 차단한다", async () => {
  const another = { ...post, id: "daily-2026-10-02", date: "2026-10-02", coverImage: { ...post.coverImage, date: "2026-10-02", src: "assets/daily/2026-10-02.webp" } };
  const records = manifest();
  records.reviews.push({ ...structuredClone(review), date: another.date, contentSha256: contentDigest(another) });
  await assert.rejects(check([post, another], records), /같은 이미지 재사용/);
});
