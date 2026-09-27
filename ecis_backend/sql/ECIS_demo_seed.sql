SELECT
    emergency_case_id,
    case_number,
    patient_id,
    unidentified_patient,
    status,
    temporary_identity_reference
FROM public.emergency_cases
WHERE case_number = 'ECIS-EMG-001';