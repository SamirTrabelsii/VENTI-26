-- 008_admin_unlock_override.sql
-- Allow admin-unlocked users to bypass the group stage lock in Postgres triggers.
-- This checks profiles.is_unlocked for the user before raising lock exceptions.

CREATE OR REPLACE FUNCTION handle_prediction_upsert()
RETURNS TRIGGER AS $$
DECLARE
    is_knockout BOOLEAN;
    match_kickoff TIMESTAMPTZ;
    match_home TEXT;
    match_away TEXT;
    user_unlocked BOOLEAN;
    existing_home INT;
    existing_away INT;
BEGIN
    is_knockout := NEW.match_id ~ '^(r32|r16|qf|sf|third_place|final)';

    -- Check if user has been admin-unlocked
    SELECT COALESCE(p.is_unlocked, false) INTO user_unlocked
    FROM profiles p WHERE p.id = NEW.user_id;

    -- Phase 1: PRE_TOURNAMENT (< opening kickoff)
    IF now() < '2026-06-12 03:00:00+00'::timestamp with time zone THEN
        NEW.original_home_score = NEW.home_score;
        NEW.original_away_score = NEW.away_score;
        NEW.is_repredicted = false;

    -- Phase 2: LIVE KNOCKOUT WINDOW
    ELSIF now() < '2026-07-19 15:00:00+00'::timestamp with time zone THEN
        IF NOT is_knockout THEN
            -- Allow if user is admin-unlocked, otherwise block
            IF NOT user_unlocked THEN
                RAISE EXCEPTION 'Group stage predictions are permanently locked.';
            END IF;
            -- Admin-unlocked: block if match is already finished (prevent cheating)
            IF EXISTS (SELECT 1 FROM matches WHERE id = NEW.match_id AND status = 'finished') THEN
                SELECT home_score, away_score INTO existing_home, existing_away 
                FROM predictions WHERE user_id = NEW.user_id AND match_id = NEW.match_id;
                
                IF NOT FOUND OR NEW.home_score IS DISTINCT FROM existing_home OR NEW.away_score IS DISTINCT FROM existing_away THEN
                    RAISE EXCEPTION 'This match (%) has already finished. Predictions cannot be changed.', NEW.match_id;
                END IF;
            END IF;
            -- Admin-unlocked user: treat like pre-tournament for group predictions
            NEW.original_home_score = NEW.home_score;
            NEW.original_away_score = NEW.away_score;
            NEW.is_repredicted = false;
            RETURN NEW;
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
        IF NOT user_unlocked THEN
            RAISE EXCEPTION 'All predictions are permanently locked.';
        END IF;
        -- Admin-unlocked: block if match is already finished (prevent cheating)
        IF EXISTS (SELECT 1 FROM matches WHERE id = NEW.match_id AND status = 'finished') THEN
            SELECT home_score, away_score INTO existing_home, existing_away 
            FROM predictions WHERE user_id = NEW.user_id AND match_id = NEW.match_id;
            
            IF NOT FOUND OR NEW.home_score IS DISTINCT FROM existing_home OR NEW.away_score IS DISTINCT FROM existing_away THEN
                RAISE EXCEPTION 'This match (%) has already finished. Predictions cannot be changed.', NEW.match_id;
            END IF;
        END IF;
        -- Admin-unlocked user can still save even after final lock
        NEW.original_home_score = NEW.home_score;
        NEW.original_away_score = NEW.away_score;
        NEW.is_repredicted = false;
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
    user_unlocked BOOLEAN;
    existing_team_code TEXT;
BEGIN
    -- Check if user has been admin-unlocked
    SELECT COALESCE(p.is_unlocked, false) INTO user_unlocked
    FROM profiles p WHERE p.id = NEW.user_id;

    -- Phase 1: PRE_TOURNAMENT
    IF now() < '2026-06-12 03:00:00+00'::timestamp with time zone THEN
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

        IF user_unlocked THEN
            -- Admin-unlocked: block if match is already finished (prevent cheating)
            IF EXISTS (SELECT 1 FROM matches WHERE id = fixture_id AND status = 'finished') THEN
                SELECT team_code INTO existing_team_code 
                FROM bracket_picks WHERE user_id = NEW.user_id AND match_id = NEW.match_id;
                
                IF NOT FOUND OR NEW.team_code IS DISTINCT FROM existing_team_code THEN
                    RAISE EXCEPTION 'This match has already finished. Bracket picks cannot be changed.';
                END IF;
            END IF;
            -- Admin-unlocked user: allow bracket saves like pre-tournament
            NEW.original_team_code = NEW.team_code;
            NEW.is_repredicted = false;
            RETURN NEW;
        END IF;

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
        IF NOT user_unlocked THEN
            RAISE EXCEPTION 'All bracket picks are permanently locked.';
        END IF;

        IF NEW.round = 'final' THEN
            fixture_id := 'final';
        ELSIF NEW.round = 'third_place' THEN
            fixture_id := 'third_place';
        ELSE
            fixture_id := NEW.round || '_' || (NEW.slot_index + 1)::TEXT;
        END IF;

        -- Admin-unlocked: block if match is already finished (prevent cheating)
        IF EXISTS (SELECT 1 FROM matches WHERE id = fixture_id AND status = 'finished') THEN
            SELECT team_code INTO existing_team_code 
            FROM bracket_picks WHERE user_id = NEW.user_id AND match_id = NEW.match_id;
            
            IF NOT FOUND OR NEW.team_code IS DISTINCT FROM existing_team_code THEN
                RAISE EXCEPTION 'This match has already finished. Bracket picks cannot be changed.';
            END IF;
        END IF;

        -- Admin-unlocked user can still save
        NEW.original_team_code = NEW.team_code;
        NEW.is_repredicted = false;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
