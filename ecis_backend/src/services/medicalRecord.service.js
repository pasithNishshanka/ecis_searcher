const pool = require("../config/database");

function positiveInteger(value, fieldName) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(
      `${fieldName} must be a positive integer.`,
    );
  }

  return number;
}

function addSectionCount(stats, key, rows) {
  stats[key] = Array.isArray(rows)
    ? rows.length
    : 0;
}

function normalizeEvent({
  type,
  date,
  id,
  title,
  subtitle,
  status = null,
  encounterId = null,
  admissionId = null,
  admissionNumber = null,
  department = null,
  details = {},
}) {
  return {
    key: `${type}-${id}`,
    type,
    date: date || null,
    id,
    title:
      title ||
      "Clinical record",
    subtitle:
      subtitle || null,
    status,
    encounterId,
    admissionId,
    admissionNumber,
    department,
    details,
  };
}

function sortTimeline(events) {
  return events.sort(
    (a, b) => {
      const aTime = a.date
        ? new Date(a.date).getTime()
        : 0;

      const bTime = b.date
        ? new Date(b.date).getTime()
        : 0;

      if (bTime !== aTime) {
        return bTime - aTime;
      }

      return String(
        b.key,
      ).localeCompare(
        String(a.key),
      );
    },
  );
}

async function getMedicalRecord(
  patientIdValue,
  hospitalIdValue,
) {
  const patientId =
    positiveInteger(
      patientIdValue,
      "patientId",
    );

  const hospitalId =
    positiveInteger(
      hospitalIdValue,
      "hospitalId",
    );

  /*
   * ------------------------------------------------------------
   * PATIENT
   * ------------------------------------------------------------
   */

  const patientResult =
    await pool.query(
      `
        SELECT
          p.patient_id,
          p.hospital_id,
          p.patient_number,
          p.nic_number,
          p.passport_number,

          p.first_name,
          p.middle_name,
          p.last_name,

          p.date_of_birth,

          EXTRACT(
            YEAR
            FROM AGE(
              CURRENT_DATE,
              p.date_of_birth
            )
          )::int AS age,

          p.gender,
          p.blood_group,
          p.height_cm,
          p.weight_kg,

          p.nationality,
          p.primary_phone,
          p.secondary_phone,
          p.email,

          p.occupation,
          p.address,
          p.province,
          p.district,

          p.registration_notes,
          p.status,
          p.registered_at,
          p.created_at,
          p.updated_at,

          h.hospital_id,
          h.hospital_name,

          COALESCE(
            (
              SELECT
                jsonb_agg(
                  jsonb_build_object(
                    'id',
                    a.allergy_id,

                    'name',
                    a.allergy_name,

                    'category',
                    a.allergy_category,

                    'reaction',
                    pa.reaction,

                    'notes',
                    pa.notes
                  )
                  ORDER BY
                    a.allergy_category,
                    a.allergy_name
                )
              FROM public.patient_allergies pa

              INNER JOIN public.allergies a
                ON a.allergy_id =
                   pa.allergy_id

              WHERE
                pa.patient_id =
                  p.patient_id
            ),
            '[]'::jsonb
          ) AS allergies

        FROM public.patients p

        INNER JOIN public.hospitals h
          ON h.hospital_id =
             p.hospital_id

        WHERE
          p.patient_id = $1

          AND p.hospital_id = $2

          AND p.status = 'ACTIVE'

          AND p.date_of_birth <=
              CURRENT_DATE -
              INTERVAL '18 years'

        LIMIT 1;
      `,
      [
        patientId,
        hospitalId,
      ],
    );

  if (
    patientResult.rowCount === 0
  ) {
    throw new Error(
      "Active adult patient was not found in the authenticated hospital.",
    );
  }

  /*
   * ------------------------------------------------------------
   * ALL LONGITUDINAL SOURCES
   * ------------------------------------------------------------
   */

  const [
    encountersResult,
    admissionsResult,
    opdResult,
    clinicResult,
    emergencyResult,
    bhtResult,
    treatmentsResult,
    investigationResult,
    medicationResult,
    surgeriesResult,
    proceduresResult,
    fracturesResult,
    observationsResult,
    conditionsResult,
    dentalResult,
    devicesResult,
  ] =
    await Promise.all([
      /*
       * ENCOUNTERS
       */
      pool.query(
        `
          SELECT
            e.encounter_id,
            e.patient_id,

            e.encounter_type,
            e.encounter_date,

            e.attending_user_id,
            e.department,

            e.status,
            e.chief_complaint,
            e.notes,

            u.full_name
              AS attending_user_name

          FROM public.encounters e

          LEFT JOIN public.hospital_users u
            ON u.user_id =
               e.attending_user_id

          WHERE
            e.patient_id = $1
            AND e.hospital_id = $2

          ORDER BY
            e.encounter_date DESC,
            e.encounter_id DESC;
        `,
        [
          patientId,
          hospitalId,
        ],
      ),

      /*
       * ADMISSIONS
       */
      pool.query(
        `
          SELECT
            a.admission_id,
            a.patient_id,
            a.encounter_id,

            a.admission_number,

            a.admission_date,
            a.discharge_date,

            a.admission_reason,
            a.admission_diagnosis,

            a.discharge_diagnosis,
            a.discharge_summary,

            a.status,
            a.attending_doctor_id,

            e.encounter_type,
            e.status
              AS encounter_status,

            w.ward_id,
            w.ward_code,
            w.ward_name,
            w.ward_type,

            b.bed_id,
            b.bed_number,

            u.full_name
              AS doctor_name

          FROM public.admissions a

          INNER JOIN public.encounters e
            ON e.encounter_id =
               a.encounter_id

          INNER JOIN public.wards w
            ON w.ward_id =
               a.ward_id

          INNER JOIN public.beds b
            ON b.bed_id =
               a.bed_id

          LEFT JOIN public.hospital_users u
            ON u.user_id =
               a.attending_doctor_id

          WHERE
            a.patient_id = $1
            AND w.hospital_id = $2

          ORDER BY
            a.admission_date DESC,
            a.admission_id DESC;
        `,
        [
          patientId,
          hospitalId,
        ],
      ),

      /*
       * OPD
       */
      pool.query(
        `
          SELECT
            o.opd_visit_id,
            o.opd_number,
            o.visit_date,

            o.chief_complaint,
            o.clinical_notes,
            o.diagnosis_summary,

            o.follow_up_required,
            o.follow_up_date,

            o.status,

            e.encounter_id,
            e.encounter_type,
            e.department,
            e.encounter_date,

            e.status
              AS encounter_status,

            u.user_id AS doctor_id,
            u.full_name AS doctor_name

          FROM public.opd_visits o

          INNER JOIN public.encounters e
            ON e.encounter_id =
               o.encounter_id

          LEFT JOIN public.hospital_users u
            ON u.user_id =
               o.doctor_user_id

          WHERE
            o.patient_id = $1

            AND e.hospital_id = $2

          ORDER BY
            o.visit_date DESC,
            o.opd_visit_id DESC;
        `,
        [
          patientId,
          hospitalId,
        ],
      ),

      /*
       * CLINICS
       */
      pool.query(
        `
          SELECT
            cv.clinic_visit_id,

            cv.visit_number,
            cv.visit_date,

            cv.reason_for_visit,
            cv.clinical_notes,
            cv.diagnosis_summary,

            cv.follow_up_required,
            cv.follow_up_date,

            cv.status,

            c.clinic_id,
            c.clinic_code,
            c.clinic_name,
            c.specialty,
            c.location,

            e.encounter_id,
            e.encounter_type,
            e.encounter_date,
            e.department,

            e.status
              AS encounter_status,

            u.user_id AS doctor_id,
            u.full_name AS doctor_name

          FROM public.clinic_visits cv

          INNER JOIN public.clinics c
            ON c.clinic_id =
               cv.clinic_id

          INNER JOIN public.encounters e
            ON e.encounter_id =
               cv.encounter_id

          LEFT JOIN public.hospital_users u
            ON u.user_id =
               cv.doctor_user_id

          WHERE
            cv.patient_id = $1

            AND c.hospital_id = $2

            AND e.hospital_id = $2

          ORDER BY
            cv.visit_date DESC,
            cv.clinic_visit_id DESC;
        `,
        [
          patientId,
          hospitalId,
        ],
      ),

      /*
       * EMERGENCY
       */
      pool.query(
        `
          SELECT
            ec.emergency_case_id,
            ec.case_number,

            ec.arrival_date,
            ec.arrival_mode,

            ec.triage_level,
            ec.chief_complaint,
            ec.initial_condition,

            ec.unidentified_patient,
            ec.temporary_identity_reference,

            ec.status,

            ec.encounter_id,
            ec.identified_at,
            ec.identified_by,

            u.full_name
              AS assigned_doctor_name

          FROM public.emergency_cases ec

          LEFT JOIN public.hospital_users u
            ON u.user_id =
               ec.assigned_doctor_id

          WHERE
            ec.patient_id = $1

            AND ec.hospital_id = $2

          ORDER BY
            ec.arrival_date DESC,
            ec.emergency_case_id DESC;
        `,
        [
          patientId,
          hospitalId,
        ],
      ),

      /*
       * BHT
       */
      pool.query(
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

            b.recorded_by,

            u.full_name
              AS recorded_by_name,

            w.ward_code,
            w.ward_name,
            w.ward_type

          FROM public.bht_entries b

          INNER JOIN public.admissions a
            ON a.admission_id =
               b.admission_id

          INNER JOIN public.wards w
            ON w.ward_id =
               a.ward_id

          LEFT JOIN public.hospital_users u
            ON u.user_id =
               b.recorded_by

          WHERE
            b.patient_id = $1
            AND b.hospital_id = $2

          ORDER BY
            b.entry_date DESC,
            b.bht_entry_id DESC;
        `,
        [
          patientId,
          hospitalId,
        ],
      ),

      /*
       * TREATMENTS
       */
      pool.query(
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

            t.performed_by,

            u.full_name
              AS performed_by_name,

            e.encounter_type,
            e.encounter_date,
            e.department,

            e.chief_complaint
              AS diagnosis

          FROM public.treatment_records t

          INNER JOIN public.patients p
            ON p.patient_id =
               t.patient_id
           AND p.hospital_id = $2

          LEFT JOIN public.hospital_users u
            ON u.user_id =
               t.performed_by

          LEFT JOIN public.encounters e
            ON e.encounter_id =
               t.encounter_id

          WHERE
            t.patient_id = $1

          ORDER BY
            t.treatment_date DESC,
            t.treatment_id DESC;
        `,
        [
          patientId,
          hospitalId,
        ],
      ),

      /*
       * INVESTIGATIONS
       * LAB + RADIOLOGY
       */
      pool.query(
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

            i.performed_by,
            i.requested_by,
            i.verified_by,

            i.verified_at,

            i.status,
            i.priority,

            i.specimen_type,
            i.clinical_notes,

            e.encounter_type,
            e.encounter_date,
            e.department,

            req.full_name
              AS requested_by_name,

            perf.full_name
              AS performed_by_name,

            ver.full_name
              AS verified_by_name

          FROM public.investigations i

          INNER JOIN public.patients p
            ON p.patient_id =
               i.patient_id
           AND p.hospital_id = $2

          LEFT JOIN public.encounters e
            ON e.encounter_id =
               i.encounter_id

          LEFT JOIN public.hospital_users req
            ON req.user_id =
               i.requested_by

          LEFT JOIN public.hospital_users perf
            ON perf.user_id =
               i.performed_by

          LEFT JOIN public.hospital_users ver
            ON ver.user_id =
               i.verified_by

          WHERE
            i.patient_id = $1

          ORDER BY
            COALESCE(
              i.performed_date,
              i.requested_date
            ) DESC,

            i.investigation_id DESC;
        `,
        [
          patientId,
          hospitalId,
        ],
      ),

      /*
       * MEDICATION
       */
      pool.query(
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

            prescribed_by_user_id,
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

            AND hospital_id = $2

          ORDER BY
            start_date DESC NULLS LAST,
            medication_order_id DESC;
        `,
        [
          patientId,
          hospitalId,
        ],
      ),

      /*
       * SURGERIES
       */
      pool.query(
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

            u.user_id
              AS surgeon_id,

            u.full_name
              AS surgeon_name,

            e.encounter_type,
            e.encounter_date,
            e.department,

            a.admission_number,

            w.ward_name

          FROM public.surgeries s

          INNER JOIN public.patients p
            ON p.patient_id =
               s.patient_id
           AND p.hospital_id = $2

          LEFT JOIN public.hospital_users u
            ON u.user_id =
               s.surgeon_user_id

          LEFT JOIN public.encounters e
            ON e.encounter_id =
               s.encounter_id

          LEFT JOIN public.admissions a
            ON a.admission_id =
               s.admission_id

          LEFT JOIN public.wards w
            ON w.ward_id =
               a.ward_id

          WHERE
            s.patient_id = $1

          ORDER BY
            s.surgery_date DESC,
            s.surgery_id DESC;
        `,
        [
          patientId,
          hospitalId,
        ],
      ),

      /*
       * PROCEDURES
       */
      pool.query(
        `
          SELECT
            pr.procedure_id,

            pr.encounter_id,

            pr.procedure_code,
            pr.procedure_name,

            pr.procedure_date,

            pr.body_site,
            pr.laterality,

            pr.indication,
            pr.findings,
            pr.outcome,

            u.user_id
              AS performed_by_id,

            u.full_name
              AS performed_by_name,

            e.encounter_type,
            e.encounter_date,
            e.department

          FROM public.procedures pr

          INNER JOIN public.patients p
            ON p.patient_id =
               pr.patient_id
           AND p.hospital_id = $2

          LEFT JOIN public.hospital_users u
            ON u.user_id =
               pr.performed_by

          LEFT JOIN public.encounters e
            ON e.encounter_id =
               pr.encounter_id

          WHERE
            pr.patient_id = $1

          ORDER BY
            pr.procedure_date DESC,
            pr.procedure_id DESC;
        `,
        [
          patientId,
          hospitalId,
        ],
      ),

      /*
       * FRACTURES
       */
      pool.query(
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

            f.notes,

            e.encounter_type,
            e.encounter_date,
            e.department

          FROM public.fractures f

          INNER JOIN public.patients p
            ON p.patient_id =
               f.patient_id
           AND p.hospital_id = $2

          LEFT JOIN public.encounters e
            ON e.encounter_id =
               f.encounter_id

          WHERE
            f.patient_id = $1

          ORDER BY
            f.fracture_date DESC,
            f.fracture_id DESC;
        `,
        [
          patientId,
          hospitalId,
        ],
      ),

      /*
       * CLINICAL OBSERVATIONS
       */
      pool.query(
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

            u.full_name
              AS recorded_by_name,

            e.encounter_type,
            e.encounter_date,
            e.department

          FROM public.clinical_observations co

          INNER JOIN public.patients p
            ON p.patient_id =
               co.patient_id
           AND p.hospital_id = $2

          LEFT JOIN public.hospital_users u
            ON u.user_id =
               co.recorded_by

          LEFT JOIN public.encounters e
            ON e.encounter_id =
               co.encounter_id

          WHERE
            co.patient_id = $1

          ORDER BY
            co.observed_date DESC,
            co.observation_id DESC;
        `,
        [
          patientId,
          hospitalId,
        ],
      ),

      /*
       * CONDITIONS
       */
      pool.query(
        `
          SELECT
            pc.patient_condition_id,

            pc.condition_id,
            pc.encounter_id,

            pc.diagnosis_date,
            pc.condition_status,
            pc.severity,
            pc.notes,

            mc.condition_code,
            mc.condition_name,
            mc.description,

            e.encounter_type,
            e.encounter_date,
            e.department

          FROM public.patient_conditions pc

          INNER JOIN public.medical_conditions mc
            ON mc.condition_id =
               pc.condition_id

          INNER JOIN public.patients p
            ON p.patient_id =
               pc.patient_id
           AND p.hospital_id = $2

          LEFT JOIN public.encounters e
            ON e.encounter_id =
               pc.encounter_id

          WHERE
            pc.patient_id = $1

          ORDER BY
            pc.diagnosis_date DESC,
            pc.patient_condition_id DESC;
        `,
        [
          patientId,
          hospitalId,
        ],
      ),

      /*
       * DENTAL
       */
      pool.query(
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

            u.full_name
              AS recorded_by_name,

            e.encounter_type,
            e.encounter_date,
            e.department

          FROM public.dental_records d

          INNER JOIN public.patients p
            ON p.patient_id =
               d.patient_id
           AND p.hospital_id = $2

          LEFT JOIN public.hospital_users u
            ON u.user_id =
               d.recorded_by

          LEFT JOIN public.encounters e
            ON e.encounter_id =
               d.encounter_id

          WHERE
            d.patient_id = $1

          ORDER BY
            d.record_date DESC,
            d.dental_record_id DESC;
        `,
        [
          patientId,
          hospitalId,
        ],
      ),

      /*
       * MEDICAL DEVICES
       */
      pool.query(
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
            md.notes,

            e.encounter_type,
            e.encounter_date,
            e.department

          FROM public.medical_devices md

          INNER JOIN public.patients p
            ON p.patient_id =
               md.patient_id
           AND p.hospital_id = $2

          LEFT JOIN public.encounters e
            ON e.encounter_id =
               md.encounter_id

          WHERE
            md.patient_id = $1

          ORDER BY
            md.implantation_date DESC NULLS LAST,
            md.device_id DESC;
        `,
        [
          patientId,
          hospitalId,
        ],
      ),
    ]);

  /*
   * ------------------------------------------------------------
   * GROUPED SOURCE DATA
   * ------------------------------------------------------------
   */

  const sections = {
    encounters:
      encountersResult.rows,

    admissions:
      admissionsResult.rows,

    opd:
      opdResult.rows,

    clinics:
      clinicResult.rows,

    emergency:
      emergencyResult.rows,

    bht:
      bhtResult.rows,

    treatments:
      treatmentsResult.rows,

    investigations:
      investigationResult.rows,

    medications:
      medicationResult.rows,

    surgeries:
      surgeriesResult.rows,

    procedures:
      proceduresResult.rows,

    fractures:
      fracturesResult.rows,

    observations:
      observationsResult.rows,

    conditions:
      conditionsResult.rows,

    dental:
      dentalResult.rows,

    devices:
      devicesResult.rows,
  };

  const stats = {};

  Object.entries(
    sections,
  ).forEach(
    ([key, rows]) => {
      addSectionCount(
        stats,
        key,
        rows,
      );
    },
  );

  /*
   * ------------------------------------------------------------
   * UNIFIED TIMELINE
   * ------------------------------------------------------------
   */

  const timeline = [];

  /*
   * ENCOUNTERS
   */

  for (
    const row of
    encountersResult.rows
  ) {
    timeline.push(
      normalizeEvent({
        type:
          "ENCOUNTER",

        date:
          row.encounter_date,

        id:
          row.encounter_id,

        title:
          row.encounter_type ||
          "Clinical encounter",

        subtitle:
          row.department ||
          row.chief_complaint ||
          "Clinical contact",

        status:
          row.status,

        encounterId:
          row.encounter_id,

        department:
          row.department,

        details: {
          chiefComplaint:
            row.chief_complaint,

          notes:
            row.notes,

          attendingUserName:
            row.attending_user_name,
        },
      }),
    );
  }

  /*
   * ADMISSIONS
   */

  for (
    const row of
    admissionsResult.rows
  ) {
    timeline.push(
      normalizeEvent({
        type:
          "ADMISSION",

        date:
          row.admission_date,

        id:
          row.admission_id,

        title:
          row.admission_number ||
          "Inpatient admission",

        subtitle:
          row.ward_name ||
          "Ward admission",

        status:
          row.status,

        encounterId:
          row.encounter_id,

        admissionId:
          row.admission_id,

        admissionNumber:
          row.admission_number,

        details: {
          admissionReason:
            row.admission_reason,

          admissionDiagnosis:
            row.admission_diagnosis,

          dischargeDiagnosis:
            row.discharge_diagnosis,

          dischargeSummary:
            row.discharge_summary,

          dischargeDate:
            row.discharge_date,

          wardCode:
            row.ward_code,

          wardName:
            row.ward_name,

          wardType:
            row.ward_type,

          bedNumber:
            row.bed_number,

          doctorName:
            row.doctor_name,
        },
      }),
    );

    if (
      row.discharge_date
    ) {
      timeline.push(
        normalizeEvent({
          type:
            "DISCHARGE",

          date:
            row.discharge_date,

          id:
            row.admission_id,

          title:
            `Discharge · ${
              row.admission_number ||
              "Admission"
            }`,

          subtitle:
            row.ward_name ||
            "Inpatient discharge",

          status:
            "DISCHARGED",

          encounterId:
            row.encounter_id,

          admissionId:
            row.admission_id,

          admissionNumber:
            row.admission_number,

          details: {
            dischargeDiagnosis:
              row.discharge_diagnosis,

            dischargeSummary:
              row.discharge_summary,

            doctorName:
              row.doctor_name,
          },
        }),
      );
    }
  }

  /*
   * OPD
   */

  for (
    const row of
    opdResult.rows
  ) {
    timeline.push(
      normalizeEvent({
        type:
          "OPD",

        date:
          row.visit_date,

        id:
          row.opd_visit_id,

        title:
          `OPD · ${
            row.opd_number ||
            "Visit"
          }`,

        subtitle:
          row.diagnosis_summary ||
          row.chief_complaint,

        status:
          row.status,

        encounterId:
          row.encounter_id,

        department:
          row.department,

        details: {
          visitNumber:
            row.opd_number,

          chiefComplaint:
            row.chief_complaint,

          clinicalNotes:
            row.clinical_notes,

          diagnosisSummary:
            row.diagnosis_summary,

          followUpRequired:
            row.follow_up_required,

          followUpDate:
            row.follow_up_date,

          doctorName:
            row.doctor_name,
        },
      }),
    );
  }

  /*
   * CLINICS
   */

  for (
    const row of
    clinicResult.rows
  ) {
    timeline.push(
      normalizeEvent({
        type:
          "CLINIC",

        date:
          row.visit_date,

        id:
          row.clinic_visit_id,

        title:
          row.clinic_name ||
          `Clinic · ${
            row.visit_number ||
            "Visit"
          }`,

        subtitle:
          row.diagnosis_summary ||
          row.reason_for_visit,

        status:
          row.status,

        encounterId:
          row.encounter_id,

        department:
          row.specialty ||
          row.department,

        details: {
          visitNumber:
            row.visit_number,

          clinicName:
            row.clinic_name,

          specialty:
            row.specialty,

          reasonForVisit:
            row.reason_for_visit,

          clinicalNotes:
            row.clinical_notes,

          diagnosisSummary:
            row.diagnosis_summary,

          followUpRequired:
            row.follow_up_required,

          followUpDate:
            row.follow_up_date,

          doctorName:
            row.doctor_name,
        },
      }),
    );
  }

  /*
   * EMERGENCY
   */

  for (
    const row of
    emergencyResult.rows
  ) {
    timeline.push(
      normalizeEvent({
        type:
          "EMERGENCY",

        date:
          row.arrival_date,

        id:
          row.emergency_case_id,

        title:
          `Emergency · ${
            row.case_number
          }`,

        subtitle:
          row.chief_complaint ||
          row.initial_condition,

        status:
          row.status,

        encounterId:
          row.encounter_id,

        details: {
          arrivalMode:
            row.arrival_mode,

          triageLevel:
            row.triage_level,

          chiefComplaint:
            row.chief_complaint,

          initialCondition:
            row.initial_condition,

          identifiedAt:
            row.identified_at,

          assignedDoctorName:
            row.assigned_doctor_name,

          unidentifiedPatient:
            row.unidentified_patient,
        },
      }),
    );
  }

  /*
   * BHT
   */

  for (
    const row of
    bhtResult.rows
  ) {
    const vitals = {
      temperatureC:
        row.temperature_c,

      pulseBpm:
        row.pulse_bpm,

      respiratoryRateBpm:
        row.respiratory_rate_bpm,

      systolicBp:
        row.systolic_bp,

      diastolicBp:
        row.diastolic_bp,

      spo2Percent:
        row.spo2_percent,

      painScore:
        row.pain_score,

      weightKg:
        row.weight_kg,
    };

    timeline.push(
      normalizeEvent({
        type:
          "BHT",

        date:
          row.entry_date,

        id:
          row.bht_entry_id,

        title:
          row.entry_title ||
          row.entry_type,

        subtitle:
          row.diagnosis ||
          row.assessment ||
          row.ward_name,

        status:
          row.entry_type,

        encounterId:
          row.encounter_id,

        admissionId:
          row.admission_id,

        admissionNumber:
          row.admission_number,

        department:
          row.ward_name,

        details: {
          entryType:
            row.entry_type,

          subjectiveNotes:
            row.subjective_notes,

          objectiveNotes:
            row.objective_notes,

          assessment:
            row.assessment,

          plan:
            row.plan,

          diagnosis:
            row.diagnosis,

          vitals,

          recordedByName:
            row.recorded_by_name,

          wardCode:
            row.ward_code,

          wardName:
            row.ward_name,
        },
      }),
    );
  }

  /*
   * TREATMENTS
   */

  for (
    const row of
    treatmentsResult.rows
  ) {
    timeline.push(
      normalizeEvent({
        type:
          "TREATMENT",

        date:
          row.treatment_date,

        id:
          row.treatment_id,

        title:
          row.treatment_name ||
          row.treatment_type ||
          "Clinical treatment",

        subtitle:
          row.description ||
          row.diagnosis,

        status:
          row.treatment_type,

        encounterId:
          row.encounter_id,

        admissionId:
          row.admission_id,

        department:
          row.department,

        details: {
          treatmentType:
            row.treatment_type,

          description:
            row.description,

          bodySite:
            row.body_site,

          laterality:
            row.laterality,

          outcome:
            row.outcome,

          complications:
            row.complications,

          performedByName:
            row.performed_by_name,

          emergencyCaseId:
            row.emergency_case_id,
        },
      }),
    );
  }

  /*
   * INVESTIGATIONS
   */

  for (
    const row of
    investigationResult.rows
  ) {
    const investigationType =
      String(
        row.investigation_type ||
          "",
      ).toUpperCase();

    const isImaging =
      investigationType ===
        "IMAGING" ||
      investigationType ===
        "RADIOLOGY";

    const eventType =
      isImaging
        ? "RADIOLOGY"
        : "LAB";

    timeline.push(
      normalizeEvent({
        type:
          eventType,

        date:
          row.performed_date ||
          row.requested_date,

        id:
          row.investigation_id,

        title:
          row.investigation_name ||
          "Investigation",

        subtitle:
          row.result_summary ||
          row.clinical_notes ||
          `${
            investigationType ||
            "Investigation"
          } request`,

        status:
          row.status,

        encounterId:
          row.encounter_id,

        department:
          row.department,

        details: {
          investigationType:
            row.investigation_type,

          requestedDate:
            row.requested_date,

          performedDate:
            row.performed_date,

          resultSummary:
            row.result_summary,

          resultValue:
            row.result_value,

          unit:
            row.unit,

          referenceRange:
            row.reference_range,

          bodySite:
            row.body_site,

          reportReference:
            row.report_reference,

          priority:
            row.priority,

          specimenType:
            row.specimen_type,

          clinicalNotes:
            row.clinical_notes,

          requestedByName:
            row.requested_by_name,

          performedByName:
            row.performed_by_name,

          verifiedByName:
            row.verified_by_name,

          verifiedAt:
            row.verified_at,
        },
      }),
    );
  }

  /*
   * MEDICATION
   */

  for (
    const row of
    medicationResult.rows
  ) {
    timeline.push(
      normalizeEvent({
        type:
          "MEDICATION",

        date:
          row.start_date ||
          row.encounter_date,

        id:
          row.medication_order_id,

        title:
          row.medication_name ||
          "Medication order",

        subtitle:
          row.dosage &&
          row.frequency
            ? `${row.dosage} · ${row.frequency}`
            : row.dosage ||
              row.frequency,

        status:
          row.order_status,

        encounterId:
          row.encounter_id,

        admissionId:
          row.admission_id,

        admissionNumber:
          row.admission_number,

        details: {
          medicationName:
            row.medication_name,

          strength:
            row.strength,

          dosage:
            row.dosage,

          route:
            row.route,

          frequency:
            row.frequency,

          durationValue:
            row.duration_value,

          durationUnit:
            row.duration_unit,

          quantityPrescribed:
            row.quantity_prescribed,

          quantityUnit:
            row.quantity_unit,

          instructions:
            row.instructions,

          indication:
            row.indication,

          startDate:
            row.start_date,

          endDate:
            row.end_date,

          totalDispensedQuantity:
            row.total_dispensed_quantity,

          lastDispensedAt:
            row.last_dispensed_at,

          prescribedNotes:
            row.prescribed_notes,

          prescriberName:
            row.prescriber_name,
        },
      }),
    );
  }

  /*
   * SURGERIES
   */

  for (
    const row of
    surgeriesResult.rows
  ) {
    timeline.push(
      normalizeEvent({
        type:
          "SURGERY",

        date:
          row.surgery_date,

        id:
          row.surgery_id,

        title:
          row.surgery_name ||
          "Surgery",

        subtitle:
          row.postoperative_diagnosis ||
          row.preoperative_diagnosis ||
          row.body_site,

        status:
          "RECORDED",

        encounterId:
          row.encounter_id,

        admissionId:
          row.admission_id,

        admissionNumber:
          row.admission_number,

        department:
          row.department,

        details: {
          surgeryCode:
            row.surgery_code,

          bodySite:
            row.body_site,

          laterality:
            row.laterality,

          preoperativeDiagnosis:
            row.preoperative_diagnosis,

          postoperativeDiagnosis:
            row.postoperative_diagnosis,

          findings:
            row.findings,

          complications:
            row.complications,

          surgicalNotes:
            row.surgical_notes,

          surgeonName:
            row.surgeon_name,

          wardName:
            row.ward_name,
        },
      }),
    );
  }

  /*
   * PROCEDURES
   */

  for (
    const row of
    proceduresResult.rows
  ) {
    timeline.push(
      normalizeEvent({
        type:
          "PROCEDURE",

        date:
          row.procedure_date,

        id:
          row.procedure_id,

        title:
          row.procedure_name ||
          "Procedure",

        subtitle:
          row.indication ||
          row.body_site,

        status:
          "RECORDED",

        encounterId:
          row.encounter_id,

        department:
          row.department,

        details: {
          procedureCode:
            row.procedure_code,

          bodySite:
            row.body_site,

          laterality:
            row.laterality,

          indication:
            row.indication,

          findings:
            row.findings,

          outcome:
            row.outcome,

          performedByName:
            row.performed_by_name,
        },
      }),
    );
  }

  /*
   * FRACTURES
   */

  for (
    const row of
    fracturesResult.rows
  ) {
    timeline.push(
      normalizeEvent({
        type:
          "FRACTURE",

        date:
          row.fracture_date,

        id:
          row.fracture_id,

        title:
          `Fracture · ${
            row.body_part ||
            "Body part not specified"
          }`,

        subtitle:
          row.fracture_type ||
          row.treatment_description,

        status:
          row.healed_date
            ? "HEALED"
            : "RECORDED",

        encounterId:
          row.encounter_id,

        department:
          row.department,

        details: {
          bodyPart:
            row.body_part,

          laterality:
            row.laterality,

          fractureType:
            row.fracture_type,

          treatmentDescription:
            row.treatment_description,

          healedDate:
            row.healed_date,

          notes:
            row.notes,
        },
      }),
    );
  }

  /*
   * OBSERVATIONS
   */

  for (
    const row of
    observationsResult.rows
  ) {
    timeline.push(
      normalizeEvent({
        type:
          "OBSERVATION",

        date:
          row.observed_date,

        id:
          row.observation_id,

        title:
          row.observation_type ||
          "Clinical observation",

        subtitle:
          row.observation_value,

        status:
          "RECORDED",

        encounterId:
          row.encounter_id,

        department:
          row.department,

        details: {
          observationType:
            row.observation_type,

          observationValue:
            row.observation_value,

          bodySite:
            row.body_site,

          laterality:
            row.laterality,

          notes:
            row.notes,

          recordedByName:
            row.recorded_by_name,

          treatmentId:
            row.treatment_id,
        },
      }),
    );
  }

  /*
   * CONDITIONS
   */

  for (
    const row of
    conditionsResult.rows
  ) {
    timeline.push(
      normalizeEvent({
        type:
          "CONDITION",

        date:
          row.diagnosis_date,

        id:
          row.patient_condition_id,

        title:
          row.condition_name ||
          "Medical condition",

        subtitle:
          row.severity ||
          row.condition_status,

        status:
          row.condition_status ||
          "RECORDED",

        encounterId:
          row.encounter_id,

        department:
          row.department,

        details: {
          conditionCode:
            row.condition_code,

          conditionName:
            row.condition_name,

          description:
            row.description,

          severity:
            row.severity,

          notes:
            row.notes,
        },
      }),
    );
  }

  /*
   * DENTAL
   */

  for (
    const row of
    dentalResult.rows
  ) {
    timeline.push(
      normalizeEvent({
        type:
          "DENTAL",

        date:
          row.record_date,

        id:
          row.dental_record_id,

        title:
          row.tooth_number !==
            null &&
          row.tooth_number !==
            undefined
            ? `Dental record · Tooth ${row.tooth_number}`
            : "Dental record",

        subtitle:
          row.condition ||
          row.treatment,

        status:
          "RECORDED",

        encounterId:
          row.encounter_id,

        details: {
          toothNumber:
            row.tooth_number,

          condition:
            row.condition,

          treatment:
            row.treatment,

          fillingType:
            row.filling_type,

          crownPresent:
            row.crown_present,

          implantPresent:
            row.implant_present,

          missingTooth:
            row.missing_tooth,

          notes:
            row.notes,

          recordedByName:
            row.recorded_by_name,
        },
      }),
    );
  }

  /*
   * MEDICAL DEVICES
   */

  for (
    const row of
    devicesResult.rows
  ) {
    timeline.push(
      normalizeEvent({
        type:
          "DEVICE",

        date:
          row.implantation_date ||
          row.encounter_date,

        id:
          row.device_id,

        title:
          row.device_name ||
          row.device_type ||
          "Medical device",

        subtitle:
          row.body_site ||
          row.status,

        status:
          row.status,

        encounterId:
          row.encounter_id,

        department:
          row.department,

        details: {
          deviceType:
            row.device_type,

          deviceName:
            row.device_name,

          manufacturer:
            row.manufacturer,

          modelNumber:
            row.model_number,

          serialNumber:
            row.serial_number,

          bodySite:
            row.body_site,

          laterality:
            row.laterality,

          implantationDate:
            row.implantation_date,

          removalDate:
            row.removal_date,

          notes:
            row.notes,
        },
      }),
    );
  }

  sortTimeline(
    timeline,
  );

  return {
    patient:
      patientResult.rows[0],

    stats: {
      ...stats,

      timeline:
        timeline.length,
    },

    sections,

    timeline,
  };
}

module.exports = {
  getMedicalRecord,
};