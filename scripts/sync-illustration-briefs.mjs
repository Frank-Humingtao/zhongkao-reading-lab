#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { buildIllustrationModel, listBriefFiles, repoRoot } from "./illustration-lib.mjs";

const check = process.argv.includes("--check");
const model = buildIllustrationModel();
const mismatches = [];

for (const [relative, content] of model.files) {
  const absolute = path.join(repoRoot, relative);
  const current = fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : null;
  if (current !== content) mismatches.push(relative);
}

const expectedBriefs = new Set([...model.files.keys()].filter(name => name.startsWith("illustrations/briefs/")));
for (const relative of listBriefFiles()) {
  if (!expectedBriefs.has(relative)) mismatches.push(`${relative}（多余文件）`);
}

if (check) {
  if (mismatches.length || model.dimensionProblems.length) {
    for (const relative of mismatches) console.error(`过期：${relative}`);
    for (const problem of model.dimensionProblems) console.error(problem);
    console.error("运行 node scripts/sync-illustration-briefs.mjs 重新生成。尺寸不对的 JPEG 不要替换，除非主人点名重画。");
    process.exitCode = 1;
  }
} else {
  for (const [relative, content] of model.files) {
    const absolute = path.join(repoRoot, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    if (!fs.existsSync(absolute) || fs.readFileSync(absolute, "utf8") !== content) {
      fs.writeFileSync(absolute, content);
    }
  }
  for (const relative of listBriefFiles()) {
    if (!expectedBriefs.has(relative)) fs.unlinkSync(path.join(repoRoot, relative));
  }
  console.log(`已更新 ${model.files.size} 个插画索引文件。缺图 ${model.missing.length} 张。`);
  for (const problem of model.dimensionProblems) console.error(problem);
  if (model.dimensionProblems.length) process.exitCode = 1;
}
