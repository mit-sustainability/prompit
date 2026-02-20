export type PromptWithStats = {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  author_id: string;
  author_name: string | null;
  forked_from: string | null;
  created_at: string;
  updated_at: string;
  upvote_count: number;
  copy_count: number;
};
