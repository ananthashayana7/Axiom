import fs from "node:fs/promises";
import JSZip from "jszip";

const input = process.argv[2];
if (!input) {
  throw new Error("Usage: node inspect_deck_text.mjs <pptx>");
}

function decodeXml(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

const zip = await JSZip.loadAsync(await fs.readFile(input));
const slideNames = Object.keys(zip.files)
  .filter((name) => name.startsWith("ppt/slides/slide") && name.endsWith(".xml"))
  .sort((a, b) => Number(a.match(/slide(\d+)/)[1]) - Number(b.match(/slide(\d+)/)[1]));

for (const name of slideNames) {
  const xml = await zip.file(name).async("string");
  const text = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
    .map((match) => decodeXml(match[1]).trim())
    .filter(Boolean)
    .join(" | ");
  console.log(`${name.replace("ppt/slides/", "")}: ${text}`);
}
