import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { validateDailyImages } from "./daily-images.mjs";
const data = JSON.parse(await readFile(new URL("../data/posts.json", import.meta.url), "utf8"));
assert.equal(data.schemaVersion, 1, "지원하는 schemaVersion은 1입니다.");
assert.ok(Array.isArray(data.posts), "posts는 배열이어야 합니다.");
const ids = new Set();
const requiredText = (value, context) => assert.ok(typeof value === "string" && value.trim(), `${context} 필요`);
const https = (value, context) => assert.equal(new URL(value).protocol, "https:", `${context}: HTTPS만 허용`);
const validDate = (value, context) => {
  assert.match(value, /^\d{4}-\d{2}-\d{2}$/, `${context}: 날짜 형식`);
  const parsed = new Date(`${value}T00:00:00Z`);
  assert.ok(!Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0,10) === value, `${context}: 잘못된 날짜`);
};
for (const post of data.posts) {
  assert.match(post.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, "id 형식 오류");
  assert.ok(!ids.has(post.id), `중복 id: ${post.id}`); ids.add(post.id);
  assert.ok(["guide", "monthly", "daily"].includes(post.type), `type 오류: ${post.id}`);
  for (const key of ["title", "summary", "author", "date"]) assert.ok(typeof post[key] === "string" && post[key].trim(), `${post.id}: ${key} 필요`);
  assert.match(post.date, /^\d{4}-\d{2}-\d{2}$/);
  const date = new Date(`${post.date}T00:00:00Z`);
  assert.ok(!Number.isNaN(date.valueOf()) && date.toISOString().slice(0,10) === post.date, `잘못된 날짜: ${post.id}`);
  assert.ok(Array.isArray(post.tags) && post.tags.every(tag=>typeof tag === "string" && tag.trim()), `${post.id}: tags 오류`);
  if (post.published !== undefined) assert.equal(typeof post.published, "boolean", `${post.id}: published는 boolean 필요`);
  if (post.sourceMonth !== undefined) {
    assert.equal(post.type, "guide", `${post.id}: sourceMonth는 guide 전용`);
    assert.match(post.sourceMonth, /^\d{4}-(?:0[1-9]|1[0-2])$/, `${post.id}: 원자료 월 YYYY-MM 필요`);
  }
  if (post.sourceLabel !== undefined) requiredText(post.sourceLabel, `${post.id}: sourceLabel`);
  if (post.sourcePreview !== undefined) {
    const preview = post.sourcePreview;
    assert.equal(post.type, "guide", `${post.id}: sourcePreview는 guide 전용`);
    assert.ok(preview && typeof preview === "object" && !Array.isArray(preview), `${post.id}: sourcePreview 객체 필요`);
    for (const key of ["title", "byline"]) requiredText(preview[key], `${post.id}: sourcePreview ${key}`);
    if (preview.src !== undefined) {
      assert.match(preview.src, /^assets\/(?:dental|sources)\/[a-z0-9-]+\.webp$/, `${post.id}: 원자료 대표 이미지 경로 오류`);
      for (const key of ["alt", "caption"]) requiredText(preview[key], `${post.id}: sourcePreview ${key}`);
      for (const key of ["width", "height"]) assert.ok(Number.isInteger(preview[key]) && preview[key] > 0, `${post.id}: sourcePreview ${key} 필요`);
      assert.ok((await readFile(new URL(`../${preview.src}`, import.meta.url))).length > 0, `${post.id}: 빈 원자료 이미지`);
    }
  }
  if (post.noteImage !== undefined) {
    const note = post.noteImage;
    assert.equal(post.type, "guide", `${post.id}: noteImage는 guide 전용`);
    assert.ok(note && typeof note === "object" && !Array.isArray(note), `${post.id}: noteImage 객체 필요`);
    assert.equal(note.src, `assets/insights/${post.id}.webp`, `${post.id}: 글별 노트 이미지 경로 필요`);
    for (const key of ["alt", "caption"]) requiredText(note[key], `${post.id}: noteImage ${key}`);
    for (const key of ["width", "height"]) assert.ok(Number.isInteger(note[key]) && note[key] > 0, `${post.id}: noteImage ${key} 필요`);
    assert.ok((await readFile(new URL(`../${note.src}`, import.meta.url))).length > 0, `${post.id}: 빈 노트 이미지`);
  }
  if (post.coverImage !== undefined) {
    const cover = post.coverImage;
    assert.equal(post.type, "daily", `${post.id}: coverImage는 daily 전용`);
    assert.ok(cover && typeof cover === "object" && !Array.isArray(cover), `${post.id}: coverImage 객체 필요`);
    assert.equal(cover.date, post.date, `${post.id}: 이미지 날짜 불일치`);
    assert.equal(cover.src, `assets/daily/${post.date}.webp`, `${post.id}: 날짜별 이미지 경로 필요`);
    requiredText(cover.alt, `${post.id}: 이미지 alt`);
    for (const key of ["width", "height"]) assert.ok(Number.isInteger(cover[key]) && cover[key] > 0, `${post.id}: 이미지 ${key} 필요`);
    assert.ok((await readFile(new URL(`../${cover.src}`, import.meta.url))).length > 0, `${post.id}: 빈 이미지`);
  }
  if (post.highlights !== undefined) assert.ok(Array.isArray(post.highlights) && post.highlights.length <= 3 && post.highlights.every(item=>typeof item === "string" && item.trim()), `${post.id}: highlights 오류`);
  if (post.coverNote !== undefined) requiredText(post.coverNote, `${post.id}: coverNote`);
  if (post.coverArt !== undefined) {
    assert.equal(post.type, "monthly", `${post.id}: coverArt는 월간 발표 전용`);
    const cover = post.coverArt;
    assert.match(cover.src, /^assets\/ai-specialist\/[a-z0-9-]+\.webp$/);
    requiredText(cover.alt, `${post.id}: coverArt alt`);
    for (const key of ["width", "height"]) assert.ok(Number.isInteger(cover[key]) && cover[key] > 0, `${post.id}: coverArt ${key} 필요`);
    await readFile(new URL(`../${cover.src}`, import.meta.url));
  }
  if (post.coverTopics !== undefined) {
    assert.equal(post.type, "monthly", `${post.id}: coverTopics는 월간 발표 전용`);
    assert.ok(Array.isArray(post.coverTopics) && post.coverTopics.length, `${post.id}: coverTopics 배열 필요`);
    for (const topic of post.coverTopics) {
      requiredText(topic.title, `${post.id}: coverTopics title`);
      requiredText(topic.description, `${post.id}: coverTopics description`);
    }
  }
  if (post.radar !== undefined) {
    assert.ok(Array.isArray(post.radar), `${post.id}: radar 배열 필요`);
    for (const repo of post.radar) {
      for (const key of ["label", "repo", "description", "signal", "why", "try", "limitation"]) requiredText(repo[key], `${post.id}: radar ${key}`);
      if (repo.headline !== undefined) requiredText(repo.headline, `${post.id}: radar headline`);
      assert.match(repo.repo, /^[\w.-]+\/[\w.-]+$/, `${post.id}: repo 형식 오류`);
      https(repo.url, `${post.id}: radar url`); https(repo.sourceUrl, `${post.id}: radar sourceUrl`);
      assert.equal(new URL(repo.url).hostname, "github.com", `${post.id}: radar는 GitHub 저장소 URL 필요`);
      validDate(repo.checkedAt, `${post.id}: radar checkedAt`);
    }
  }
  if (post.recipe !== undefined) {
    for (const key of ["heading", "description", "prompt", "limitation"]) requiredText(post.recipe[key], `${post.id}: recipe ${key}`);
    assert.ok(Array.isArray(post.recipe.steps) && post.recipe.steps.length && post.recipe.steps.every(step=>typeof step === "string" && step.trim()), `${post.id}: recipe steps 필요`);
  }
  if (post.monthlyCandidates !== undefined) {
    assert.ok(Array.isArray(post.monthlyCandidates), `${post.id}: monthlyCandidates 배열 필요`);
    for (const candidate of post.monthlyCandidates) {
      requiredText(candidate.title, `${post.id}: candidate title`); requiredText(candidate.reason, `${post.id}: candidate reason`); https(candidate.url, `${post.id}: candidate url`);
    }
  }
  assert.ok(Array.isArray(post.sections) && post.sections.length, `${post.id}: sections 필요`);
  if (post.presentation !== undefined) {
    assert.equal(post.type, "monthly");
    assert.equal(post.presentation, "slides");
  }
  if (post.coverBenefits !== undefined) {
    assert.equal(post.presentation, "slides", `${post.id}: 인증 혜택은 슬라이드 표지 전용`);
    const {title, items, note} = post.coverBenefits;
    requiredText(title, `${post.id}: 혜택 제목`);
    requiredText(note, `${post.id}: 혜택 안내 기준`);
    for (const key of ["condition", "exception"]) {
      if (post.coverBenefits[key] !== undefined) requiredText(post.coverBenefits[key], `${post.id}: 인증 혜택 ${key}`);
    }
    assert.ok(Array.isArray(items) && items.length, `${post.id}: 혜택 항목 필요`);
    for (const {label, value} of items) {
      requiredText(label, `${post.id}: 혜택 항목 이름`);
      requiredText(value, `${post.id}: 혜택 항목 값`);
    }
  }
  for (const section of post.sections) {
    if (post.presentation === "slides") {
      requiredText(section.label, `${post.id}: 슬라이드 주제`);
      assert.ok(section.briefing || section.courseSource, `${post.id}: 브리핑 또는 수업 자료 출처 필요`);
      if (section.coursePath !== undefined) {
        assert.ok(Array.isArray(section.coursePath) && section.coursePath.length === 3, `${post.id}: 수강 과정 세 단계 필요`);
        for (const course of section.coursePath) {
          for (const key of ["title", "focus"]) requiredText(course[key], `${post.id}: 수강 과정 ${key}`);
          assert.ok(Array.isArray(course.keywords) && course.keywords.length, `${post.id}: 수강 과정 키워드 필요`);
          for (const keyword of course.keywords) requiredText(keyword, `${post.id}: 수강 과정 키워드`);
          assert.ok(Number.isInteger(course.days) && course.days > 0, `${post.id}: 수강 과정 일수 필요`);
          if (course.durationNote !== undefined) requiredText(course.durationNote, `${post.id}: 수강 과정 일수 기준`);
        }
      }
      if (section.bodyMotion !== undefined) assert.ok(["contrast"].includes(section.bodyMotion), `${post.id}: bodyMotion 값 오류`);
      if (section.figureLayout !== undefined) {
        const {figureLayout, media = []} = section;
        assert.ok(["notebooks", "pair", "recap", "feature"].includes(figureLayout));
        if (figureLayout === "recap") {
          assert.deepEqual(media.map(item => item.diagram), ["attention", "quantization", "rag"], `${post.id}: 복습 도식 세 개 필요`);
          for (const item of media) {
            requiredText(item.diagramAlt, `${post.id}: 복습 도식 대체 텍스트`);
            requiredText(item.description, `${post.id}: 복습 도식 설명`);
            // Blender 3D 장면: 정지 그림·재생 영상·투영 라벨이 모두 있어야 합니다.
            const model = item.model;
            assert.ok(model && typeof model === "object", `${post.id}: ${item.diagram} 3D 모델 필요`);
            assert.equal(model.still, `assets/ai-specialist/recap-3d-${item.diagram}.webp`, `${post.id}: 3D 정지 그림 경로`);
            assert.equal(model.glb, `assets/ai-specialist/recap-3d-${item.diagram}.glb`, `${post.id}: 3D 모델(GLB) 경로`);
            for (const key of ["width", "height"]) assert.ok(Number.isInteger(model[key]) && model[key] > 0, `${post.id}: 3D ${key}`);
            for (const file of [model.still, model.glb]) assert.ok((await readFile(new URL(`../${file}`, import.meta.url))).length > 0, `${post.id}: 빈 3D 파일 ${file}`);
            // GLB 머리(12바이트) 뒤 첫 청크가 JSON입니다. 라벨 기준점 노드 이름을 확인합니다.
            const glb = await readFile(new URL(`../${model.glb}`, import.meta.url));
            assert.equal(glb.toString("latin1", 0, 4), "glTF", `${post.id}: GLB 형식 아님`);
            const glbJson = JSON.parse(glb.toString("utf8", 20, 20 + glb.readUInt32LE(12)));
            const glbNodes = new Set(glbJson.nodes.map(node => node.name));
            assert.ok(glbJson.animations?.length && glbJson.cameras?.length, `${post.id}: GLB 애니메이션·카메라 필요`);
            assert.ok(Array.isArray(model.labels) && model.labels.length, `${post.id}: 3D 라벨 필요`);
            for (const label of model.labels) {
              requiredText(label.text, `${post.id}: 3D 라벨 문구`);
              assert.match(label.anchor, /^[a-z]+[0-9]?$/, `${post.id}: 3D 라벨 기준점`);
              assert.ok(glbNodes.has(`anchor_${label.anchor}`), `${post.id}: ${model.glb}에 anchor_${label.anchor} 없음`);
              assert.ok(["key", "plain", "quiet"].includes(label.tone), `${post.id}: 3D 라벨 종류 ${label.tone}`);
              for (const axis of ["x", "y"]) assert.ok(Number.isFinite(label[axis]) && label[axis] >= 0 && label[axis] <= 100, `${post.id}: 3D 라벨 ${axis} 범위`);
            }
          }
        } else {
          assert.equal(media.length, {notebooks:3, pair:2, feature:1}[figureLayout], `${post.id}: 그림 수와 배치 불일치`);
        }
      }
      if (section.schedule !== undefined) {
        assert.ok(Array.isArray(section.schedule) && section.schedule.length);
        let previousMonth = "";
        for (const {month, events} of section.schedule) {
          assert.match(month, /^20\d{2}-(0[1-9]|1[0-2])$/);
          assert.ok(month > previousMonth, `${post.id}: 일정 월은 시간순으로 한 번만 사용`);
          previousMonth = month;
          const [year, monthNumber] = month.split("-").map(Number);
          const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
          assert.ok(Array.isArray(events) && events.length);
          let previousEnd = 0;
          for (const {start, end = start, label, activity, kind, subject} of events) {
            assert.ok(Number.isInteger(start) && Number.isInteger(end) && start > previousEnd && end >= start && end <= lastDay, `${post.id}: 달력 일정 날짜 범위`);
            previousEnd = end;
            requiredText(label, `${post.id}: 달력 일정 이름`);
            requiredText(activity, `${post.id}: 달력 일정 설명`);
            assert.ok(["class", "project", "exam"].includes(kind));
            if (subject !== undefined) {
              assert.equal(kind, "class");
              assert.ok(["llm", "vision", "on-device", "data", "rag"].includes(subject));
            }
          }
        }
      }
      if (section.applicationSteps !== undefined) {
        assert.ok(Array.isArray(section.applicationSteps) && section.applicationSteps.length);
        for (const {label, detail} of section.applicationSteps) {
          requiredText(label, `${post.id}: 적용 단계 이름`);
          requiredText(detail, `${post.id}: 적용 단계 설명`);
        }
      }
      if (section.studyExamples !== undefined) {
        assert.ok(Array.isArray(section.studyExamples) && section.studyExamples.length);
        for (const example of section.studyExamples) {
          requiredText(example.label, `${post.id}: 복습 자료 이름`);
          requiredText(example.detail, `${post.id}: 복습 자료 설명`);
          if (example.code !== undefined) requiredText(example.code, `${post.id}: 복습 코드`);
        }
      }
      if (section.spotlight !== undefined) assert.equal(typeof section.spotlight, "boolean");
      if (section.statsCaption !== undefined) {
        requiredText(section.statsCaption, `${post.id}: 실습 그림 설명`);
        assert.equal(section.stats?.length, 2, `${post.id}: 실습의 입력과 결과 필요`);
      }
      if (section.codeCaption !== undefined) {
        requiredText(section.codeCaption, `${post.id}: 코드 요약 이름`);
        assert.ok(section.code?.length, `${post.id}: 코드 예시 필요`);
      }
      if (section.linkLabel !== undefined) {
        requiredText(section.linkLabel, `${post.id}: 자료 링크 이름`);
        https(section.url, `${post.id}: 자료 링크 주소`);
      }
    }
    assert.ok(typeof section.heading === "string" && section.heading.trim(), `${post.id}: heading 필요`);
    assert.equal(typeof section.body, "string", `${post.id}: body 필요`);
    for (const key of ["label", "takeaway", "action", "summary", "relevance"]) if (section[key] !== undefined) requiredText(section[key], `${post.id}: section ${key}`);
    if (section.conceptIllustration !== undefined) {
      assert.equal(post.type, "monthly");
      assert.equal(typeof section.conceptIllustration, "boolean");
      if (section.conceptIllustration) assert.ok(section.media?.length, `${post.id}: 개념 그림 필요`);
    }
    if (section.generationExample !== undefined) {
      assert.equal(post.type, "monthly");
      const { prompt, tokens } = section.generationExample;
      requiredText(prompt, `${post.id}: 이어쓰기 시작 문구`);
      assert.ok(Array.isArray(tokens) && tokens.length, `${post.id}: 이어쓰기 토큰 필요`);
      for (const token of tokens) requiredText(token, `${post.id}: 토큰`);
    }
    if (section.instructorQuote !== undefined) {
      assert.equal(post.type, "monthly");
      requiredText(section.instructorQuote.text, `${post.id}: 강사 인용문`);
      requiredText(section.instructorQuote.attribution, `${post.id}: 강사 인용 출처`);
    }
    if (section.courseSource !== undefined) {
      assert.equal(post.type, "monthly");
      requiredText(section.courseSource.label, `${post.id}: 수업 자료 이름`);
      requiredText(section.courseSource.detail, `${post.id}: 수업 자료 근거`);
    }
    if (section.briefing !== undefined) {
      assert.equal(post.presentation, "slides", `${post.id}: 발표 브리핑은 슬라이드 전용`);
      assert.ok(Array.isArray(section.briefing) && section.briefing.length === 3, `${post.id}: 브리핑은 세 건이어야 합니다.`);
      for (const item of section.briefing) {
        for (const key of ["publisher", "headline", "stat", "statLabel", "summary"]) requiredText(item[key], `${post.id}: 브리핑 ${key}`);
        validDate(item.date, `${post.id}: 브리핑 날짜`);
        assert.ok(Array.isArray(item.sources) && item.sources.length, `${post.id}: 브리핑 출처 필요`);
        for (const source of item.sources) {
          requiredText(source.title, `${post.id}: 브리핑 출처 이름`);
          https(source.url, `${post.id}: 브리핑 출처 URL`);
        }
      }
    }
    if (section.speakerNotes !== undefined) {
      assert.equal(post.type, "monthly", `${post.id}: speakerNotes는 월간 발표 전용`);
      requiredText(section.speakerNotes, `${post.id}: speakerNotes`);
    }
    if (section.insightId !== undefined) {
      assert.equal(post.type, "monthly", `${post.id}: insightId는 월간 소개 전용`);
      assert.equal(section.kind, "chapter", `${post.id}: insightId는 chapter 전용`);
      assert.ok(data.posts.some(guide => guide.id === section.insightId && guide.type === "guide" && guide.published === true), `${post.id}: 발행된 인사이트 ID 필요`);
    }
    if (section.date !== undefined) validDate(section.date, `${post.id}: section date`);
    if (section.url !== undefined) https(section.url, `${post.id}: section url`);
    if (section.kind !== undefined) {
      assert.equal(section.kind, "chapter", `${post.id}: kind는 chapter만 허용`);
      assert.ok(typeof section.part === "string" && section.part.trim(), `${post.id}: chapter part 필요`);
      assert.equal(new URL(section.url).protocol, "https:", `${post.id}: chapter url은 HTTPS`);
    } else if (!section.media && !section.stats && !section.points && !section.steps && !section.code && !(post.presentation === "slides" && (section.coursePath || section.briefing))) {
      assert.ok(section.body.trim() || section.instructorQuote?.text.trim(), `${post.id}: 내용 없는 장면: ${section.heading}`);
    }
    for (const key of ["points", "steps", "code"]) if (section[key] !== undefined) assert.ok(Array.isArray(section[key]) && section[key].every(item=>typeof item === "string" && item.trim()), `${post.id}: ${key} 오류`);
    if (section.stats !== undefined) assert.ok(Array.isArray(section.stats) && section.stats.every(stat=>stat.value?.trim() && stat.label?.trim()), `${post.id}: stats 오류`);
    if (section.media === undefined) continue;
    assert.ok(Array.isArray(section.media) && section.media.length, `${post.id}: media는 배열이어야 합니다.`);
    for (const media of section.media) {
      assert.match(media.src, /^assets\/(?:dental|herdr|ai-specialist)\/[a-z0-9-]+\.(?:webp|png|jpg)$/);
      for (const key of ["alt", "caption"]) assert.ok(typeof media[key] === "string" && media[key].trim(), `${post.id}: media ${key} 필요`);
      for (const key of ["width", "height"]) assert.ok(Number.isInteger(media[key]) && media[key] > 0, `${post.id}: media ${key} 필요`);
      if (media.excerpt !== undefined) {
        assert.equal(post.presentation, "slides");
        const { top, bottom, alt } = media.excerpt;
        assert.ok(Number.isInteger(top) && Number.isInteger(bottom) && top >= 0 && top < bottom && bottom <= media.height, `${post.id}: 그림 발췌 영역 오류`);
        requiredText(alt, `${post.id}: 그림 발췌 설명`);
      }
      await readFile(new URL(`../${media.src}`, import.meta.url));
    }
  }
  assert.ok(Array.isArray(post.sources), `${post.id}: sources는 배열이어야 합니다.`);
  if (post.type === "daily") assert.ok(post.sources.length, `${post.id}: 데일리 원문 출처 필요`);
  for (const source of post.sources) {
    assert.ok(typeof source.title === "string" && source.title.trim());
    assert.equal(new URL(source.url).protocol, "https:", `${post.id}: HTTPS 출처만 허용`);
  }
}
const imageReviews = JSON.parse(await readFile(new URL("../docs/daily-image-reviews.json", import.meta.url), "utf8"));
await validateDailyImages(data.posts, imageReviews);
console.log(`콘텐츠 검사 통과: ${data.posts.length}건, 고유 ID·날짜·필수 필드·출처 확인`);
