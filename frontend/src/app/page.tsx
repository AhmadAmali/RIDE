import Link from "next/link";
import { fetchDocuments } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Document } from "@/lib/types";
import { UploadDropzone } from "@/components/UploadDropzone";

function StatusBadge({ status }: { status: Document["status"] }) {
  const variants: Record<
    Document["status"],
    { label: string; className: string }
  > = {
    uploaded: {
      label: "Uploaded",
      className: "bg-status-neutral-muted text-status-neutral-foreground border-status-neutral/30",
    },
    parsed: {
      label: "Parsed",
      className: "bg-status-info-muted text-status-info-foreground border-status-info/30",
    },
    extracted: {
      label: "Ready for Review",
      className: "bg-status-success-muted text-status-success-foreground border-status-success/30",
    },
  };

  const config = variants[status] ?? variants.uploaded;

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

function formatDate(isoString: string | null): string {
  if (!isoString) return "Unknown date";
  const date = new Date(isoString);
  return date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DocumentListPage() {
  let documents: Document[] = [];
  let error: string | null = null;

  try {
    documents = await fetchDocuments();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load documents";
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="header-gradient">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                RIDE
              </h1>
              <p className="mt-2 text-base text-muted-foreground">
                Regulatory Integrated Development Environment
              </p>
            </div>
            <Link
              href="/impact"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
            >
              View Impact Matrix &rarr;
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground">Documents</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review regulatory documents and their extracted obligations.
          </p>
        </div>

        {error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="py-6">
              <p className="text-sm text-destructive">{error}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Make sure the backend is running at{" "}
                {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="mb-8">
          <UploadDropzone />
        </div>

        <div className="grid gap-4">
          {documents.map((doc) => {
            const isReviewable = doc.status === "extracted";
            const hasApprovals = (doc.approved_count ?? 0) > 0;

            return (
              <Card
                key={doc.id}
                className={`transition-all card-glow ${
                  isReviewable
                    ? "hover:shadow-md hover:border-primary/20"
                    : "opacity-70"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate text-base">
                        {doc.filename}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {formatDate(doc.uploaded_at)}
                      </CardDescription>
                    </div>
                    <StatusBadge status={doc.status} />
                  </div>
                </CardHeader>
                {isReviewable && (
                  <CardContent>
                    <div className="flex gap-3">
                      <Link
                        href={`/review/${doc.id}`}
                        className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-md hover:shadow-primary/20"
                      >
                        Legal Review
                      </Link>
                      {hasApprovals ? (
                        <Link
                          href={`/engineering/${doc.id}`}
                          className="inline-flex items-center gap-2 rounded-md border border-status-teal/30 bg-status-teal-muted px-4 py-2 text-sm font-medium text-status-teal-foreground transition-all hover:bg-status-teal hover:text-primary-foreground hover:shadow-md hover:shadow-status-teal/20"
                        >
                          Engineering Review
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-2 rounded-md border border-status-neutral/20 bg-status-neutral-muted px-4 py-2 text-sm font-medium text-status-neutral-foreground cursor-not-allowed">
                          Engineering Review
                        </span>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
