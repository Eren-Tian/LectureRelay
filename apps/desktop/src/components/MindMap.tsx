import { ui } from '../i18n';
import { outline, type OutlineNode } from '../lib/outline';

/** A left-to-right mind map of a Markdown document's headings and lists. */
export function MindMap({ body, title }: { body: string; title: string }) {
  const nodes = outline(body);
  if (!nodes.length) return <p className="empty-state">{ui.mindMapEmpty}</p>;
  // A single top-level heading is the centre; otherwise the title is.
  const tree = nodes.length === 1 ? nodes[0] : { text: title, children: nodes };
  return (
    <div className="mindmap" role="tree" aria-label={ui.mindMapLabel}>
      <ul>
        <Branch node={tree} />
      </ul>
    </div>
  );
}

function Branch({ node }: { node: OutlineNode }) {
  return (
    <li role="treeitem" aria-expanded={node.children.length ? true : undefined}>
      <span className="mindmap-node">{node.text}</span>
      {node.children.length > 0 && (
        <ul role="group">
          {node.children.map((child, i) => (
            <Branch key={i} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}
