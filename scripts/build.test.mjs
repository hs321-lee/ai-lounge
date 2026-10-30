import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const fixtureOrigin = "https://example.invalid"; // Reserved test address, never a deployment URL.
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "ai-lounge-build-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const dir of ["scripts", "assets", "data", "skills/spec-six", "docs", "dist"]) {
    await mkdir(path.join(root, dir), { recursive: true });
  }
  await cp(new URL("build.mjs", import.meta.url), path.join(root, "scripts/build.mjs"));
  await cp(new URL("../index.html", import.meta.url), path.join(root, "index.html"));
  for (const file of ["tokens.css", "assets/app.js", "skills/spec-six/SKILL.md", "docs/private.md", "README.md", ".env", "dist/stale-secret.txt"]) {
    await writeFile(path.join(root, file), file);
  }
  const data = { schemaVersion: 1, posts: [
    { id: "public-guide", type: "guide", published: true, sources: [{ url: "https://hs321-lee.github.io/ai-lounge/skills/spec-six/SKILL.md" }] },
    { id: "unpublished-guide", type: "guide" },
    { id: "private-guide", type: "guide", published: false },
    { id: "public-daily", type: "daily", monthlyCandidates: [{ title: "private preparation" }] },
    { id: "private-daily", type: "daily", published: false },
    { id: "public-monthly", type: "monthly" }
  ] };
  await writeFile(path.join(root, "data/posts.json"), JSON.stringify(data));
  return { root, data, run: value => spawnSync(process.execPath, ["scripts/build.mjs"], {
    cwd: root, encoding: "utf8", env: { ...process.env, SITE_URL: value }
  }) };
}

test("build emits only public files/data and uses the explicit production origin", async t => {
  const { root, data, run } = await fixture(t);
  const result = run(`${fixtureOrigin}/`);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual((await readdir(path.join(root, "dist"))).sort(), ["assets", "data", "index.html", "skills", "tokens.css"]);
  assert.equal(await readFile(path.join(root, "dist/skills/spec-six/SKILL.md"), "utf8"), "skills/spec-six/SKILL.md");
  const output = JSON.parse(await readFile(path.join(root, "dist/data/posts.json"), "utf8"));
  assert.deepEqual(output.posts.map(post => post.id), ["public-guide", "public-daily", "public-monthly"]);
  assert(!("monthlyCandidates" in output.posts[1]));
  assert.equal(output.posts[0].sources[0].url, `${fixtureOrigin}/skills/spec-six/SKILL.md`);
  const html = await readFile(path.join(root, "dist/index.html"), "utf8");
  assert(html.includes(`rel="canonical" href="${fixtureOrigin}/"`));
  assert(html.includes(`property="og:url" content="${fixtureOrigin}/"`));
  assert(html.includes(`property="og:image" content="${fixtureOrigin}/assets/sources/ai2027-cover.webp"`));
  assert.deepEqual(JSON.parse(await readFile(path.join(root, "data/posts.json"), "utf8")), data);
});

test("missing or unsafe SITE_URL fails before replacing the last build", async t => {
  const { root, run } = await fixture(t);
  for (const value of ["", "http://example.invalid", "https://user@example.invalid", "https://example.invalid/path", "https://example.invalid/?q=secret", "https://example.invalid/#preview"]) {
    const result = run(value);
    assert.notEqual(result.status, 0, value);
    assert.match(result.stderr, /SITE_URL/);
    assert.equal(await readFile(path.join(root, "dist/stale-secret.txt"), "utf8"), "dist/stale-secret.txt");
  }
});

test("public asset symlinks cannot expose files outside the output allowlist", async t => {
  const { root, run } = await fixture(t);
  await symlink(path.join(root, ".env"), path.join(root, "assets/leak.txt"));
  const result = run(fixtureOrigin);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /symbolic link/);
});

test("transformed inputs and allowed path ancestors reject symlinks before clearing dist", async t => {
  for (const entry of ["index.html", "data/posts.json", "data", "skills", "skills/spec-six", "assets"]) {
    const { root, run } = await fixture(t);
    await rm(path.join(root, entry), { recursive: true, force: true });
    await symlink(path.join(root, entry.includes(".") ? ".env" : "docs"), path.join(root, entry));
    const result = run(fixtureOrigin);
    assert.notEqual(result.status, 0, entry);
    assert.match(result.stderr, /symbolic link/, entry);
    assert.equal(await readFile(path.join(root, "dist/stale-secret.txt"), "utf8"), "dist/stale-secret.txt");
  }
});
