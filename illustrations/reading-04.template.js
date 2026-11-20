// Copy this file to /reading-04.js when starting set 04. Do not link this template from index.html.
//
// Then, in index.html:
//   <script src="reading-04.js"></script>
//   ["reading-04", { data: readingSet04, progressId: "reading-04" }]
//   <li><a href="?set=reading-04" id="reading-material-04">04 生词复现</a></li>
// And add the same set to illustrations/editions.json (see the existing entries).
// progressId becomes a localStorage key. Do not change it after the set is published.
//
// illustration is the Chinese scene caption only. Do not put a filename there.
// The page loads images/reading-04/<story id>.jpg (960×640 JPEG) from the story id.
// Story ids must be lowercase and start with "reading-04-", for example "reading-04-paper-boat".
//
// Example story, to replace before publishing:
// {
//   id: "reading-04-paper-boat",
//   title: "Paper Boat",
//   topic: "纸船",
//   illustration: "雨后的窗台上，一个学生把纸船放进积着水的托盘。",
//   paragraphs: [
//     [
//       ["After the rain, I set a paper boat in a tray of water.", "雨停后，我把纸船放进一托盘水里。"]
//     ]
//   ]
// }

const readingSet04 = {
  words: {},
  stories: []
};
