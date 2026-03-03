export interface Document {
  id: string;
  filename: string;
  original_url: string | null;
  content_markdown: string | null;
  status: "uploaded" | "parsed" | "extracted";
  uploaded_at: string;
  updated_at: string;
}

export interface Obligation {
  id: string;
  document_id: string;
  text: string;
  source_quote: string;
  reasoning: string | null;
  status: "pending" | "approved" | "rejected";
  is_ambiguous: boolean;
  created_at: string;
  updated_at: string;
}
