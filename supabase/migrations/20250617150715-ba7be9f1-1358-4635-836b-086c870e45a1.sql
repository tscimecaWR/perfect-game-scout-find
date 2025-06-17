
-- Add team_last_played column to the perfect_game_players table
ALTER TABLE public.perfect_game_players 
ADD COLUMN team_last_played TEXT;
