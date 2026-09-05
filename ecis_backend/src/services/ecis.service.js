const pool = require("../config/database");

/*
 * ECIS Candidate Search
 *
 * ECIS searches the existing longitudinal EHR.
 * It does not create or maintain a second patient identity database.
 *
 * The result is a list of candidate patients with an explainable
 * matching score. Final identity confirmation must be performed
 * by an authorized healthcare staff member.
 */

const searchCandidates = async (criteria = {}) => {
    const values = [];
    const whereConditions = [];

    const addValue = (value) => {
        values.push(value);
        return `$${values.length}`;
    };

    /*
     * ---------------------------------------------------------
     * BASIC PATIENT INFORMATION
     * ---------------------------------------------------------
     */

    if (criteria.gender) {
        const param = addValue(criteria.gender);

        whereConditions.push(`
            p.gender ILIKE ${param}
        `);
    }

    if (criteria.bloodGroup) {
        const param = addValue(criteria.bloodGroup);

        whereConditions.push(`
            p.blood_group ILIKE ${param}
        `);
    }

    if (criteria.partialName) {
        const param = addValue(`%${criteria.partialName}%`);

        whereConditions.push(`
            (
                p.first_name ILIKE ${param}
                OR p.middle_name ILIKE ${param}
                OR p.last_name ILIKE ${param}
                OR CONCAT_WS(
                    ' ',
                    p.first_name,
                    p.middle_name,
                    p.last_name
                ) ILIKE ${param}
            )
        `);
    }

    if (criteria.phoneFragment) {
        const param = addValue(`%${criteria.phoneFragment}%`);

        whereConditions.push(`
            (
                p.primary_phone ILIKE ${param}
                OR p.secondary_phone ILIKE ${param}
            )
        `);
    }

    /*
     * ---------------------------------------------------------
     * AGE
     * ---------------------------------------------------------
     */

    if (
        criteria.ageMin !== undefined &&
        criteria.ageMin !== null
    ) {
        const param = addValue(criteria.ageMin);

        whereConditions.push(`
            EXTRACT(
                YEAR FROM AGE(CURRENT_DATE, p.date_of_birth)
            ) >= ${param}
        `);
    }

    if (
        criteria.ageMax !== undefined &&
        criteria.ageMax !== null
    ) {
        const param = addValue(criteria.ageMax);

        whereConditions.push(`
            EXTRACT(
                YEAR FROM AGE(CURRENT_DATE, p.date_of_birth)
            ) <= ${param}
        `);
    }

    /*
     * ---------------------------------------------------------
     * HEIGHT
     * ---------------------------------------------------------
     */

    if (
        criteria.heightMin !== undefined &&
        criteria.heightMin !== null
    ) {
        const param = addValue(criteria.heightMin);

        whereConditions.push(`
            p.height_cm >= ${param}
        `);
    }

    if (
        criteria.heightMax !== undefined &&
        criteria.heightMax !== null
    ) {
        const param = addValue(criteria.heightMax);

        whereConditions.push(`
            p.height_cm <= ${param}
        `);
    }

    /*
     * ---------------------------------------------------------
     * WEIGHT
     * ---------------------------------------------------------
     */

    if (
        criteria.weightMin !== undefined &&
        criteria.weightMin !== null
    ) {
        const param = addValue(criteria.weightMin);

        whereConditions.push(`
            p.weight_kg >= ${param}
        `);
    }

    if (
        criteria.weightMax !== undefined &&
        criteria.weightMax !== null
    ) {
        const param = addValue(criteria.weightMax);

        whereConditions.push(`
            p.weight_kg <= ${param}
        `);
    }

    /*
     * ---------------------------------------------------------
     * OCCUPATION
     * ---------------------------------------------------------
     *
     * Your patients table already contains occupation, so we
     * don't need patient_employment for the basic workplace clue.
     */

    if (criteria.workplace) {
        const param = addValue(`%${criteria.workplace}%`);

        whereConditions.push(`
            p.occupation ILIKE ${param}
        `);
    }

    /*
     * ---------------------------------------------------------
     * CLINICAL HISTORY FILTERS
     * ---------------------------------------------------------
     */

    if (criteria.previousSurgery) {
        const param = addValue(`%${criteria.previousSurgery}%`);

        whereConditions.push(`
            EXISTS (
                SELECT 1
                FROM surgeries s
                WHERE s.patient_id = p.patient_id
                  AND (
                      s.surgery_name ILIKE ${param}
                      OR s.body_site ILIKE ${param}
                      OR s.preoperative_diagnosis ILIKE ${param}
                  )
            )
        `);
    }

    if (criteria.fracture) {
        const param = addValue(`%${criteria.fracture}%`);

        whereConditions.push(`
            EXISTS (
                SELECT 1
                FROM fractures f
                WHERE f.patient_id = p.patient_id
                  AND (
                      f.body_part ILIKE ${param}
                      OR f.laterality ILIKE ${param}
                      OR f.fracture_type ILIKE ${param}
                  )
            )
        `);
    }

    if (criteria.implantOrDevice) {
        const param = addValue(`%${criteria.implantOrDevice}%`);

        whereConditions.push(`
            EXISTS (
                SELECT 1
                FROM medical_devices md
                WHERE md.patient_id = p.patient_id
                  AND (
                      md.device_type ILIKE ${param}
                      OR md.device_name ILIKE ${param}
                      OR md.manufacturer ILIKE ${param}
                      OR md.model_number ILIKE ${param}
                      OR md.body_site ILIKE ${param}
                  )
            )
        `);
    }

    if (criteria.dentalClue) {
        const param = addValue(`%${criteria.dentalClue}%`);

        whereConditions.push(`
            EXISTS (
                SELECT 1
                FROM dental_records dr
                WHERE dr.patient_id = p.patient_id
                  AND (
                      dr.tooth_number ILIKE ${param}
                      OR dr.condition ILIKE ${param}
                  )
            )
        `);
    }

    if (criteria.clinicalObservation) {
        const param = addValue(`%${criteria.clinicalObservation}%`);

        whereConditions.push(`
            EXISTS (
                SELECT 1
                FROM clinical_observations co
                WHERE co.patient_id = p.patient_id
                  AND (
                      co.observation_type ILIKE ${param}
                      OR co.observation_value ILIKE ${param}
                  )
            )
        `);
    }

    if (criteria.treatment) {
        const param = addValue(`%${criteria.treatment}%`);

        whereConditions.push(`
            EXISTS (
                SELECT 1
                FROM treatment_records tr
                WHERE tr.patient_id = p.patient_id
                  AND (
                      tr.treatment_type ILIKE ${param}
                      OR tr.treatment_name ILIKE ${param}
                      OR tr.description ILIKE ${param}
                  )
            )
        `);
    }

    if (criteria.investigation) {
        const param = addValue(`%${criteria.investigation}%`);

        whereConditions.push(`
            EXISTS (
                SELECT 1
                FROM investigations i
                WHERE i.patient_id = p.patient_id
                  AND (
                      i.investigation_type ILIKE ${param}
                      OR i.investigation_name ILIKE ${param}
                      OR i.result_summary ILIKE ${param}
                      OR i.result_value ILIKE ${param}
                  )
            )
        `);
    }

    /*
     * ---------------------------------------------------------
     * MAIN QUERY
     * ---------------------------------------------------------
     *
     * EXISTS is deliberately used for one-to-many clinical
     * tables to avoid row multiplication.
     */

    let query = `
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
        FROM patients p
        LEFT JOIN hospitals h
            ON h.hospital_id = p.hospital_id
    `;

    if (whereConditions.length > 0) {
        query += `
            WHERE ${whereConditions.join(" AND ")}
        `;
    }

    query += `
        ORDER BY p.patient_id DESC
        LIMIT 100
    `;

    const result = await pool.query(query, values);

    return result.rows;
};

module.exports = {
    searchCandidates,
};