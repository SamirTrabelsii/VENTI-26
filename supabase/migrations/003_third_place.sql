-- Add 'third_place' to the round check constraint
ALTER TABLE bracket_picks DROP CONSTRAINT IF EXISTS bracket_picks_round_check;
ALTER TABLE bracket_picks ADD CONSTRAINT bracket_picks_round_check 
  CHECK (round IN ('r32', 'r16', 'qf', 'sf', 'third_place', 'final', 'champion'));

-- Add DELETE policy so users can delete their own picks (needed for save flow)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bracket_picks' AND policyname = 'Users can delete own picks'
  ) THEN
    CREATE POLICY "Users can delete own picks" ON bracket_picks FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

