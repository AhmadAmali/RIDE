"use client";

import { useState } from "react";
import { reviewObligation } from "@/lib/api";
import { Obligation } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ObligationCardProps {
  obligation: Obligation;
  index: number;
  onReview: (obligationId: string, action: "approved" | "rejected") => void;
}

export function ObligationCard({
  obligation,
  index,
  onReview,
}: ObligationCardProps) {
  const [loading, setLoading] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isPending = obligation.status === "pending";
  const isApproved = obligation.status === "approved";
  const isRejected = obligation.status === "rejected";

  async function handleAction(action: "approved" | "rejected") {
    setLoading(action);
    setError(null);
    try {
      await reviewObligation(obligation.id, action);
      onReview(obligation.id, action);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card
      className={`transition-all ${
        !isPending ? "opacity-75" : "shadow-sm hover:shadow-md"
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base leading-snug">
            <span className="text-muted-foreground font-normal mr-2">
              #{index}
            </span>
            {obligation.text}
          </CardTitle>
          <div className="flex shrink-0 items-center gap-2">
            {obligation.is_ambiguous && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
                Ambiguous
              </Badge>
            )}
            {isApproved && (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">
                Approved
              </Badge>
            )}
            {isRejected && (
              <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">
                Rejected
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Source Quote */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Source Quote
          </p>
          <blockquote className="bg-slate-50 border-l-4 border-primary/30 pl-4 py-3 pr-3 rounded-r-md">
            <p className="text-sm text-foreground/80 italic leading-relaxed">
              &ldquo;{obligation.source_quote}&rdquo;
            </p>
          </blockquote>
        </div>

        {/* Reasoning */}
        {obligation.reasoning && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              AI Reasoning
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {obligation.reasoning}
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </CardContent>

      {/* Action buttons - only for pending obligations */}
      {isPending && (
        <CardFooter className="gap-3 pt-2">
          <Button
            onClick={() => handleAction("approved")}
            disabled={loading !== null}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium h-11"
            size="lg"
          >
            {loading === "approved" ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Approving...
              </span>
            ) : (
              "Approve"
            )}
          </Button>
          <Button
            onClick={() => handleAction("rejected")}
            disabled={loading !== null}
            variant="destructive"
            className="flex-1 font-medium h-11"
            size="lg"
          >
            {loading === "rejected" ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Rejecting...
              </span>
            ) : (
              "Reject"
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
