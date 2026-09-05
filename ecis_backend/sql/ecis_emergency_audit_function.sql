CREATE OR REPLACE FUNCTION public.fn_audit_emergency_case_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    audit_user_id BIGINT;
    action_name VARCHAR(100);
BEGIN
    /*
     * Use the user responsible for the identification operation.
     */
    audit_user_id := COALESCE(
        NEW.identified_by,
        OLD.identified_by
    );

    /*
     * The audit_logs table requires a user_id.
     * If no user is available, do not create an audit row.
     */
    IF audit_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    /*
     * Only audit meaningful identity-related changes.
     */
    IF
        OLD.patient_id IS DISTINCT FROM NEW.patient_id
        OR OLD.unidentified_patient IS DISTINCT FROM NEW.unidentified_patient
        OR OLD.status IS DISTINCT FROM NEW.status
        OR OLD.identified_at IS DISTINCT FROM NEW.identified_at
        OR OLD.identified_by IS DISTINCT FROM NEW.identified_by
    THEN

        IF NEW.status = 'IDENTIFIED'
           AND OLD.status IS DISTINCT FROM 'IDENTIFIED'
        THEN
            action_name := 'ECIS_IDENTITY_CONFIRMED';
        ELSE
            action_name := 'EMERGENCY_IDENTITY_UPDATED';
        END IF;

        INSERT INTO public.audit_logs (
            hospital_id,
            user_id,
            action_type,
            entity_type,
            entity_id,
            old_values,
            new_values,
            action_reason
        )
        VALUES (
            NEW.hospital_id,
            audit_user_id,
            action_name,
            'emergency_case',
            NEW.emergency_case_id,

            jsonb_build_object(
                'patient_id', OLD.patient_id,
                'unidentified_patient', OLD.unidentified_patient,
                'status', OLD.status,
                'identified_at', OLD.identified_at,
                'identified_by', OLD.identified_by
            ),

            jsonb_build_object(
                'patient_id', NEW.patient_id,
                'unidentified_patient', NEW.unidentified_patient,
                'status', NEW.status,
                'identified_at', NEW.identified_at,
                'identified_by', NEW.identified_by
            ),

            CASE
                WHEN NEW.status = 'IDENTIFIED'
                     AND OLD.status IS DISTINCT FROM 'IDENTIFIED'
                THEN 'Emergency patient identity confirmed through ECIS human verification'
                ELSE 'Emergency patient identity information updated'
            END
        );

    END IF;

    RETURN NEW;
END;
$$;