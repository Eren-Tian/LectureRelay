// Splits Markdown notes into recall cards for the self-test view.

export interface RecallCard {
  /** Headings above this one, outermost first. */
  path: string[];
  heading: string;
  /** The Markdown between this heading and the next one. */
  body: string;
}

const plain = (text: string) =>
  text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~`]+/g, '')
    .trim();

/**
 * Each heading with text under it becomes a card: the heading is the prompt
 * and the text up to the next heading is the answer. Headings with nothing
 * under them only add to the path of the cards below.
 */
export function recallCards(markdown: string): RecallCard[] {
  const cards: RecallCard[] = [];
  const path: { level: number; text: string }[] = [];
  let current: { path: string[]; heading: string; lines: string[] } | null =
    null;
  let fenced = false;
  const close = () => {
    const body = current?.lines.join('\n').trim();
    if (current && body)
      cards.push({ path: current.path, heading: current.heading, body });
  };
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    const heading = fenced ? null : line.match(/^(#{1,6})\s+(.*)$/);
    if (!heading) {
      current?.lines.push(line);
      continue;
    }
    close();
    const level = heading[1].length,
      text = plain(heading[2]);
    while (path.length && path[path.length - 1].level >= level) path.pop();
    current = text
      ? { path: path.map((p) => p.text), heading: text, lines: [] }
      : null;
    if (text) path.push({ level, text });
  }
  close();
  return cards;
}
