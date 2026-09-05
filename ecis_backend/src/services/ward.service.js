const pool = require("../config/database");

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
      gender_policy
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8
    )
    RETURNING *;
  `;

  const values = [
    hospitalId,
    wardCode,
    wardName,
    wardType || null,
    floor || null,
    location || null,
    capacity ?? 0,
    genderPolicy || null,
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
}

async function getWardsByHospital(hospitalId) {
  const query = `
    SELECT
      w.ward_id,
      w.ward_code,
      w.ward_name,
      w.ward_type,
      w.floor,
      w.location,
      w.capacity,
      w.gender_policy,
      w.is_active,

      COUNT(b.bed_id) AS total_beds,

      COUNT(
        CASE
          WHEN b.status = 'AVAILABLE'
          THEN 1
        END
      ) AS available_beds,

      COUNT(
        CASE
          WHEN b.status = 'OCCUPIED'
          THEN 1
        END
      ) AS occupied_beds,

      COUNT(
        CASE
          WHEN b.status = 'MAINTENANCE'
          THEN 1
        END
      ) AS maintenance_beds

    FROM wards w

    LEFT JOIN beds b
      ON w.ward_id = b.ward_id

    WHERE
      w.hospital_id = $1
      AND w.is_active = TRUE

    GROUP BY
      w.ward_id

    ORDER BY
      w.ward_name ASC;
  `;

  const result = await pool.query(query, [hospitalId]);

  return result.rows;
}

async function createBed(wardId, bedData) {
  const { bedNumber, bedType } = bedData;

  const query = `
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
    RETURNING *;
  `;

  const values = [wardId, bedNumber, bedType || null];

  const result = await pool.query(query, values);

  return result.rows[0];
}

async function getBedsByWard(wardId) {
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
        ' ',
        COALESCE(p.last_name, '')
      ) AS patient_name

    FROM beds b

    LEFT JOIN admissions a
      ON b.bed_id = a.bed_id
      AND a.status = 'ADMITTED'

    LEFT JOIN patients p
      ON a.patient_id = p.patient_id

    WHERE b.ward_id = $1

    ORDER BY b.bed_number ASC;
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
