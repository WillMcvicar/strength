-- D-30: a generated deload slot follows its source slot's weekday pin (DESIGN §4.3). drizzle-kit
-- drops the ON DELETE action when it adds a column, so this one is written by hand to match.
ALTER TABLE `cycle_slot` ADD `source_cycle_slot_id` text REFERENCES cycle_slot(id) ON DELETE SET NULL;
