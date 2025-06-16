
-- Update height and weight columns to store integers
ALTER TABLE public.perfect_game_players 
ALTER COLUMN height TYPE INTEGER USING CASE 
  WHEN height ~ '^\d+$' THEN height::INTEGER 
  ELSE NULL 
END;

ALTER TABLE public.perfect_game_players 
ALTER COLUMN weight TYPE INTEGER USING CASE 
  WHEN weight ~ '^\d+$' THEN weight::INTEGER 
  ELSE NULL 
END;
