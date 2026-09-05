const pool = require("../config/database");

/*
 * ECIS Candidate Matching Service
 *
 * ECIS searches the existing longitudinal EHR.
 *
 * Security rule:
 * Candidate patients are restricted to the hospital
 * associated with the authenticated emergency case.
 *
 * The score is an explainable heuristic for research.
 * It is NOT a medically validated probability of identity.
 */

const WEIGHTS = {
  gender: 7,
  bloodGroup: 12,
  age: 10,
  height: 10,
  weight: 6,
  name: 12,
  phone: 10,
  occupation: 8,
  surgery: 18,
  fracture: 15,
  device: 18,
  dental: 12,
  observation: 15,
  treatment: 15,
  investigation: 12,
};

const normalize = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim().toLowerCase();
};

const containsValue = (value, searchValue) => {
  if (!value || !searchValue) {
    return false;
  }

  return normalize(value).includes(
    normalize(searchValue),
  );
};

const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) {
    return null;
  }

  const today = new Date();
  const dob = new Date(dateOfBirth);

  let age =
    today.getFullYear() -
    dob.getFullYear();

  const monthDifference =
    today.getMonth() -
    dob.getMonth();

  if (
    monthDifference < 0 ||
    (
      monthDifference === 0 &&
      today.getDate() < dob.getDate()
    )
  ) {
    age--;
  }

  return age;
};

const isNumberProvided = (value) =>
  value !== undefined &&
  value !== null &&
  value !== "";

const addEvidence = (
  evidence,
  type,
  description,
  sourceTable,
) => {
  evidence.push({
    type,
    description,
    sourceTable,
  });
};

const searchCandidates = async (
  criteria = {},
  hospitalId,
) => {
  if (!hospitalId) {
    throw new Error(
      "Hospital context is required for ECIS search",
    );
  }

  /*
   * ---------------------------------------------------------
   * 1. RETRIEVE PATIENTS ONLY FROM USER'S HOSPITAL
   * ---------------------------------------------------------
   */

  const patientQuery = `
    SELECT
      p.patient_id,
      p.patient_number,
      p.first_name,
      p.middle_name,
      p.last_name,
      p.date_of_birth,
      p.gender,
      p.blood_group,
      p.height_cm,
      p.weight_kg,
      p.nationality,
      p.primary_phone,
      p.secondary_phone,
      p.occupation,
      p.status,
      p.hospital_id,
      h.hospital_name
    FROM public.patients p
    LEFT JOIN public.hospitals h
      ON h.hospital_id = p.hospital_id
    WHERE p.status = 'ACTIVE'
      AND p.hospital_id = $1
    ORDER BY p.patient_id DESC
    LIMIT 1000
  `;

  const patientResult = await pool.query(
    patientQuery,
    [hospitalId],
  );

  if (patientResult.rows.length === 0) {
    return [];
  }

  const patientIds =
    patientResult.rows.map(
      (patient) => patient.patient_id,
    );

  /*
   * ---------------------------------------------------------
   * 2. LOAD RELATED EHR DATA
   * ---------------------------------------------------------
   */

  const [
    surgeriesResult,
    fracturesResult,
    devicesResult,
    dentalResult,
    observationsResult,
    treatmentsResult,
    investigationsResult,
  ] = await Promise.all([
    pool.query(
      `
      SELECT
        surgery_id,
        patient_id,
        surgery_name,
        surgery_code,
        body_site,
        laterality,
        preoperative_diagnosis,
        surgery_date
      FROM public.surgeries
      WHERE patient_id = ANY($1::bigint[])
      `,
      [patientIds],
    ),

    pool.query(
      `
      SELECT
        fracture_id,
        patient_id,
        body_part,
        laterality,
        fracture_type
      FROM public.fractures
      WHERE patient_id = ANY($1::bigint[])
      `,
      [patientIds],
    ),

    pool.query(
      `
      SELECT
        device_id,
        patient_id,
        device_type,
        device_name,
        manufacturer,
        model_number,
        serial_number,
        body_site,
        laterality,
        implantation_date
      FROM public.medical_devices
      WHERE patient_id = ANY($1::bigint[])
      `,
      [patientIds],
    ),

    pool.query(
      `
      SELECT
        dental_record_id,
        patient_id,
        record_date,
        tooth_number,
        condition
      FROM public.dental_records
      WHERE patient_id = ANY($1::bigint[])
      `,
      [patientIds],
    ),

    pool.query(
      `
      SELECT
        observation_id,
        patient_id,
        observation_type,
        observation_value
      FROM public.clinical_observations
      WHERE patient_id = ANY($1::bigint[])
      `,
      [patientIds],
    ),

    pool.query(
      `
      SELECT
        treatment_id,
        patient_id,
        treatment_type,
        treatment_name,
        description,
        treatment_date
      FROM public.treatment_records
      WHERE patient_id = ANY($1::bigint[])
      `,
      [patientIds],
    ),

    pool.query(
      `
      SELECT
        investigation_id,
        patient_id,
        investigation_type,
        investigation_name,
        result_summary,
        result_value,
        unit,
        reference_range,
        performed_date
      FROM public.investigations
      WHERE patient_id = ANY($1::bigint[])
      `,
      [patientIds],
    ),
  ]);

  /*
   * ---------------------------------------------------------
   * 3. GROUP CLINICAL DATA BY PATIENT
   * ---------------------------------------------------------
   */

  const groupByPatient = (rows) => {
    const grouped = new Map();

    for (const row of rows) {
      if (!grouped.has(row.patient_id)) {
        grouped.set(row.patient_id, []);
      }

      grouped.get(row.patient_id).push(row);
    }

    return grouped;
  };

  const surgeriesByPatient =
    groupByPatient(surgeriesResult.rows);

  const fracturesByPatient =
    groupByPatient(fracturesResult.rows);

  const devicesByPatient =
    groupByPatient(devicesResult.rows);

  const dentalByPatient =
    groupByPatient(dentalResult.rows);

  const observationsByPatient =
    groupByPatient(observationsResult.rows);

  const treatmentsByPatient =
    groupByPatient(treatmentsResult.rows);

  const investigationsByPatient =
    groupByPatient(investigationsResult.rows);

  /*
   * ---------------------------------------------------------
   * 4. SCORE EACH PATIENT
   * ---------------------------------------------------------
   */

  const scoredCandidates = [];

  for (const patient of patientResult.rows) {
    let score = 0;

    const evidence = [];

    /*
     * GENDER
     */

    if (
      criteria.gender &&
      normalize(patient.gender) ===
        normalize(criteria.gender)
    ) {
      score += WEIGHTS.gender;

      addEvidence(
        evidence,
        "Gender",
        `Gender matched: ${patient.gender}`,
        "patients",
      );
    }

    /*
     * BLOOD GROUP
     */

    if (
      criteria.bloodGroup &&
      normalize(patient.blood_group) ===
        normalize(criteria.bloodGroup)
    ) {
      score += WEIGHTS.bloodGroup;

      addEvidence(
        evidence,
        "Blood Group",
        `Blood group matched: ${patient.blood_group}`,
        "patients",
      );
    }

    /*
     * AGE
     */

    const patientAge =
      calculateAge(patient.date_of_birth);

    if (
      (
        isNumberProvided(criteria.ageMin) ||
        isNumberProvided(criteria.ageMax)
      ) &&
      patientAge !== null
    ) {
      const minPassed =
        !isNumberProvided(criteria.ageMin) ||
        patientAge >= Number(criteria.ageMin);

      const maxPassed =
        !isNumberProvided(criteria.ageMax) ||
        patientAge <= Number(criteria.ageMax);

      if (minPassed && maxPassed) {
        score += WEIGHTS.age;

        addEvidence(
          evidence,
          "Age",
          `Age matched: ${patientAge} years`,
          "patients",
        );
      }
    }

    /*
     * HEIGHT
     */

    if (isNumberProvided(patient.height_cm)) {
      const minPassed =
        !isNumberProvided(criteria.heightMin) ||
        Number(patient.height_cm) >=
          Number(criteria.heightMin);

      const maxPassed =
        !isNumberProvided(criteria.heightMax) ||
        Number(patient.height_cm) <=
          Number(criteria.heightMax);

      if (
        (
          isNumberProvided(criteria.heightMin) ||
          isNumberProvided(criteria.heightMax)
        ) &&
        minPassed &&
        maxPassed
      ) {
        score += WEIGHTS.height;

        addEvidence(
          evidence,
          "Height",
          `Height matched: ${patient.height_cm} cm`,
          "patients",
        );
      }
    }

    /*
     * WEIGHT
     */

    if (isNumberProvided(patient.weight_kg)) {
      const minPassed =
        !isNumberProvided(criteria.weightMin) ||
        Number(patient.weight_kg) >=
          Number(criteria.weightMin);

      const maxPassed =
        !isNumberProvided(criteria.weightMax) ||
        Number(patient.weight_kg) <=
          Number(criteria.weightMax);

      if (
        (
          isNumberProvided(criteria.weightMin) ||
          isNumberProvided(criteria.weightMax)
        ) &&
        minPassed &&
        maxPassed
      ) {
        score += WEIGHTS.weight;

        addEvidence(
          evidence,
          "Weight",
          `Weight matched: ${patient.weight_kg} kg`,
          "patients",
        );
      }
    }

    /*
     * NAME
     */

    if (
      criteria.partialName &&
      (
        containsValue(
          patient.first_name,
          criteria.partialName,
        ) ||
        containsValue(
          patient.middle_name,
          criteria.partialName,
        ) ||
        containsValue(
          patient.last_name,
          criteria.partialName,
        )
      )
    ) {
      score += WEIGHTS.name;

      addEvidence(
        evidence,
        "Name",
        "Name clue matched patient name",
        "patients",
      );
    }

    /*
     * PHONE
     */

    if (
      criteria.phoneFragment &&
      (
        containsValue(
          patient.primary_phone,
          criteria.phoneFragment,
        ) ||
        containsValue(
          patient.secondary_phone,
          criteria.phoneFragment,
        )
      )
    ) {
      score += WEIGHTS.phone;

      addEvidence(
        evidence,
        "Phone",
        "Phone fragment matched",
        "patients",
      );
    }

    /*
     * OCCUPATION
     */

    if (
      criteria.workplace &&
      containsValue(
        patient.occupation,
        criteria.workplace,
      )
    ) {
      score += WEIGHTS.occupation;

      addEvidence(
        evidence,
        "Occupation",
        `Occupation matched: ${patient.occupation}`,
        "patients",
      );
    }

    /*
     * SURGERY
     */

    const surgeries =
      surgeriesByPatient.get(
        patient.patient_id,
      ) || [];

    if (criteria.previousSurgery) {
      const matchedSurgery =
        surgeries.find(
          (surgery) =>
            containsValue(
              surgery.surgery_name,
              criteria.previousSurgery,
            ) ||
            containsValue(
              surgery.surgery_code,
              criteria.previousSurgery,
            ) ||
            containsValue(
              surgery.body_site,
              criteria.previousSurgery,
            ) ||
            containsValue(
              surgery.preoperative_diagnosis,
              criteria.previousSurgery,
            ),
        );

      if (matchedSurgery) {
        score += WEIGHTS.surgery;

        addEvidence(
          evidence,
          "Surgery",
          `Previous surgery matched: ${matchedSurgery.surgery_name}`,
          "surgeries",
        );
      }
    }

    /*
     * FRACTURE
     */

    const fractures =
      fracturesByPatient.get(
        patient.patient_id,
      ) || [];

    if (criteria.fracture) {
      const matchedFracture =
        fractures.find(
          (fracture) =>
            containsValue(
              fracture.body_part,
              criteria.fracture,
            ) ||
            containsValue(
              fracture.laterality,
              criteria.fracture,
            ) ||
            containsValue(
              fracture.fracture_type,
              criteria.fracture,
            ),
        );

      if (matchedFracture) {
        score += WEIGHTS.fracture;

        addEvidence(
          evidence,
          "Fracture",
          `Fracture matched: ${matchedFracture.body_part} ${matchedFracture.laterality || ""}`.trim(),
          "fractures",
        );
      }
    }

    /*
     * MEDICAL DEVICE
     */

    const devices =
      devicesByPatient.get(
        patient.patient_id,
      ) || [];

    if (criteria.implantOrDevice) {
      const matchedDevice =
        devices.find(
          (device) =>
            containsValue(
              device.device_type,
              criteria.implantOrDevice,
            ) ||
            containsValue(
              device.device_name,
              criteria.implantOrDevice,
            ) ||
            containsValue(
              device.manufacturer,
              criteria.implantOrDevice,
            ) ||
            containsValue(
              device.model_number,
              criteria.implantOrDevice,
            ) ||
            containsValue(
              device.body_site,
              criteria.implantOrDevice,
            ),
        );

      if (matchedDevice) {
        score += WEIGHTS.device;

        addEvidence(
          evidence,
          "Medical Device",
          `Medical device matched: ${matchedDevice.device_name || matchedDevice.device_type}`,
          "medical_devices",
        );
      }
    }

    /*
     * DENTAL
     */

    const dentalRecords =
      dentalByPatient.get(
        patient.patient_id,
      ) || [];

    if (criteria.dentalClue) {
      const matchedDental =
        dentalRecords.find(
          (record) =>
            containsValue(
              record.tooth_number,
              criteria.dentalClue,
            ) ||
            containsValue(
              record.condition,
              criteria.dentalClue,
            ),
        );

      if (matchedDental) {
        score += WEIGHTS.dental;

        addEvidence(
          evidence,
          "Dental",
          `Dental clue matched: tooth ${matchedDental.tooth_number}, ${matchedDental.condition}`,
          "dental_records",
        );
      }
    }

    /*
     * CLINICAL OBSERVATION
     */

    const observations =
      observationsByPatient.get(
        patient.patient_id,
      ) || [];

    if (criteria.clinicalObservation) {
      const matchedObservation =
        observations.find(
          (observation) =>
            containsValue(
              observation.observation_type,
              criteria.clinicalObservation,
            ) ||
            containsValue(
              observation.observation_value,
              criteria.clinicalObservation,
            ),
        );

      if (matchedObservation) {
        score += WEIGHTS.observation;

        addEvidence(
          evidence,
          "Clinical Observation",
          `${matchedObservation.observation_type}: ${matchedObservation.observation_value}`,
          "clinical_observations",
        );
      }
    }

    /*
     * TREATMENT
     */

    const treatments =
      treatmentsByPatient.get(
        patient.patient_id,
      ) || [];

    if (criteria.treatment) {
      const matchedTreatment =
        treatments.find(
          (treatment) =>
            containsValue(
              treatment.treatment_type,
              criteria.treatment,
            ) ||
            containsValue(
              treatment.treatment_name,
              criteria.treatment,
            ) ||
            containsValue(
              treatment.description,
              criteria.treatment,
            ),
        );

      if (matchedTreatment) {
        score += WEIGHTS.treatment;

        addEvidence(
          evidence,
          "Treatment",
          `Treatment matched: ${matchedTreatment.treatment_name || matchedTreatment.treatment_type}`,
          "treatment_records",
        );
      }
    }

    /*
     * INVESTIGATION
     */

    const investigations =
      investigationsByPatient.get(
        patient.patient_id,
      ) || [];

    if (criteria.investigation) {
      const matchedInvestigation =
        investigations.find(
          (investigation) =>
            containsValue(
              investigation.investigation_type,
              criteria.investigation,
            ) ||
            containsValue(
              investigation.investigation_name,
              criteria.investigation,
            ) ||
            containsValue(
              investigation.result_summary,
              criteria.investigation,
            ) ||
            containsValue(
              investigation.result_value,
              criteria.investigation,
            ),
        );

      if (matchedInvestigation) {
        score += WEIGHTS.investigation;

        addEvidence(
          evidence,
          "Investigation",
          `Investigation matched: ${matchedInvestigation.investigation_name}`,
          "investigations",
        );
      }
    }

    /*
     * Only candidates with at least one matching clue
     * are returned.
     */

    if (score > 0) {
      scoredCandidates.push({
        patientId: patient.patient_id,
        patientNumber: patient.patient_number,
        name: [
          patient.first_name,
          patient.middle_name,
          patient.last_name,
        ]
          .filter(Boolean)
          .join(" "),
        dateOfBirth: patient.date_of_birth,
        age: patientAge,
        gender: patient.gender,
        bloodGroup: patient.blood_group,
        heightCm: patient.height_cm,
        weightKg: patient.weight_kg,
        primaryPhone: patient.primary_phone,
        occupation: patient.occupation,
        nationality: patient.nationality,
        hospitalId: patient.hospital_id,
        hospitalName: patient.hospital_name,
        score,
        evidence,
      });
    }
  }

  /*
   * ---------------------------------------------------------
   * 5. RANK CANDIDATES
   * ---------------------------------------------------------
   */

  scoredCandidates.sort(
    (a, b) => b.score - a.score,
  );

  return scoredCandidates.slice(
    0,
    50,
  );
};

module.exports = {
  searchCandidates,
};