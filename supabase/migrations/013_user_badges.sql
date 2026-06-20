-- User Badges table for tracking earned achievements
CREATE TABLE IF NOT EXISTS user_badges (
  user_id   UUID REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id  TEXT NOT NULL,
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- Everyone can see earned badges (for profile pages)
CREATE POLICY "Anyone can view badges" ON user_badges FOR SELECT USING (true);

-- Only service role can insert/update badges (the recalculation engine)
CREATE POLICY "Service role can manage badges" ON user_badges FOR ALL
  USING (auth.role() = 'service_role');

-- Add to realtime so profile pages update live
ALTER PUBLICATION supabase_realtime ADD TABLE user_badges;
