"use client";

import { useState } from "react";
import { reviewSystemMapping } from "@/lib/api";
import { SystemMapping } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const SYSTEM_OPTIONS = [
  "kyc",
  "trading_engine",
  "tax_reporting",
  "compliance_reporting",
  "auth",
  "notifications",
];

interface SystemMappingCardProps {
  mapping: SystemMapping;
  onReview: (
    mappingId: string,
    action: string,
    newSystemName?: string
  ) => void;
}

type FormMode = "buttons" | "correct" | "reassign";

export function SystemMappingCard({
  mapping,
  onReview,
}: SystemMappingCardProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>("buttons");
  const [selectedSystem, setSelectedSystem] = useState("");
  const [reason, setReason] = useState("");

  const isConfirmed = mapping.confirmed;

  // Determine the review status label
  const reviewAction =
    mapping.suggested_by === "engineer"
      ? mapping.engineer_note
        ? "Corrected"
        : "Reassigned"
      : "Confirmed";

  async function handleConfirm() {
    setLoading("confirmed");
    setError(null);
    try {
      await reviewSystemMapping(mapping.id, "confirmed");
      onReview(mapping.id, "confirmed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setLoading(null);
    }
  }

  async function handleSubmitForm() {
    const action = formMode === "correct" ? "corrected" : "reassigned";
    setLoading(action);
    setError(null);
    try {
      await reviewSystemMapping(
        mapping.id,
        action,
        selectedSystem,
        reason
      );
      onReview(mapping.id, action, selectedSystem);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setLoading(null);
    }
  }

  function handleCancel() {
    setFormMode("buttons");
    setSelectedSystem("");
    setReason("");
    setError(null);
  }

  const availableSystems = SYSTEM_OPTIONS.filter(
    (s) => s !== mapping.system_name
  );

  return (
    <Card
      className={`transition-all ${
        isConfirmed ? "opacity-75" : "shadow-sm hover:shadow-md"
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base leading-snug flex items-center gap-2">
            <Badge className="bg-teal-100 text-teal-800 border-teal-200 hover:bg-teal-100 shrink-0">
              {mapping.system_name}
            </Badge>
            {mapping.confidence_score !== null && (
              <span className="text-sm font-normal text-muted-foreground">
                {Math.round(mapping.confidence_score * 100)}% confidence
              </span>
            )}
          </CardTitle>
          <div className="flex shrink-0 items-center gap-2">
            <Badge
              variant="outline"
              className={
                mapping.suggested_by === "engineer"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-slate-50 text-slate-600 border-slate-200"
              }
            >
              {mapping.suggested_by === "engineer"
                ? "Engineer Override"
                : "AI Suggested"}
            </Badge>
            {isConfirmed && reviewAction === "Confirmed" && (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">
                Confirmed
              </Badge>
            )}
            {isConfirmed && reviewAction === "Corrected" && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
                Corrected
              </Badge>
            )}
            {isConfirmed && reviewAction === "Reassigned" && (
              <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">
                Reassigned
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Action Item Description */}
        {mapping.action_item_description && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Action Item
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed">
              {mapping.action_item_description}
            </p>
          </div>
        )}

        {/* RAG Evidence */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            RAG Evidence &mdash; Why this system was suggested
          </p>
          {mapping.matched_chunk ? (
            <blockquote className="bg-slate-50 border-l-4 border-primary/30 pl-4 py-3 pr-3 rounded-r-md">
              <p className="text-sm text-foreground/80 italic leading-relaxed">
                &ldquo;{mapping.matched_chunk}&rdquo;
              </p>
            </blockquote>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No retrieval evidence available
            </p>
          )}
        </div>

        {/* Engineer Note (for reviewed mappings) */}
        {isConfirmed && mapping.engineer_note && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Engineer Note
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {mapping.engineer_note}
            </p>
          </div>
        )}

        {/* Error message */}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Inline correction form */}
        {!isConfirmed && formMode !== "buttons" && (
          <div className="rounded-lg border bg-slate-50/50 p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">
              {formMode === "correct"
                ? "Correct System Assignment"
                : "Reassign to Different System"}
            </p>
            <div>
              <label
                htmlFor="system-select"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Target System
              </label>
              <select
                id="system-select"
                value={selectedSystem}
                onChange={(e) => setSelectedSystem(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select a system...</option>
                {availableSystems.map((sys) => (
                  <option key={sys} value={sys}>
                    {sys.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="reason-input"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Reason (required)
              </label>
              <textarea
                id="reason-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this mapping needs to change..."
                className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSubmitForm}
                disabled={
                  !selectedSystem || !reason.trim() || loading !== null
                }
                className={`flex-1 font-medium ${
                  formMode === "correct"
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Submitting...
                  </span>
                ) : (
                  "Submit"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={loading !== null}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Action buttons - only for unconfirmed mappings in button mode */}
      {!isConfirmed && formMode === "buttons" && (
        <CardFooter className="gap-3 pt-2">
          <Button
            onClick={handleConfirm}
            disabled={loading !== null}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium h-11"
            size="lg"
          >
            {loading === "confirmed" ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Confirming...
              </span>
            ) : (
              "Confirm"
            )}
          </Button>
          <Button
            onClick={() => setFormMode("correct")}
            disabled={loading !== null}
            variant="outline"
            className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50 font-medium h-11"
            size="lg"
          >
            Correct System
          </Button>
          <Button
            onClick={() => setFormMode("reassign")}
            disabled={loading !== null}
            variant="outline"
            className="flex-1 border-blue-300 text-blue-700 hover:bg-blue-50 font-medium h-11"
            size="lg"
          >
            Reassign
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
