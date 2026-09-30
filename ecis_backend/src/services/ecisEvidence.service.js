const pool = require("../config/database");

function positiveInteger(value, fieldName) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }

  return number;
}

async function assertPatientAccess(client, patientId, hospitalId, emergencyCaseId) {
  const result = await client.query(
    `
      SELECT
        p.patient_id,
        p.hospital_id,
        p.patient_number,
        p.first_name,
        p.middle_name,
        p.last_name,
        p.date_of_birth,
        p.gender,
        p.blood_group,
        p.height_cm,
        p.weight_kg,
        p.primary_phone,
        p.occupation,
        p.nationality,
        h.hospital_name
      FROM public.patients p
      LEFT JOIN public.hospitals h
        ON h.hospital_id = p.hospital_id
      WHERE
        p.patient_id = $1
        AND p.status = 'ACTIVE'
        AND p.date_of_birth <= CURRENT_DATE - INTERVAL '18 years'
        AND (
          EXISTS (
            SELECT 1 FROM public.patient_hospital_registrations phr
            WHERE phr.patient_id = p.patient_id
              AND phr.hospital_id = $2
              AND phr.status = 'ACTIVE'
          )
          OR EXISTS (
            SELECT 1 FROM public.emergency_cases ec
            WHERE ec.emergency_case_id = $3
              AND ec.hospital_id = $2
              AND ec.unidentified_patient = TRUE
              AND ec.status <> 'DISCHARGED'
              AND EXISTS (
                SELECT 1 FROM public.ecis_search_logs l
                WHERE l.emergency_case_id = ec.emergency_case_id
                  AND p.patient_id = ANY(l.candidate_patient_ids)
              )
          )
        )
      LIMIT 1;
    `,
    [patientId, hospitalId, emergencyCaseId],
  );

  if (result.rowCount === 0) {
    throw new Error("Adult patient was not found for this hospital");
  }

  return result.rows[0];
}

async function getCandidateEvidence(patientIdValue, hospitalIdValue, emergencyCaseIdValue, accessedByValue) {
  const patientId = positiveInteger(patientIdValue, "patientId");
  const hospitalId = positiveInteger(hospitalIdValue, "hospitalId");
  const emergencyCaseId = emergencyCaseIdValue == null
    ? null
    : positiveInteger(emergencyCaseIdValue, "emergencyCaseId");
  const accessedBy = positiveInteger(accessedByValue, "accessedBy");

  const client = pool;

  const patient = await assertPatientAccess(
      client,
      patientId,
      hospitalId,
      emergencyCaseId,
    );

    const [
      encountersResult,
      admissionsResult,
      surgeriesResult,
      fracturesResult,
      devicesResult,
      dentalResult,
      observationsResult,
      treatmentsResult,
      investigationsResult,
      medicationsResult,
      bhtResult,
    ] = await Promise.all([
      client.query(
        `
          SELECT
            e.encounter_id,
            e.encounter_type,
            e.encounter_date,
            e.department,
            e.status,
            e.chief_complaint,
            e.notes
          FROM public.encounters e
          WHERE
            e.patient_id = $1
          ORDER BY
            e.encounter_date DESC,
            e.encounter_id DESC
          LIMIT 30;
        `,
        [patientId],
      ),

      client.query(
        `
          SELECT
            a.admission_id,
            a.encounter_id,
            a.admission_number,
            a.admission_date,
            a.discharge_date,
            a.admission_reason,
            a.admission_diagnosis,
            a.discharge_diagnosis,
            a.discharge_summary,
            a.status,
            w.ward_name,
            b.bed_number,
            u.full_name AS doctor_name
          FROM public.admissions a
          INNER JOIN public.wards w
            ON w.ward_id = a.ward_id
          LEFT JOIN public.beds b
            ON b.bed_id = a.bed_id
          LEFT JOIN public.hospital_users u
            ON u.user_id = a.attending_doctor_id
          WHERE
            a.patient_id = $1
          ORDER BY
            a.admission_date DESC,
            a.admission_id DESC
          LIMIT 20;
        `,
        [patientId],
      ),

      client.query(
        `
          SELECT
            s.surgery_id,
            s.encounter_id,
            s.admission_id,
            s.surgery_code,
            s.surgery_name,
            s.surgery_date,
            s.body_site,
            s.laterality,
            s.preoperative_diagnosis,
            s.postoperative_diagnosis,
            s.findings,
            s.complications,
            s.surgical_notes,
            u.full_name AS surgeon_name
          FROM public.surgeries s
          INNER JOIN public.patients p
            ON p.patient_id = s.patient_id
          LEFT JOIN public.hospital_users u
            ON u.user_id = s.surgeon_user_id
          WHERE
            s.patient_id = $1
          ORDER BY
            s.surgery_date DESC,
            s.surgery_id DESC
          LIMIT 30;
        `,
        [patientId],
      ),

      client.query(
        `
          SELECT
            f.fracture_id,
            f.encounter_id,
            f.body_part,
            f.laterality,
            f.fracture_type,
            f.fracture_date,
            f.treatment_description,
            f.healed_date,
            f.notes
          FROM public.fractures f
          INNER JOIN public.patients p
            ON p.patient_id = f.patient_id
          WHERE
            f.patient_id = $1
          ORDER BY
            f.fracture_date DESC,
            f.fracture_id DESC
          LIMIT 30;
        `,
        [patientId],
      ),

      client.query(
        `
          SELECT
            md.device_id,
            md.encounter_id,
            md.device_type,
            md.device_name,
            md.manufacturer,
            md.model_number,
            md.serial_number,
            md.body_site,
            md.laterality,
            md.implantation_date,
            md.removal_date,
            md.status,
            md.notes
          FROM public.medical_devices md
          INNER JOIN public.patients p
            ON p.patient_id = md.patient_id
          WHERE
            md.patient_id = $1
          ORDER BY
            md.implantation_date DESC NULLS LAST,
            md.device_id DESC
          LIMIT 30;
        `,
        [patientId],
      ),

      client.query(
        `
          SELECT
            d.dental_record_id,
            d.encounter_id,
            d.record_date,
            d.tooth_number,
            d.condition,
            d.treatment,
            d.filling_type,
            d.crown_present,
            d.implant_present,
            d.missing_tooth,
            d.notes,
            u.full_name AS recorded_by_name
          FROM public.dental_records d
          INNER JOIN public.patients p
            ON p.patient_id = d.patient_id
          LEFT JOIN public.hospital_users u
            ON u.user_id = d.recorded_by
          WHERE
            d.patient_id = $1
          ORDER BY
            d.record_date DESC,
            d.dental_record_id DESC
          LIMIT 30;
        `,
        [patientId],
      ),

      client.query(
        `
          SELECT
            co.observation_id,
            co.encounter_id,
            co.treatment_id,
            co.observation_type,
            co.observation_value,
            co.body_site,
            co.laterality,
            co.observed_date,
            co.notes,
            u.full_name AS recorded_by_name
          FROM public.clinical_observations co
          INNER JOIN public.patients p
            ON p.patient_id = co.patient_id
          LEFT JOIN public.hospital_users u
            ON u.user_id = co.recorded_by
          WHERE
            co.patient_id = $1
          ORDER BY
            co.observed_date DESC,
            co.observation_id DESC
          LIMIT 50;
        `,
        [patientId],
      ),

      client.query(
        `
          SELECT
            t.treatment_id,
            t.encounter_id,
            t.opd_visit_id,
            t.clinic_visit_id,
            t.admission_id,
            t.emergency_case_id,
            t.treatment_date,
            t.treatment_type,
            t.treatment_name,
            t.description,
            t.body_site,
            t.laterality,
            t.outcome,
            t.complications,
            u.full_name AS performed_by_name
          FROM public.treatment_records t
          INNER JOIN public.patients p
            ON p.patient_id = t.patient_id
          LEFT JOIN public.hospital_users u
            ON u.user_id = t.performed_by
          WHERE
            t.patient_id = $1
          ORDER BY
            t.treatment_date DESC,
            t.treatment_id DESC
          LIMIT 50;
        `,
        [patientId],
      ),

      client.query(
        `
          SELECT
            i.investigation_id,
            i.encounter_id,
            i.investigation_type,
            i.investigation_name,
            i.requested_date,
            i.performed_date,
            i.result_summary,
            i.result_value,
            i.unit,
            i.reference_range,
            i.body_site,
            i.report_reference,
            i.status,
            i.priority,
            i.specimen_type,
            i.clinical_notes,
            req.full_name AS requested_by_name,
            perf.full_name AS performed_by_name,
            ver.full_name AS verified_by_name,
            i.verified_at
          FROM public.investigations i
          INNER JOIN public.patients p
            ON p.patient_id = i.patient_id
          LEFT JOIN public.hospital_users req
            ON req.user_id = i.requested_by
          LEFT JOIN public.hospital_users perf
            ON perf.user_id = i.performed_by
          LEFT JOIN public.hospital_users ver
            ON ver.user_id = i.verified_by
          WHERE
            i.patient_id = $1
          ORDER BY
            COALESCE(
              i.performed_date,
              i.requested_date
            ) DESC,
            i.investigation_id DESC
          LIMIT 50;
        `,
        [patientId],
      ),

      client.query(
        `
          SELECT
            medication_order_id,
            admission_id,
            encounter_id,
            medication_name,
            strength,
            dosage,
            route,
            frequency,
            duration_value,
            duration_unit,
            quantity_prescribed,
            quantity_unit,
            instructions,
            indication,
            start_date,
            end_date,
            order_status,
            prescriber_name,
            total_dispensed_quantity,
            last_dispensed_at,
            prescribed_notes,
            encounter_type,
            encounter_date,
            admission_number
          FROM public.vw_medication_longitudinal_history
          WHERE
            patient_id = $1
          ORDER BY
            start_date DESC NULLS LAST,
            medication_order_id DESC
          LIMIT 50;
        `,
        [patientId],
      ),

      client.query(
        `
          SELECT
            b.bht_entry_id,
            b.admission_id,
            a.admission_number,
            b.encounter_id,
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
            u.full_name AS recorded_by_name,
            w.ward_name
          FROM public.bht_entries b
          INNER JOIN public.admissions a
            ON a.admission_id = b.admission_id
          LEFT JOIN public.hospital_users u
            ON u.user_id = b.recorded_by
          LEFT JOIN public.wards w
            ON w.ward_id = a.ward_id
          WHERE
            b.patient_id = $1
          ORDER BY
            b.entry_date DESC,
            b.bht_entry_id DESC
          LIMIT 100;
        `,
        [patientId],
      ),
    ]);

    await pool.query(
      `INSERT INTO public.audit_logs (
         hospital_id, user_id, action_type, entity_type, entity_id,
         new_values
       ) VALUES ($1, $2, 'ECIS_EVIDENCE_ACCESSED', 'patient', $3, $4::jsonb);`,
      [hospitalId, accessedBy, patientId, JSON.stringify({ emergencyCaseId })],
    );

    return {
      patient,

      evidence: {
        encounters: encountersResult.rows,
        admissions: admissionsResult.rows,
        surgeries: surgeriesResult.rows,
        fractures: fracturesResult.rows,
        medicalDevices: devicesResult.rows,
        dental: dentalResult.rows,
        observations: observationsResult.rows,
        treatments: treatmentsResult.rows,
        investigations: investigationsResult.rows,
        medications: medicationsResult.rows,
        bht: bhtResult.rows,
      },

      counts: {
        encounters: encountersResult.rowCount,
        admissions: admissionsResult.rowCount,
        surgeries: surgeriesResult.rowCount,
        fractures: fracturesResult.rowCount,
        medicalDevices: devicesResult.rowCount,
        dental: dentalResult.rowCount,
        observations: observationsResult.rowCount,
        treatments: treatmentsResult.rowCount,
        investigations: investigationsResult.rowCount,
        medications: medicationsResult.rowCount,
        bht: bhtResult.rowCount,
      },
    };
}

module.exports = {
  getCandidateEvidence,
};
