export interface Document {
  id: string;
  filename: string;
  original_url: string | null;
  content_markdown: string | null;
  status: "uploaded" | "parsed" | "extracted";
  uploaded_at: string;
  updated_at: string;
  obligation_count?: number;
  approved_count?: number;
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

export interface ActionItem {
  id: string;
  obligation_id: string;
  description: string;
  owner: string | null;
  deadline: string | null;
  status: string;
  created_at: string;
}

export interface SystemMapping {
  id: string;
  action_item_id: string;
  system_name: string;
  confidence_score: number | null;
  matched_chunk: string | null;
  suggested_by: string;
  confirmed: boolean;
  engineer_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  action_item_description: string | null;
}

export interface ImpactMatrixCell {
  system_name: string;
  obligation_id: string;
  obligation_text: string;
  confidence_score: number | null;
  suggested_by: string;
  engineer_note: string | null;
}

export interface ImpactMatrixData {
  systems: string[];
  obligations: { id: string; text: string }[];
  cells: ImpactMatrixCell[];
}
