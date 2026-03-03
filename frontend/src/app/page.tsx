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

function StatusBadge({ status }: { status: Document["status"] }) {
  const variants: Record<
    Document["status"],
    { label: string; className: string }
  > = {
    uploaded: {
      label: "Uploaded",
      className: "bg-slate-100 text-slate-700 border-slate-200",
    },
    parsed: {
      label: "Parsed",
      className: "bg-blue-100 text-blue-700 border-blue-200",
    },
    extracted: {
      label: "Ready for Review",
      className: "bg-emerald-100 text-emerald-700 border-emerald-200",
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
      <header className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            RIDE
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Regulatory Integrated Development Environment
          </p>
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

        {!error && documents.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No documents uploaded yet.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload a PDF via the API to get started.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4">
          {documents.map((doc) => {
            const isReviewable = doc.status === "extracted";
            const CardWrapper = isReviewable ? Link : "div";
            const wrapperProps = isReviewable
              ? { href: `/review/${doc.id}` }
              : {};

            return (
              <CardWrapper key={doc.id} {...(wrapperProps as Record<string, string>)}>
                <Card
                  className={`transition-all ${
                    isReviewable
                      ? "cursor-pointer hover:shadow-md hover:border-primary/20"
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
                      <p className="text-sm text-primary font-medium">
                        Click to review obligations &rarr;
                      </p>
                    </CardContent>
                  )}
                </Card>
              </CardWrapper>
            );
          })}
        </div>
      </main>
    </div>
  );
}
