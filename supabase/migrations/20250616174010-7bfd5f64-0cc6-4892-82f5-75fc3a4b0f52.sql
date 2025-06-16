
-- Add separate columns for bats and throws
ALTER TABLE public.perfect_game_players 
ADD COLUMN bats TEXT,
ADD COLUMN throws TEXT;

-- Update existing records to split handedness into bats and throws
UPDATE public.perfect_game_players 
SET 
  bats = CASE 
    WHEN handedness LIKE '%/%' THEN TRIM(SPLIT_PART(handedness, '/', 1))
    ELSE NULL 
  END,
  throws = CASE 
    WHEN handedness LIKE '%/%' THEN TRIM(SPLIT_PART(handedness, '/', 2))
    ELSE NULL 
  END
WHERE handedness IS NOT NULL;

-- Drop the old handedness column
ALTER TABLE public.perfect_game_players 
DROP COLUMN handedness;
