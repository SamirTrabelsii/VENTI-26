-- Drop the existing check constraint on the round column
ALTER TABLE bracket_picks DROP CONSTRAINT IF EXISTS bracket_picks_round_check;

-- Add the new check constraint that includes 'r32'
ALTER TABLE bracket_picks ADD CONSTRAINT bracket_picks_round_check 
  CHECK (round IN ('r32', 'r16', 'qf', 'sf', 'final', 'champion'));

-- Add columns for knockout score predictions
ALTER TABLE bracket_picks ADD COLUMN IF NOT EXISTS home_score INT NULL CHECK (home_score >= 0);
ALTER TABLE bracket_picks ADD COLUMN IF NOT EXISTS away_score INT NULL CHECK (away_score >= 0);
