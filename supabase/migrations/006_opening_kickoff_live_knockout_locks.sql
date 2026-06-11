-- 006_opening_kickoff_live_knockout_locks.sql
-- Original predictions lock at opening kickoff.
-- Live knockout predictions open when real R32 fixtures are known, then lock per match at kickoff.

CREATE OR REPLACE FUNCTION handle_prediction_upsert()
RETURNS TRIGGER AS $$
DECLARE
    is_knockout BOOLEAN;
    match_kickoff TIMESTAMPTZ;
    match_home TEXT;
    match_away TEXT;
BEGIN
    is_knockout := NEW.match_id ~ '^(r32|r16|qf|sf|third_place|final)';

    -- Phase 1: PRE_TOURNAMENT (< opening kickoff)
    IF now() < '2026-06-11 19:00:00+00'::timestamp with time zone THEN
        NEW.original_home_score = NEW.home_score;
        NEW.original_away_score = NEW.away_score;
        NEW.is_repredicted = false;

    -- Phase 2: LIVE KNOCKOUT WINDOW
    ELSIF now() < '2026-07-19 15:00:00+00'::timestamp with time zone THEN
        IF NOT is_knockout THEN
            RAISE EXCEPTION 'Group stage predictions are permanently locked.';
        END IF;

        SELECT kickoff, home_team, away_team
        INTO match_kickoff, match_home, match_away
        FROM matches
        WHERE id = NEW.match_id;

        IF match_kickoff IS NULL THEN
            RAISE EXCEPTION 'This knockout fixture is not available yet.';
        END IF;

        IF match_home !~ '^[A-Z0-9]{3,5}$' OR match_away !~ '^[A-Z0-9]{3,5}$' THEN
            RAISE EXCEPTION 'This knockout fixture is not available yet.';
        END IF;

        IF now() >= match_kickoff THEN
            RAISE EXCEPTION 'This knockout match has already kicked off.';
        END IF;

        IF OLD IS NULL THEN
            NEW.original_home_score = NEW.home_score;
            NEW.original_away_score = NEW.away_score;
        ELSE
            NEW.original_home_score = OLD.original_home_score;
            NEW.original_away_score = OLD.original_away_score;
        END IF;
        NEW.is_repredicted = true;

    -- Phase 4: FINAL_LOCK
    ELSE
        RAISE EXCEPTION 'All predictions are permanently locked.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_bracket_upsert()
RETURNS TRIGGER AS $$
DECLARE
    fixture_id TEXT;
    fixture_kickoff TIMESTAMPTZ;
    fixture_home TEXT;
    fixture_away TEXT;
BEGIN
    -- Phase 1: PRE_TOURNAMENT
    IF now() < '2026-06-11 19:00:00+00'::timestamp with time zone THEN
        NEW.original_team_code = NEW.team_code;
        NEW.is_repredicted = false;

    -- Phase 2: LIVE KNOCKOUT WINDOW
    ELSIF now() < '2026-07-19 15:00:00+00'::timestamp with time zone THEN
        IF NEW.round = 'final' THEN
            fixture_id := 'final';
        ELSIF NEW.round = 'third_place' THEN
            fixture_id := 'third_place';
        ELSE
            fixture_id := NEW.round || '_' || (NEW.slot_index + 1)::TEXT;
        END IF;

        SELECT kickoff, home_team, away_team
        INTO fixture_kickoff, fixture_home, fixture_away
        FROM matches
        WHERE id = fixture_id;

        IF fixture_kickoff IS NULL THEN
            RAISE EXCEPTION 'This knockout fixture is not available yet.';
        END IF;

        IF fixture_home !~ '^[A-Z0-9]{3,5}$' OR fixture_away !~ '^[A-Z0-9]{3,5}$' THEN
            RAISE EXCEPTION 'This knockout fixture is not available yet.';
        END IF;

        IF now() >= fixture_kickoff THEN
            RAISE EXCEPTION 'This knockout match has already kicked off.';
        END IF;

        IF OLD IS NULL THEN
            NEW.original_team_code = NEW.team_code;
        ELSE
            NEW.original_team_code = OLD.original_team_code;
        END IF;
        NEW.is_repredicted = true;

    -- Phase 4: FINAL_LOCK
    ELSE
        RAISE EXCEPTION 'Bracket predictions are permanently locked.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
