# Database SQL files

`00_baseline.sql` is the complete schema for a new empty ECIS database. Use `npm run db:setup` from the backend directory; it checks the target database and applies this file only if no application tables exist. Do not manually run the baseline on the working database.

The other SQL files are historical, narrowly scoped upgrades for installations that already had an older schema. They are **not** a sequence to run after the baseline, and `npm start` does not execute them. `internal_clinician_ids.sql` is used by the explicit `npm run migrate:clinician-ids` command. Face/photo services also have idempotent table creation as a runtime fallback; the baseline already includes those tables.

The obsolete `ecis_search_logs.sql` and incorrectly named `ecis_candidate_reviews.sql` were removed because both contained `DROP TABLE ecis_search_logs`, which could erase search history. Their current structures are included safely in the baseline. No database table or record was deleted.
