
-- Add city and state columns to the perfect_game_players table
ALTER TABLE public.perfect_game_players 
ADD COLUMN city TEXT,
ADD COLUMN state TEXT;
