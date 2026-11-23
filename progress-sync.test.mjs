import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import "./progress-sync.js";

const { createSyncer, decodeFile, encodeFile } = globalThis.progressSync;
const URL = "https://api.github.test/contents/progress-test.json";
const TOKEN = "github_pat_TEST";

// A stand-in for the GitHub Contents API holding one file. Nothing here talks to GitHub.
//   staleReads: how many GETs after each PUT still return the version before it,
//               as GitHub's read replicas do for a moment after a write.
function fakeGitHub({ records, staleReads = 0 } = {}) {
  const versions = [];
  let pendingStale = 0;
  const calls = [];
  function write(content) {
    const sha = createHash("sha1").update(content).digest("hex");
    versions.push({ sha, content });
    return sha;
  }
  if (records) write(encodeFile(new Map(Object.entries(records))));
  async function fetch(url, options = {}) {
    assert.equal(url, URL);
    const method = options.method ?? "GET";
    calls.push(method);
    const current = versions.at(-1);
    if (method === "GET") {
      const served = pendingStale > 0 && versions.length > 1 ? versions.at(-2) : current;
      if (pendingStale > 0) pendingStale--;
      if (!served) return response(404, { message: "Not Found" });
      return response(200, { sha: served.sha, content: served.content.replace(/(.{60})/g, "$1\n") });
    }
    const body = JSON.parse(options.body);
    if ((body.sha ?? null) !== (current?.sha ?? null)) {
      return response(current && !body.sha ? 422 : 409, { message: "sha does not match" });
    }
    const sha = write(body.content);
    pendingStale = staleReads;
    return response(current ? 200 : 201, { content: { sha }, commit: {} });
  }
  return {
    fetch,
    calls,
    records: () => new Map(Object.entries(decodeFile(versions.at(-1).content))),
    // Another device writes to the file.
    otherDeviceWrites(extra) {
      const merged = { ...decodeFile(versions.at(-1).content), ...extra };
      write(encodeFile(new Map(Object.entries(merged))));
    }
  };
}

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const decode = raw => new Map(Object.entries(raw));
const noWait = async () => {};

test("a mark made right after a sync reaches GitHub even while GitHub still serves the old file", async () => {
  const github = fakeGitHub({ records: { active: [1, "laptop", "read-01"] }, staleReads: 5 });
  const syncer = createSyncer({ fetch: github.fetch, url: URL, decode, wait: noWait });
  let local = new Map([["active", [1, "laptop", "read-01"]], ["mark/read-01/apple", [1, "phone", 0]]]);
  await syncer.sync(TOKEN, () => local);
  local = new Map([...local, ["mark/read-01/pear", [2, "phone", 1]]]);
  await syncer.sync(TOKEN, () => local);
  assert.deepEqual(github.records(), local);
});

test("a new progress file that GitHub does not show yet is not created twice", async () => {
  const github = fakeGitHub({ staleReads: 3 });
  const syncer = createSyncer({ fetch: github.fetch, url: URL, decode, wait: noWait });
  let local = new Map([["mark/read-01/apple", [1, "phone", 0]]]);
  await syncer.sync(TOKEN, () => local);
  local = new Map([...local, ["mark/read-01/pear", [2, "phone", 1]]]);
  await syncer.sync(TOKEN, () => local);
  assert.deepEqual(github.records(), local);
});

test("when another device wrote first, the sync waits, reads again and keeps both devices' marks", async () => {
  const github = fakeGitHub({ records: { active: [1, "laptop", "read-01"] } });
  const waits = [];
  let raced = false;
  const fetch = async (url, options = {}) => {
    // The laptop writes between this phone's read and its write, once.
    if (options.method === "PUT" && !raced) {
      raced = true;
      github.otherDeviceWrites({ "mark/read-01/kite": [5, "laptop", 0] });
    }
    return github.fetch(url, options);
  };
  const syncer = createSyncer({ fetch, url: URL, decode, wait: async ms => { waits.push(ms); } });
  const local = new Map([["mark/read-01/apple", [3, "phone", 0]]]);
  const merged = await syncer.sync(TOKEN, () => local);
  assert.equal(waits.length, 1);
  assert.deepEqual(github.records(), new Map([
    ["active", [1, "laptop", "read-01"]],
    ["mark/read-01/kite", [5, "laptop", 0]],
    ["mark/read-01/apple", [3, "phone", 0]]
  ]));
  assert.deepEqual(merged, github.records());
});

test("marks made while a sync waits to retry go out with that retry", async () => {
  const github = fakeGitHub({ records: { active: [1, "laptop", "read-01"] } });
  let raced = false;
  const fetch = async (url, options = {}) => {
    if (options.method === "PUT" && !raced) {
      raced = true;
      github.otherDeviceWrites({ "read/read-02": [5, "laptop", true] });
    }
    return github.fetch(url, options);
  };
  let local = new Map([["mark/read-01/apple", [3, "phone", 0]]]);
  const syncer = createSyncer({
    fetch, url: URL, decode,
    wait: async () => { local = new Map([...local, ["mark/read-01/pear", [6, "phone", 2]]]); }
  });
  await syncer.sync(TOKEN, () => local);
  assert.deepEqual(github.records().get("mark/read-01/pear"), [6, "phone", 2]);
});

test("after the retries run out the reader is told another device is syncing", async () => {
  const github = fakeGitHub({ records: { active: [1, "laptop", "read-01"] } });
  let clock = 10;
  const fetch = async (url, options = {}) => {
    if (options.method === "PUT") github.otherDeviceWrites({ ["mark/read-01/w" + clock]: [clock++, "laptop", 0] });
    return github.fetch(url, options);
  };
  const syncer = createSyncer({ fetch, url: URL, decode, wait: noWait });
  await assert.rejects(syncer.sync(TOKEN, () => new Map([["mark/read-01/apple", [3, "phone", 0]]])),
    { message: "有其他设备正在同步，请稍后再试。" });
});

test("a sync for a token the reader has disconnected stops without writing", async () => {
  const github = fakeGitHub({ records: { active: [1, "laptop", "read-01"] } });
  const syncer = createSyncer({ fetch: github.fetch, url: URL, decode, wait: noWait });
  const result = await syncer.sync(TOKEN, () => new Map([["mark/read-01/apple", [3, "phone", 0]]]), { isCurrent: () => false });
  assert.equal(result, undefined);
  assert.deepEqual(github.calls, ["GET"]);
});

test("an up-to-date file is read and not written", async () => {
  const github = fakeGitHub({ records: { active: [1, "laptop", "read-01"] } });
  const syncer = createSyncer({ fetch: github.fetch, url: URL, decode, wait: noWait });
  const merged = await syncer.sync(TOKEN, () => new Map());
  assert.deepEqual(merged, new Map([["active", [1, "laptop", "read-01"]]]));
  assert.deepEqual(github.calls, ["GET"]);
});

test("a write is sent with keepalive so it finishes when the reader leaves the page", async () => {
  const github = fakeGitHub();
  const sent = [];
  const fetch = (url, options = {}) => { sent.push(options); return github.fetch(url, options); };
  const syncer = createSyncer({ fetch, url: URL, decode, wait: noWait });
  await syncer.sync(TOKEN, () => new Map([["mark/read-01/apple", [3, "phone", 0]]]));
  assert.deepEqual(sent.map(options => [options.method ?? "GET", options.keepalive]), [["GET", false], ["PUT", true]]);
});

test("a sync the phone froze ends when it is aborted, so a fresh one can start", async () => {
  const controller = new AbortController();
  const fetch = (url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(options.signal.reason));
  });
  const syncer = createSyncer({ fetch, url: URL, decode, wait: noWait });
  const running = syncer.sync(TOKEN, () => new Map(), { abort: controller.signal });
  controller.abort();
  await assert.rejects(running, { name: "AbortError" });
});

test("a reading set with changes stays listed until its sync succeeds, across pages", () => {
  const storage = new Map();
  const local = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const { markPending, pendingFiles } = globalThis.progressSync;
  markPending(local, "progress-reading-01.json", "records-01", true);
  markPending(local, "progress.json", "records", true);
  markPending(local, "progress.json", "records", false);
  assert.deepEqual(pendingFiles(local), { "progress-reading-01.json": "records-01" });
});

test("another reading set's records pass through whole, whatever their fields", () => {
  const { wellFormedRecords } = globalThis.progressSync;
  assert.deepEqual(wellFormedRecords({
    "mark/news-01/quake": [5, "phone", 2],
    "future/kind": [6, "laptop", { any: "value" }],
    broken: [1, "phone"],
    negative: [-1, "phone", 0]
  }), new Map([["mark/news-01/quake", [5, "phone", 2]], ["future/kind", [6, "laptop", { any: "value" }]]]));
});

test("GitHub refusing the token is reported as such", async () => {
  const syncer = createSyncer({ fetch: async () => response(401, {}), url: URL, decode, wait: noWait });
  await assert.rejects(syncer.sync(TOKEN, () => new Map()), { message: "令牌已失效，请断开后重新连接。" });
});
