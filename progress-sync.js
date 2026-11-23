// Syncing a progress file with the private progress repository (GitHub Contents API).
// The file is {version: 1, records: {field: [clock, writer, value]}}; a field's newer
// record wins (ties by writer), so any two copies merge to the same result.
// A plain script so index.html can load it before its own script; it defines
// `progressSync` on the global object (tests import it the same way).
(function (root) {
  function mergeRecords(left, right) {
    const merged = new Map(left);
    for (const [field, incoming] of right) {
      const existing = merged.get(field);
      if (!existing || incoming[0] > existing[0]
        || (incoming[0] === existing[0] && incoming[1] > existing[1])) merged.set(field, incoming);
    }
    return merged;
  }

  function sameRecords(left, right) {
    return left.size === right.size && [...left].every(([field, record]) => {
      const other = right.get(field);
      return other && record.every((cell, index) => cell === other[index]);
    });
  }

  function encodeFile(records) {
    const bytes = new TextEncoder().encode(JSON.stringify({ version: 1, records: Object.fromEntries(records) }));
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    return btoa(binary);
  }

  // The records object of a file's base64 content.
  function decodeFile(content) {
    const binary = atob(content.replace(/\s/g, ""));
    const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, byte => byte.charCodeAt(0))));
    if (data.version !== 1 || !data.records || Array.isArray(data.records) || typeof data.records !== "object") {
      throw new Error("GitHub 上的进度文件格式不正确。");
    }
    return data.records;
  }

  function syncError(status) {
    if (status === 401) return new Error("令牌已失效，请断开后重新连接。");
    if (status === 403 || status === 404) return new Error("请检查令牌是否能读写私有进度仓库。");
    return new Error("同步失败（GitHub " + status + "），进度已保留在设备上。");
  }

  // One progress file's syncer.
  //   fetch    the fetch to use
  //   url      the file's Contents API URL
  //   decode   records object → Map of the records this page keeps
  //   wait     ms → promise, between retries after a conflict
  const RETRY_DELAYS = [700, 1500, 3000, 6000];
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  function createSyncer({ fetch, url, decode, wait = sleep }) {
    function request(token, abort, options = {}) {
      const headers = { Accept: "application/vnd.github+json", Authorization: "Bearer " + token };
      if (options.body) headers["Content-Type"] = "application/json";
      const timeout = AbortSignal.timeout?.(15000);
      return fetch(url, {
        ...options, headers, credentials: "omit", redirect: "error", cache: "no-store",
        // A write small enough for keepalive still finishes when the page is left.
        keepalive: Boolean(options.body && options.body.length < 60000),
        signal: abort && timeout && AbortSignal.any ? AbortSignal.any([abort, timeout]) : abort ?? timeout
      });
    }

    // Merges `local()` (a Map of records, read again on every attempt) with the
    // file and writes the result back when the file lacks any of it. Resolves to
    // the merged records, or undefined once `isCurrent()` turns false (the reader
    // disconnected or changed token).
    // Right after a write GitHub can still serve the version before it for a
    // while. The version this page last wrote is remembered, and a read of one it
    // has replaced is answered from memory instead.
    let written;
    const replaced = new Set();

    async function read(token, abort) {
      const response = await request(token, abort);
      if (!response.ok && response.status !== 404) throw syncError(response.status);
      const file = response.ok ? await response.json() : null;
      if (written && (!file || replaced.has(file.sha))) return written;
      return file && { sha: file.sha, records: decodeFile(file.content) };
    }

    // `abort` (an AbortSignal) ends a sync whose requests the phone froze.
    async function sync(token, local, { isCurrent = () => true, abort } = {}) {
      for (let attempt = 0; ; attempt++) {
        const file = await read(token, abort);
        if (!isCurrent()) return;
        const remote = file ? decode(file.records) : new Map();
        const merged = mergeRecords(local(), remote);
        if (file && sameRecords(merged, remote)) return merged;
        const content = encodeFile(merged);
        const result = await request(token, abort, {
          method: "PUT",
          body: JSON.stringify({ message: "Sync reading progress", content, ...(file && { sha: file.sha }) })
        });
        if (result.ok) {
          const sha = (await result.json().catch(() => null))?.content?.sha;
          if (file) replaced.add(file.sha);
          written = sha ? { sha, records: Object.fromEntries(merged) } : undefined;
          return merged;
        }
        if (result.status !== 409 && result.status !== 422) throw syncError(result.status);
        // Another device wrote first, or GitHub served an old version: read again.
        written = undefined;
        if (attempt >= RETRY_DELAYS.length || !isCurrent()) break;
        await wait(RETRY_DELAYS[attempt]);
        if (!isCurrent()) return;
      }
      throw new Error("有其他设备正在同步，请稍后再试。");
    }

    return { sync };
  }

  // Records whose shape is right, whatever their fields: for passing another
  // reading set's records through without dropping any.
  function wellFormedRecords(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return new Map();
    return new Map(Object.entries(raw).filter(([, record]) =>
      Array.isArray(record) && record.length === 3 && Number.isSafeInteger(record[0])
      && record[0] >= 0 && typeof record[1] === "string"));
  }

  // Which progress files have changes not yet on GitHub, kept across pages so a
  // reading set left before its sync finished is synced from the next page.
  // `storage` is localStorage; the value is {file: recordsKey}.
  const PENDING_KEY = "zhongkao-github-sync-pending-v1";
  function pendingFiles(storage) {
    try {
      const value = JSON.parse(storage.getItem(PENDING_KEY));
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }
  function markPending(storage, file, recordsKey, pending) {
    const files = pendingFiles(storage);
    if (pending) files[file] = recordsKey;
    else delete files[file];
    try {
      storage.setItem(PENDING_KEY, JSON.stringify(files));
    } catch {
      // Without storage the page still syncs while it is open.
    }
  }

  root.progressSync = Object.freeze({
    mergeRecords, sameRecords, encodeFile, decodeFile, createSyncer, wellFormedRecords, pendingFiles, markPending
  });
})(globalThis);
