// recap-motion.html을 1/30초 단위로 찍어 mp4로 묶습니다. 로컬 파일만 서빙하므로 서버가 필요 없습니다.
//
//   node scripts/motion/capture.mjs --frames <Blender anim 폴더> --fonts <글꼴 폴더> --out assets/ai-specialist/recap-motion.mp4
//   node scripts/motion/capture.mjs ... --at 3,12.5,20 --stills <폴더>   (지정 시각만 PNG로 확인)
//
// --frames 폴더 구조: attention/attention-0001.png … (recap-3d.py --mode anim 결과)
// --fonts 폴더: PretendardVariable.woff2, NanumMyeongjo-ExtraBold.ttf
import { createRequire } from "node:module";
import { spawn, execSync } from "node:child_process";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); } catch { playwright = require(path.join(execSync("npm root -g").toString().trim(), "playwright")); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => index % 2 ? pairs : [...pairs, [value.replace(/^--/, ""), all[index + 1]]], []));
for (const key of ["frames", "fonts"]) if (!args[key]) throw new Error(`--${key} 필요`);

const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".ttf": "font/ttf" };
function resolve(urlPath) {
  const p = decodeURIComponent(urlPath);
  if (p === "/" || p === "/recap-motion.html") return path.join(root, "scripts/motion/recap-motion.html");
  if (p.startsWith("/fonts/")) return path.join(path.resolve(args.fonts), p.slice(7));
  if (p.startsWith("/frames/")) return path.join(path.resolve(args.frames), p.slice(8));
  if (p.startsWith("/data/") || p.startsWith("/assets/")) return path.join(root, p.slice(1));
  return null;
}

const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on("pageerror", error => console.error("pageerror:", error.message));
await page.route("http://motion.test/**", async route => {
  const file = resolve(new URL(route.request().url()).pathname);
  if (!file || !existsSync(file)) { console.error("missing:", route.request().url()); return route.fulfill({ status: 404, body: "" }); }
  route.fulfill({ status: 200, body: await readFile(file), headers: { "content-type": types[path.extname(file)] || "application/octet-stream" } });
});
await page.goto("http://motion.test/recap-motion.html?capture=1");
await page.evaluate(() => window.__ready);
const { duration, fps } = await page.evaluate(() => ({ duration: window.__duration, fps: window.__fps }));
const stage = page.locator("#stage");

if (args.at) {
  const dir = path.resolve(args.stills || ".");
  await mkdir(dir, { recursive: true });
  for (const t of args.at.split(",").map(Number)) {
    await page.evaluate(time => window.__render(time), t);
    await stage.screenshot({ path: path.join(dir, `motion-${String(t).replace(".", "_")}.png`) });
  }
} else {
  const out = path.resolve(args.out || "recap-motion.mp4");
  const ffmpeg = spawn("ffmpeg", ["-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
  const total = Math.round(duration * fps);
  for (let frame = 0; frame < total; frame++) {
    await page.evaluate(time => window.__render(time), frame / fps);
    const png = await stage.screenshot({ type: "png" });
    if (!ffmpeg.stdin.write(png)) await new Promise(done => ffmpeg.stdin.once("drain", done));
    if (frame % 150 === 0) console.log(`frame ${frame}/${total}`);
  }
  ffmpeg.stdin.end();
  await new Promise((done, fail) => ffmpeg.on("close", code => code ? fail(new Error(`ffmpeg ${code}`)) : done()));
  console.log("saved", out);
}
await browser.close();
