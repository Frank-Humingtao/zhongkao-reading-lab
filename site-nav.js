// The collection switcher in the top bar of every page. It lists what
// content/index.json lists (content.js): placement sets, review batches and
// news editions, newest first in each group. Publishing a collection never
// changes this file.

import { findCollection, loadManifest, switcherGroups } from "./content.js";

const root = document.getElementById("site-switch");
if (root) start(root);

async function start(root) {
  const button = root.querySelector(".switch-button");
  const label = root.querySelector(".switch-label");
  const menu = root.querySelector(".switch-menu");
  const onBoard = document.documentElement.dataset.page === "vocab";

  function setOpen(open) {
    menu.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  }
  button.addEventListener("click", () => setOpen(menu.hidden));
  document.addEventListener("click", event => {
    if (!menu.hidden && !root.contains(event.target)) setOpen(false);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !menu.hidden) {
      setOpen(false);
      button.focus();
    }
  });
  if (onBoard) {
    label.textContent = "生词看板";
    document.getElementById("vocab-link")?.setAttribute("aria-current", "page");
  }

  let collections = [];
  try {
    const response = await fetch("content/index.json", { cache: "no-cache" });
    if (response.ok) ({ collections } = await loadManifest(async () => response.text()));
  } catch {
    // Without the list the switcher stays empty; the page itself still works.
  }
  const current = onBoard ? null : findCollection(collections, new URLSearchParams(location.search).get("set"));
  if (!onBoard) label.textContent = current?.label ?? "";

  function item(collection) {
    const link = document.createElement("a");
    link.href = collection.href;
    if (collection === current) link.setAttribute("aria-current", "page");
    const number = document.createElement("span");
    number.className = "set-number";
    number.textContent = collection.number;
    link.append(number, collection.kindLabel);
    return link;
  }
  function gap() {
    const node = document.createElement("div");
    node.className = "set-gap";
    return node;
  }
  menu.replaceChildren(...switcherGroups(collections).flatMap((group, index) => [
    ...(index ? [gap()] : []),
    ...group.map(item)
  ]));
}
