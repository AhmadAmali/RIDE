import { Document, Obligation } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchDocuments(): Promise<Document[]> {
  const res = await fetch(`${API_URL}/api/documents`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch documents: ${res.status}`);
  }
  return res.json();
}

export async function fetchDocument(id: string): Promise<Document> {
  const res = await fetch(`${API_URL}/api/documents/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch document: ${res.status}`);
  }
  return res.json();
}

export async function fetchObligations(
  documentId: string
): Promise<Obligation[]> {
  const res = await fetch(
    `${API_URL}/api/obligations?document_id=${documentId}`,
    {
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch obligations: ${res.status}`);
  }
  return res.json();
}

export async function reviewObligation(
  obligationId: string,
  action: "approved" | "rejected"
): Promise<Obligation> {
  const res = await fetch(
    `${API_URL}/api/obligations/${obligationId}/review`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, actor: "legal-reviewer" }),
    }
  );
  if (res.status === 409) {
    throw new Error("This obligation has already been reviewed.");
  }
  if (!res.ok) {
    throw new Error(`Review failed: ${res.status}`);
  }
  return res.json();
}
