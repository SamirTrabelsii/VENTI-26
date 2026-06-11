-- 005_locking_rules.sql

-- 1. Add original_team_code to bracket_picks to track repredictions
ALTER TABLE bracket_picks ADD COLUMN IF NOT EXISTS original_team_code TEXT;
ALTER TABLE bracket_picks ADD COLUMN IF NOT EXISTS is_repredicted BOOLEAN DEFAULT false;

-- Backfill original_team_code for existing rows if any
UPDATE bracket_picks SET original_team_code = team_code WHERE original_team_code IS NULL;

-- 2. Update prediction scores trigger (handle_prediction_upsert)
CREATE OR REPLACE FUNCTION handle_prediction_upsert()
RETURNS TRIGGER AS $$
DECLARE
    is_knockout BOOLEAN;
BEGIN
    -- Determine if match is knockout. Group matches IDs start with a-l (e.g., 'a1', 'b2')
    -- Knockout match IDs start with r, q, s, f (e.g. 'r32_1', 'qf_1', 'sf_1', 'final')
    is_knockout := NEW.match_id ~ '^(r32|r16|qf|sf|final)';

    -- Phase 1: PRE_TOURNAMENT (< June 11 19:00 UTC)
    IF now() < '2026-06-11 19:00:00+00'::timestamp with time zone THEN
        NEW.original_home_score = NEW.home_score;
        NEW.original_away_score = NEW.away_score;
        NEW.is_repredicted = false;
        
    -- Phase 2: GROUP_STAGE_LOCKED (June 11 14:00 UTC to June 24 00:00 UTC)
    ELSIF now() < '2026-06-24 00:00:00+00'::timestamp with time zone THEN
        RAISE EXCEPTION 'All predictions are currently hard-locked (Group Stage in progress).';
        
    -- Phase 3: KNOCKOUT_OPEN (June 24 00:00 UTC to June 28 17:00 UTC)
    ELSIF now() < '2026-06-28 17:00:00+00'::timestamp with time zone THEN
        IF NOT is_knockout THEN
            RAISE EXCEPTION 'Group stage predictions are permanently locked.';
        END IF;
        
        -- Allow knockout predictions but mark as repredicted
        IF OLD IS NULL THEN
            NEW.original_home_score = NEW.home_score;
            NEW.original_away_score = NEW.away_score;
        ELSE
            NEW.original_home_score = OLD.original_home_score;
            NEW.original_away_score = OLD.original_away_score;
        END IF;
        NEW.is_repredicted = true;
        
    -- Phase 4: FINAL_LOCK (>= June 28 17:00 UTC)
    ELSE
        RAISE EXCEPTION 'All predictions are permanently locked for the knockout phase.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Update bracket trigger (check_bracket_lock -> handle_bracket_upsert)
DROP TRIGGER IF EXISTS enforce_bracket_lock ON bracket_picks;
DROP FUNCTION IF EXISTS check_bracket_lock();

CREATE OR REPLACE FUNCTION handle_bracket_upsert()
RETURNS TRIGGER AS $$
BEGIN
    -- Phase 1: PRE_TOURNAMENT
    IF now() < '2026-06-11 19:00:00+00'::timestamp with time zone THEN
        NEW.original_team_code = NEW.team_code;
        NEW.is_repredicted = false;

    -- Phase 2: GROUP_STAGE_LOCKED
    ELSIF now() < '2026-06-24 00:00:00+00'::timestamp with time zone THEN
        RAISE EXCEPTION 'Bracket predictions are currently hard-locked (Group Stage in progress).';

    -- Phase 3: KNOCKOUT_OPEN
    ELSIF now() < '2026-06-28 17:00:00+00'::timestamp with time zone THEN
        -- Allow knockout bracket updates, mark as repredicted
        IF OLD IS NULL THEN
            NEW.original_team_code = NEW.team_code;
        ELSE
            NEW.original_team_code = OLD.original_team_code;
        END IF;
        NEW.is_repredicted = true;

    -- Phase 4: FINAL_LOCK
    ELSE
        RAISE EXCEPTION 'Bracket predictions are permanently locked for the knockout phase.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER process_bracket_upsert
    BEFORE INSERT OR UPDATE ON bracket_picks
    FOR EACH ROW
    EXECUTE FUNCTION handle_bracket_upsert();
