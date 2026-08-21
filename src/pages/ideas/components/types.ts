export interface Idea {
  id: number;
  idea_name: string;
  related_project_id: number;
  category: string | null;
  priority: string;
  status: string;
  description: string | null;
  owner: string | null;
  ai_generated: boolean;
  notes: string | null;
  project_name?: string;
}