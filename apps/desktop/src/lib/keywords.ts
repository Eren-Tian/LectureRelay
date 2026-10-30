// Frequent terms in an English transcript, for the transcript's keyword chips.
// Counting is local and deterministic; no model is involved.

const STOP = new Set(
  `a about above after again against all also am an and any are aren't as at be
because been before being below between both but by can can't cannot could
couldn't did didn't do does doesn't doing don't down during each few for from
further get gets getting got had hadn't has hasn't have haven't having he he's her
here here's hers herself him himself his how how's i i'd i'll i'm i've if in into
is isn't it it's its itself just let's like me more most mustn't my myself no
nor not now of off on once only or other ought our ours ourselves out over own
really right same she she'd she'll she's should shouldn't so some such than that
that's the their theirs them themselves then there there's these they they'd
they'll they're they've this those through to too under until up very was wasn't
we we'd we'll we're we've were weren't what what's when when's where where's which
while who who's whom why why's will with won't would wouldn't you you'd you'll
you're you've your yours yourself yourselves okay ok yeah yes um uh oh gonna
wanna kind sort thing things actually basically going know think see say said
make made way lot well one two three first next today let want need look good
much many something anything everything people mean means may might must shall
also lets talk talking go goes went come comes take takes put use used using
able back even still around another every thank thanks guys question questions
example call called across allow allows apart behind close compare different
difference important similar likely simply usually often always never sometimes
probably maybe whether within without among along upon via give gives given
show shows shown find found keep start end part parts case cases point points
number kinds type types set time times year years day new old big small large
high low long short last little less least great better best sure true else
ever hand change changes`.split(/\s+/),
);

const tokens = (text: string) =>
  [...text.matchAll(/[A-Za-z][A-Za-z'-]*[A-Za-z]/g)].map((m) => m[0]);
const content = (word: string) =>
  word.length >= 3 && !STOP.has(word.toLowerCase());

/**
 * Repeated phrases rank first. Among equal counts, acronyms and longer words
 * win, since they tend to be the lecture's technical terms.
 */
function score(key: string, count: number, form: string) {
  if (key.includes(' ')) return count * 2.5 + 0.3;
  const acronym = /^[A-Z]{2,}$/.test(form) ? 0.5 : 0;
  return count + acronym + Math.min(key.length, 12) / 40;
}

/** Up to `limit` terms, two-word phrases first when they repeat. */
export function keywords(texts: string[], limit = 10) {
  const counts = new Map<string, number>();
  const shown = new Map<string, string>();
  let total = 0;
  const add = (key: string, form: string) => {
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!shown.has(key)) shown.set(key, form);
  };
  for (const text of texts) {
    const words = tokens(text);
    total += words.length;
    words.forEach((word, i) => {
      if (!content(word)) return;
      add(word.toLowerCase(), word);
      const next = words[i + 1];
      if (next && content(next))
        add(`${word} ${next}`.toLowerCase(), `${word} ${next}`);
    });
  }
  // Longer transcripts need a term to repeat before it counts as a keyword.
  const minimum = total > 300 ? 2 : 1;
  const ranked = [...counts]
    .filter(([key, count]) => count >= (key.includes(' ') ? 2 : minimum))
    .map(([key, count]) => ({
      key,
      count,
      score: score(key, count, shown.get(key) ?? key),
    }))
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  const picked: { term: string; count: number }[] = [];
  for (const { key, count } of ranked) {
    // A word already inside a picked phrase adds nothing.
    if (picked.some((p) => p.term.toLowerCase().split(' ').includes(key)))
      continue;
    picked.push({ term: shown.get(key) ?? key, count });
    if (picked.length === limit) break;
  }
  return picked;
}
