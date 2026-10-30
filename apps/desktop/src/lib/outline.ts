// Turns Markdown headings and list items into a tree for the mind map view.

export interface OutlineNode {
  text: string;
  children: OutlineNode[];
}

/** Plain text of a Markdown line: links keep their label, marks are dropped. */
const plain = (text: string) =>
  text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~`]+/g, '')
    .replace(/^\[[ xX]\]\s*/, '')
    .replace(/^#{1,6}\s+/, '')
    .trim();

/**
 * Headings nest by level and list items by indentation under the nearest
 * heading. Paragraphs, tables and code are left to the document view.
 */
export function outline(markdown: string): OutlineNode[] {
  const root: OutlineNode = { text: '', children: [] };
  // Each entry is a node and the depth it sits at; headings use 0–5 and
  // list items continue below the heading they follow.
  const stack: { node: OutlineNode; depth: number }[] = [
    { node: root, depth: -1 },
  ];
  let headingDepth = -1;
  let fenced = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    if (fenced) continue;
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    const item = line.match(/^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/);
    let depth: number;
    let text: string;
    if (heading) {
      depth = heading[1].length - 1;
      headingDepth = depth;
      text = plain(heading[2]);
    } else if (item) {
      depth =
        headingDepth + 1 + Math.floor(item[1].replace(/\t/g, '  ').length / 2);
      text = plain(item[2]);
    } else continue;
    if (!text) continue;
    while (stack.length > 1 && stack[stack.length - 1].depth >= depth)
      stack.pop();
    const node = { text, children: [] };
    stack[stack.length - 1].node.children.push(node);
    stack.push({ node, depth });
  }
  return root.children;
}
