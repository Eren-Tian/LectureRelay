import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// GitHub-flavored Markdown: tables, task lists and strikethrough in notes.
const plugins = [remarkGfm];

export function MarkdownBody({
  body,
  onSeek,
}: {
  body: string;
  onSeek?: (seconds: number) => void;
}) {
  return (
    <div className="markdown">
      <Markdown
        remarkPlugins={plugins}
        components={{
          a: ({ children, href }) => {
            const stamp = href?.match(/^#t=(\d+(?:\.\d+)?)$/);
            return stamp && onSeek ? (
              <button
                className="timestamp-link"
                onClick={() => onSeek(Number(stamp[1]))}
              >
                {children}
              </button>
            ) : (
              <span className="markdown-link">{children}</span>
            );
          },
          img: ({ alt }) => <span>{alt}</span>,
        }}
      >
        {body}
      </Markdown>
    </div>
  );
}
