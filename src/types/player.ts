
export interface PlayerData {
  id: number;
  player_id: number;
  name: string;
  height: number | null;
  weight: number | null;
  graduation_year: string;
  positions: string;
  bats: string;
  throws: string;
  profile_url: string;
  showcase_report: string;
  scraped_at: string;
}

export interface BatchProgress {
  currentChunk: number;
  totalChunks: number;
  overallSuccessful: number;
  overallFailed: number;
  overallProcessed: number;
  total: number;
  isComplete: boolean;
}
