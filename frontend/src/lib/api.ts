import { ActionItem, Document, Obligation, SystemMapping } from "./types";

// Server-side (SSR) uses Docker internal hostname; browser uses localhost
const API_URL =
  typeof window !== "undefined"
    ? "http://localhost:8000"
    : process.env.NEXT_PUBLIC_API_URL || "http://backend:8000";

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

export async function fetchSystemMappings(
  documentId: string
): Promise<SystemMapping[]> {
  const res = await fetch(
    `${API_URL}/api/system-mappings?document_id=${documentId}`,
    {
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch system mappings: ${res.status}`);
  }
  return res.json();
}

export async function fetchActionItems(
  documentId: string
): Promise<ActionItem[]> {
  const res = await fetch(
    `${API_URL}/api/action-items?document_id=${documentId}`,
    {
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch action items: ${res.status}`);
  }
  return res.json();
}

export async function reviewSystemMapping(
  mappingId: string,
  action: "confirmed" | "corrected" | "reassigned",
  correctedSystem?: string,
  reason?: string
): Promise<SystemMapping> {
  const res = await fetch(
    `${API_URL}/api/system-mappings/${mappingId}/review`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        actor: "engineer",
        corrected_system: correctedSystem,
        reason,
      }),
    }
  );
  if (res.status === 409) {
    throw new Error("This mapping has already been reviewed.");
  }
  if (!res.ok) {
    throw new Error(`Review failed: ${res.status}`);
  }
  return res.json();
}

export async function uploadDocument(file: File): Promise<Document> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}/api/documents/upload`, {
    method: "POST",
    body: formData,
  });
  if (res.status === 413) {
    throw new Error("File too large. Maximum size is 50 MB.");
  }
  if (res.status === 422) {
    throw new Error("Invalid file. Only PDF files are accepted.");
  }
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status}`);
  }
  return res.json();
}
