const crypto = require("crypto");
const pool = require("../config/database");

function positiveInteger(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return number;
}

async function findStoredImageMatches(imageBuffer, hospitalIdValue) {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    throw new Error("An image is required for the search.");
  }

  const hospitalId = positiveInteger(hospitalIdValue, "hospitalId");
  const checksum = crypto.createHash("sha256").update(imageBuffer).digest("hex");
  const result = await pool.query(
    `SELECT
       ri.radiology_image_id AS image_id,
       ri.uploaded_at,
       p.patient_id,
       p.patient_number,
       CONCAT_WS(' ', p.first_name, NULLIF(p.middle_name, ''), p.last_name) AS patient_name,
       i.investigation_id,
       i.investigation_name,
       i.status AS investigation_status,
       i.performed_date,
       CASE WHEN i.status = 'VERIFIED' THEN NULLIF(i.result_summary, '')
            ELSE NULL END AS verified_report_summary
     FROM public.radiology_images ri
     JOIN public.investigations i
       ON i.investigation_id = ri.investigation_id
      AND i.patient_id = ri.patient_id
     JOIN public.encounters e
       ON e.encounter_id = i.encounter_id
      AND e.patient_id = i.patient_id
     JOIN public.patients p ON p.patient_id = ri.patient_id
     WHERE ri.checksum_sha256 = $1
       AND ri.hospital_id = $2
       AND e.hospital_id = $2
       AND ri.is_active = TRUE
       AND i.investigation_type = 'IMAGING'
       AND p.status = 'ACTIVE'
       AND p.date_of_birth <= CURRENT_DATE - INTERVAL '18 years'
       AND EXISTS (
         SELECT 1 FROM public.patient_hospital_registrations phr
         WHERE phr.patient_id = p.patient_id
           AND phr.hospital_id = $2
           AND phr.status = 'ACTIVE'
       )
     ORDER BY ri.uploaded_at DESC, ri.radiology_image_id DESC
     LIMIT 20;`,
    [checksum, hospitalId],
  );

  return result.rows.map((row) => ({
    imageId: Number(row.image_id),
    uploadedAt: row.uploaded_at,
    patientId: Number(row.patient_id),
    patientNumber: row.patient_number,
    patientName: row.patient_name,
    investigationId: Number(row.investigation_id),
    investigationName: row.investigation_name,
    investigationStatus: row.investigation_status,
    performedDate: row.performed_date,
    verifiedReportSummary: row.verified_report_summary,
  }));
}

module.exports = { findStoredImageMatches };
