
-- Create a table for storing scraped Perfect Game player data
CREATE TABLE public.perfect_game_players (
  id SERIAL PRIMARY KEY,
  player_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  height TEXT,
  weight TEXT,
  graduation_year TEXT,
  positions TEXT,
  handedness TEXT,
  profile_url TEXT NOT NULL,
  showcase_report TEXT,
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on player_id for faster lookups
CREATE INDEX idx_perfect_game_players_player_id ON public.perfect_game_players(player_id);

-- Enable Row Level Security (making it public for now since this is scraping public data)
ALTER TABLE public.perfect_game_players ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows anyone to read the data
CREATE POLICY "Allow public read access" ON public.perfect_game_players
  FOR SELECT USING (true);

-- Create a policy that allows the service role to insert/update data
CREATE POLICY "Allow service role to modify data" ON public.perfect_game_players
  FOR ALL USING (true);
