-- Migration: Add fields for advanced prediction rules
-- Enables distinguishing between original locked predictions and live re-predictions.

ALTER TABLE predictions ADD COLUMN IF NOT EXISTS original_home_score INT NULL CHECK (original_home_score >= 0);
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS original_away_score INT NULL CHECK (original_away_score >= 0);
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS is_repredicted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE bracket_picks ADD COLUMN IF NOT EXISTS predicted_home_team TEXT NULL;
ALTER TABLE bracket_picks ADD COLUMN IF NOT EXISTS predicted_away_team TEXT NULL;

ALTER TABLE scores ADD COLUMN IF NOT EXISTS bracket_bonus_points INT NOT NULL DEFAULT 0;

-- Global Lock Time (12 hours before first match, e.g. June 11, 2026 13:00 local -> June 11 19:00 UTC -> minus 12 hours = June 11 07:00 UTC)
CREATE OR REPLACE FUNCTION check_global_lock()
RETURNS TRIGGER AS $$
BEGIN
    IF now() > '2026-06-11 07:00:00+00'::timestamptz THEN
        RAISE EXCEPTION 'Global lock has passed. Original tournament predictions cannot be modified.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_bracket_lock ON bracket_picks;
CREATE TRIGGER enforce_bracket_lock
    BEFORE INSERT OR UPDATE OR DELETE ON bracket_picks
    FOR EACH ROW EXECUTE FUNCTION check_global_lock();

-- For predictions, if it's after the global lock, we automatically set is_repredicted = true.
-- If it's before, we copy home_score to original_home_score.
CREATE OR REPLACE FUNCTION handle_prediction_upsert()
RETURNS TRIGGER AS $$
BEGIN
    IF now() > '2026-06-11 07:00:00+00'::timestamptz THEN
        -- If user is inserting a new prediction after the global lock, or updating an existing one
        NEW.is_repredicted := true;
        -- Do not overwrite original scores!
        IF TG_OP = 'UPDATE' THEN
            NEW.original_home_score := OLD.original_home_score;
            NEW.original_away_score := OLD.original_away_score;
        END IF;
    ELSE
        -- Before global lock, any save updates the original prediction
        NEW.is_repredicted := false;
        NEW.original_home_score := NEW.home_score;
        NEW.original_away_score := NEW.away_score;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prediction_upsert ON predictions;
CREATE TRIGGER trigger_prediction_upsert
    BEFORE INSERT OR UPDATE ON predictions
    FOR EACH ROW EXECUTE FUNCTION handle_prediction_upsert();

