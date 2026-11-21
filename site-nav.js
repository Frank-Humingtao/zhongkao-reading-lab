// The set switcher in the top bar of every page.
// To publish a new reading set, add one line to READING_SETS (newest last).
// News editions live in NEWS_EDITIONS so their 01, 02, 03 do not replace 生词复现.
(() => {
  const READING_SETS = [
    { id: "reading-01", number: "01", name: "生词复现" },
    { id: "reading-02", number: "02", name: "生词复现" },
    { id: "reading-03", number: "03", name: "生词复现" }
  ];
  const NEWS_EDITIONS = [
    { id: "daily-news-01", number: "01", name: "daily news", title: "daily news 01" }
  ];

  const root = document.getElementById("site-switch");
  if (!root) return;
  const button = root.querySelector(".switch-button");
  const label = root.querySelector(".switch-label");
  const menu = root.querySelector(".switch-menu");

  const onBoard = document.documentElement.dataset.page === "vocab";
  const setParam = new URLSearchParams(location.search).get("set");
  const known = [...READING_SETS, ...NEWS_EDITIONS].find(set => set.id === setParam);
  const current = onBoard ? "vocab" : known ? known.id : "screening";

  function item(href, id, number, name) {
    const link = document.createElement("a");
    link.href = href;
    if (id === current) link.setAttribute("aria-current", "page");
    const num = document.createElement("span");
    num.className = "set-number";
    num.textContent = number;
    link.append(num, name);
    return link;
  }

  function gap() {
    const node = document.createElement("div");
    node.className = "set-gap";
    return node;
  }
  menu.replaceChildren(
    item("./", "screening", "", "筛选短文"),
    gap(),
    ...[...READING_SETS].reverse().map(set => item("./?set=" + set.id, set.id, set.number, set.name)),
    gap(),
    ...[...NEWS_EDITIONS].reverse().map(set => item("./?set=" + set.id, set.id, set.number, set.name))
  );

  label.textContent = onBoard
    ? "生词看板"
    : known?.title || (known ? known.number + " " + known.name : "筛选短文");
  const vocabLink = document.getElementById("vocab-link");
  if (onBoard) vocabLink?.setAttribute("aria-current", "page");

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
})();
