export type Role = "admin" | "creator" | "reviewer";
export type FormState = { error?: string; ok?: string };

export type SourceType = "fact" | "terminology" | "tone" | "disclosure";
export type Source = {
  id: string;
  workspace_id: string;
  title: string;
  content: string;
  type: SourceType;
  version: number;
  approved: boolean;
  effective_date: string;
  expiry_date: string | null;
  updated_at: string;
};
