// One-time setup for a genuinely empty ECIS installation. This never changes
// an existing hospital and does not create staff or patient records.
const pool = require("../src/config/database");
const { createHospital } = require("../src/services/administration.service");

async function main() {
  const hospitalName = String(process.env.ECIS_BOOTSTRAP_HOSPITAL_NAME || "").trim();
  if (!hospitalName) {
    throw new Error("ECIS_BOOTSTRAP_HOSPITAL_NAME is required.");
  }
  const existing = await pool.query("SELECT count(*)::int AS count FROM public.hospitals;");
  if (existing.rows[0].count !== 0) {
    throw new Error("Hospitals already exist. No changes made; manage additional hospitals through Settings.");
  }
  const hospital = await createHospital({
    hospitalName,
    hospitalType: process.env.ECIS_BOOTSTRAP_HOSPITAL_TYPE,
    province: process.env.ECIS_BOOTSTRAP_PROVINCE,
    district: process.env.ECIS_BOOTSTRAP_DISTRICT,
    address: process.env.ECIS_BOOTSTRAP_ADDRESS,
    phone: process.env.ECIS_BOOTSTRAP_PHONE,
    email: process.env.ECIS_BOOTSTRAP_EMAIL,
  });
  console.log(`Created initial hospital ${hospital.hospitalName} (${hospital.hospitalCode}), ID ${hospital.hospitalId}.`);
  console.log(`Set ECIS_BOOTSTRAP_HOSPITAL_ID=${hospital.hospitalId} before provisioning the system administrator.`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => pool.end());
