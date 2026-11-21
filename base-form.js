// The base form (原型) of a marked word: plural → singular, past tense / -ing → the verb.
// Marks keep whatever the page stored (sometimes "slipped" or "sleeves"); the board and
// the exports group and show them by this base form instead.
//
// `known` is an optional Set of headwords from the site's own word lists. A word that is
// itself a headword stays as it is ("interested", "building"); otherwise the first rule
// candidate that is a headword wins, and with no match the most likely candidate is used.

const IRREGULAR = Object.fromEntries(`
am:be is:be are:be was:be were:be been:be has:have had:have does:do did:do done:do
arose:arise arisen:arise ate:eat eaten:eat awoke:awake awoken:awake bore:bear born:bear borne:bear
beat:beat beaten:beat became:become began:begin begun:begin bent:bend bet:bet bit:bite bitten:bite
bled:bleed blew:blow blown:blow broke:break broken:break bred:breed brought:bring built:build burnt:burn
burst:burst bought:buy caught:catch chose:choose chosen:choose clung:cling came:come crept:creep
dealt:deal dug:dig dived:dive dove:dive drew:draw drawn:draw dreamt:dream drank:drink drunk:drink
drove:drive driven:drive dwelt:dwell fell:fall fallen:fall fed:feed felt:feel fought:fight found:find
fled:flee flung:fling flew:fly flown:fly forbade:forbid forbidden:forbid forgot:forget forgotten:forget
forgave:forgive forgiven:forgive froze:freeze frozen:freeze got:get gotten:get gave:give given:give
went:go gone:go ground:grind grew:grow grown:grow hung:hang heard:hear hid:hide hidden:hide held:hold
kept:keep knelt:kneel knew:know known:know laid:lay led:lead leant:lean leapt:leap learnt:learn left:leave
lent:lend lay:lie lain:lie lit:light lost:lose made:make meant:mean met:meet mistook:mistake
mistaken:mistake overcame:overcome overheard:overhear overtook:overtake overtaken:overtake paid:pay
proved:prove proven:prove rode:ride ridden:ride rang:ring rung:ring rose:rise risen:rise ran:run
said:say saw:see seen:see sought:seek sold:sell sent:send sewn:sew shook:shake shaken:shake shone:shine
shot:shoot showed:show shown:show shrank:shrink shrunk:shrink sang:sing sung:sing sank:sink sunk:sink
sat:sit slept:sleep slid:slide slung:sling smelt:smell spoke:speak spoken:speak sped:speed spelt:spell
spent:spend spilt:spill span:spin spun:spin spat:spit split:split spread:spread sprang:spring sprung:spring
stood:stand stole:steal stolen:steal stuck:stick stung:sting stank:stink strode:stride struck:strike
strove:strive swore:swear sworn:swear swept:sweep swam:swim swum:swim swung:swing took:take taken:take
taught:teach tore:tear torn:tear told:tell thought:think threw:throw thrown:throw trod:tread
trodden:tread understood:understand undertook:undertake upset:upset woke:wake woken:wake wore:wear
worn:wear wove:weave woven:weave wept:weep won:win wound:wind withdrew:withdraw wrung:wring wrote:write
written:write
children:child men:man women:woman feet:foot teeth:tooth geese:goose mice:mouse people:person
oxen:ox leaves:leaf knives:knife wives:wife lives:life shelves:shelf wolves:wolf halves:half
loaves:loaf thieves:thief calves:calf selves:self scarves:scarf potatoes:potato tomatoes:tomato
heroes:hero echoes:echo lying:lie dying:die tying:tie better:good best:good worse:bad worst:bad
`.trim().split(/\s+/).map(pair => pair.split(":")));

// Look inflected but are words in their own right.
const KEEP = new Set(`
news series species means trousers jeans glasses clothes scissors shorts pants stairs goods thanks
physics maths mathematics politics economics athletics gymnastics always perhaps sometimes towards
afterwards upstairs downstairs indoors outdoors overseas whereas besides headquarters
this thus yes bus gas plus his its us as was has does less unless across else chaos lens atlas canvas
christmas bias iris tennis focus bonus virus campus circus status minus surplus
morning evening nothing something anything everything thing string spring during ceiling
`.trim().split(/\s+/));

const VOWELS = "aeiou";
const isVowel = char => VOWELS.includes(char);
const syllables = stem => (stem.match(/[aeiouy]+/g) || []).length;

// Candidates for an -ed / -ing stem, most likely first.
function verbStems(stem) {
  if (stem.length < 2 || !/[aeiouy]/.test(stem)) return [];
  const last = stem.at(-1);
  const before = stem.at(-2);
  if (last === before && !"aeiouwxy".includes(last)) {
    if (!"lsfz".includes(last)) return [stem.slice(0, -1), stem];
    return last === "l" && syllables(stem) > 1 ? [stem.slice(0, -1), stem] : [stem, stem.slice(0, -1)];
  }
  if (stem.endsWith("i")) return [stem.slice(0, -1) + "y", stem + "e"];
  const singleVowel = isVowel(before) && !isVowel(stem.at(-3) ?? "");
  const shortStem = syllables(stem) === 1 && singleVowel && !isVowel(last) && !"wxy".includes(last);
  const needsE = /(?:c|[^n]g|(?:ch|r)ang|[^s]s|v|z|u|dg|[^aeiourl]l)$/.test(stem);
  return shortStem || needsE ? [stem + "e", stem] : [stem, stem + "e"];
}

function candidates(word) {
  if (word.endsWith("ies") && word.length > 4) return [word.slice(0, -3) + "y", word.slice(0, -1)];
  if (word.endsWith("ves") && word.length > 4) return [word.slice(0, -1), word.slice(0, -3) + "f", word.slice(0, -3) + "fe"];
  if (/(?:ch|sh|ss|x|zz|o)es$/.test(word)) return [word.slice(0, -2), word.slice(0, -1)];
  if (word.endsWith("es") && word.length > 3) return [word.slice(0, -1), word.slice(0, -2)];
  if (word.endsWith("s") && word.length > 3 && !/(?:ss|us|is|'s)$/.test(word)) return [word.slice(0, -1)];
  if (word.endsWith("ied") && word.length > 4) return [word.slice(0, -3) + "y"];
  if (word.endsWith("ed") && word.length > 3) return verbStems(word.slice(0, -2));
  if (word.endsWith("ing") && word.length > 5) {
    const stem = word.slice(0, -3);
    if (stem.endsWith("y")) return [stem];
    return verbStems(stem);
  }
  return [];
}

export function baseForm(word, known = null) {
  if (typeof word !== "string" || !/^[A-Za-z][A-Za-z'’-]*$/.test(word)) return word;
  const lower = word.toLowerCase();
  if (known?.has(lower) || known?.has(word)) return word;
  if (Object.hasOwn(IRREGULAR, lower)) return IRREGULAR[lower];
  if (KEEP.has(lower) || lower.includes("-")) return word;
  const options = candidates(lower).filter(option => option.length >= 2);
  if (!options.length) return word;
  return (known && options.find(option => known.has(option))) || options[0];
}
