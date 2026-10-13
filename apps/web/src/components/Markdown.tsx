import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownProps {
  /** Raw Markdown source to render. */
  children: string;
}

/**
 * Element overrides tuned for the chat:
 *  - `a`     → open in a new tab, safely (rel="noopener noreferrer").
 *  - `table` → wrap in a scrollable, rounded container (responsive + pretty).
 * `node` is stripped so it is not spread onto the underlying DOM element.
 */
const chatComponents: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  table: ({ node: _node, ...props }) => (
    <div className="chat-md-table-wrap">
      <table {...props} />
    </div>
  ),
};

/**
 * Renders Markdown (GFM: tables, strikethrough, task lists) as safe React
 * elements. Raw HTML in the source is NOT executed (no `rehype-raw`), so this
 * is XSS-safe by default. Visual styling comes from CSS on `.chat-md`.
 */
export function Markdown({ children }: MarkdownProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={chatComponents}>
      {children}
    </ReactMarkdown>
  );
}
