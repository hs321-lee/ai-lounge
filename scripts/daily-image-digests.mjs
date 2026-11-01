import { readFile } from "node:fs/promises";
import { contentDigest, imageDigest, webpSize } from "./daily-images.mjs";
const { posts } = JSON.parse(await readFile(new URL("../data/posts.json", import.meta.url), "utf8"));
for (const post of posts.filter(item => item.type === "daily" && item.published !== false)) {
  const buffer = await readFile(new URL(`../assets/daily/${post.date}.webp`, import.meta.url));
  console.log(JSON.stringify({ date: post.date, imageSha256: imageDigest(buffer), contentSha256: contentDigest(post), ...webpSize(buffer) }));
}
