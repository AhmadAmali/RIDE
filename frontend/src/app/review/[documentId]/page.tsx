"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchDocument, fetchObligations } from "@/lib/api";
import { Document, Obligation } from "@/lib/types";
import { ReviewPanel } from "@/components/review/ReviewPanel";
import { Badge } from "@/components/ui/badge";

export default function ReviewPage() {
  const params = useParams();
  const documentId = params.documentId as string;

  const [document, setDocument] = useState<Document | null>(null);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [doc, obs] = await Promise.all([
          fetchDocument(documentId),
          fetchObligations(documentId),
        ]);
        setDocument(doc);
        setObligations(obs);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [documentId]);

  const handleReview = useCallback(
    (obligationId: string, newStatus: "approved" | "rejected") => {
      setObligations((prev) =>
        prev.map((ob) =>
          ob.id === obligationId ? { ...ob, status: newStatus } : ob
        )
      );
    },
    []
  );

  const reviewedCount = obligations.filter(
    (ob) => ob.status !== "pending"
  ).length;
  const totalCount = obligations.length;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">
            Loading document...
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
            <p className="text-xs text-muted-foreground">Legal Review</p>
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
        <ReviewPanel
          markdown={document.content_markdown || "*No document content available.*"}
          obligations={obligations}
          onReview={handleReview}
        />
      </div>
    </div>
  );
}
