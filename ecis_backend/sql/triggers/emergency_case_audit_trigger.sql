DROP TRIGGER IF EXISTS trg_emergency_case_identity_audit
ON public.emergency_cases;

CREATE TRIGGER trg_emergency_case_identity_audit
AFTER UPDATE OF
    patient_id,
    unidentified_patient,
    status,
    identified_at,
    identified_by
ON public.emergency_cases
FOR EACH ROW
EXECUTE FUNCTION public.fn_audit_emergency_case_identity();