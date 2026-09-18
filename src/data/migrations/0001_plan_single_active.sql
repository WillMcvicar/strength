-- FR-4.1: at most one active or paused plan (DESIGN §4.3). Hand-written because drizzle-kit
-- can't serialise this expression index, so it isn't declared in schema.ts.
CREATE UNIQUE INDEX `uq_plan_single_active` ON `plan` ((status IN ('active','paused'))) WHERE status IN ('active','paused');
