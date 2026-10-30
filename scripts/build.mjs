import assert from "node:assert/strict";
import { copyFile, lstat, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

let site;
try {
  site = new URL(process.env.SITE_URL);
  assert(site.protocol === "https:" && !site.username && !site.password && site.pathname === "/" && !site.search && !site.hash);
} catch {
  throw new Error("SITE_URL must be the explicit production HTTPS origin, without credentials, path, query or fragment.");
}
const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "dist");
const oldBase = "https://hs321-lee.github.io/ai-lounge/";
const publicBase = `${site.origin}/`;
// Only these paths are public. Everything under assets/ is intentionally public.
const publicFiles = [];
async function inspectPublic(relative) {
  let source = root;
  let stat;
  for (const part of relative.split(path.sep)) {
    source = path.join(source, part);
    stat = await lstat(source);
    assert(!stat.isSymbolicLink(), `Public input cannot contain a symbolic link: ${relative}`);
  }
  if (stat.isDirectory()) {
    for (const name of await readdir(source)) await inspectPublic(path.join(relative, name));
  } else {
    assert(stat.isFile(), `Public output requires a regular file: ${relative}`);
    publicFiles.push(relative);
  }
}
// Preflight every source and ancestor before reading content or replacing dist.
for (const entry of ["index.html", "data/posts.json", "assets", "tokens.css", "skills/spec-six/SKILL.md"]) await inspectPublic(entry);
const html = (await readFile(path.join(root, "index.html"), "utf8")).replaceAll(oldBase, publicBase);
const data = JSON.parse(await readFile(path.join(root, "data/posts.json"), "utf8"));
data.posts = data.posts
  .filter(post => post.published !== false && (post.type !== "guide" || post.published === true))
  .map(({ monthlyCandidates, ...post }) => post);
await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, "data"), { recursive: true });
for (const file of publicFiles.filter(file => file !== "index.html" && file !== path.join("data", "posts.json"))) {
  await mkdir(path.dirname(path.join(output, file)), { recursive: true });
  await copyFile(path.join(root, file), path.join(output, file));
}
await writeFile(path.join(output, "index.html"), html);
await writeFile(path.join(output, "data/posts.json"), `${JSON.stringify(data, null, 2).replaceAll(oldBase, publicBase)}\n`);
console.log(`Built ${data.posts.length} public posts to dist/ for ${publicBase}`);
