const pool = require("../config/database");

/**
 * Create a hospital ward.
 *
 * hospitalId MUST come from the authenticated user.
 * It should never be trusted from the frontend request body.
 */
async function createWard(wardData) {
  const {
    hospitalId,
    wardCode,
    wardName,
    wardType,
    floor,
    location,
    capacity,
    genderPolicy,
  } = wardData;

  const query = `
    INSERT INTO wards (
      hospital_id,
      ward_code,
      ward_name,
      ward_type,
      floor,
      location,
      capacity,
      gender_policy,
      is_active
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      TRUE
    )
    RETURNING
      ward_id,
      hospital_id,
      ward_code,
      ward_name,
      ward_type,
      floor,
      location,
      capacity,
      gender_policy,
      is_active;
  `;

  const values = [
    hospitalId,
    wardCode,
    wardName,
    wardType || null,
    floor || null,
    location || null,
    capacity,
    genderPolicy || null,
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
}

/**
 * Get active wards belonging only to the authenticated hospital.
 */
async function getWardsByHospital(hospitalId) {
  const query = `
    SELECT
      w.ward_id,
      w.hospital_id,
      w.ward_code,
      w.ward_name,
      w.ward_type,
      w.floor,
      w.location,
      w.capacity,
      w.gender_policy,
      w.is_active,

      COUNT(b.bed_id)::INTEGER AS total_beds,

      COUNT(
        CASE
          WHEN b.status = 'AVAILABLE'
          THEN 1
        END
      )::INTEGER AS available_beds,

      COUNT(
        CASE
          WHEN b.status = 'OCCUPIED'
          THEN 1
        END
      )::INTEGER AS occupied_beds,

      COUNT(
        CASE
          WHEN b.status = 'MAINTENANCE'
          THEN 1
        END
      )::INTEGER AS maintenance_beds

    FROM wards w

    LEFT JOIN beds b
      ON b.ward_id = w.ward_id

    WHERE
      w.hospital_id = $1
      AND w.is_active = TRUE

    GROUP BY
      w.ward_id,
      w.hospital_id,
      w.ward_code,
      w.ward_name,
      w.ward_type,
      w.floor,
      w.location,
      w.capacity,
      w.gender_policy,
      w.is_active

    ORDER BY
      w.ward_name ASC;
  `;

  const result = await pool.query(query, [hospitalId]);

  return result.rows;
}

/**
 * Create a bed inside a ward.
 *
 * Before creating the bed we verify:
 *
 * 1. Ward exists.
 * 2. Ward belongs to authenticated hospital.
 * 3. Ward is active.
 * 4. Ward capacity has not been reached.
 */
async function createBed(hospitalId, wardId, bedData) {
  const { bedNumber, bedType } = bedData;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /*
     * Lock the ward while checking capacity.
     * This prevents two simultaneous requests from
     * creating beds beyond the ward capacity.
     */
    const wardResult = await client.query(
      `
        SELECT
          ward_id,
          hospital_id,
          capacity,
          is_active
        FROM wards
        WHERE
          ward_id = $1
          AND hospital_id = $2
          AND is_active = TRUE
        FOR UPDATE;
      `,
      [wardId, hospitalId],
    );

    if (wardResult.rowCount === 0) {
      throw new Error("Ward not found or inactive.");
    }

    const ward = wardResult.rows[0];

    const bedCountResult = await client.query(
      `
        SELECT COUNT(*)::INTEGER AS bed_count
        FROM beds
        WHERE ward_id = $1;
      `,
      [wardId],
    );

    const currentBedCount = Number(
      bedCountResult.rows[0]?.bed_count || 0,
    );

    const capacity = Number(ward.capacity || 0);

    if (currentBedCount >= capacity) {
      throw new Error(
        "Ward capacity has already been reached.",
      );
    }

    const bedResult = await client.query(
      `
        INSERT INTO beds (
          ward_id,
          bed_number,
          bed_type,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          'AVAILABLE'
        )
        RETURNING
          bed_id,
          ward_id,
          bed_number,
          bed_type,
          status;
      `,
      [
        wardId,
        bedNumber,
        bedType || null,
      ],
    );

    await client.query("COMMIT");

    return bedResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get all beds for a ward.
 *
 * The ward is first verified against the authenticated
 * hospital so another hospital cannot access its beds.
 */
async function getBedsByWard(hospitalId, wardId) {
  const wardResult = await pool.query(
    `
      SELECT
        ward_id
      FROM wards
      WHERE
        ward_id = $1
        AND hospital_id = $2
        AND is_active = TRUE;
    `,
    [wardId, hospitalId],
  );

  if (wardResult.rowCount === 0) {
    throw new Error("Ward not found or inactive.");
  }

  const query = `
    SELECT
      b.bed_id,
      b.ward_id,
      b.bed_number,
      b.bed_type,
      b.status,

      a.admission_id,
      a.admission_number,

      p.patient_id,
      p.patient_number,

      CONCAT(
        p.first_name,
        CASE
          WHEN p.last_name IS NOT NULL
            AND TRIM(p.last_name) <> ''
          THEN ' ' || p.last_name
          ELSE ''
        END
      ) AS patient_name

    FROM beds b

    LEFT JOIN LATERAL (
      SELECT
        a.admission_id,
        a.admission_number,
        a.patient_id
      FROM admissions a
      WHERE
        a.bed_id = b.bed_id
        AND a.status = 'ADMITTED'
      ORDER BY
        a.admission_date DESC
      LIMIT 1
    ) a
      ON TRUE

    LEFT JOIN patients p
      ON p.patient_id = a.patient_id

    WHERE
      b.ward_id = $1

    ORDER BY
      b.bed_number ASC;
  `;

  const result = await pool.query(query, [wardId]);

  return result.rows;
}

module.exports = {
  createWard,
  getWardsByHospital,
  createBed,
  getBedsByWard,
};