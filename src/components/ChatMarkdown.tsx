import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** عرض Markdown لردود المحلل: يدعم الجداول، ويمنع الصور (رابط صورة قد يسرّب بيانات). */
export function ChatMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      disallowedElements={["img"]}
      components={{
        table: ({ children: c }) => (
          <div className="my-3 overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full table-auto border-collapse text-[13px]">{c}</table>
          </div>
        ),
        th: ({ children: c }) => (
          <th className="border-b border-border/60 bg-muted/30 px-3 py-2 text-start font-semibold">{c}</th>
        ),
        td: ({ children: c }) => <td className="border-t border-border/40 px-3 py-2 align-top">{c}</td>,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
