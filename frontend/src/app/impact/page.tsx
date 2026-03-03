"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchImpactMatrix } from "@/lib/api";
import { ImpactMatrixData } from "@/lib/types";
import ImpactMatrix from "@/components/impact/ImpactMatrix";

export default function ImpactMatrixPage() {
  const [data, setData] = useState<ImpactMatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const result = await fetchImpactMatrix();
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load impact matrix");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="header-gradient">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                RIDE
              </h1>
              <p className="mt-1 text-base text-muted-foreground">
                Impact Analysis Matrix
              </p>
            </div>
            <Link
              href="/"
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              &larr; Back to Documents
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-6 py-10">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-muted-foreground">Loading impact matrix...</div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6">
            <p className="text-sm text-destructive">{error}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Make sure the backend is running at http://localhost:8000.
            </p>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Summary stats */}
            <div className="mb-6 flex gap-6">
              <div className="rounded-lg border bg-card px-5 py-3">
                <p className="text-2xl font-bold text-foreground">
                  {data.systems.length}
                </p>
                <p className="text-xs text-muted-foreground">Systems Affected</p>
              </div>
              <div className="rounded-lg border bg-card px-5 py-3">
                <p className="text-2xl font-bold text-foreground">
                  {data.obligations.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  Obligations Mapped
                </p>
              </div>
              <div className="rounded-lg border bg-card px-5 py-3">
                <p className="text-2xl font-bold text-foreground">
                  {data.cells.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  Confirmed Mappings
                </p>
              </div>
            </div>

            {/* Matrix */}
            <ImpactMatrix data={data} />
          </>
        )}
      </main>
    </div>
  );
}
