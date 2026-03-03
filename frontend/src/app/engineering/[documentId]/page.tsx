"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  fetchDocument,
  fetchActionItems,
  fetchSystemMappings,
} from "@/lib/api";
import { ActionItem, Document, SystemMapping } from "@/lib/types";
import { EngineeringPanel } from "@/components/engineering/EngineeringPanel";
import { Badge } from "@/components/ui/badge";

export default function EngineeringReviewPage() {
  const params = useParams();
  const documentId = params.documentId as string;

  const [document, setDocument] = useState<Document | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [mappings, setMappings] = useState<SystemMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [doc, items, maps] = await Promise.all([
          fetchDocument(documentId),
          fetchActionItems(documentId),
          fetchSystemMappings(documentId),
        ]);
        setDocument(doc);
        setActionItems(items);
        setMappings(maps);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [documentId]);

  const handleReview = useCallback(
    (mappingId: string, action: string, newSystemName?: string) => {
      setMappings((prev) =>
        prev.map((m) =>
          m.id === mappingId
            ? {
                ...m,
                confirmed: true,
                reviewed_at: new Date().toISOString(),
                ...(action === "corrected" || action === "reassigned"
                  ? {
                      system_name: newSystemName || m.system_name,
                      suggested_by: "engineer",
                    }
                  : {}),
              }
            : m
        )
      );
    },
    []
  );

  const reviewedCount = mappings.filter((m) => m.confirmed).length;
  const totalCount = mappings.length;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">
            Loading engineering review...
          </p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-destructive">{error || "Document not found"}</p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            &larr; Back to documents
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header bar */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; Documents
          </Link>
          <div className="h-5 w-px bg-border" />
          <div>
            <h1 className="text-sm font-semibold text-foreground leading-tight">
              {document.filename}
            </h1>
            <p className="text-xs text-muted-foreground">
              Engineering Review
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {reviewedCount} of {totalCount} reviewed
          </span>
          <Badge
            variant="outline"
            className={
              reviewedCount === totalCount && totalCount > 0
                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                : "bg-slate-100 text-slate-600 border-slate-200"
            }
          >
            {totalCount > 0
              ? `${Math.round((reviewedCount / totalCount) * 100)}%`
              : "0%"}
          </Badge>
        </div>
      </header>

      {/* Split panel */}
      <div className="flex-1 overflow-hidden">
        <EngineeringPanel
          actionItems={actionItems}
          mappings={mappings}
          onReview={handleReview}
        />
      </div>
    </div>
  );
}
