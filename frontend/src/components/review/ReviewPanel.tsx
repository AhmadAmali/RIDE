import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DocumentPanel } from "./DocumentPanel";
import { ObligationCard } from "./ObligationCard";
import { Obligation } from "@/lib/types";

interface ReviewPanelProps {
  markdown: string;
  obligations: Obligation[];
  onReview: (obligationId: string, action: "approved" | "rejected") => void;
}

export function ReviewPanel({
  markdown,
  obligations,
  onReview,
}: ReviewPanelProps) {
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      {/* Left panel: Document markdown */}
      <ResizablePanel defaultSize={50} minSize={30}>
        <DocumentPanel markdown={markdown} />
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Right panel: Obligation cards */}
      <ResizablePanel defaultSize={50} minSize={30}>
        <ScrollArea className="h-full">
          <div className="p-6 space-y-4">
            {obligations.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">
                  No obligations extracted for this document.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Extracted Obligations
                  </h2>
                </div>
                {obligations.map((obligation, index) => (
                  <ObligationCard
                    key={obligation.id}
                    obligation={obligation}
                    index={index + 1}
                    onReview={onReview}
                  />
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
