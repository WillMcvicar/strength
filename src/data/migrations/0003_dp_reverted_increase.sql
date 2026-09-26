-- D-44: an increase the lifter reverted stays reverted when the track is replayed (DESIGN §3.12,
-- §4.3). drizzle-kit drops the ON DELETE action when it adds a column, so this one is written by
-- hand to match.
ALTER TABLE `double_progression_state` ADD `reverted_increase_session_id` text REFERENCES session(id) ON DELETE SET NULL;
