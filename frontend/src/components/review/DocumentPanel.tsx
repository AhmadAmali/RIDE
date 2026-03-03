import ReactMarkdown from "react-markdown";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DocumentPanelProps {
  markdown: string;
}

export function DocumentPanel({ markdown }: DocumentPanelProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-8">
        <ReactMarkdown
          className="prose prose-invert max-w-none prose-ride
            prose-headings:text-foreground prose-headings:font-semibold
            prose-p:text-muted-foreground prose-p:leading-7
            prose-strong:text-foreground
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-blockquote:border-primary/30 prose-blockquote:text-muted-foreground
            prose-li:text-muted-foreground
            prose-hr:border-border"
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </ScrollArea>
  );
}
