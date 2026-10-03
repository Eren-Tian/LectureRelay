import Markdown from 'react-markdown';

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
