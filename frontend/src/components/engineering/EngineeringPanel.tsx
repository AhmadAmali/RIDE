import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SystemMappingCard } from "./SystemMappingCard";
import { ActionItem, SystemMapping } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EngineeringPanelProps {
  actionItems: ActionItem[];
  mappings: SystemMapping[];
  onReview: (
    mappingId: string,
    action: string,
    newSystemName?: string
  ) => void;
}

export function EngineeringPanel({
  actionItems,
  mappings,
  onReview,
}: EngineeringPanelProps) {
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      {/* Left panel: Action Items context */}
      <ResizablePanel defaultSize={50} minSize={30}>
        <ScrollArea className="h-full">
          <div className="p-6 space-y-4">
            {actionItems.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">
                  No action items found for this document.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Action Items
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Business actions derived from approved obligations
                  </p>
                </div>
                {actionItems.map((item, index) => (
                  <Card key={item.id} className="shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm leading-snug flex items-center gap-2">
                        <span className="text-muted-foreground font-normal">
                          #{index + 1}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            item.status === "pending"
                              ? "bg-slate-50 text-slate-600 border-slate-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }
                        >
                          {item.status}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-foreground/90 leading-relaxed">
                        {item.description}
                      </p>
                      {item.owner && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Owner: {item.owner}
                        </p>
                      )}
                      {item.deadline && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Deadline:{" "}
                          {new Date(item.deadline).toLocaleDateString()}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Right panel: System Mapping Cards */}
      <ResizablePanel defaultSize={50} minSize={30}>
        <ScrollArea className="h-full">
          <div className="p-6 space-y-4">
            {mappings.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">
                  No system mapping suggestions for this document.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    System Mapping Suggestions
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    AI-suggested system assignments with RAG evidence
                  </p>
                </div>
                {mappings.map((mapping) => (
                  <SystemMappingCard
                    key={mapping.id}
                    mapping={mapping}
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
