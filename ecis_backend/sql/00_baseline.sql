--
-- PostgreSQL database dump
--

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: fn_audit_emergency_case_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_audit_emergency_case_identity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    audit_user_id BIGINT;
    action_name VARCHAR(100);
BEGIN
    audit_user_id := COALESCE(
        NEW.identified_by,
        OLD.identified_by
    );

    -- No reviewer/user available, so there is nothing to audit.
    IF audit_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Only create an audit record when identity-related fields change.
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


--
-- Name: fn_sync_investigation_verification_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_sync_investigation_verification_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.status = 'VERIFIED' THEN
    IF NEW.verified_at IS NULL THEN
      NEW.verified_at := CURRENT_TIMESTAMP;
    END IF;
  ELSE
    NEW.verified_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: fn_sync_medication_order_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_sync_medication_order_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  prescribed_quantity NUMERIC;
  dispensed_quantity NUMERIC;
BEGIN

  SELECT
    mo.quantity_prescribed

  INTO
    prescribed_quantity

  FROM public.medication_orders mo

  WHERE
    mo.medication_order_id =
      COALESCE(
        NEW.medication_order_id,
        OLD.medication_order_id
      );


  /*
   * If there is no prescribed quantity,
   * dispensing still represents a completed
   * pharmacy action but quantity comparison
   * cannot be performed.
   */
  IF prescribed_quantity IS NULL THEN

    UPDATE public.medication_orders

    SET
      order_status =
        CASE
          WHEN NEW.dispensing_status =
            'REVERSED'
          THEN 'ORDERED'

          ELSE 'DISPENSED'
        END,

      updated_at =
        CURRENT_TIMESTAMP

    WHERE
      medication_order_id =
        COALESCE(
          NEW.medication_order_id,
          OLD.medication_order_id
        );

    RETURN NEW;
  END IF;


  SELECT
    COALESCE(
      SUM(
        md.dispensed_quantity
      ),
      0
    )

  INTO
    dispensed_quantity

  FROM public.medication_dispensations md

  WHERE
    md.medication_order_id =
      COALESCE(
        NEW.medication_order_id,
        OLD.medication_order_id
      )

    AND md.dispensing_status =
      'DISPENSED';


  UPDATE public.medication_orders

  SET
    order_status =
      CASE

        WHEN dispensed_quantity <= 0
        THEN 'ORDERED'

        WHEN dispensed_quantity <
             prescribed_quantity
        THEN 'PARTIALLY_DISPENSED'

        ELSE 'DISPENSED'

      END,

    updated_at =
      CURRENT_TIMESTAMP

  WHERE
    medication_order_id =
      COALESCE(
        NEW.medication_order_id,
        OLD.medication_order_id
      );


  RETURN NEW;
END;
$$;


--
-- Name: fn_update_medication_order_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_update_medication_order_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at =
    CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$;


--
-- Name: fn_validate_medication_dispensation_context(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_validate_medication_dispensation_context() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  order_hospital_id BIGINT;
  order_patient_id BIGINT;
BEGIN

  SELECT
    mo.hospital_id,
    mo.patient_id

  INTO
    order_hospital_id,
    order_patient_id

  FROM public.medication_orders mo

  WHERE
    mo.medication_order_id =
      NEW.medication_order_id;


  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Medication order for dispensing does not exist.';
  END IF;


  IF order_hospital_id
     <> NEW.hospital_id THEN

    RAISE EXCEPTION
      'Dispensation hospital does not match medication order hospital.';

  END IF;


  /* ----------------------------------------------------------
     Validate dispenser hospital and active status
     ---------------------------------------------------------- */

  IF NOT EXISTS (
    SELECT 1

    FROM public.hospital_users u

    WHERE
      u.user_id =
        NEW.dispensed_by_user_id

      AND u.hospital_id =
        NEW.hospital_id

      AND u.is_active =
        TRUE
  ) THEN

    RAISE EXCEPTION
      'Pharmacist/dispensing user is not active in the selected hospital.';

  END IF;


  RETURN NEW;
END;
$$;


--
-- Name: fn_validate_medication_order_context(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_validate_medication_order_context() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  patient_hospital_id BIGINT;
  patient_dob DATE;

  encounter_patient_id BIGINT;
  encounter_hospital_id BIGINT;

  admission_patient_id BIGINT;
  admission_encounter_id BIGINT;

  prescriber_hospital_id BIGINT;
  prescriber_active BOOLEAN;
BEGIN

  /* ----------------------------------------------------------
     Patient validation
     ---------------------------------------------------------- */

  SELECT
    p.hospital_id,
    p.date_of_birth
  INTO
    patient_hospital_id,
    patient_dob

  FROM public.patients p

  WHERE
    p.patient_id = NEW.patient_id;


  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Medication order patient does not exist.';
  END IF;


  IF patient_hospital_id
     <> NEW.hospital_id THEN

    RAISE EXCEPTION
      'Patient does not belong to the selected hospital.';

  END IF;


  /* ----------------------------------------------------------
     Adult population validation
     ---------------------------------------------------------- */

  IF patient_dob IS NULL THEN

    RAISE EXCEPTION
      'Patient date of birth is required for medication ordering.';

  END IF;


  IF EXTRACT(
       YEAR
       FROM AGE(
         CURRENT_DATE,
         patient_dob
       )
     ) < 18 THEN

    RAISE EXCEPTION
      'Medication workflow is restricted to adult patients aged 18 or older.';

  END IF;


  /* ----------------------------------------------------------
     Encounter validation
     ---------------------------------------------------------- */

  SELECT
    e.patient_id,
    e.hospital_id

  INTO
    encounter_patient_id,
    encounter_hospital_id

  FROM public.encounters e

  WHERE
    e.encounter_id =
      NEW.encounter_id;


  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Medication order encounter does not exist.';
  END IF;


  IF encounter_patient_id
     <> NEW.patient_id THEN

    RAISE EXCEPTION
      'Encounter does not belong to the selected patient.';

  END IF;


  IF encounter_hospital_id
     <> NEW.hospital_id THEN

    RAISE EXCEPTION
      'Encounter does not belong to the selected hospital.';

  END IF;


  /* ----------------------------------------------------------
     Admission validation
     ---------------------------------------------------------- */

  IF NEW.admission_id IS NOT NULL THEN

    SELECT
      a.patient_id,
      a.encounter_id

    INTO
      admission_patient_id,
      admission_encounter_id

    FROM public.admissions a

    WHERE
      a.admission_id =
        NEW.admission_id;


    IF NOT FOUND THEN
      RAISE EXCEPTION
        'Medication order admission does not exist.';
    END IF;


    IF admission_patient_id
       <> NEW.patient_id THEN

      RAISE EXCEPTION
        'Admission does not belong to the selected patient.';

    END IF;


    IF admission_encounter_id
       <> NEW.encounter_id THEN

      RAISE EXCEPTION
        'Admission does not belong to the selected encounter.';

    END IF;

  END IF;


  /* ----------------------------------------------------------
     Prescriber validation
     ---------------------------------------------------------- */

  SELECT
    u.hospital_id,
    u.is_active

  INTO
    prescriber_hospital_id,
    prescriber_active

  FROM public.hospital_users u

  WHERE
    u.user_id =
      NEW.prescribed_by_user_id;


  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Medication prescriber does not exist.';
  END IF;


  IF prescriber_hospital_id
     <> NEW.hospital_id THEN

    RAISE EXCEPTION
      'Medication prescriber does not belong to the selected hospital.';

  END IF;


  IF NOT prescriber_active THEN

    RAISE EXCEPTION
      'Medication prescriber is not active.';

  END IF;


  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admissions (
    admission_id bigint NOT NULL,
    patient_id bigint NOT NULL,
    encounter_id bigint NOT NULL,
    ward_id bigint NOT NULL,
    bed_id bigint NOT NULL,
    admission_number character varying(50) NOT NULL,
    admission_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    discharge_date timestamp without time zone,
    admission_reason text,
    admission_diagnosis text,
    discharge_diagnosis text,
    discharge_summary text,
    attending_doctor_id bigint,
    status character varying(30) DEFAULT 'ADMITTED'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone,
    CONSTRAINT chk_admission_status CHECK (((status)::text = ANY ((ARRAY['ADMITTED'::character varying, 'DISCHARGED'::character varying, 'TRANSFERRED'::character varying, 'CANCELLED'::character varying])::text[]))),
    CONSTRAINT chk_discharge_date CHECK (((discharge_date IS NULL) OR (discharge_date >= admission_date)))
);


--
-- Name: admissions_admission_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admissions_admission_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admissions_admission_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admissions_admission_id_seq OWNED BY public.admissions.admission_id;


--
-- Name: allergies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.allergies (
    allergy_id bigint NOT NULL,
    allergy_name character varying(255) NOT NULL,
    allergy_category character varying(30) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT allergies_allergy_category_check CHECK (((allergy_category)::text = ANY ((ARRAY['FOOD'::character varying, 'MEDICAL_DRUG'::character varying])::text[])))
);


--
-- Name: allergies_allergy_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.allergies_allergy_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: allergies_allergy_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.allergies_allergy_id_seq OWNED BY public.allergies.allergy_id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    audit_log_id bigint NOT NULL,
    hospital_id bigint NOT NULL,
    user_id bigint NOT NULL,
    action_type character varying(100) NOT NULL,
    entity_type character varying(100) NOT NULL,
    entity_id bigint NOT NULL,
    old_values jsonb,
    new_values jsonb,
    action_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: audit_logs_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_audit_log_id_seq OWNED BY public.audit_logs.audit_log_id;


--
-- Name: auth_refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_refresh_tokens (
    refresh_token_id bigint NOT NULL,
    user_id bigint NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: auth_refresh_tokens_refresh_token_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auth_refresh_tokens_refresh_token_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auth_refresh_tokens_refresh_token_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auth_refresh_tokens_refresh_token_id_seq OWNED BY public.auth_refresh_tokens.refresh_token_id;


--
-- Name: beds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beds (
    bed_id bigint NOT NULL,
    ward_id bigint NOT NULL,
    bed_number character varying(30) NOT NULL,
    bed_type character varying(50),
    status character varying(30) DEFAULT 'AVAILABLE'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone,
    CONSTRAINT chk_bed_status CHECK (((status)::text = ANY ((ARRAY['AVAILABLE'::character varying, 'OCCUPIED'::character varying, 'MAINTENANCE'::character varying, 'RESERVED'::character varying, 'OUT_OF_SERVICE'::character varying])::text[])))
);


--
-- Name: beds_bed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.beds_bed_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: beds_bed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.beds_bed_id_seq OWNED BY public.beds.bed_id;


--
-- Name: bht_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bht_entries (
    bht_entry_id bigint NOT NULL,
    admission_id bigint NOT NULL,
    encounter_id bigint NOT NULL,
    patient_id bigint NOT NULL,
    hospital_id bigint NOT NULL,
    entry_type character varying(40) NOT NULL,
    entry_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    entry_title character varying(200),
    subjective_notes text,
    objective_notes text,
    assessment text,
    plan text,
    diagnosis text,
    temperature_c numeric(4,1),
    pulse_bpm integer,
    respiratory_rate_bpm integer,
    systolic_bp integer,
    diastolic_bp integer,
    spo2_percent numeric(5,2),
    pain_score smallint,
    weight_kg numeric(6,2),
    recorded_by bigint NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_bht_diastolic CHECK (((diastolic_bp IS NULL) OR ((diastolic_bp >= 20) AND (diastolic_bp <= 200)))),
    CONSTRAINT chk_bht_entry_type CHECK (((entry_type)::text = ANY ((ARRAY['ADMISSION_ASSESSMENT'::character varying, 'DAILY_PROGRESS'::character varying, 'WARD_ROUND'::character varying, 'CONSULTATION'::character varying, 'PROCEDURE_NOTE'::character varying, 'DISCHARGE_PLANNING'::character varying])::text[]))),
    CONSTRAINT chk_bht_pain CHECK (((pain_score IS NULL) OR ((pain_score >= 0) AND (pain_score <= 10)))),
    CONSTRAINT chk_bht_pulse CHECK (((pulse_bpm IS NULL) OR ((pulse_bpm >= 20) AND (pulse_bpm <= 300)))),
    CONSTRAINT chk_bht_respiratory_rate CHECK (((respiratory_rate_bpm IS NULL) OR ((respiratory_rate_bpm >= 1) AND (respiratory_rate_bpm <= 100)))),
    CONSTRAINT chk_bht_spo2 CHECK (((spo2_percent IS NULL) OR ((spo2_percent >= (0)::numeric) AND (spo2_percent <= (100)::numeric)))),
    CONSTRAINT chk_bht_systolic CHECK (((systolic_bp IS NULL) OR ((systolic_bp >= 40) AND (systolic_bp <= 300)))),
    CONSTRAINT chk_bht_temperature CHECK (((temperature_c IS NULL) OR ((temperature_c >= (20)::numeric) AND (temperature_c <= (45)::numeric)))),
    CONSTRAINT chk_bht_weight CHECK (((weight_kg IS NULL) OR ((weight_kg > (0)::numeric) AND (weight_kg <= (500)::numeric))))
);


--
-- Name: bht_entries_bht_entry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bht_entries_bht_entry_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bht_entries_bht_entry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bht_entries_bht_entry_id_seq OWNED BY public.bht_entries.bht_entry_id;


--
-- Name: clinic_visits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_visits (
    clinic_visit_id bigint NOT NULL,
    clinic_id bigint NOT NULL,
    encounter_id bigint NOT NULL,
    patient_id bigint NOT NULL,
    visit_number character varying(50),
    visit_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    doctor_user_id bigint,
    reason_for_visit text,
    clinical_notes text,
    diagnosis_summary text,
    follow_up_required boolean DEFAULT false NOT NULL,
    follow_up_date date,
    status character varying(30) DEFAULT 'COMPLETED'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone
);


--
-- Name: clinic_visits_clinic_visit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clinic_visits_clinic_visit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clinic_visits_clinic_visit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clinic_visits_clinic_visit_id_seq OWNED BY public.clinic_visits.clinic_visit_id;


--
-- Name: clinical_observations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinical_observations (
    observation_id bigint NOT NULL,
    patient_id bigint NOT NULL,
    encounter_id bigint NOT NULL,
    treatment_id bigint,
    observation_type character varying(100) NOT NULL,
    observation_value text NOT NULL,
    body_site character varying(150),
    laterality character varying(30),
    observed_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    recorded_by bigint,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: clinical_observations_observation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clinical_observations_observation_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clinical_observations_observation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clinical_observations_observation_id_seq OWNED BY public.clinical_observations.observation_id;


--
-- Name: clinics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinics (
    clinic_id bigint NOT NULL,
    hospital_id bigint NOT NULL,
    clinic_code character varying(30) NOT NULL,
    clinic_name character varying(150) NOT NULL,
    specialty character varying(100),
    location character varying(150),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone
);


--
-- Name: clinics_clinic_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clinics_clinic_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clinics_clinic_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clinics_clinic_id_seq OWNED BY public.clinics.clinic_id;


--
-- Name: dental_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dental_records (
    dental_record_id bigint NOT NULL,
    patient_id bigint NOT NULL,
    encounter_id bigint,
    record_date date DEFAULT CURRENT_DATE NOT NULL,
    tooth_number character varying(20),
    condition character varying(150),
    treatment character varying(200),
    filling_type character varying(100),
    crown_present boolean DEFAULT false NOT NULL,
    implant_present boolean DEFAULT false NOT NULL,
    missing_tooth boolean DEFAULT false NOT NULL,
    notes text,
    recorded_by bigint,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone
);


--
-- Name: dental_records_dental_record_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dental_records_dental_record_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dental_records_dental_record_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dental_records_dental_record_id_seq OWNED BY public.dental_records.dental_record_id;


--
-- Name: ecis_candidate_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecis_candidate_reviews (
    review_id bigint NOT NULL,
    emergency_case_id bigint NOT NULL,
    patient_id bigint NOT NULL,
    reviewed_by bigint NOT NULL,
    review_status character varying(30) NOT NULL,
    review_reason text,
    reviewed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_ecis_review_status CHECK (((review_status)::text = ANY ((ARRAY['CONFIRMED'::character varying, 'REJECTED'::character varying, 'NEEDS_MORE_EVIDENCE'::character varying])::text[])))
);


--
-- Name: ecis_candidate_reviews_review_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ecis_candidate_reviews_review_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ecis_candidate_reviews_review_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ecis_candidate_reviews_review_id_seq OWNED BY public.ecis_candidate_reviews.review_id;


--
-- Name: ecis_search_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ecis_search_logs (
    search_log_id bigint NOT NULL,
    emergency_case_id bigint,
    searched_by bigint NOT NULL,
    search_criteria jsonb NOT NULL,
    result_count integer DEFAULT 0 NOT NULL,
    searched_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    candidate_patient_ids bigint[] DEFAULT ARRAY[]::bigint[] NOT NULL,
    CONSTRAINT chk_ecis_result_count CHECK ((result_count >= 0))
);


--
-- Name: ecis_search_logs_search_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ecis_search_logs_search_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ecis_search_logs_search_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ecis_search_logs_search_log_id_seq OWNED BY public.ecis_search_logs.search_log_id;


--
-- Name: emergency_case_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emergency_case_locations (
    emergency_case_location_id bigint NOT NULL,
    emergency_case_id bigint NOT NULL,
    bed_id bigint NOT NULL,
    location_type character varying(30) NOT NULL,
    started_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ended_at timestamp without time zone,
    assigned_by bigint NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_emergency_location_dates CHECK (((ended_at IS NULL) OR (ended_at >= started_at))),
    CONSTRAINT chk_emergency_location_type CHECK (((location_type)::text = ANY ((ARRAY['EMERGENCY'::character varying, 'WARD'::character varying, 'ICU'::character varying])::text[])))
);


--
-- Name: emergency_case_locations_emergency_case_location_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.emergency_case_locations_emergency_case_location_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: emergency_case_locations_emergency_case_location_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.emergency_case_locations_emergency_case_location_id_seq OWNED BY public.emergency_case_locations.emergency_case_location_id;


--
-- Name: emergency_cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emergency_cases (
    emergency_case_id bigint NOT NULL,
    hospital_id bigint NOT NULL,
    encounter_id bigint,
    patient_id bigint,
    case_number character varying(50) NOT NULL,
    arrival_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    arrival_mode character varying(50),
    triage_level character varying(50),
    chief_complaint text,
    initial_condition text,
    unidentified_patient boolean DEFAULT false NOT NULL,
    temporary_identity_reference character varying(100),
    assigned_doctor_id bigint,
    status character varying(30) DEFAULT 'OPEN'::character varying NOT NULL,
    identified_at timestamp without time zone,
    identified_by bigint,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone,
    CONSTRAINT chk_emergency_status CHECK (((status)::text = ANY ((ARRAY['OPEN'::character varying, 'IN_TREATMENT'::character varying, 'IDENTIFICATION_PENDING'::character varying, 'IDENTIFIED'::character varying, 'DISCHARGED'::character varying])::text[])))
);


--
-- Name: emergency_cases_emergency_case_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.emergency_cases_emergency_case_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: emergency_cases_emergency_case_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.emergency_cases_emergency_case_id_seq OWNED BY public.emergency_cases.emergency_case_id;


--
-- Name: encounters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.encounters (
    encounter_id bigint NOT NULL,
    patient_id bigint NOT NULL,
    hospital_id bigint NOT NULL,
    encounter_type character varying(30) NOT NULL,
    encounter_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    attending_user_id bigint,
    department character varying(100),
    status character varying(30) DEFAULT 'OPEN'::character varying NOT NULL,
    chief_complaint text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone
);


--
-- Name: encounters_encounter_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.encounters_encounter_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: encounters_encounter_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.encounters_encounter_id_seq OWNED BY public.encounters.encounter_id;


--
-- Name: fractures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fractures (
    fracture_id bigint NOT NULL,
    patient_id bigint NOT NULL,
    encounter_id bigint NOT NULL,
    body_part character varying(150) NOT NULL,
    laterality character varying(30),
    fracture_type character varying(100),
    fracture_date date,
    treatment_description text,
    healed_date date,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone
);


--
-- Name: fractures_fracture_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fractures_fracture_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fractures_fracture_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fractures_fracture_id_seq OWNED BY public.fractures.fracture_id;


--
-- Name: hospital_user_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hospital_user_assignments (
    assignment_id bigint NOT NULL,
    user_id bigint NOT NULL,
    hospital_id bigint NOT NULL,
    role character varying(64) NOT NULL,
    department character varying(150),
    designation character varying(150),
    license_number character varying(100),
    start_date date DEFAULT CURRENT_DATE NOT NULL,
    end_date date,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone,
    CONSTRAINT chk_hospital_user_assignment_dates CHECK (((end_date IS NULL) OR (end_date >= start_date))),
    CONSTRAINT chk_hospital_user_assignment_status CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'SUSPENDED'::character varying, 'ENDED'::character varying])::text[])))
);


--
-- Name: hospital_user_assignments_assignment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hospital_user_assignments_assignment_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hospital_user_assignments_assignment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hospital_user_assignments_assignment_id_seq OWNED BY public.hospital_user_assignments.assignment_id;


--
-- Name: hospital_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hospital_users (
    user_id bigint NOT NULL,
    hospital_id bigint NOT NULL,
    employee_number character varying(50) NOT NULL,
    full_name character varying(150) NOT NULL,
    username character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    department character varying(100),
    phone character varying(20),
    email character varying(150),
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone,
    internal_clinician_id character varying(32)
);


--
-- Name: hospital_users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hospital_users_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hospital_users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hospital_users_user_id_seq OWNED BY public.hospital_users.user_id;


--
-- Name: hospitals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hospitals (
    hospital_id bigint NOT NULL,
    hospital_code character varying(20) NOT NULL,
    hospital_name character varying(150) NOT NULL,
    hospital_type character varying(50),
    province character varying(100),
    district character varying(100),
    address text,
    phone character varying(20),
    email character varying(150),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone
);


--
-- Name: hospitals_hospital_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hospitals_hospital_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hospitals_hospital_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hospitals_hospital_id_seq OWNED BY public.hospitals.hospital_id;


--
-- Name: investigations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.investigations (
    investigation_id bigint NOT NULL,
    patient_id bigint NOT NULL,
    encounter_id bigint NOT NULL,
    investigation_type character varying(100) NOT NULL,
    investigation_name character varying(200) NOT NULL,
    requested_date timestamp without time zone,
    performed_date timestamp without time zone,
    result_summary text,
    result_value character varying(200),
    unit character varying(50),
    reference_range character varying(100),
    body_site character varying(150),
    performed_by bigint,
    report_reference character varying(200),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone,
    status character varying(30) DEFAULT 'RESULTED'::character varying NOT NULL,
    requested_by bigint,
    verified_by bigint,
    verified_at timestamp without time zone,
    priority character varying(20) DEFAULT 'NORMAL'::character varying NOT NULL,
    specimen_type character varying(120),
    clinical_notes text,
    CONSTRAINT investigations_priority_check CHECK (((priority)::text = ANY ((ARRAY['ROUTINE'::character varying, 'NORMAL'::character varying, 'URGENT'::character varying, 'STAT'::character varying])::text[]))),
    CONSTRAINT investigations_status_check CHECK (((status)::text = ANY ((ARRAY['REQUESTED'::character varying, 'COLLECTED'::character varying, 'IN_PROCESS'::character varying, 'RESULTED'::character varying, 'VERIFIED'::character varying, 'CANCELLED'::character varying])::text[])))
);


--
-- Name: investigations_investigation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.investigations_investigation_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: investigations_investigation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.investigations_investigation_id_seq OWNED BY public.investigations.investigation_id;


--
-- Name: medical_conditions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medical_conditions (
    condition_id bigint NOT NULL,
    condition_code character varying(50),
    condition_name character varying(200) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: medical_conditions_condition_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.medical_conditions_condition_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: medical_conditions_condition_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.medical_conditions_condition_id_seq OWNED BY public.medical_conditions.condition_id;


--
-- Name: medical_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medical_devices (
    device_id bigint NOT NULL,
    patient_id bigint NOT NULL,
    encounter_id bigint,
    device_type character varying(100) NOT NULL,
    device_name character varying(200),
    manufacturer character varying(150),
    model_number character varying(100),
    serial_number character varying(100),
    body_site character varying(150),
    laterality character varying(30),
    implantation_date date,
    removal_date date,
    status character varying(30) DEFAULT 'ACTIVE'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone
);


--
-- Name: medical_devices_device_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.medical_devices_device_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: medical_devices_device_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.medical_devices_device_id_seq OWNED BY public.medical_devices.device_id;


--
-- Name: medication_dispensations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medication_dispensations (
    medication_dispensation_id bigint NOT NULL,
    medication_order_id bigint NOT NULL,
    hospital_id bigint NOT NULL,
    dispensed_by_user_id bigint NOT NULL,
    dispensed_quantity numeric(12,3) NOT NULL,
    quantity_unit character varying(50) NOT NULL,
    dispensed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    dispensing_status character varying(30) DEFAULT 'DISPENSED'::character varying NOT NULL,
    pharmacy_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT medication_dispensations_quantity_chk CHECK ((dispensed_quantity > (0)::numeric)),
    CONSTRAINT medication_dispensations_status_chk CHECK (((dispensing_status)::text = ANY ((ARRAY['DISPENSED'::character varying, 'REVERSED'::character varying])::text[])))
);


--
-- Name: TABLE medication_dispensations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.medication_dispensations IS 'Pharmacy dispensing records linked to medication orders.';


--
-- Name: medication_dispensations_medication_dispensation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.medication_dispensations_medication_dispensation_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: medication_dispensations_medication_dispensation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.medication_dispensations_medication_dispensation_id_seq OWNED BY public.medication_dispensations.medication_dispensation_id;


--
-- Name: medication_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medication_orders (
    medication_order_id bigint NOT NULL,
    hospital_id bigint NOT NULL,
    patient_id bigint NOT NULL,
    encounter_id bigint NOT NULL,
    admission_id bigint,
    prescribed_by_user_id bigint NOT NULL,
    medication_name character varying(200) NOT NULL,
    strength character varying(100),
    dosage character varying(100) NOT NULL,
    route character varying(50),
    frequency character varying(100) NOT NULL,
    duration_value numeric(10,2),
    duration_unit character varying(30),
    quantity_prescribed numeric(12,3),
    quantity_unit character varying(50),
    instructions text,
    indication text,
    start_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    end_date timestamp without time zone,
    order_status character varying(30) DEFAULT 'ORDERED'::character varying NOT NULL,
    prescribed_notes text,
    cancelled_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT medication_orders_duration_chk CHECK (((duration_value IS NULL) OR (duration_value > (0)::numeric))),
    CONSTRAINT medication_orders_end_date_chk CHECK (((end_date IS NULL) OR (end_date >= start_date))),
    CONSTRAINT medication_orders_quantity_chk CHECK (((quantity_prescribed IS NULL) OR (quantity_prescribed > (0)::numeric))),
    CONSTRAINT medication_orders_status_chk CHECK (((order_status)::text = ANY ((ARRAY['ORDERED'::character varying, 'PARTIALLY_DISPENSED'::character varying, 'DISPENSED'::character varying, 'DISCONTINUED'::character varying, 'CANCELLED'::character varying, 'COMPLETED'::character varying])::text[])))
);


--
-- Name: TABLE medication_orders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.medication_orders IS 'Medication orders linked to the existing longitudinal EHR patient and encounter records.';


--
-- Name: medication_orders_medication_order_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.medication_orders_medication_order_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: medication_orders_medication_order_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.medication_orders_medication_order_id_seq OWNED BY public.medication_orders.medication_order_id;


--
-- Name: opd_visits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.opd_visits (
    opd_visit_id bigint NOT NULL,
    encounter_id bigint NOT NULL,
    patient_id bigint NOT NULL,
    opd_number character varying(50) NOT NULL,
    visit_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    doctor_user_id bigint,
    chief_complaint text,
    clinical_notes text,
    diagnosis_summary text,
    follow_up_required boolean DEFAULT false NOT NULL,
    follow_up_date date,
    status character varying(30) DEFAULT 'COMPLETED'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone
);


--
-- Name: opd_visits_opd_visit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.opd_visits_opd_visit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: opd_visits_opd_visit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.opd_visits_opd_visit_id_seq OWNED BY public.opd_visits.opd_visit_id;


--
-- Name: patient_allergies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_allergies (
    patient_allergy_id bigint NOT NULL,
    patient_id bigint NOT NULL,
    allergy_id bigint NOT NULL,
    reaction text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: patient_allergies_patient_allergy_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.patient_allergies_patient_allergy_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: patient_allergies_patient_allergy_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.patient_allergies_patient_allergy_id_seq OWNED BY public.patient_allergies.patient_allergy_id;


--
-- Name: patient_conditions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_conditions (
    patient_condition_id bigint NOT NULL,
    patient_id bigint NOT NULL,
    condition_id bigint NOT NULL,
    encounter_id bigint,
    diagnosis_date date DEFAULT CURRENT_DATE NOT NULL,
    condition_status character varying(50),
    severity character varying(50),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone
);


--
-- Name: patient_conditions_patient_condition_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.patient_conditions_patient_condition_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: patient_conditions_patient_condition_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.patient_conditions_patient_condition_id_seq OWNED BY public.patient_conditions.patient_condition_id;


--
-- Name: patient_face_profile_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_face_profile_events (
    event_id bigint NOT NULL,
    patient_id bigint NOT NULL,
    hospital_id bigint NOT NULL,
    actor_user_id bigint NOT NULL,
    event_type character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT patient_face_profile_events_event_type_check CHECK (((event_type)::text = ANY ((ARRAY['ENROLLED'::character varying, 'REPLACED'::character varying, 'REMOVED'::character varying])::text[])))
);


--
-- Name: patient_face_profile_events_event_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.patient_face_profile_events_event_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: patient_face_profile_events_event_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.patient_face_profile_events_event_id_seq OWNED BY public.patient_face_profile_events.event_id;


--
-- Name: patient_face_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_face_profiles (
    patient_id bigint NOT NULL,
    enrolled_hospital_id bigint NOT NULL,
    enrolled_by bigint NOT NULL,
    model_id character varying(100) NOT NULL,
    descriptor_ciphertext bytea NOT NULL,
    descriptor_iv bytea NOT NULL,
    descriptor_tag bytea NOT NULL,
    consent_recorded_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    photo_ciphertext bytea,
    photo_iv bytea,
    photo_tag bytea
);


--
-- Name: patient_hospital_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_hospital_registrations (
    patient_hospital_registration_id bigint CONSTRAINT patient_hospital_registrati_patient_hospital_registrat_not_null NOT NULL,
    patient_id bigint NOT NULL,
    hospital_id bigint NOT NULL,
    hospital_patient_number character varying(100) NOT NULL,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    registered_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    registered_by bigint,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone,
    CONSTRAINT chk_patient_hospital_registration_status CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'ARCHIVED'::character varying])::text[])))
);


--
-- Name: patient_hospital_registration_patient_hospital_registration_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.patient_hospital_registration_patient_hospital_registration_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: patient_hospital_registration_patient_hospital_registration_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.patient_hospital_registration_patient_hospital_registration_seq OWNED BY public.patient_hospital_registrations.patient_hospital_registration_id;


--
-- Name: patient_identity_photo_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_identity_photo_events (
    event_id bigint NOT NULL,
    patient_id bigint NOT NULL,
    hospital_id bigint NOT NULL,
    actor_user_id bigint NOT NULL,
    event_type character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT patient_identity_photo_events_event_type_check CHECK (((event_type)::text = ANY ((ARRAY['ADDED'::character varying, 'REPLACED'::character varying])::text[])))
);


--
-- Name: patient_identity_photo_events_event_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.patient_identity_photo_events_event_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: patient_identity_photo_events_event_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.patient_identity_photo_events_event_id_seq OWNED BY public.patient_identity_photo_events.event_id;


--
-- Name: patient_identity_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_identity_photos (
    patient_id bigint NOT NULL,
    hospital_id bigint NOT NULL,
    uploaded_by bigint NOT NULL,
    ciphertext bytea NOT NULL,
    iv bytea NOT NULL,
    tag bytea NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: patients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patients (
    patient_id bigint NOT NULL,
    hospital_id bigint NOT NULL,
    patient_number character varying(30) NOT NULL,
    nic_number character varying(20),
    passport_number character varying(30),
    first_name character varying(100) NOT NULL,
    middle_name character varying(100),
    last_name character varying(100),
    date_of_birth date,
    gender character varying(20),
    blood_group character varying(10),
    height_cm numeric(5,2),
    weight_kg numeric(6,2),
    nationality character varying(50),
    primary_phone character varying(20),
    secondary_phone character varying(20),
    email character varying(150),
    occupation character varying(150),
    status character varying(30) DEFAULT 'ACTIVE'::character varying NOT NULL,
    registered_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone,
    address text,
    province character varying(100),
    district character varying(100),
    registration_notes text,
    allergy_status character varying(30) DEFAULT 'UNKNOWN'::character varying NOT NULL,
    CONSTRAINT chk_patients_allergy_status CHECK (((allergy_status)::text = ANY ((ARRAY['NO_KNOWN_ALLERGIES'::character varying, 'HAS_ALLERGIES'::character varying, 'UNKNOWN'::character varying])::text[])))
);


--
-- Name: patients_patient_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.patients_patient_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: patients_patient_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.patients_patient_id_seq OWNED BY public.patients.patient_id;


--
-- Name: procedures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.procedures (
    procedure_id bigint NOT NULL,
    patient_id bigint NOT NULL,
    encounter_id bigint NOT NULL,
    procedure_code character varying(50),
    procedure_name character varying(200) NOT NULL,
    procedure_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    body_site character varying(150),
    laterality character varying(30),
    performed_by bigint,
    indication text,
    findings text,
    outcome text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone
);


--
-- Name: procedures_procedure_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.procedures_procedure_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: procedures_procedure_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.procedures_procedure_id_seq OWNED BY public.procedures.procedure_id;


--
-- Name: radiology_image_access_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.radiology_image_access_logs (
    radiology_image_access_log_id bigint CONSTRAINT radiology_image_access_logs_radiology_image_access_log_not_null NOT NULL,
    radiology_image_id bigint NOT NULL,
    accessed_by bigint NOT NULL,
    access_action character varying(20) DEFAULT 'VIEW'::character varying NOT NULL,
    accessed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT radiology_image_access_logs_action_check CHECK (((access_action)::text = ANY ((ARRAY['VIEW'::character varying, 'DOWNLOAD'::character varying])::text[])))
);


--
-- Name: radiology_image_access_logs_radiology_image_access_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.radiology_image_access_logs_radiology_image_access_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: radiology_image_access_logs_radiology_image_access_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.radiology_image_access_logs_radiology_image_access_log_id_seq OWNED BY public.radiology_image_access_logs.radiology_image_access_log_id;


--
-- Name: radiology_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.radiology_images (
    radiology_image_id bigint NOT NULL,
    investigation_id bigint NOT NULL,
    patient_id bigint NOT NULL,
    hospital_id bigint NOT NULL,
    storage_key character varying(120) NOT NULL,
    original_filename character varying(255) NOT NULL,
    mime_type character varying(100) NOT NULL,
    size_bytes bigint NOT NULL,
    checksum_sha256 character(64) NOT NULL,
    uploaded_by bigint NOT NULL,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT radiology_images_mime_type_check CHECK (((mime_type)::text = ANY ((ARRAY['image/jpeg'::character varying, 'image/png'::character varying, 'image/webp'::character varying, 'application/dicom'::character varying])::text[]))),
    CONSTRAINT radiology_images_size_bytes_check CHECK ((size_bytes > 0))
);


--
-- Name: radiology_images_radiology_image_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.radiology_images_radiology_image_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: radiology_images_radiology_image_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.radiology_images_radiology_image_id_seq OWNED BY public.radiology_images.radiology_image_id;


--
-- Name: surgeries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.surgeries (
    surgery_id bigint NOT NULL,
    patient_id bigint NOT NULL,
    encounter_id bigint NOT NULL,
    admission_id bigint,
    surgery_code character varying(50),
    surgery_name character varying(200) NOT NULL,
    surgery_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    body_site character varying(150),
    laterality character varying(30),
    surgeon_user_id bigint,
    preoperative_diagnosis text,
    postoperative_diagnosis text,
    findings text,
    complications text,
    surgical_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone
);


--
-- Name: surgeries_surgery_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.surgeries_surgery_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: surgeries_surgery_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.surgeries_surgery_id_seq OWNED BY public.surgeries.surgery_id;


--
-- Name: treatment_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treatment_records (
    treatment_id bigint NOT NULL,
    patient_id bigint NOT NULL,
    encounter_id bigint NOT NULL,
    opd_visit_id bigint,
    clinic_visit_id bigint,
    admission_id bigint,
    emergency_case_id bigint,
    treatment_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    treatment_type character varying(100) NOT NULL,
    treatment_name character varying(200),
    description text,
    body_site character varying(150),
    laterality character varying(30),
    performed_by bigint,
    outcome text,
    complications text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone
);


--
-- Name: treatment_records_treatment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.treatment_records_treatment_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: treatment_records_treatment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.treatment_records_treatment_id_seq OWNED BY public.treatment_records.treatment_id;


--
-- Name: wards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wards (
    ward_id bigint NOT NULL,
    hospital_id bigint NOT NULL,
    ward_code character varying(30) NOT NULL,
    ward_name character varying(150) NOT NULL,
    ward_type character varying(50),
    floor character varying(50),
    location character varying(150),
    capacity integer DEFAULT 0 NOT NULL,
    gender_policy character varying(30),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone,
    CONSTRAINT chk_ward_capacity CHECK ((capacity >= 0))
);


--
-- Name: vw_bht_clinical_timeline; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_bht_clinical_timeline AS
 SELECT b.bht_entry_id,
    b.admission_id,
    a.admission_number,
    b.encounter_id,
    b.patient_id,
    p.patient_number,
    p.first_name,
    p.last_name,
    b.hospital_id,
    h.hospital_name,
    b.entry_type,
    b.entry_date,
    b.entry_title,
    b.subjective_notes,
    b.objective_notes,
    b.assessment,
    b.plan,
    b.diagnosis,
    b.temperature_c,
    b.pulse_bpm,
    b.respiratory_rate_bpm,
    b.systolic_bp,
    b.diastolic_bp,
    b.spo2_percent,
    b.pain_score,
    b.weight_kg,
    b.recorded_by,
    u.full_name AS recorded_by_name,
    w.ward_id,
    w.ward_code,
    w.ward_name,
    w.ward_type,
    b.created_at,
    b.updated_at
   FROM (((((public.bht_entries b
     JOIN public.admissions a ON ((a.admission_id = b.admission_id)))
     JOIN public.patients p ON ((p.patient_id = b.patient_id)))
     JOIN public.hospitals h ON ((h.hospital_id = b.hospital_id)))
     JOIN public.hospital_users u ON ((u.user_id = b.recorded_by)))
     JOIN public.wards w ON ((w.ward_id = a.ward_id)));


--
-- Name: vw_medication_longitudinal_history; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_medication_longitudinal_history AS
 SELECT mo.medication_order_id,
    mo.hospital_id,
    mo.patient_id,
    p.patient_number,
    p.first_name,
    p.middle_name,
    p.last_name,
    mo.encounter_id,
    e.encounter_type,
    e.encounter_date,
    mo.admission_id,
    a.admission_number,
    mo.medication_name,
    mo.strength,
    mo.dosage,
    mo.route,
    mo.frequency,
    mo.duration_value,
    mo.duration_unit,
    mo.quantity_prescribed,
    mo.quantity_unit,
    mo.instructions,
    mo.indication,
    mo.start_date,
    mo.end_date,
    mo.order_status,
    mo.prescribed_by_user_id,
    prescriber.full_name AS prescriber_name,
    COALESCE(( SELECT sum(md.dispensed_quantity) AS sum
           FROM public.medication_dispensations md
          WHERE ((md.medication_order_id = mo.medication_order_id) AND ((md.dispensing_status)::text = 'DISPENSED'::text))), (0)::numeric) AS total_dispensed_quantity,
    COALESCE(( SELECT max(md.dispensed_at) AS max
           FROM public.medication_dispensations md
          WHERE ((md.medication_order_id = mo.medication_order_id) AND ((md.dispensing_status)::text = 'DISPENSED'::text))), NULL::timestamp without time zone) AS last_dispensed_at,
    mo.prescribed_notes,
    mo.created_at,
    mo.updated_at
   FROM ((((public.medication_orders mo
     JOIN public.patients p ON ((p.patient_id = mo.patient_id)))
     JOIN public.encounters e ON ((e.encounter_id = mo.encounter_id)))
     LEFT JOIN public.admissions a ON ((a.admission_id = mo.admission_id)))
     LEFT JOIN public.hospital_users prescriber ON ((prescriber.user_id = mo.prescribed_by_user_id)));


--
-- Name: VIEW vw_medication_longitudinal_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.vw_medication_longitudinal_history IS 'Longitudinal medication history combining patient, encounter, admission, order and dispensing information.';


--
-- Name: wards_ward_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wards_ward_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wards_ward_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wards_ward_id_seq OWNED BY public.wards.ward_id;


--
-- Name: admissions admission_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions ALTER COLUMN admission_id SET DEFAULT nextval('public.admissions_admission_id_seq'::regclass);


--
-- Name: allergies allergy_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allergies ALTER COLUMN allergy_id SET DEFAULT nextval('public.allergies_allergy_id_seq'::regclass);


--
-- Name: audit_logs audit_log_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN audit_log_id SET DEFAULT nextval('public.audit_logs_audit_log_id_seq'::regclass);


--
-- Name: auth_refresh_tokens refresh_token_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_refresh_tokens ALTER COLUMN refresh_token_id SET DEFAULT nextval('public.auth_refresh_tokens_refresh_token_id_seq'::regclass);


--
-- Name: beds bed_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beds ALTER COLUMN bed_id SET DEFAULT nextval('public.beds_bed_id_seq'::regclass);


--
-- Name: bht_entries bht_entry_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bht_entries ALTER COLUMN bht_entry_id SET DEFAULT nextval('public.bht_entries_bht_entry_id_seq'::regclass);


--
-- Name: clinic_visits clinic_visit_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_visits ALTER COLUMN clinic_visit_id SET DEFAULT nextval('public.clinic_visits_clinic_visit_id_seq'::regclass);


--
-- Name: clinical_observations observation_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_observations ALTER COLUMN observation_id SET DEFAULT nextval('public.clinical_observations_observation_id_seq'::regclass);


--
-- Name: clinics clinic_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinics ALTER COLUMN clinic_id SET DEFAULT nextval('public.clinics_clinic_id_seq'::regclass);


--
-- Name: dental_records dental_record_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dental_records ALTER COLUMN dental_record_id SET DEFAULT nextval('public.dental_records_dental_record_id_seq'::regclass);


--
-- Name: ecis_candidate_reviews review_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecis_candidate_reviews ALTER COLUMN review_id SET DEFAULT nextval('public.ecis_candidate_reviews_review_id_seq'::regclass);


--
-- Name: ecis_search_logs search_log_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecis_search_logs ALTER COLUMN search_log_id SET DEFAULT nextval('public.ecis_search_logs_search_log_id_seq'::regclass);


--
-- Name: emergency_case_locations emergency_case_location_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_case_locations ALTER COLUMN emergency_case_location_id SET DEFAULT nextval('public.emergency_case_locations_emergency_case_location_id_seq'::regclass);


--
-- Name: emergency_cases emergency_case_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_cases ALTER COLUMN emergency_case_id SET DEFAULT nextval('public.emergency_cases_emergency_case_id_seq'::regclass);


--
-- Name: encounters encounter_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters ALTER COLUMN encounter_id SET DEFAULT nextval('public.encounters_encounter_id_seq'::regclass);


--
-- Name: fractures fracture_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fractures ALTER COLUMN fracture_id SET DEFAULT nextval('public.fractures_fracture_id_seq'::regclass);


--
-- Name: hospital_user_assignments assignment_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_user_assignments ALTER COLUMN assignment_id SET DEFAULT nextval('public.hospital_user_assignments_assignment_id_seq'::regclass);


--
-- Name: hospital_users user_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_users ALTER COLUMN user_id SET DEFAULT nextval('public.hospital_users_user_id_seq'::regclass);


--
-- Name: hospitals hospital_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospitals ALTER COLUMN hospital_id SET DEFAULT nextval('public.hospitals_hospital_id_seq'::regclass);


--
-- Name: investigations investigation_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investigations ALTER COLUMN investigation_id SET DEFAULT nextval('public.investigations_investigation_id_seq'::regclass);


--
-- Name: medical_conditions condition_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_conditions ALTER COLUMN condition_id SET DEFAULT nextval('public.medical_conditions_condition_id_seq'::regclass);


--
-- Name: medical_devices device_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_devices ALTER COLUMN device_id SET DEFAULT nextval('public.medical_devices_device_id_seq'::regclass);


--
-- Name: medication_dispensations medication_dispensation_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_dispensations ALTER COLUMN medication_dispensation_id SET DEFAULT nextval('public.medication_dispensations_medication_dispensation_id_seq'::regclass);


--
-- Name: medication_orders medication_order_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_orders ALTER COLUMN medication_order_id SET DEFAULT nextval('public.medication_orders_medication_order_id_seq'::regclass);


--
-- Name: opd_visits opd_visit_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opd_visits ALTER COLUMN opd_visit_id SET DEFAULT nextval('public.opd_visits_opd_visit_id_seq'::regclass);


--
-- Name: patient_allergies patient_allergy_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_allergies ALTER COLUMN patient_allergy_id SET DEFAULT nextval('public.patient_allergies_patient_allergy_id_seq'::regclass);


--
-- Name: patient_conditions patient_condition_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_conditions ALTER COLUMN patient_condition_id SET DEFAULT nextval('public.patient_conditions_patient_condition_id_seq'::regclass);


--
-- Name: patient_face_profile_events event_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_face_profile_events ALTER COLUMN event_id SET DEFAULT nextval('public.patient_face_profile_events_event_id_seq'::regclass);


--
-- Name: patient_hospital_registrations patient_hospital_registration_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_hospital_registrations ALTER COLUMN patient_hospital_registration_id SET DEFAULT nextval('public.patient_hospital_registration_patient_hospital_registration_seq'::regclass);


--
-- Name: patient_identity_photo_events event_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_identity_photo_events ALTER COLUMN event_id SET DEFAULT nextval('public.patient_identity_photo_events_event_id_seq'::regclass);


--
-- Name: patients patient_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients ALTER COLUMN patient_id SET DEFAULT nextval('public.patients_patient_id_seq'::regclass);


--
-- Name: procedures procedure_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedures ALTER COLUMN procedure_id SET DEFAULT nextval('public.procedures_procedure_id_seq'::regclass);


--
-- Name: radiology_image_access_logs radiology_image_access_log_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_image_access_logs ALTER COLUMN radiology_image_access_log_id SET DEFAULT nextval('public.radiology_image_access_logs_radiology_image_access_log_id_seq'::regclass);


--
-- Name: radiology_images radiology_image_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_images ALTER COLUMN radiology_image_id SET DEFAULT nextval('public.radiology_images_radiology_image_id_seq'::regclass);


--
-- Name: surgeries surgery_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgeries ALTER COLUMN surgery_id SET DEFAULT nextval('public.surgeries_surgery_id_seq'::regclass);


--
-- Name: treatment_records treatment_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_records ALTER COLUMN treatment_id SET DEFAULT nextval('public.treatment_records_treatment_id_seq'::regclass);


--
-- Name: wards ward_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wards ALTER COLUMN ward_id SET DEFAULT nextval('public.wards_ward_id_seq'::regclass);


--
-- Name: admissions admissions_admission_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_admission_number_key UNIQUE (admission_number);


--
-- Name: admissions admissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_pkey PRIMARY KEY (admission_id);


--
-- Name: allergies allergies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allergies
    ADD CONSTRAINT allergies_pkey PRIMARY KEY (allergy_id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (audit_log_id);


--
-- Name: auth_refresh_tokens auth_refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_refresh_tokens
    ADD CONSTRAINT auth_refresh_tokens_pkey PRIMARY KEY (refresh_token_id);


--
-- Name: auth_refresh_tokens auth_refresh_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_refresh_tokens
    ADD CONSTRAINT auth_refresh_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: beds beds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beds
    ADD CONSTRAINT beds_pkey PRIMARY KEY (bed_id);


--
-- Name: bht_entries bht_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bht_entries
    ADD CONSTRAINT bht_entries_pkey PRIMARY KEY (bht_entry_id);


--
-- Name: clinic_visits clinic_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_visits
    ADD CONSTRAINT clinic_visits_pkey PRIMARY KEY (clinic_visit_id);


--
-- Name: clinical_observations clinical_observations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_observations
    ADD CONSTRAINT clinical_observations_pkey PRIMARY KEY (observation_id);


--
-- Name: clinics clinics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_pkey PRIMARY KEY (clinic_id);


--
-- Name: dental_records dental_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dental_records
    ADD CONSTRAINT dental_records_pkey PRIMARY KEY (dental_record_id);


--
-- Name: ecis_candidate_reviews ecis_candidate_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecis_candidate_reviews
    ADD CONSTRAINT ecis_candidate_reviews_pkey PRIMARY KEY (review_id);


--
-- Name: ecis_search_logs ecis_search_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecis_search_logs
    ADD CONSTRAINT ecis_search_logs_pkey PRIMARY KEY (search_log_id);


--
-- Name: emergency_case_locations emergency_case_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_case_locations
    ADD CONSTRAINT emergency_case_locations_pkey PRIMARY KEY (emergency_case_location_id);


--
-- Name: emergency_cases emergency_cases_case_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_cases
    ADD CONSTRAINT emergency_cases_case_number_key UNIQUE (case_number);


--
-- Name: emergency_cases emergency_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_cases
    ADD CONSTRAINT emergency_cases_pkey PRIMARY KEY (emergency_case_id);


--
-- Name: encounters encounters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT encounters_pkey PRIMARY KEY (encounter_id);


--
-- Name: fractures fractures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fractures
    ADD CONSTRAINT fractures_pkey PRIMARY KEY (fracture_id);


--
-- Name: hospital_user_assignments hospital_user_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_user_assignments
    ADD CONSTRAINT hospital_user_assignments_pkey PRIMARY KEY (assignment_id);


--
-- Name: hospital_users hospital_users_employee_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_users
    ADD CONSTRAINT hospital_users_employee_number_key UNIQUE (employee_number);


--
-- Name: hospital_users hospital_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_users
    ADD CONSTRAINT hospital_users_pkey PRIMARY KEY (user_id);


--
-- Name: hospital_users hospital_users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_users
    ADD CONSTRAINT hospital_users_username_key UNIQUE (username);


--
-- Name: hospitals hospitals_hospital_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospitals
    ADD CONSTRAINT hospitals_hospital_code_key UNIQUE (hospital_code);


--
-- Name: hospitals hospitals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospitals
    ADD CONSTRAINT hospitals_pkey PRIMARY KEY (hospital_id);


--
-- Name: investigations investigations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investigations
    ADD CONSTRAINT investigations_pkey PRIMARY KEY (investigation_id);


--
-- Name: medical_conditions medical_conditions_condition_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_conditions
    ADD CONSTRAINT medical_conditions_condition_code_key UNIQUE (condition_code);


--
-- Name: medical_conditions medical_conditions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_conditions
    ADD CONSTRAINT medical_conditions_pkey PRIMARY KEY (condition_id);


--
-- Name: medical_devices medical_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_devices
    ADD CONSTRAINT medical_devices_pkey PRIMARY KEY (device_id);


--
-- Name: medication_dispensations medication_dispensations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_dispensations
    ADD CONSTRAINT medication_dispensations_pkey PRIMARY KEY (medication_dispensation_id);


--
-- Name: medication_orders medication_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_orders
    ADD CONSTRAINT medication_orders_pkey PRIMARY KEY (medication_order_id);


--
-- Name: opd_visits opd_visits_opd_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opd_visits
    ADD CONSTRAINT opd_visits_opd_number_key UNIQUE (opd_number);


--
-- Name: opd_visits opd_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opd_visits
    ADD CONSTRAINT opd_visits_pkey PRIMARY KEY (opd_visit_id);


--
-- Name: patient_allergies patient_allergies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_allergies
    ADD CONSTRAINT patient_allergies_pkey PRIMARY KEY (patient_allergy_id);


--
-- Name: patient_conditions patient_conditions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_conditions
    ADD CONSTRAINT patient_conditions_pkey PRIMARY KEY (patient_condition_id);


--
-- Name: patient_face_profile_events patient_face_profile_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_face_profile_events
    ADD CONSTRAINT patient_face_profile_events_pkey PRIMARY KEY (event_id);


--
-- Name: patient_face_profiles patient_face_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_face_profiles
    ADD CONSTRAINT patient_face_profiles_pkey PRIMARY KEY (patient_id);


--
-- Name: patient_hospital_registrations patient_hospital_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_hospital_registrations
    ADD CONSTRAINT patient_hospital_registrations_pkey PRIMARY KEY (patient_hospital_registration_id);


--
-- Name: patient_identity_photo_events patient_identity_photo_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_identity_photo_events
    ADD CONSTRAINT patient_identity_photo_events_pkey PRIMARY KEY (event_id);


--
-- Name: patient_identity_photos patient_identity_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_identity_photos
    ADD CONSTRAINT patient_identity_photos_pkey PRIMARY KEY (patient_id);


--
-- Name: patients patients_patient_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_patient_number_key UNIQUE (patient_number);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (patient_id);


--
-- Name: procedures procedures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedures
    ADD CONSTRAINT procedures_pkey PRIMARY KEY (procedure_id);


--
-- Name: radiology_image_access_logs radiology_image_access_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_image_access_logs
    ADD CONSTRAINT radiology_image_access_logs_pkey PRIMARY KEY (radiology_image_access_log_id);


--
-- Name: radiology_images radiology_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_images
    ADD CONSTRAINT radiology_images_pkey PRIMARY KEY (radiology_image_id);


--
-- Name: radiology_images radiology_images_storage_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_images
    ADD CONSTRAINT radiology_images_storage_key_key UNIQUE (storage_key);


--
-- Name: surgeries surgeries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgeries
    ADD CONSTRAINT surgeries_pkey PRIMARY KEY (surgery_id);


--
-- Name: treatment_records treatment_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_records
    ADD CONSTRAINT treatment_records_pkey PRIMARY KEY (treatment_id);


--
-- Name: allergies uq_allergy_name_category; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allergies
    ADD CONSTRAINT uq_allergy_name_category UNIQUE (allergy_name, allergy_category);


--
-- Name: beds uq_bed_number_ward; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beds
    ADD CONSTRAINT uq_bed_number_ward UNIQUE (ward_id, bed_number);


--
-- Name: clinics uq_clinic_code_hospital; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT uq_clinic_code_hospital UNIQUE (hospital_id, clinic_code);


--
-- Name: clinic_visits uq_clinic_visit_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_visits
    ADD CONSTRAINT uq_clinic_visit_number UNIQUE (clinic_id, visit_number);


--
-- Name: patient_allergies uq_patient_allergy; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_allergies
    ADD CONSTRAINT uq_patient_allergy UNIQUE (patient_id, allergy_id);


--
-- Name: wards uq_ward_code_hospital; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wards
    ADD CONSTRAINT uq_ward_code_hospital UNIQUE (hospital_id, ward_code);


--
-- Name: patient_hospital_registrations ux_hospital_patient_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_hospital_registrations
    ADD CONSTRAINT ux_hospital_patient_number UNIQUE (hospital_id, hospital_patient_number);


--
-- Name: patient_hospital_registrations ux_patient_hospital_registration; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_hospital_registrations
    ADD CONSTRAINT ux_patient_hospital_registration UNIQUE (patient_id, hospital_id);


--
-- Name: wards wards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wards
    ADD CONSTRAINT wards_pkey PRIMARY KEY (ward_id);


--
-- Name: idx_admissions_bed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admissions_bed ON public.admissions USING btree (bed_id);


--
-- Name: idx_admissions_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admissions_patient ON public.admissions USING btree (patient_id);


--
-- Name: idx_admissions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admissions_status ON public.admissions USING btree (status);


--
-- Name: idx_admissions_ward; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admissions_ward ON public.admissions USING btree (ward_id);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at);


--
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: idx_audit_logs_hospital; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_hospital ON public.audit_logs USING btree (hospital_id);


--
-- Name: idx_audit_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree (user_id);


--
-- Name: idx_auth_refresh_tokens_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_refresh_tokens_expires_at ON public.auth_refresh_tokens USING btree (expires_at);


--
-- Name: idx_auth_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_refresh_tokens_user_id ON public.auth_refresh_tokens USING btree (user_id);


--
-- Name: idx_beds_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_beds_status ON public.beds USING btree (status);


--
-- Name: idx_beds_ward; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_beds_ward ON public.beds USING btree (ward_id);


--
-- Name: idx_bht_entries_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bht_entries_admission ON public.bht_entries USING btree (admission_id, entry_date DESC);


--
-- Name: idx_bht_entries_encounter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bht_entries_encounter ON public.bht_entries USING btree (encounter_id, entry_date DESC);


--
-- Name: idx_bht_entries_hospital; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bht_entries_hospital ON public.bht_entries USING btree (hospital_id, entry_date DESC);


--
-- Name: idx_bht_entries_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bht_entries_patient ON public.bht_entries USING btree (patient_id, entry_date DESC);


--
-- Name: idx_bht_entries_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bht_entries_type ON public.bht_entries USING btree (entry_type, entry_date DESC);


--
-- Name: idx_clinic_visits_clinic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinic_visits_clinic ON public.clinic_visits USING btree (clinic_id);


--
-- Name: idx_clinic_visits_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinic_visits_date ON public.clinic_visits USING btree (visit_date);


--
-- Name: idx_clinic_visits_encounter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinic_visits_encounter ON public.clinic_visits USING btree (encounter_id);


--
-- Name: idx_clinic_visits_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinic_visits_patient ON public.clinic_visits USING btree (patient_id);


--
-- Name: idx_clinics_hospital; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinics_hospital ON public.clinics USING btree (hospital_id);


--
-- Name: idx_ecis_reviews_emergency_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ecis_reviews_emergency_case ON public.ecis_candidate_reviews USING btree (emergency_case_id);


--
-- Name: idx_ecis_reviews_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ecis_reviews_patient ON public.ecis_candidate_reviews USING btree (patient_id);


--
-- Name: idx_ecis_reviews_reviewed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ecis_reviews_reviewed_at ON public.ecis_candidate_reviews USING btree (reviewed_at);


--
-- Name: idx_ecis_reviews_reviewed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ecis_reviews_reviewed_by ON public.ecis_candidate_reviews USING btree (reviewed_by);


--
-- Name: idx_ecis_reviews_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ecis_reviews_status ON public.ecis_candidate_reviews USING btree (review_status);


--
-- Name: idx_ecis_search_logs_emergency_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ecis_search_logs_emergency_case ON public.ecis_search_logs USING btree (emergency_case_id);


--
-- Name: idx_ecis_search_logs_searched_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ecis_search_logs_searched_at ON public.ecis_search_logs USING btree (searched_at);


--
-- Name: idx_ecis_search_logs_searched_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ecis_search_logs_searched_by ON public.ecis_search_logs USING btree (searched_by);


--
-- Name: idx_emergency_arrival; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emergency_arrival ON public.emergency_cases USING btree (arrival_date);


--
-- Name: idx_emergency_hospital; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emergency_hospital ON public.emergency_cases USING btree (hospital_id);


--
-- Name: idx_emergency_location_bed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emergency_location_bed ON public.emergency_case_locations USING btree (bed_id);


--
-- Name: idx_emergency_location_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emergency_location_case ON public.emergency_case_locations USING btree (emergency_case_id);


--
-- Name: idx_emergency_location_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emergency_location_started ON public.emergency_case_locations USING btree (started_at);


--
-- Name: idx_emergency_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emergency_patient ON public.emergency_cases USING btree (patient_id);


--
-- Name: idx_emergency_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emergency_status ON public.emergency_cases USING btree (status);


--
-- Name: idx_emergency_unidentified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emergency_unidentified ON public.emergency_cases USING btree (unidentified_patient);


--
-- Name: idx_hospital_user_assignments_hospital_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hospital_user_assignments_hospital_active ON public.hospital_user_assignments USING btree (hospital_id, role) WHERE ((status)::text = 'ACTIVE'::text);


--
-- Name: idx_hospital_user_assignments_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hospital_user_assignments_user_active ON public.hospital_user_assignments USING btree (user_id, hospital_id) WHERE ((status)::text = 'ACTIVE'::text);


--
-- Name: idx_investigations_patient_lab; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_investigations_patient_lab ON public.investigations USING btree (patient_id, investigation_type, requested_date DESC);


--
-- Name: idx_investigations_requested_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_investigations_requested_by ON public.investigations USING btree (requested_by);


--
-- Name: idx_investigations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_investigations_status ON public.investigations USING btree (status, requested_date DESC);


--
-- Name: idx_investigations_verified_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_investigations_verified_by ON public.investigations USING btree (verified_by);


--
-- Name: idx_medication_dispensations_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medication_dispensations_date ON public.medication_dispensations USING btree (dispensed_at DESC);


--
-- Name: idx_medication_dispensations_hospital; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medication_dispensations_hospital ON public.medication_dispensations USING btree (hospital_id);


--
-- Name: idx_medication_dispensations_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medication_dispensations_order ON public.medication_dispensations USING btree (medication_order_id);


--
-- Name: idx_medication_dispensations_order_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medication_dispensations_order_status ON public.medication_dispensations USING btree (medication_order_id, dispensing_status);


--
-- Name: idx_medication_orders_admission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medication_orders_admission ON public.medication_orders USING btree (admission_id);


--
-- Name: idx_medication_orders_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medication_orders_date ON public.medication_orders USING btree (start_date DESC);


--
-- Name: idx_medication_orders_encounter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medication_orders_encounter ON public.medication_orders USING btree (encounter_id);


--
-- Name: idx_medication_orders_hospital; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medication_orders_hospital ON public.medication_orders USING btree (hospital_id);


--
-- Name: idx_medication_orders_name_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medication_orders_name_lower ON public.medication_orders USING btree (lower((medication_name)::text));


--
-- Name: idx_medication_orders_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medication_orders_patient ON public.medication_orders USING btree (patient_id);


--
-- Name: idx_medication_orders_patient_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medication_orders_patient_date ON public.medication_orders USING btree (patient_id, start_date DESC);


--
-- Name: idx_medication_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_medication_orders_status ON public.medication_orders USING btree (order_status);


--
-- Name: idx_patient_allergies_allergy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_allergies_allergy ON public.patient_allergies USING btree (allergy_id);


--
-- Name: idx_patient_allergies_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_allergies_patient ON public.patient_allergies USING btree (patient_id);


--
-- Name: idx_patient_hospital_registrations_hospital_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_hospital_registrations_hospital_active ON public.patient_hospital_registrations USING btree (hospital_id, patient_id) WHERE ((status)::text = 'ACTIVE'::text);


--
-- Name: idx_patient_hospital_registrations_patient_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_hospital_registrations_patient_active ON public.patient_hospital_registrations USING btree (patient_id, hospital_id) WHERE ((status)::text = 'ACTIVE'::text);


--
-- Name: idx_patients_allergy_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_allergy_status ON public.patients USING btree (hospital_id, allergy_status);


--
-- Name: idx_patients_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_name ON public.patients USING btree (first_name, last_name);


--
-- Name: idx_patients_nic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_nic ON public.patients USING btree (nic_number);


--
-- Name: idx_patients_patient_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_patient_number ON public.patients USING btree (patient_number);


--
-- Name: idx_patients_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_phone ON public.patients USING btree (primary_phone);


--
-- Name: idx_wards_hospital; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wards_hospital ON public.wards USING btree (hospital_id);


--
-- Name: radiology_image_access_logs_image_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX radiology_image_access_logs_image_idx ON public.radiology_image_access_logs USING btree (radiology_image_id, accessed_at DESC);


--
-- Name: radiology_images_hospital_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX radiology_images_hospital_idx ON public.radiology_images USING btree (hospital_id) WHERE (is_active = true);


--
-- Name: radiology_images_investigation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX radiology_images_investigation_idx ON public.radiology_images USING btree (investigation_id) WHERE (is_active = true);


--
-- Name: uq_active_admission_per_bed; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_active_admission_per_bed ON public.admissions USING btree (bed_id) WHERE ((status)::text = 'ADMITTED'::text);


--
-- Name: uq_emergency_bed_active_location; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_emergency_bed_active_location ON public.emergency_case_locations USING btree (bed_id) WHERE (ended_at IS NULL);


--
-- Name: uq_emergency_case_active_location; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_emergency_case_active_location ON public.emergency_case_locations USING btree (emergency_case_id) WHERE (ended_at IS NULL);


--
-- Name: uq_patients_nic_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_patients_nic_number ON public.patients USING btree (nic_number) WHERE (nic_number IS NOT NULL);


--
-- Name: ux_hospital_user_assignments_active_role; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_hospital_user_assignments_active_role ON public.hospital_user_assignments USING btree (user_id, hospital_id, role) WHERE ((status)::text = 'ACTIVE'::text);


--
-- Name: ux_hospital_users_internal_clinician_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_hospital_users_internal_clinician_id ON public.hospital_users USING btree (internal_clinician_id) WHERE (internal_clinician_id IS NOT NULL);


--
-- Name: emergency_cases trg_emergency_case_identity_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_emergency_case_identity_audit AFTER UPDATE OF patient_id, unidentified_patient, status, identified_at, identified_by ON public.emergency_cases FOR EACH ROW EXECUTE FUNCTION public.fn_audit_emergency_case_identity();


--
-- Name: investigations trg_sync_investigation_verification_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_investigation_verification_timestamp BEFORE INSERT OR UPDATE OF status, verified_at ON public.investigations FOR EACH ROW EXECUTE FUNCTION public.fn_sync_investigation_verification_timestamp();


--
-- Name: medication_dispensations trg_sync_medication_order_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_medication_order_status AFTER INSERT OR DELETE OR UPDATE ON public.medication_dispensations FOR EACH ROW EXECUTE FUNCTION public.fn_sync_medication_order_status();


--
-- Name: medication_orders trg_update_medication_order_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_medication_order_timestamp BEFORE UPDATE ON public.medication_orders FOR EACH ROW EXECUTE FUNCTION public.fn_update_medication_order_timestamp();


--
-- Name: medication_dispensations trg_validate_medication_dispensation_context; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_medication_dispensation_context BEFORE INSERT OR UPDATE ON public.medication_dispensations FOR EACH ROW EXECUTE FUNCTION public.fn_validate_medication_dispensation_context();


--
-- Name: medication_orders trg_validate_medication_order_context; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_medication_order_context BEFORE INSERT OR UPDATE ON public.medication_orders FOR EACH ROW EXECUTE FUNCTION public.fn_validate_medication_order_context();


--
-- Name: admissions fk_admission_bed; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT fk_admission_bed FOREIGN KEY (bed_id) REFERENCES public.beds(bed_id);


--
-- Name: admissions fk_admission_doctor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT fk_admission_doctor FOREIGN KEY (attending_doctor_id) REFERENCES public.hospital_users(user_id);


--
-- Name: admissions fk_admission_encounter; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT fk_admission_encounter FOREIGN KEY (encounter_id) REFERENCES public.encounters(encounter_id);


--
-- Name: admissions fk_admission_patient; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT fk_admission_patient FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: admissions fk_admission_ward; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT fk_admission_ward FOREIGN KEY (ward_id) REFERENCES public.wards(ward_id);


--
-- Name: audit_logs fk_audit_hospital; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT fk_audit_hospital FOREIGN KEY (hospital_id) REFERENCES public.hospitals(hospital_id) ON DELETE RESTRICT;


--
-- Name: audit_logs fk_audit_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES public.hospital_users(user_id) ON DELETE RESTRICT;


--
-- Name: auth_refresh_tokens fk_auth_refresh_tokens_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_refresh_tokens
    ADD CONSTRAINT fk_auth_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES public.hospital_users(user_id) ON DELETE CASCADE;


--
-- Name: beds fk_bed_ward; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beds
    ADD CONSTRAINT fk_bed_ward FOREIGN KEY (ward_id) REFERENCES public.wards(ward_id);


--
-- Name: bht_entries fk_bht_admission; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bht_entries
    ADD CONSTRAINT fk_bht_admission FOREIGN KEY (admission_id) REFERENCES public.admissions(admission_id);


--
-- Name: bht_entries fk_bht_encounter; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bht_entries
    ADD CONSTRAINT fk_bht_encounter FOREIGN KEY (encounter_id) REFERENCES public.encounters(encounter_id);


--
-- Name: bht_entries fk_bht_hospital; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bht_entries
    ADD CONSTRAINT fk_bht_hospital FOREIGN KEY (hospital_id) REFERENCES public.hospitals(hospital_id);


--
-- Name: bht_entries fk_bht_patient; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bht_entries
    ADD CONSTRAINT fk_bht_patient FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: bht_entries fk_bht_recorded_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bht_entries
    ADD CONSTRAINT fk_bht_recorded_by FOREIGN KEY (recorded_by) REFERENCES public.hospital_users(user_id);


--
-- Name: clinics fk_clinic_hospital; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT fk_clinic_hospital FOREIGN KEY (hospital_id) REFERENCES public.hospitals(hospital_id);


--
-- Name: clinic_visits fk_clinic_visit_clinic; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_visits
    ADD CONSTRAINT fk_clinic_visit_clinic FOREIGN KEY (clinic_id) REFERENCES public.clinics(clinic_id);


--
-- Name: clinic_visits fk_clinic_visit_doctor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_visits
    ADD CONSTRAINT fk_clinic_visit_doctor FOREIGN KEY (doctor_user_id) REFERENCES public.hospital_users(user_id);


--
-- Name: clinic_visits fk_clinic_visit_encounter; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_visits
    ADD CONSTRAINT fk_clinic_visit_encounter FOREIGN KEY (encounter_id) REFERENCES public.encounters(encounter_id);


--
-- Name: clinic_visits fk_clinic_visit_patient; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_visits
    ADD CONSTRAINT fk_clinic_visit_patient FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: dental_records fk_dental_encounter; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dental_records
    ADD CONSTRAINT fk_dental_encounter FOREIGN KEY (encounter_id) REFERENCES public.encounters(encounter_id);


--
-- Name: dental_records fk_dental_patient; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dental_records
    ADD CONSTRAINT fk_dental_patient FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: dental_records fk_dental_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dental_records
    ADD CONSTRAINT fk_dental_user FOREIGN KEY (recorded_by) REFERENCES public.hospital_users(user_id);


--
-- Name: medical_devices fk_device_encounter; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_devices
    ADD CONSTRAINT fk_device_encounter FOREIGN KEY (encounter_id) REFERENCES public.encounters(encounter_id);


--
-- Name: medical_devices fk_device_patient; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_devices
    ADD CONSTRAINT fk_device_patient FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: ecis_candidate_reviews fk_ecis_review_emergency_case; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecis_candidate_reviews
    ADD CONSTRAINT fk_ecis_review_emergency_case FOREIGN KEY (emergency_case_id) REFERENCES public.emergency_cases(emergency_case_id) ON DELETE RESTRICT;


--
-- Name: ecis_candidate_reviews fk_ecis_review_patient; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecis_candidate_reviews
    ADD CONSTRAINT fk_ecis_review_patient FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) ON DELETE RESTRICT;


--
-- Name: ecis_candidate_reviews fk_ecis_review_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecis_candidate_reviews
    ADD CONSTRAINT fk_ecis_review_user FOREIGN KEY (reviewed_by) REFERENCES public.hospital_users(user_id) ON DELETE RESTRICT;


--
-- Name: ecis_search_logs fk_ecis_search_emergency_case; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecis_search_logs
    ADD CONSTRAINT fk_ecis_search_emergency_case FOREIGN KEY (emergency_case_id) REFERENCES public.emergency_cases(emergency_case_id) ON DELETE SET NULL;


--
-- Name: ecis_search_logs fk_ecis_search_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ecis_search_logs
    ADD CONSTRAINT fk_ecis_search_user FOREIGN KEY (searched_by) REFERENCES public.hospital_users(user_id) ON DELETE RESTRICT;


--
-- Name: emergency_cases fk_emergency_doctor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_cases
    ADD CONSTRAINT fk_emergency_doctor FOREIGN KEY (assigned_doctor_id) REFERENCES public.hospital_users(user_id);


--
-- Name: emergency_cases fk_emergency_encounter; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_cases
    ADD CONSTRAINT fk_emergency_encounter FOREIGN KEY (encounter_id) REFERENCES public.encounters(encounter_id);


--
-- Name: emergency_cases fk_emergency_hospital; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_cases
    ADD CONSTRAINT fk_emergency_hospital FOREIGN KEY (hospital_id) REFERENCES public.hospitals(hospital_id);


--
-- Name: emergency_cases fk_emergency_identifier; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_cases
    ADD CONSTRAINT fk_emergency_identifier FOREIGN KEY (identified_by) REFERENCES public.hospital_users(user_id);


--
-- Name: emergency_case_locations fk_emergency_location_bed; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_case_locations
    ADD CONSTRAINT fk_emergency_location_bed FOREIGN KEY (bed_id) REFERENCES public.beds(bed_id);


--
-- Name: emergency_case_locations fk_emergency_location_case; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_case_locations
    ADD CONSTRAINT fk_emergency_location_case FOREIGN KEY (emergency_case_id) REFERENCES public.emergency_cases(emergency_case_id) ON DELETE CASCADE;


--
-- Name: emergency_case_locations fk_emergency_location_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_case_locations
    ADD CONSTRAINT fk_emergency_location_user FOREIGN KEY (assigned_by) REFERENCES public.hospital_users(user_id);


--
-- Name: emergency_cases fk_emergency_patient; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_cases
    ADD CONSTRAINT fk_emergency_patient FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: encounters fk_encounters_hospital; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT fk_encounters_hospital FOREIGN KEY (hospital_id) REFERENCES public.hospitals(hospital_id);


--
-- Name: encounters fk_encounters_patient; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT fk_encounters_patient FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: fractures fk_fracture_encounter; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fractures
    ADD CONSTRAINT fk_fracture_encounter FOREIGN KEY (encounter_id) REFERENCES public.encounters(encounter_id);


--
-- Name: fractures fk_fracture_patient; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fractures
    ADD CONSTRAINT fk_fracture_patient FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: investigations fk_investigation_encounter; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investigations
    ADD CONSTRAINT fk_investigation_encounter FOREIGN KEY (encounter_id) REFERENCES public.encounters(encounter_id);


--
-- Name: investigations fk_investigation_patient; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investigations
    ADD CONSTRAINT fk_investigation_patient FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: investigations fk_investigation_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investigations
    ADD CONSTRAINT fk_investigation_user FOREIGN KEY (performed_by) REFERENCES public.hospital_users(user_id);


--
-- Name: clinical_observations fk_observation_encounter; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_observations
    ADD CONSTRAINT fk_observation_encounter FOREIGN KEY (encounter_id) REFERENCES public.encounters(encounter_id);


--
-- Name: clinical_observations fk_observation_patient; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_observations
    ADD CONSTRAINT fk_observation_patient FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: clinical_observations fk_observation_treatment; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_observations
    ADD CONSTRAINT fk_observation_treatment FOREIGN KEY (treatment_id) REFERENCES public.treatment_records(treatment_id);


--
-- Name: clinical_observations fk_observation_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_observations
    ADD CONSTRAINT fk_observation_user FOREIGN KEY (recorded_by) REFERENCES public.hospital_users(user_id);


--
-- Name: opd_visits fk_opd_encounter; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opd_visits
    ADD CONSTRAINT fk_opd_encounter FOREIGN KEY (encounter_id) REFERENCES public.encounters(encounter_id);


--
-- Name: opd_visits fk_opd_patient; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opd_visits
    ADD CONSTRAINT fk_opd_patient FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: patient_allergies fk_patient_allergy_allergy; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_allergies
    ADD CONSTRAINT fk_patient_allergy_allergy FOREIGN KEY (allergy_id) REFERENCES public.allergies(allergy_id) ON DELETE RESTRICT;


--
-- Name: patient_allergies fk_patient_allergy_patient; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_allergies
    ADD CONSTRAINT fk_patient_allergy_patient FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) ON DELETE CASCADE;


--
-- Name: patient_conditions fk_patient_condition_condition; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_conditions
    ADD CONSTRAINT fk_patient_condition_condition FOREIGN KEY (condition_id) REFERENCES public.medical_conditions(condition_id);


--
-- Name: patient_conditions fk_patient_condition_encounter; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_conditions
    ADD CONSTRAINT fk_patient_condition_encounter FOREIGN KEY (encounter_id) REFERENCES public.encounters(encounter_id);


--
-- Name: patient_conditions fk_patient_condition_patient; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_conditions
    ADD CONSTRAINT fk_patient_condition_patient FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: patients fk_patients_hospital; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT fk_patients_hospital FOREIGN KEY (hospital_id) REFERENCES public.hospitals(hospital_id);


--
-- Name: procedures fk_procedure_encounter; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedures
    ADD CONSTRAINT fk_procedure_encounter FOREIGN KEY (encounter_id) REFERENCES public.encounters(encounter_id);


--
-- Name: procedures fk_procedure_patient; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedures
    ADD CONSTRAINT fk_procedure_patient FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: procedures fk_procedure_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedures
    ADD CONSTRAINT fk_procedure_user FOREIGN KEY (performed_by) REFERENCES public.hospital_users(user_id);


--
-- Name: surgeries fk_surgery_encounter; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgeries
    ADD CONSTRAINT fk_surgery_encounter FOREIGN KEY (encounter_id) REFERENCES public.encounters(encounter_id);


--
-- Name: surgeries fk_surgery_patient; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgeries
    ADD CONSTRAINT fk_surgery_patient FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: surgeries fk_surgery_surgeon; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgeries
    ADD CONSTRAINT fk_surgery_surgeon FOREIGN KEY (surgeon_user_id) REFERENCES public.hospital_users(user_id);


--
-- Name: treatment_records fk_treatment_encounter; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_records
    ADD CONSTRAINT fk_treatment_encounter FOREIGN KEY (encounter_id) REFERENCES public.encounters(encounter_id);


--
-- Name: treatment_records fk_treatment_opd; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_records
    ADD CONSTRAINT fk_treatment_opd FOREIGN KEY (opd_visit_id) REFERENCES public.opd_visits(opd_visit_id);


--
-- Name: treatment_records fk_treatment_patient; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_records
    ADD CONSTRAINT fk_treatment_patient FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: treatment_records fk_treatment_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_records
    ADD CONSTRAINT fk_treatment_user FOREIGN KEY (performed_by) REFERENCES public.hospital_users(user_id);


--
-- Name: hospital_users fk_users_hospital; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_users
    ADD CONSTRAINT fk_users_hospital FOREIGN KEY (hospital_id) REFERENCES public.hospitals(hospital_id);


--
-- Name: wards fk_ward_hospital; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wards
    ADD CONSTRAINT fk_ward_hospital FOREIGN KEY (hospital_id) REFERENCES public.hospitals(hospital_id);


--
-- Name: hospital_user_assignments hospital_user_assignments_hospital_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_user_assignments
    ADD CONSTRAINT hospital_user_assignments_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospitals(hospital_id);


--
-- Name: hospital_user_assignments hospital_user_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_user_assignments
    ADD CONSTRAINT hospital_user_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.hospital_users(user_id);


--
-- Name: investigations investigations_requested_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investigations
    ADD CONSTRAINT investigations_requested_by_fk FOREIGN KEY (requested_by) REFERENCES public.hospital_users(user_id);


--
-- Name: investigations investigations_verified_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investigations
    ADD CONSTRAINT investigations_verified_by_fk FOREIGN KEY (verified_by) REFERENCES public.hospital_users(user_id);


--
-- Name: medication_dispensations medication_dispensations_hospital_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_dispensations
    ADD CONSTRAINT medication_dispensations_hospital_fk FOREIGN KEY (hospital_id) REFERENCES public.hospitals(hospital_id);


--
-- Name: medication_dispensations medication_dispensations_order_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_dispensations
    ADD CONSTRAINT medication_dispensations_order_fk FOREIGN KEY (medication_order_id) REFERENCES public.medication_orders(medication_order_id) ON DELETE RESTRICT;


--
-- Name: medication_dispensations medication_dispensations_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_dispensations
    ADD CONSTRAINT medication_dispensations_user_fk FOREIGN KEY (dispensed_by_user_id) REFERENCES public.hospital_users(user_id);


--
-- Name: medication_orders medication_orders_admission_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_orders
    ADD CONSTRAINT medication_orders_admission_fk FOREIGN KEY (admission_id) REFERENCES public.admissions(admission_id);


--
-- Name: medication_orders medication_orders_encounter_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_orders
    ADD CONSTRAINT medication_orders_encounter_fk FOREIGN KEY (encounter_id) REFERENCES public.encounters(encounter_id);


--
-- Name: medication_orders medication_orders_hospital_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_orders
    ADD CONSTRAINT medication_orders_hospital_fk FOREIGN KEY (hospital_id) REFERENCES public.hospitals(hospital_id);


--
-- Name: medication_orders medication_orders_patient_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_orders
    ADD CONSTRAINT medication_orders_patient_fk FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: medication_orders medication_orders_prescriber_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_orders
    ADD CONSTRAINT medication_orders_prescriber_fk FOREIGN KEY (prescribed_by_user_id) REFERENCES public.hospital_users(user_id);


--
-- Name: patient_face_profile_events patient_face_profile_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_face_profile_events
    ADD CONSTRAINT patient_face_profile_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.hospital_users(user_id);


--
-- Name: patient_face_profile_events patient_face_profile_events_hospital_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_face_profile_events
    ADD CONSTRAINT patient_face_profile_events_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospitals(hospital_id);


--
-- Name: patient_face_profile_events patient_face_profile_events_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_face_profile_events
    ADD CONSTRAINT patient_face_profile_events_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: patient_face_profiles patient_face_profiles_enrolled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_face_profiles
    ADD CONSTRAINT patient_face_profiles_enrolled_by_fkey FOREIGN KEY (enrolled_by) REFERENCES public.hospital_users(user_id);


--
-- Name: patient_face_profiles patient_face_profiles_enrolled_hospital_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_face_profiles
    ADD CONSTRAINT patient_face_profiles_enrolled_hospital_id_fkey FOREIGN KEY (enrolled_hospital_id) REFERENCES public.hospitals(hospital_id);


--
-- Name: patient_face_profiles patient_face_profiles_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_face_profiles
    ADD CONSTRAINT patient_face_profiles_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: patient_hospital_registrations patient_hospital_registrations_hospital_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_hospital_registrations
    ADD CONSTRAINT patient_hospital_registrations_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospitals(hospital_id);


--
-- Name: patient_hospital_registrations patient_hospital_registrations_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_hospital_registrations
    ADD CONSTRAINT patient_hospital_registrations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: patient_hospital_registrations patient_hospital_registrations_registered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_hospital_registrations
    ADD CONSTRAINT patient_hospital_registrations_registered_by_fkey FOREIGN KEY (registered_by) REFERENCES public.hospital_users(user_id);


--
-- Name: patient_identity_photo_events patient_identity_photo_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_identity_photo_events
    ADD CONSTRAINT patient_identity_photo_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.hospital_users(user_id);


--
-- Name: patient_identity_photo_events patient_identity_photo_events_hospital_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_identity_photo_events
    ADD CONSTRAINT patient_identity_photo_events_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospitals(hospital_id);


--
-- Name: patient_identity_photo_events patient_identity_photo_events_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_identity_photo_events
    ADD CONSTRAINT patient_identity_photo_events_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: patient_identity_photos patient_identity_photos_hospital_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_identity_photos
    ADD CONSTRAINT patient_identity_photos_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospitals(hospital_id);


--
-- Name: patient_identity_photos patient_identity_photos_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_identity_photos
    ADD CONSTRAINT patient_identity_photos_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);


--
-- Name: patient_identity_photos patient_identity_photos_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_identity_photos
    ADD CONSTRAINT patient_identity_photos_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.hospital_users(user_id);


--
-- Name: radiology_image_access_logs radiology_image_access_logs_accessed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_image_access_logs
    ADD CONSTRAINT radiology_image_access_logs_accessed_by_fkey FOREIGN KEY (accessed_by) REFERENCES public.hospital_users(user_id);


--
-- Name: radiology_image_access_logs radiology_image_access_logs_radiology_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_image_access_logs
    ADD CONSTRAINT radiology_image_access_logs_radiology_image_id_fkey FOREIGN KEY (radiology_image_id) REFERENCES public.radiology_images(radiology_image_id) ON DELETE CASCADE;


--
-- Name: radiology_images radiology_images_hospital_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_images
    ADD CONSTRAINT radiology_images_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospitals(hospital_id);


--
-- Name: radiology_images radiology_images_investigation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_images
    ADD CONSTRAINT radiology_images_investigation_id_fkey FOREIGN KEY (investigation_id) REFERENCES public.investigations(investigation_id) ON DELETE CASCADE;


--
-- Name: radiology_images radiology_images_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_images
    ADD CONSTRAINT radiology_images_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) ON DELETE CASCADE;


--
-- Name: radiology_images radiology_images_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology_images
    ADD CONSTRAINT radiology_images_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.hospital_users(user_id);


--
-- PostgreSQL database dump complete
--
