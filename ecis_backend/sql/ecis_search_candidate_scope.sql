/*
 * Persist the patient IDs returned by each ECIS search. A case-linked
 * evidence request or human review may only use an actual search result.
 * Existing logs receive an empty list and must be searched again; this
 * deliberately does not grant access based on a historic count alone.
 */
BEGIN;

ALTER TABLE public.ecis_search_logs
  ADD COLUMN IF NOT EXISTS candidate_patient_ids BIGINT[]
    NOT NULL DEFAULT ARRAY[]::BIGINT[];

COMMIT;
