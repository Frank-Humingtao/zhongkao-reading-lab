#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { decidePlacement, jpegSize, repoRoot } from "./illustration-lib.mjs";

const scriptPath = fileURLToPath(import.meta.url);

function usage() {
  console.log(`用法：node scripts/place-illustration.mjs <jpg> [--set reading-04] [--replace] [--dry-run]

按 illustrations/catalog.json 把 JPEG 复制到约定路径。
默认不覆盖已有图片。尺寸必须是目录里登记的 960×640。`);
}

function parseArgs(argv) {
  let setId = null;
  let replace = false;
  let dryRun = false;
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--replace") replace = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--set") {
      setId = argv[index + 1];
      if (!setId) throw new Error("--set 后面要写套题 id，例如 reading-04 或 screening");
      index += 1;
    } else if (arg.startsWith("-")) {
      throw new Error(`未知参数 ${arg}`);
    } else positional.push(arg);
  }
  if (positional.length !== 1) throw new Error("请提供正好一个 JPEG 路径");
  return { setId, replace, dryRun, source: positional[0] };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }
  const catalogPath = path.join(repoRoot, "illustrations/catalog.json");
  if (!fs.existsSync(catalogPath)) {
    throw new Error("还没有 illustrations/catalog.json。先运行 node scripts/sync-illustration-briefs.mjs");
  }
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const source = path.resolve(options.source);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) throw new Error(`找不到文件 ${options.source}`);
  let size;
  try {
    size = jpegSize(fs.readFileSync(source));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 4;
    return;
  }
  const fileName = path.basename(source);
  const named = decidePlacement({
    catalog,
    fileName,
    setId: options.setId,
    replace: true,
    destinationExists: false,
    width: size.width,
    height: size.height
  });
  if (!named.ok) {
    console.error(named.message);
    process.exitCode = named.code;
    return;
  }
  const destination = path.join(repoRoot, ...named.output.split("/"));
  const sameFile = path.resolve(destination) === source;
  const decision = decidePlacement({
    catalog,
    fileName,
    setId: options.setId,
    replace: options.replace,
    destinationExists: fs.existsSync(destination) && !sameFile,
    width: size.width,
    height: size.height
  });
  if (!decision.ok) {
    console.error(decision.message);
    process.exitCode = decision.code;
    return;
  }
  if (sameFile) {
    console.log(`已经在约定路径：${decision.output}`);
    return;
  }
  if (options.dryRun) {
    console.log(`将复制到 ${decision.output}`);
    return;
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  const sync = spawnSync(process.execPath, [path.join(repoRoot, "scripts/sync-illustration-briefs.mjs")], {
    cwd: repoRoot,
    stdio: "inherit"
  });
  if (sync.status) process.exitCode = sync.status;
  console.log(`已放入 ${decision.output}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
