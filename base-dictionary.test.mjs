import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { formatContent } from "./content.js";
import { buildBaseDictionary, CONTRACTIONS, parseCsv, shortenTranslation } from "./scripts/base-dictionary.mjs";

const rows = parseCsv(readFileSync(new URL("./fixtures/ecdict-sample.csv", import.meta.url), "utf8"));
// The fixture's frequent words by rank: may 50, common 100, book 235, London 400,
// ice cream 500 (a phrase, never counted), net 800, algorithm 6819, astronomer 9000, hood 25000.
const dictionary = buildBaseDictionary(rows, { frequent: 5 });

test("the csv parser reads quoted fields with commas and escaped line breaks", () => {
  const book = rows.find(row => row.word === "book");
  assert.equal(book.tag, "zk gk ielts");
  assert.equal(book.translation, "n. 书, 书籍, 帐簿, 名册, 工作簿\\nv. 登记, 预订\\n[计] 工作簿");
});

test("words tagged zk, gk, cet4, cet6 or ky are kept", () => {
  assert.equal(dictionary.book, "n. 书；书籍；帐簿 v. 登记；预订");
  assert.equal(dictionary.astronomer, "n. 天文学家");
});

test("the most frequent words are kept, rare untagged ones are not", () => {
  assert.equal(dictionary.common, "adj. 普通的");
  assert.equal(dictionary.london, "n. 伦敦");
  assert.equal(dictionary.net, "网；网络；净");
  assert.equal(dictionary.algorithm, undefined);
  assert.equal(dictionary.hood, undefined);
  assert.equal(dictionary.rareword, undefined);
  assert.equal(buildBaseDictionary(rows, { frequent: 20000 }).algorithm, "n. 算法");
});

test("phrases, odd spellings and entries with no Chinese are left out", () => {
  assert.equal(dictionary["ice cream"], undefined);
  assert.equal(dictionary["english only"], undefined);
  assert.equal(dictionary["'hood"], undefined);
  assert.equal(dictionary.nochinese, undefined);
});

test("keys are lowercase and a lowercase entry wins over a capitalised one", () => {
  assert.equal(dictionary.may, "aux. 可能；可以");
  assert.ok(Object.keys(dictionary).every(key => key === key.toLowerCase()));
});

test("meanings keep two parts of speech and three senses each", () => {
  assert.equal(shortenTranslation("n. 头巾, 兜帽\\nv. 覆盖\\nadj. 戴头巾的"), "n. 头巾；兜帽 v. 覆盖");
  assert.equal(shortenTranslation("n. 一；二；三；四"), "n. 一；二；三");
  assert.equal(dictionary.saddle, "vt. 使(马,鹰等)戴鞍；使负担 n. 鞍");
  assert.equal(shortenTranslation("n. something"), "");
});

test("hand-written contractions are added and win over ECDICT", () => {
  assert.ok(Object.keys(CONTRACTIONS).length >= 30);
  assert.equal(dictionary["can't"], CONTRACTIONS["can't"]);
  for (const word of ["i've", "you're", "i'd", "won't"]) assert.ok(dictionary[word], word);
});

test("the file is a flat object, one sorted entry per line", () => {
  const text = formatContent(dictionary);
  assert.deepEqual(JSON.parse(text), dictionary);
  assert.deepEqual(Object.keys(dictionary), Object.keys(dictionary).toSorted());
  assert.equal(text.split("\n").length, Object.keys(dictionary).length + 3);
});

test("stray carriage returns and subject labels are dropped", () => {
  assert.equal(shortenTranslation("第一个字母 A；一个\\r\\nart. [计] 累加器；加法器"), "第一个字母 A；一个 art. 累加器；加法器");
});
