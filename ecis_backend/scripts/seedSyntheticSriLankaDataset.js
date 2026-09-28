/*
 * Load a clearly labelled, fictional Sri Lankan training dataset into the
 * local ECIS database. This script only inserts rows; it never deletes or
 * updates existing patient/clinical records. Generated content is not real
 * health information and must never be used for clinical care.
 *
 * Run from ecis_backend: node scripts/seedSyntheticSriLankaDataset.js --execute
 */

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const pool = require("../src/config/database");
const { SRI_LANKA_LOCATIONS } = require("../src/config/sriLankaLocations");

const PATIENT_COUNT = 3000;
const MARKER = "SYNTHETIC TRAINING ONLY — NOT FOR CLINICAL CARE";
const DATA_TABLES = [
  "patients", "patient_hospital_registrations", "patient_allergies", "patient_conditions",
  "encounters", "opd_visits", "clinic_visits", "emergency_cases", "emergency_case_locations",
  "admissions", "bht_entries", "clinical_observations", "treatment_records", "investigations",
  "medication_orders", "surgeries", "procedures", "fractures", "dental_records", "medical_devices",
];

const NAMES = {
  Sinhala: {
    male: ["Nimal", "Kasun", "Ruwan", "Chaminda", "Lahiru", "Dinesh", "Sahan", "Chathura", "Nuwan", "Pradeep", "Ajith", "Anura", "Sanjaya", "Tharindu", "Isuru", "Supun", "Mahesh", "Gayan", "Ashan", "Roshan", "Thisara", "Harsha", "Buddhika", "Ramesh", "Suranga", "Chinthaka", "Eranga", "Kanishka", "Thilak", "Chamal"],
    female: ["Anjali", "Anusha", "Dilini", "Ishara", "Nadeesha", "Sachini", "Sanduni", "Tharushi", "Hasini", "Kaushalya", "Sewwandi", "Madushani", "Lakshika", "Chamari", "Upeksha", "Pradeepa", "Malini", "Nirasha", "Harshani", "Thilini", "Imesha", "Piumi", "Oshadi", "Dinithi", "Kavindi", "Chathuri", "Madhavi", "Himashi", "Rashmi", "Gayani"],
    middle: ["Chandima", "Saman", "Nirosha", "Ranjith", "Sandamali", "Malith", "Lakmini", "Priyantha", "Wasantha", "Nimali"],
    surnames: ["Perera", "Silva", "Fernando", "Jayawardena", "Wickramasinghe", "Bandara", "Rajapaksha", "Gunasekara", "Abeysekara", "Herath", "Senanayake", "Karunaratne", "Samarasinghe", "Wijesinghe", "Dissanayake", "Kulatunga", "Ranasinghe", "Ekanayake", "Amarasinghe", "De Silva", "Gamage", "Pathirana", "Weerasinghe", "Jayasuriya", "Mendis", "Peiris", "Wijeratne", "Kumara", "Ariyaratne", "Kariyawasam"],
  },
  Tamil: {
    male: ["Arun", "Suthan", "Ketheeswaran", "Tharshan", "Pradeepan", "Vijay", "Suren", "Niroshan", "Thileep", "Mathan", "Rajan", "Gajan", "Praveen", "Kishan", "Haran", "Vimal", "Nithushan", "Siva", "Kugathasan", "Thivakaran", "Mahendran", "Gowtham", "Yoganathan", "Jegan", "Karthik", "Vithushan", "Ramesh", "Sathish", "Naveen", "Sivakumar"],
    female: ["Kavitha", "Nivetha", "Tharmini", "Mathumitha", "Shalini", "Priya", "Vithya", "Tharani", "Dharshini", "Jeevitha", "Kanmani", "Iniya", "Narmatha", "Yogitha", "Pavithra", "Revathi", "Shobana", "Sangeetha", "Abinaya", "Anushiya", "Malar", "Niroja", "Kokila", "Lavanya", "Sujitha", "Vimala", "Thilaga", "Harini", "Janani", "Kowsalya"],
    middle: ["Arul", "Devi", "Kumaran", "Saraswathy", "Nadarajah", "Thilaka", "Selvi", "Sivakumar", "Malarvizhi", "Sankari"],
    surnames: ["Nadarajah", "Sivanesan", "Thirunavukarasu", "Kanagaratnam", "Sivarajah", "Arulanantham", "Rajendram", "Tharmalingam", "Mahendran", "Gnanasekaram", "Navaratnam", "Balasubramaniam", "Selvarajah", "Kugathasan", "Jeyakumar", "Ratnam", "Santhirakumar", "Manoharan", "Arokiam", "Pararajasingam", "Sivapalan", "Yogaratnam", "Suthakaran", "Vijayakumar", "Thiruchelvam", "Sinnathurai", "Raveendran", "Ponniah", "Kanthan", "Thangarajah"],
  },
  Muslim: {
    male: ["Ahamed", "Mohamed", "Rizwan", "Muneer", "Imran", "Faris", "Naleem", "Ashraff", "Irfan", "Fawzan", "Rameez", "Akeel", "Niyas", "Fairoz", "Rilwan", "Anees", "Nizam", "Mifras", "Shihan", "Zuhair", "Hisham", "Aazim", "Rifky", "Nafras", "Sajith", "Amaan", "Ashik", "Rauf", "Faizal", "Nashath"],
    female: ["Fathima", "Ayesha", "Nazeera", "Farzana", "Rizana", "Zainab", "Rifka", "Nuzla", "Inshira", "Nafeesa", "Shakira", "Rashida", "Nishara", "Hafsa", "Muneera", "Fauzuna", "Sameera", "Nihma", "Sajina", "Amina", "Haniya", "Nashra", "Rifna", "Shifana", "Nawra", "Asma", "Zuhra", "Aroosa", "Safna", "Fairoosa"],
    middle: ["Ahamed", "Rizwana", "Naleem", "Fathima", "Rauf", "Nazeera", "Mohamed", "Rifka", "Muneer", "Sameera"],
    surnames: ["Mohamed", "Ahamed", "Rauf", "Naleem", "Cassim", "Mowlana", "Majeed", "Marikkar", "Haniffa", "Rizwan", "Fareed", "Mubarak", "Ibrahim", "Ismail", "Fairoz", "Rifky", "Niyas", "Rameez", "Ashraff", "Jiffry", "Rahman", "Hameed", "Faizal", "Mifras", "Nazar", "Husain", "Sulaiman", "Noor", "Nizam", "Mansoor"],
  },
  Burgher: {
    male: ["Michael", "Anton", "David", "Thomas", "Rohan", "Derrick", "Julian", "Mark", "Peter", "Roy"],
    female: ["Ann", "Theresa", "Michelle", "Shanthi", "Rita", "Marina", "Angela", "Daphne", "Nadine", "Melanie"],
    middle: ["Joseph", "Mary", "Anthony", "Louise", "Noel", "Grace", "Francis", "Rose", "Edward", "Irene"],
    surnames: ["Van Dort", "De Croos", "Brito", "Mack", "Leembruggen", "Elliot", "Pietersz", "De Zoysa", "Ondaatje", "Keuneman"],
  },
};

const DISTRICT_TOWNS = {
  Colombo: ["Colombo", "Nugegoda", "Maharagama", "Dehiwala", "Moratuwa", "Homagama"],
  Gampaha: ["Gampaha", "Negombo", "Wattala", "Kadawatha", "Ja-Ela", "Minuwangoda"],
  Kalutara: ["Kalutara", "Panadura", "Horana", "Beruwala", "Matugama"],
  Kandy: ["Kandy", "Peradeniya", "Katugastota", "Gampola", "Kundasale"],
  Matale: ["Matale", "Dambulla", "Galewela", "Ukuwela"],
  "Nuwara Eliya": ["Nuwara Eliya", "Hatton", "Talawakele", "Ginigathhena"],
  Galle: ["Galle", "Ambalangoda", "Hikkaduwa", "Elpitiya"],
  Matara: ["Matara", "Weligama", "Akuressa", "Dikwella"],
  Hambantota: ["Hambantota", "Tangalle", "Beliatta", "Tissamaharama"],
  Jaffna: ["Jaffna", "Chavakachcheri", "Point Pedro", "Nallur"],
  Batticaloa: ["Batticaloa", "Eravur", "Kattankudy", "Valaichchenai"],
  Ampara: ["Ampara", "Kalmunai", "Akkaraipattu", "Pottuvil"],
  Trincomalee: ["Trincomalee", "Kinniya", "Mutur", "Kantale"],
  Kurunegala: ["Kurunegala", "Kuliyapitiya", "Narammala", "Wariyapola"],
  Puttalam: ["Puttalam", "Chilaw", "Wennappuwa", "Anamaduwa"],
  Anuradhapura: ["Anuradhapura", "Kekirawa", "Medawachchiya", "Mihintale"],
  Polonnaruwa: ["Polonnaruwa", "Hingurakgoda", "Kaduruwela", "Medirigiriya"],
  Badulla: ["Badulla", "Bandarawela", "Haputale", "Mahiyanganaya"],
  Monaragala: ["Monaragala", "Wellawaya", "Bibile", "Buttala"],
  Ratnapura: ["Ratnapura", "Balangoda", "Embilipitiya", "Pelmadulla"],
  Kegalle: ["Kegalle", "Mawanella", "Rambukkana", "Warakapola"],
  Kilinochchi: ["Kilinochchi", "Pallai", "Poonakary"],
  Mannar: ["Mannar", "Nanattan", "Madhu"],
  Mullaitivu: ["Mullaitivu", "Puthukkudiyiruppu", "Oddusuddan"],
  Vavuniya: ["Vavuniya", "Nedunkeni", "Cheddikulam"],
};

const STREETS = ["Lake View Lane", "Temple Road", "Station Road", "Garden Lane", "School Lane", "Market Road", "Park Avenue", "Flower Road", "New Town Road", "Church Road", "Wewa Road", "River View Road", "Library Road", "Hillcrest Avenue"];
const OCCUPATIONS = ["Teacher", "Agricultural worker", "Nurse", "Driver", "Shop owner", "Accountant", "Office administrator", "Engineer", "Fisher", "Tailor", "University student", "Construction worker", "Public servant", "Chef", "Technician", "Retired", "Small business owner", "Estate worker", "Clerk", "Home duties"];
const BLOOD_GROUPS = ["O+", "O+", "O+", "B+", "B+", "A+", "A+", "AB+", "O-", "B-", "A-", "AB-"];
const PROFILES = [
  ["Blood pressure follow-up", "Hypertension review", "Blood pressure review and lifestyle follow-up"],
  ["Routine diabetes follow-up", "Type 2 diabetes mellitus", "Longitudinal glucose review in a fictional training case"],
  ["Intermittent headache", "Recurrent headache", "Headache history documented for training"],
  ["Cough and sore throat", "Acute upper respiratory symptoms", "Short-duration respiratory symptoms in a fictional case"],
  ["Upper abdominal discomfort", "Dyspepsia", "Dietary and symptom history in a synthetic scenario"],
  ["Itchy skin rash", "Dermatitis", "Skin symptoms documented for software training"],
  ["Knee pain on walking", "Knee osteoarthritis", "Mobility and pain history in the synthetic record"],
  ["Low back discomfort", "Mechanical back pain", "Back symptoms documented for training"],
  ["Wheeze with exertion", "Asthma follow-up", "Respiratory symptom review in a fictional record"],
  ["Dizziness on standing", "Postural dizziness", "Symptom and hydration history documented for training"],
  ["Follow-up after minor injury", "Soft tissue injury", "Recovery review for a synthetic visit"],
  ["Routine medication review", "Chronic disease follow-up", "Medication-reconciliation scenario; fictional details only"],
];

const MEDICATIONS = [
  { name: "Paracetamol", strength: "500 mg tablet", dosage: "1 tablet", route: "ORAL", frequency: "As required, up to every 6 hours", quantity: 16, unit: "tablets", duration: 4 },
  { name: "Metformin", strength: "500 mg tablet", dosage: "1 tablet", route: "ORAL", frequency: "Twice daily with meals", quantity: 60, unit: "tablets", duration: 30 },
  { name: "Amlodipine", strength: "5 mg tablet", dosage: "1 tablet", route: "ORAL", frequency: "Once daily", quantity: 30, unit: "tablets", duration: 30 },
  { name: "Cetirizine", strength: "10 mg tablet", dosage: "1 tablet", route: "ORAL", frequency: "Once daily", quantity: 10, unit: "tablets", duration: 10 },
  { name: "Omeprazole", strength: "20 mg capsule", dosage: "1 capsule", route: "ORAL", frequency: "Once daily before breakfast", quantity: 14, unit: "capsules", duration: 14 },
  { name: "Salbutamol inhaler", strength: "100 micrograms per actuation", dosage: "1–2 puffs", route: "INHALATION", frequency: "As required", quantity: 1, unit: "inhaler", duration: 30 },
];

function random(seed, salt = 0) {
  const value = Math.sin((seed + 1) * 12.9898 + (salt + 1) * 78.233) * 43758.5453;
  return Math.floor((value - Math.floor(value)) * 1000000);
}

function pick(array, seed, salt = 0) {
  return array[random(seed, salt) % array.length];
}

function ts(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function dstr(date) {
  return date.toISOString().slice(0, 10);
}

function ago(days, hour = 9) {
  const date = new Date();
  date.setUTCHours(hour, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function after(date, days, hour = date.getUTCHours()) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  result.setUTCHours(hour, 0, 0, 0);
  return result;
}

function training(text) {
  return `${MARKER}. ${text}`;
}

function makePatient(index, cultureCounts) {
  const culture = index < 2250 ? "Sinhala" : index < 2700 ? "Tamil" : index < 2970 ? "Muslim" : "Burgher";
  const genderRoll = random(index, 1) % 100;
  const gender = genderRoll < 49 ? "Female" : genderRoll < 98 ? "Male" : "Other";
  const nameGender = gender === "Other" ? (index % 2 ? "Female" : "Male") : gender;
  const localIndex = cultureCounts[culture]++;
  const names = NAMES[culture];
  const givenNames = nameGender === "Female" ? names.female : names.male;
  const firstName = givenNames[localIndex % givenNames.length];
  const middleName = names.middle[Math.floor(localIndex / givenNames.length) % names.middle.length];
  const lastName = names.surnames[Math.floor(localIndex / (givenNames.length * names.middle.length)) % names.surnames.length];
  const age = 18 + random(index, 3) % 68;
  const today = new Date();
  const birthMonth = random(index, 4) % 12;
  const birthDay = 1 + random(index, 5) % 28;
  let birthYear = today.getUTCFullYear() - age;
  if (birthMonth > today.getUTCMonth() || (birthMonth === today.getUTCMonth() && birthDay > today.getUTCDate())) birthYear -= 1;
  const dob = new Date(Date.UTC(birthYear, birthMonth, birthDay, 12));
  const province = pick(Object.keys(SRI_LANKA_LOCATIONS), index, 7);
  const district = pick(SRI_LANKA_LOCATIONS[province], index, 8);
  const town = pick(DISTRICT_TOWNS[district] || [district], index, 9);
  const heightBase = gender === "Male" ? 171 : gender === "Female" ? 159 : 165;
  const height = heightBase + random(index, 12) % 25 - 12;
  const bmi = 19 + (random(index, 13) % 1400) / 100;

  return {
    index,
    number: `P${String(index + 1).padStart(6, "0")}`,
    firstName,
    middleName,
    lastName,
    gender,
    dob: dstr(dob),
    age,
    blood: pick(BLOOD_GROUPS, index, 15),
    height,
    weight: Math.round(bmi * (height / 100) ** 2 * 10) / 10,
    nationality: "Sri Lankan",
    occupation: pick(OCCUPATIONS, index, 16),
    province,
    district,
    address: `No. ${1 + random(index, 11) % 248}, ${pick(STREETS, index, 10)}, ${town}`,
    email: `patient${String(index + 1).padStart(4, "0")}@example.invalid`,
    registrationDate: ago(1000 + random(index, 14) % 400, 10 + index % 8),
    profile: PROFILES[random(index, 17) % PROFILES.length],
  };
}

function makeEvent(plan, kind, type, date, department, complaint, status = "COMPLETED") {
  const key = `E${String(plan.patient.index + 1).padStart(4, "0")}${String(plan.events.length + 1).padStart(2, "0")}`;
  const event = { key, kind, type, date, department, complaint, status, patient: plan.patient };
  plan.events.push(event);
  return event;
}

async function insertRows(client, table, columns, rows, returning = "") {
  const returned = [];
  for (let offset = 0; offset < rows.length; offset += 350) {
    const values = [];
    const groups = rows.slice(offset, offset + 350).map((row) => `(${row.map((value) => {
      values.push(value);
      return `$${values.length}`;
    }).join(", ")})`);
    if (!groups.length) continue;
    const result = await client.query(
      `INSERT INTO public.${table} (${columns.join(", ")}) VALUES ${groups.join(", ")}${returning ? ` RETURNING ${returning}` : ""};`,
      values,
    );
    if (returning) returned.push(...result.rows);
  }
  return returned;
}

function mapRows(rows, key, prefix) {
  return new Map(rows.map((row) => [String(row[key]), row]));
}

async function assertSafeDatabase(client) {
  if (!process.argv.includes("--execute")) throw new Error("No changes made. Pass --execute to insert this training dataset.");
  const target = await client.query("SELECT current_database() AS name, inet_server_addr()::text AS address, current_setting('transaction_read_only') AS read_only;");
  const connection = target.rows[0];
  if (connection.name !== "ecis_ehr" || !["::1/128", "127.0.0.1/32"].includes(connection.address) || connection.read_only !== "off") {
    throw new Error("Safety stop: seeding is restricted to a writable local loopback ecis_ehr database.");
  }
  const counts = await client.query(
    `SELECT ${DATA_TABLES.map((table, index) => `(SELECT COUNT(*)::int FROM public.${table}) AS c${index}`).join(", ")};`,
  );
  const occupied = DATA_TABLES.filter((table, index) => counts.rows[0][`c${index}`] !== 0);
  if (occupied.length) throw new Error(`Safety stop: existing data found in ${occupied.join(", ")}; nothing was modified.`);
  const hospitals = await client.query("SELECT hospital_id FROM public.hospitals WHERE is_active = TRUE ORDER BY hospital_id;");
  if (hospitals.rowCount !== 1) throw new Error("Safety stop: expected one active hospital to avoid inserting into the wrong tenant.");
  const actor = await client.query("SELECT 1 FROM public.hospital_users WHERE username = 'synthetic.dataset.generator' OR employee_number = 'SYNTHETIC-DATASET-001' LIMIT 1;");
  if (actor.rowCount) throw new Error("Safety stop: the synthetic dataset actor already exists.");
}

async function seed() {
  const client = await pool.connect();
  let open = false;
  try {
    await client.query("BEGIN");
    open = true;
    await client.query("SELECT pg_advisory_xact_lock(9130473);");
    await assertSafeDatabase(client);

    const hospitalResult = await client.query("SELECT hospital_id FROM public.hospitals WHERE is_active = TRUE LIMIT 1 FOR SHARE;");
    const hospitalId = Number(hospitalResult.rows[0].hospital_id);
    const clinicResult = await client.query("SELECT clinic_id, clinic_code, clinic_name, specialty FROM public.clinics WHERE hospital_id = $1 AND is_active = TRUE ORDER BY clinic_id;", [hospitalId]);
    if (!clinicResult.rowCount) throw new Error("No active clinic exists for the selected hospital.");
    const clinics = clinicResult.rows.map((row) => ({ id: Number(row.clinic_id), code: row.clinic_code, name: row.clinic_name, specialty: row.specialty || row.clinic_name }));

    const bedResult = await client.query(`
      SELECT w.ward_id,w.ward_type,w.gender_policy,b.bed_id
      FROM public.wards w JOIN public.beds b USING (ward_id)
      WHERE w.hospital_id=$1 AND w.is_active=TRUE AND b.status='AVAILABLE'
        AND UPPER(COALESCE(w.ward_type,'')) NOT IN ('EMERGENCY','ICU')
      ORDER BY w.ward_id,b.bed_id;
    `, [hospitalId]);
    const inpatientBeds = bedResult.rows.map((row) => ({ wardId: Number(row.ward_id), bedId: Number(row.bed_id), genderPolicy: String(row.gender_policy || "MIXED").toUpperCase() }));
    const emergencyBeds = await client.query(`
      SELECT b.bed_id FROM public.wards w JOIN public.beds b USING (ward_id)
      WHERE w.hospital_id=$1 AND w.is_active=TRUE AND b.status='AVAILABLE'
        AND UPPER(COALESCE(w.ward_type,''))='EMERGENCY'
      ORDER BY b.bed_id;
    `, [hospitalId]);
    if (inpatientBeds.length < 20 || emergencyBeds.rowCount < 1) throw new Error("Available inpatient and emergency beds are required before seeding.");

    const allergyResult = await client.query("SELECT allergy_id,allergy_name,allergy_category FROM public.allergies;");
    const allergyIds = new Map(allergyResult.rows.map((row) => [`${row.allergy_category}:${row.allergy_name.toLowerCase()}`, Number(row.allergy_id)]));
    const conditionsResult = await client.query("SELECT condition_id,condition_name FROM public.medical_conditions ORDER BY condition_id;");
    const conditionIds = new Map();
    for (const row of conditionsResult.rows) if (!conditionIds.has(row.condition_name.trim().toLowerCase())) conditionIds.set(row.condition_name.trim().toLowerCase(), Number(row.condition_id));
    for (const name of ["Hypertension", "Diabetes Mellitus", "Asthma", "Migraine", "Chronic Back Pain", "Cardiac Arrhythmia"]) {
      if (!conditionIds.has(name.toLowerCase())) throw new Error(`Required condition reference is missing: ${name}.`);
    }

    const passwordHash = await bcrypt.hash(crypto.randomBytes(48).toString("hex"), 12);
    const actorResult = await client.query(`
      INSERT INTO public.hospital_users (hospital_id,employee_number,full_name,username,password_hash,role,department,is_active)
      VALUES ($1,'SYNTHETIC-DATASET-001','Synthetic Dataset Generator (Not a Clinician)',
        'synthetic.dataset.generator',$2,'DATASET_GENERATOR','Synthetic training records only',TRUE)
      RETURNING user_id;
    `, [hospitalId, passwordHash]);
    const actorId = Number(actorResult.rows[0].user_id);

    const cultureCounts = { Sinhala: 0, Tamil: 0, Muslim: 0, Burgher: 0 };
    const patients = Array.from({ length: PATIENT_COUNT }, (_, index) => makePatient(index, cultureCounts));
    const nameSet = new Set(patients.map((p) => `${p.firstName}|${p.middleName}|${p.lastName}`.toLowerCase()));
    if (nameSet.size !== PATIENT_COUNT) throw new Error(`Expected 3,000 distinct names but generated ${nameSet.size}.`);

    for (const patient of patients) {
      patient.unknownAllergy = patient.index % 29 === 0;
      patient.foodAllergy = !patient.unknownAllergy && patient.index % 6 === 0;
      patient.drugAllergy = !patient.unknownAllergy && patient.index % 10 === 1;
      patient.allergyStatus = patient.unknownAllergy ? "UNKNOWN" : patient.foodAllergy || patient.drugAllergy ? "HAS_ALLERGIES" : "NO_KNOWN_ALLERGIES";
    }

    const patientRows = patients.map((p) => [
      hospitalId, p.number, null, null, p.firstName, p.middleName, p.lastName, p.dob, p.gender, p.blood,
      p.height, p.weight, p.allergyStatus, "Sri Lankan", null, null, p.email, p.occupation,
      p.address, p.province, p.district,
      training("Fictional demographics for application training. Not copied from real patient records; NIC and telephone numbers are intentionally blank."),
      "ACTIVE", ts(p.registrationDate), ts(p.registrationDate),
    ]);
    const insertedPatients = await insertRows(client, "patients", [
      "hospital_id", "patient_number", "nic_number", "passport_number", "first_name", "middle_name", "last_name", "date_of_birth", "gender", "blood_group", "height_cm", "weight_kg", "allergy_status", "nationality", "primary_phone", "secondary_phone", "email", "occupation", "address", "province", "district", "registration_notes", "status", "registered_at", "created_at",
    ], patientRows, "patient_id,patient_number");
    const patientIds = new Map(insertedPatients.map((row) => [row.patient_number, Number(row.patient_id)]));
    if (patientIds.size !== PATIENT_COUNT) throw new Error("Patient rows did not verify at 3,000; rolling back.");

    await insertRows(client, "patient_hospital_registrations", ["patient_id", "hospital_id", "hospital_patient_number", "status", "registered_at", "registered_by", "notes"], patients.map((p) => [
      patientIds.get(p.number), hospitalId, p.number, "ACTIVE", ts(p.registrationDate), actorId,
      training("Synthetic local hospital registration; no identity documents were imported."),
    ]));

    const allergyRows = [];
    for (const p of patients) {
      if (p.foodAllergy) {
        const name = pick(["Peanuts", "Tree nuts", "Shellfish", "Fish", "Milk", "Egg", "Soy", "Wheat"], p.index, 23);
        const id = allergyIds.get(`FOOD:${name.toLowerCase()}`);
        if (!id) throw new Error(`Food allergy reference missing: ${name}.`);
        allergyRows.push([patientIds.get(p.number), id, "Fictional training reaction: rash or gastrointestinal discomfort.", training("Illustrative allergy only; verify any real patient's allergy history directly.")]);
      }
      if (p.drugAllergy) {
        const name = pick(["Penicillin", "Amoxicillin", "Cephalosporins", "Sulfonamides", "Aspirin", "Ibuprofen", "Diclofenac"], p.index, 24);
        const id = allergyIds.get(`MEDICAL_DRUG:${name.toLowerCase()}`);
        if (!id) throw new Error(`Drug allergy reference missing: ${name}.`);
        allergyRows.push([patientIds.get(p.number), id, "Fictional training reaction: rash.", training("Illustrative allergy only; verify any real patient's allergy history directly.")]);
      }
    }
    await insertRows(client, "patient_allergies", ["patient_id", "allergy_id", "reaction", "notes"], allergyRows);

    const plans = patients.map((patient) => ({ patient, events: [], opd: [], clinics: [], emergency: null, admission: null, dental: null, procedure: null, surgery: null, fracture: null }));
    const events = [];
    const reservedBeds = inpatientBeds.filter((bed) => bed.genderPolicy !== "FEMALE").slice(0, 12);
    if (reservedBeds.length < 12) throw new Error("Could not reserve 12 gender-compatible inpatient beds.");
    const historyBeds = inpatientBeds.filter((bed) =>
      bed.genderPolicy !== "FEMALE" && !reservedBeds.some((current) => current.bedId === bed.bedId),
    );
    let admissionIndex = 0;
    let emergencySequence = 0;

    for (const plan of plans) {
      const i = plan.patient.index;
      const profile = plan.patient.profile;
      const primary = makeEvent(plan, "OPD", "OPD", ago(20 + random(i, 30) % 100, 8 + i % 9), "Outpatient Department", profile[0]);
      primary.profile = profile;
      plan.opd.push(primary);
      events.push(primary);
      const repeats = i % 3 === 0 || i % 10 === 0 || i % 25 === 0 ? 1 : 0;
      for (let n = 1; n <= repeats; n += 1) {
        const repeatProfile = PROFILES[random(i, 31 + n) % PROFILES.length];
        const event = makeEvent(plan, "OPD", "OPD", ago(180 * n + 20 + random(i, 32 + n) % 45, 9 + i % 8), "Outpatient Department", repeatProfile[0]);
        event.profile = repeatProfile;
        plan.opd.push(event);
        events.push(event);
      }

      const clinicCount = (i % 4 === 0 ? 1 : 0) + (i % 18 === 0 ? 1 : 0);
      for (let n = 0; n < clinicCount; n += 1) {
        const clinic = clinics[(i + n) % clinics.length];
        const clinicProfile = PROFILES[random(i, 40 + n) % PROFILES.length];
        const event = makeEvent(plan, "CLINIC", "CLINIC", ago(35 + random(i, 41 + n) % 310 + n * 170, 10 + i % 7), clinic.name, clinicProfile[0]);
        event.profile = clinicProfile;
        event.clinic = clinic;
        plan.clinics.push(event);
        events.push(event);
      }

      if (i % 8 === 0 || i % 40 === 1) {
        const emergencyProfile = pick([
          ["Fall with wrist pain", "Wrist sprain", "Fictional emergency assessment and discharge scenario"],
          ["Fever and dehydration", "Acute febrile illness", "Fictional emergency hydration and observation scenario"],
          ["Chest discomfort", "Chest pain assessment", "Fictional emergency assessment; not clinical guidance"],
          ["Minor road traffic injury", "Soft tissue injury", "Fictional trauma assessment and follow-up scenario"],
          ["Breathlessness", "Acute respiratory symptoms", "Fictional respiratory assessment scenario"],
        ], i, 42);
        const event = makeEvent(plan, "EMERGENCY", "EMERGENCY", ago(5 + emergencySequence * 2, 13), "Emergency Department", emergencyProfile[0]);
        emergencySequence += 1;
        event.profile = emergencyProfile;
        plan.emergency = event;
        events.push(event);
      }

      if (i % 12 === 0) {
        const current = admissionIndex < 12;
        const historicalBed = historyBeds[(admissionIndex - 12 + historyBeds.length) % historyBeds.length];
        const bed = current ? reservedBeds[admissionIndex] : historicalBed;
        const seqOnBed = current ? 0 : Math.floor((admissionIndex - 12) / historyBeds.length);
        const offset = current ? 2 + admissionIndex % 4 : Math.max(30, 650 - seqOnBed * 220 - random(i, 44) % 18);
        const admissionDate = ago(offset, 11);
        const event = makeEvent(plan, "INPATIENT", "INPATIENT", admissionDate, "Inpatient Department", profile[1], current ? "ADMITTED" : "COMPLETED");
        event.bed = bed;
        event.admissionDate = admissionDate;
        event.dischargeDate = current ? null : after(admissionDate, 4 + random(i, 45) % 8, 14);
        event.isCurrentAdmission = current;
        plan.admission = event;
        events.push(event);
        admissionIndex += 1;
      }

      if (i % 8 === 0) {
        const event = makeEvent(plan, "DENTAL", "DENTAL", ago(30 + random(i, 50) % 400, 10), "Dental Clinic", "Dental review");
        event.profile = ["Dental review", "Dental caries", "Fictional dental assessment for software training"];
        plan.dental = event;
        events.push(event);
      }
      if (i % 15 === 0) {
        const event = makeEvent(plan, "PROCEDURE", "PROCEDURE", ago(18 + random(i, 51) % 380, 12), "Treatment Room", "Minor procedure follow-up");
        plan.procedure = event;
        events.push(event);
      }
      if (i % 60 === 0 && plan.admission) {
        const event = makeEvent(plan, "SURGERY", "SURGERY", after(plan.admission.admissionDate, 1, 9), "Surgical Department", "Perioperative assessment");
        event.admission = plan.admission;
        plan.surgery = event;
        events.push(event);
      }
      if (i % 40 === 0) {
        plan.fracture = { event: plan.emergency || primary, profile: ["Fall with limb pain", "Closed wrist fracture", "Fictional fracture treatment and follow-up scenario"] };
      }
    }

    const encounterRows = events.map((event) => [
      patientIds.get(event.patient.number), hospitalId, event.type, ts(event.date), null,
      event.department, event.status, event.complaint,
      `${training("Fictional encounter for interface training; no real care occurred.")} event_key=${event.key}`,
    ]);
    const insertedEncounters = await insertRows(client, "encounters", ["patient_id", "hospital_id", "encounter_type", "encounter_date", "attending_user_id", "department", "status", "chief_complaint", "notes"], encounterRows, "encounter_id,notes");
    const eventIds = new Map();
    for (const row of insertedEncounters) {
      const match = String(row.notes).match(/event_key=(E\d{6})/);
      if (match) eventIds.set(match[1], Number(row.encounter_id));
    }
    if (eventIds.size !== events.length) throw new Error("Encounter linking check failed; rolling back.");

    const opdRows = [];
    const clinicRows = [];
    const opdKeyByEvent = new Map();
    const clinicKeyByEvent = new Map();
    for (const plan of plans) {
      for (let visit = 0; visit < plan.opd.length; visit += 1) {
        const event = plan.opd[visit];
        const number = `OPD-TRN-${event.key}`;
        opdKeyByEvent.set(event.key, number);
        const details = event.profile || plan.patient.profile;
        const followUp = visit > 0 || plan.patient.index % 5 === 0;
        opdRows.push([eventIds.get(event.key), patientIds.get(plan.patient.number), number, ts(event.date), actorId, details[0], training(details[2]), details[1], followUp, followUp ? dstr(after(event.date, 30, 9)) : null, "COMPLETED"]);
      }
      for (let visit = 0; visit < plan.clinics.length; visit += 1) {
        const event = plan.clinics[visit];
        const number = `CLN-TRN-${event.key}`;
        clinicKeyByEvent.set(event.key, number);
        const followUp = plan.patient.index % 3 === 0;
        clinicRows.push([event.clinic.id, eventIds.get(event.key), patientIds.get(plan.patient.number), number, ts(event.date), actorId, event.profile[0], training(event.profile[2]), event.profile[1], followUp, followUp ? dstr(after(event.date, 60, 9)) : null, "COMPLETED"]);
      }
    }
    const opdInserted = await insertRows(client, "opd_visits", ["encounter_id", "patient_id", "opd_number", "visit_date", "doctor_user_id", "chief_complaint", "clinical_notes", "diagnosis_summary", "follow_up_required", "follow_up_date", "status"], opdRows, "opd_visit_id,opd_number");
    const opdIds = mapRows(opdInserted, "opd_number", "OPD-TRN-");
    const clinicInserted = await insertRows(client, "clinic_visits", ["clinic_id", "encounter_id", "patient_id", "visit_number", "visit_date", "doctor_user_id", "reason_for_visit", "clinical_notes", "diagnosis_summary", "follow_up_required", "follow_up_date", "status"], clinicRows, "clinic_visit_id,visit_number");
    const clinicIds = mapRows(clinicInserted, "visit_number", "CLN-TRN-");

    const admissionEvents = [];
    const emergencyEvents = [];
    const admissionRows = [];
    const emergencyRows = [];
    for (const plan of plans) {
      if (plan.admission) {
        const event = plan.admission;
        event.admissionNumber = `ADM-TRN-${String(admissionEvents.length + 1).padStart(6, "0")}`;
        admissionEvents.push(event);
        admissionRows.push([
          patientIds.get(plan.patient.number), eventIds.get(event.key), event.bed.wardId, event.bed.bedId,
          event.admissionNumber, ts(event.admissionDate), event.dischargeDate ? ts(event.dischargeDate) : null,
          training("Fictional inpatient admission for application training."), event.complaint,
          event.isCurrentAdmission ? null : event.complaint,
          event.isCurrentAdmission ? null : training("Synthetic discharge summary; not a real clinical decision."),
          null, event.isCurrentAdmission ? "ADMITTED" : "DISCHARGED",
        ]);
      }
      if (plan.emergency) {
        const event = plan.emergency;
        event.caseNumber = `EMG-TRN-${String(emergencyEvents.length + 1).padStart(6, "0")}`;
        emergencyEvents.push(event);
        emergencyRows.push([
          hospitalId, eventIds.get(event.key), patientIds.get(plan.patient.number), event.caseNumber, ts(event.date),
          pick(["WALK_IN", "AMBULANCE", "TRANSFER"], plan.patient.index, 61), `Priority ${1 + random(plan.patient.index, 62) % 5}`,
          event.profile[0], training(event.profile[2]), false, "DISCHARGED", ts(after(event.date, 0, 18)), actorId,
        ]);
      }
    }
    const admissionsInserted = await insertRows(client, "admissions", ["patient_id", "encounter_id", "ward_id", "bed_id", "admission_number", "admission_date", "discharge_date", "admission_reason", "admission_diagnosis", "discharge_diagnosis", "discharge_summary", "attending_doctor_id", "status"], admissionRows, "admission_id,admission_number");
    const admissionIds = mapRows(admissionsInserted, "admission_number", "ADM-TRN-");
    const emergenciesInserted = await insertRows(client, "emergency_cases", ["hospital_id", "encounter_id", "patient_id", "case_number", "arrival_date", "arrival_mode", "triage_level", "chief_complaint", "initial_condition", "unidentified_patient", "status", "identified_at", "identified_by"], emergencyRows, "emergency_case_id,case_number");
    const emergencyIds = mapRows(emergenciesInserted, "case_number", "EMG-TRN-");

    const bhtRows = [];
    for (const event of admissionEvents) {
      const admission = admissionIds.get(event.admissionNumber);
      const secondDate = event.dischargeDate || new Date();
      for (const [type, date, title] of [
        ["ADMISSION_ASSESSMENT", event.admissionDate, "Admission assessment — synthetic training"],
        [event.isCurrentAdmission ? "DAILY_PROGRESS" : "DISCHARGE_PLANNING", secondDate, event.isCurrentAdmission ? "Ward progress — synthetic training" : "Discharge planning — synthetic training"],
      ]) {
        const patient = event.patient;
        bhtRows.push([
          Number(admission.admission_id), eventIds.get(event.key), patientIds.get(patient.number), hospitalId,
          type, ts(date), title, training("Fictional patient-reported symptoms for interface testing."),
          training("Illustrative measurements only; not clinical observations."), event.complaint,
          training("Training-only plan; no care recommendation."), event.complaint,
          (36.2 + random(patient.index, 73) % 11 / 10).toFixed(1), 62 + random(patient.index, 71) % 34,
          12 + random(patient.index, 74) % 8, 105 + random(patient.index, 75) % 38,
          65 + random(patient.index, 76) % 24, (95 + random(patient.index, 77) % 5).toFixed(1),
          random(patient.index, 78) % 6, patient.weight, actorId,
        ]);
      }
    }
    await insertRows(client, "bht_entries", ["admission_id", "encounter_id", "patient_id", "hospital_id", "entry_type", "entry_date", "entry_title", "subjective_notes", "objective_notes", "assessment", "plan", "diagnosis", "temperature_c", "pulse_bpm", "respiratory_rate_bpm", "systolic_bp", "diastolic_bp", "spo2_percent", "pain_score", "weight_kg", "recorded_by"], bhtRows);

    const locationRows = emergencyEvents.map((event, index) => [
      Number(emergencyIds.get(event.caseNumber).emergency_case_id), Number(emergencyBeds.rows[index % emergencyBeds.rowCount].bed_id), "EMERGENCY",
      ts(event.date), ts(after(event.date, 0, 16)), actorId,
      training("Historical fictional emergency location; bed released after the training encounter."),
    ]);
    await insertRows(client, "emergency_case_locations", ["emergency_case_id", "bed_id", "location_type", "started_at", "ended_at", "assigned_by", "notes"], locationRows);

    const conditionRows = [];
    const diagnosisForPatient = new Map();
    for (const plan of plans) {
      const i = plan.patient.index;
      const diagnoses = [];
      if (i % 5 === 0) diagnoses.push("Hypertension");
      if (i % 7 === 0) diagnoses.push("Diabetes Mellitus");
      if (i % 11 === 0) diagnoses.push("Asthma");
      if (i % 23 === 0) diagnoses.push("Migraine");
      if (i % 31 === 0) diagnoses.push("Chronic Back Pain");
      if (i % 101 === 0) diagnoses.push("Cardiac Arrhythmia");
      diagnosisForPatient.set(i, diagnoses);
      diagnoses.forEach((name, index) => conditionRows.push([
        patientIds.get(plan.patient.number), conditionIds.get(name.toLowerCase()), eventIds.get(plan.opd[0].key),
        dstr(ago(90 + random(i, 81 + index) % 1300, 12)), i % 17 === 0 ? "RESOLVED" : "ACTIVE",
        pick(["MILD", "MODERATE"], i, 82 + index), training(`Fictional ${name.toLowerCase()} history for application testing.`),
      ]));
    }
    await insertRows(client, "patient_conditions", ["patient_id", "condition_id", "encounter_id", "diagnosis_date", "condition_status", "severity", "notes"], conditionRows);

    const treatmentRows = [];
    const observationRows = [];
    const medicationRows = [];
    const labRows = [];
    const imageRows = [];
    const procedureRows = [];
    const surgeryRows = [];
    const fractureRows = [];
    const dentalRows = [];
    const deviceRows = [];
    let medicationNumber = 0;
    let labNumber = 0;
    let imageNumber = 0;

    const labs = [
      { name: "Full Blood Count", value: (i) => (11.2 + random(i, 91) % 45 / 10).toFixed(1), unit: "g/dL", range: "Illustrative training range: 11.0–16.0", specimen: "EDTA blood" },
      { name: "Random Blood Glucose", value: (i) => String(82 + random(i, 92) % 95), unit: "mg/dL", range: "Illustrative training range: 70–180", specimen: "Blood" },
      { name: "Serum Creatinine", value: (i) => (0.6 + random(i, 93) % 18 / 10).toFixed(1), unit: "mg/dL", range: "Illustrative training range: 0.6–1.4", specimen: "Serum" },
      { name: "Lipid Profile", value: (i) => String(145 + random(i, 94) % 90), unit: "mg/dL", range: "Illustrative training range: 125–240", specimen: "Serum" },
      { name: "Urine Full Report", value: "Clear", unit: null, range: "Illustrative training reference", specimen: "Urine" },
    ];
    const images = [
      ["Chest radiograph (PA)", "Chest", "Fictional report: no acute finding recorded in this synthetic scenario."],
      ["X-ray wrist", "Wrist", "Fictional report; findings are for software testing only."],
      ["Ultrasound abdomen", "Abdomen", "Fictional report; findings are illustrative and not diagnostic."],
      ["X-ray knee", "Knee", "Fictional report: mild degenerative change scenario."],
      ["X-ray ankle", "Ankle", "Fictional report; no displaced injury described in this training case."],
    ];
    const dentalConditions = ["Dental caries", "Gingivitis", "Tooth sensitivity", "Fractured restoration", "Routine review"];
    const dentalTreatments = ["Composite restoration", "Scale and polish", "Fluoride application", "Temporary dressing", "Review and oral hygiene advice"];
    const procedures = [
      ["Wound dressing", "Minor wound", "Fictional dressing change for workflow training."],
      ["Suture removal", "Skin wound", "Fictional suture removal record for workflow training."],
      ["ECG recording", "Chest", "Synthetic 12-lead ECG workflow record; no diagnostic interpretation."],
      ["Nebulisation", "Respiratory", "Fictional respiratory procedure entry for interface testing."],
      ["IV cannulation", "Upper limb", "Synthetic procedure record; no real treatment was performed."],
    ];
    const surgeryProfiles = [
      ["Appendicectomy", "Appendix", "Acute appendicitis"],
      ["Open hernia repair", "Abdominal wall", "Inguinal hernia"],
      ["Cholecystectomy", "Gallbladder", "Symptomatic gallstone disease"],
      ["Open reduction and internal fixation", "Wrist", "Closed distal radius fracture"],
      ["Excision of soft tissue lesion", "Skin and subcutaneous tissue", "Benign soft tissue lesion"],
    ];
    const fractureParts = ["Distal radius", "Clavicle", "Ankle", "Metacarpal", "Tibia"];

    for (const plan of plans) {
      const patient = plan.patient;
      const patientId = patientIds.get(patient.number);
      const primary = plan.opd[0];
      const primaryEncounterId = eventIds.get(primary.key);
      const bpSys = 105 + random(patient.index, 101) % 34;
      const bpDia = 65 + random(patient.index, 102) % 22;
      const pulse = 62 + random(patient.index, 103) % 34;
      const temperature = (36.2 + random(patient.index, 104) % 11 / 10).toFixed(1);
      const spo2 = 95 + random(patient.index, 105) % 5;
      for (const [type, value, site] of [
        ["BLOOD_PRESSURE", `${bpSys}/${bpDia} mmHg`, "Arm"], ["PULSE", `${pulse} bpm`, null],
        ["TEMPERATURE", `${temperature} °C`, null], ["WEIGHT", `${patient.weight} kg`, null], ["SPO2", `${spo2}%`, null],
      ]) observationRows.push([patientId, primaryEncounterId, null, type, value, site, null, ts(primary.date), actorId, training("Illustrative measurement only; not a real observation.")]);

      for (let visit = 0; visit < plan.opd.length; visit += 1) {
        const event = plan.opd[visit];
        const details = event.profile || patient.profile;
        const opd = opdIds.get(opdKeyByEvent.get(event.key));
        treatmentRows.push([patientId, eventIds.get(event.key), Number(opd.opd_visit_id), null, null, null, ts(event.date), "OPD", "Outpatient assessment", training(details[2]), null, null, actorId, training("Synthetic encounter outcome for interface testing."), null]);

        medicationNumber += 1;
        const medication = MEDICATIONS[random(patient.index, medicationNumber) % MEDICATIONS.length];
        const medicationEnd = after(event.date, medication.duration, 12);
        medicationRows.push([
          hospitalId, patientId, eventIds.get(event.key), null, actorId, medication.name, medication.strength, medication.dosage,
          medication.route, medication.frequency, medication.duration, "days", medication.quantity, medication.unit,
          "Synthetic training instruction only; not for patient use.", details[1], ts(event.date), ts(medicationEnd),
          medicationEnd > new Date() ? "ORDERED" : "COMPLETED",
          training("Fictional medication order; not a real prescription and not for clinical use."),
        ]);

        if (random(patient.index, event.key.length + 111) % 100 < 67) {
          labNumber += 1;
          const lab = labs[random(patient.index, labNumber) % labs.length];
          labRows.push([
            patientId, eventIds.get(event.key), "LAB", lab.name, ts(event.date), ts(after(event.date, 0, 14)),
            training("Fictional laboratory result; value and reference range are illustrative only."), typeof lab.value === "function" ? lab.value(patient.index) : lab.value, lab.unit,
            lab.range, null, actorId, `LAB-TRN-${String(labNumber).padStart(6, "0")}`, "VERIFIED", actorId, actorId,
            ts(after(event.date, 0, 15)), "NORMAL", lab.specimen,
            training("Synthetic result; not measured from a person and not for clinical interpretation."),
          ]);
        }
      }

      for (const event of plan.clinics) {
        const clinic = clinicIds.get(clinicKeyByEvent.get(event.key));
        treatmentRows.push([patientId, eventIds.get(event.key), null, Number(clinic.clinic_visit_id), null, null, ts(event.date), "CLINIC", event.clinic.name, training(event.profile[2]), null, null, actorId, training("Synthetic clinic outcome for interface testing."), null]);
      }
      if (plan.emergency) {
        const event = plan.emergency;
        const emergency = emergencyIds.get(event.caseNumber);
        treatmentRows.push([patientId, eventIds.get(event.key), null, null, null, Number(emergency.emergency_case_id), ts(event.date), "EMERGENCY", "Emergency assessment", training(event.profile[2]), null, null, actorId, training("Synthetic emergency outcome; no real care occurred."), null]);
        if (patient.index % 3 === 0 || plan.fracture?.event === event) {
          imageNumber += 1;
          const image = images[random(patient.index, 122) % images.length];
          imageRows.push([patientId, eventIds.get(event.key), "IMAGING", image[0], ts(event.date), ts(after(event.date, 0, 16)), training(image[2]), null, null, "Synthetic illustration only", image[1], actorId, `IMG-TRN-${String(imageNumber).padStart(6, "0")}`, "VERIFIED", actorId, actorId, ts(after(event.date, 0, 17)), "NORMAL", null, training("Fictional imaging report only; no DICOM or diagnostic image is attached.")]);
        }
      }
      if (plan.admission) {
        const event = plan.admission;
        const admission = admissionIds.get(event.admissionNumber);
        treatmentRows.push([patientId, eventIds.get(event.key), null, null, Number(admission.admission_id), null, ts(event.admissionDate), "INPATIENT", "Inpatient medical care", training("Fictional inpatient pathway for software testing."), null, null, actorId, training("Synthetic inpatient outcome; not a real care decision."), null]);
      }
      if (plan.dental) {
        const event = plan.dental;
        const tooth = pick(["11", "12", "16", "21", "26", "31", "36", "41", "46"], patient.index, 131);
        const condition = pick(dentalConditions, patient.index, 132);
        const treatment = pick(dentalTreatments, patient.index, 133);
        dentalRows.push([patientId, eventIds.get(event.key), dstr(event.date), tooth, condition, treatment, treatment === "Composite restoration" ? "Composite resin" : null, false, false, false, training("Fictional dental assessment and treatment detail; no real procedure occurred."), actorId]);
        treatmentRows.push([patientId, eventIds.get(event.key), null, null, null, null, ts(event.date), "DENTAL", treatment, training(`${condition}; ${event.profile[2]}`), `Tooth ${tooth}`, null, actorId, training("Synthetic dental outcome for workflow testing."), null]);
      }
      if (plan.procedure) {
        const event = plan.procedure;
        const proc = procedures[random(patient.index, 141) % procedures.length];
        procedureRows.push([patientId, eventIds.get(event.key), `PROC-TRN-${String(patient.index + 1).padStart(4, "0")}`, proc[0], ts(event.date), proc[1], null, actorId, training(proc[1]), training("Fictional procedure findings; no real procedure occurred."), training(proc[2])]);
        treatmentRows.push([patientId, eventIds.get(event.key), null, null, null, null, ts(event.date), "PROCEDURE", proc[0], training(proc[2]), proc[1], null, actorId, training("Synthetic procedure outcome for workflow testing."), null]);
      }
      if (plan.surgery) {
        const event = plan.surgery;
        const profile = surgeryProfiles[random(patient.index, 151) % surgeryProfiles.length];
        surgeryRows.push([patientId, eventIds.get(event.key), Number(admissionIds.get(event.admission.admissionNumber).admission_id), `SURG-TRN-${String(patient.index + 1).padStart(4, "0")}`, profile[0], ts(event.date), profile[1], null, actorId, profile[2], profile[2], training("Fictional operative finding for software training only."), "None recorded in this synthetic scenario", training("Synthetic operative note; no real operation occurred.")]);
        treatmentRows.push([patientId, eventIds.get(event.key), null, null, Number(admissionIds.get(event.admission.admissionNumber).admission_id), null, ts(event.date), "SURGERY", profile[0], training("Fictional surgical workflow record; no operation took place."), profile[1], null, actorId, training("Synthetic surgical outcome; not a real result."), null]);
      }
      if (plan.fracture) {
        const event = plan.fracture.event;
        const part = pick(["Distal radius", "Clavicle", "Ankle", "Metacarpal", "Tibia"], patient.index, 161);
        const laterality = patient.index % 2 === 0 ? "RIGHT" : "LEFT";
        fractureRows.push([patientId, eventIds.get(event.key), `${laterality} ${part}`, laterality, "CLOSED", dstr(event.date), training("Illustrative fracture pathway only; not medical advice."), dstr(after(event.date, 70 + random(patient.index, 162) % 50, 12)), training("Fictional fracture record for application training.")]);
      }
      if (patient.index % 60 === 0 && plan.surgery) {
        const event = plan.surgery;
        deviceRows.push([patientId, eventIds.get(event.key), "ORTHOPAEDIC_FIXATION", "Plate and screw fixation construct", "Synthetic training manufacturer", `MODEL-TRN-${String(patient.index + 1).padStart(4, "0")}`, `TRN-DEVICE-${String(patient.index + 1).padStart(6, "0")}`, "Distal radius", patient.index % 2 === 0 ? "RIGHT" : "LEFT", dstr(event.date), null, "ACTIVE", training("Fictional device entry; no device was implanted.")]);
      }
    }

    await insertRows(client, "treatment_records", ["patient_id", "encounter_id", "opd_visit_id", "clinic_visit_id", "admission_id", "emergency_case_id", "treatment_date", "treatment_type", "treatment_name", "description", "body_site", "laterality", "performed_by", "outcome", "complications"], treatmentRows);
    await insertRows(client, "clinical_observations", ["patient_id", "encounter_id", "treatment_id", "observation_type", "observation_value", "body_site", "laterality", "observed_date", "recorded_by", "notes"], observationRows);
    await insertRows(client, "medication_orders", ["hospital_id", "patient_id", "encounter_id", "admission_id", "prescribed_by_user_id", "medication_name", "strength", "dosage", "route", "frequency", "duration_value", "duration_unit", "quantity_prescribed", "quantity_unit", "instructions", "indication", "start_date", "end_date", "order_status", "prescribed_notes"], medicationRows);
    const investigationColumns = ["patient_id", "encounter_id", "investigation_type", "investigation_name", "requested_date", "performed_date", "result_summary", "result_value", "unit", "reference_range", "body_site", "performed_by", "report_reference", "status", "requested_by", "verified_by", "verified_at", "priority", "specimen_type", "clinical_notes"];
    await insertRows(client, "investigations", investigationColumns, labRows);
    await insertRows(client, "investigations", investigationColumns, imageRows);
    await insertRows(client, "procedures", ["patient_id", "encounter_id", "procedure_code", "procedure_name", "procedure_date", "body_site", "laterality", "performed_by", "indication", "findings", "outcome"], procedureRows);
    await insertRows(client, "surgeries", ["patient_id", "encounter_id", "admission_id", "surgery_code", "surgery_name", "surgery_date", "body_site", "laterality", "surgeon_user_id", "preoperative_diagnosis", "postoperative_diagnosis", "findings", "complications", "surgical_notes"], surgeryRows);
    await insertRows(client, "fractures", ["patient_id", "encounter_id", "body_part", "laterality", "fracture_type", "fracture_date", "treatment_description", "healed_date", "notes"], fractureRows);
    await insertRows(client, "dental_records", ["patient_id", "encounter_id", "record_date", "tooth_number", "condition", "treatment", "filling_type", "crown_present", "implant_present", "missing_tooth", "notes", "recorded_by"], dentalRows);
    await insertRows(client, "medical_devices", ["patient_id", "encounter_id", "device_type", "device_name", "manufacturer", "model_number", "serial_number", "body_site", "laterality", "implantation_date", "removal_date", "status", "notes"], deviceRows);

    const currentBedIds = [...new Set(admissionEvents.filter((event) => event.isCurrentAdmission).map((event) => event.bed.bedId))];
    if (currentBedIds.length !== 12) throw new Error("Expected 12 current inpatient beds; rolling back.");
    const occupiedBeds = await client.query("UPDATE public.beds SET status='OCCUPIED',updated_at=CURRENT_TIMESTAMP WHERE bed_id=ANY($1::bigint[]) AND status='AVAILABLE';", [currentBedIds]);
    if (occupiedBeds.rowCount !== currentBedIds.length) throw new Error("Bed occupancy check failed; rolling back.");

    const counts = {};
    for (const table of DATA_TABLES) {
      const result = await client.query(`SELECT COUNT(*)::int AS count FROM public.${table};`);
      counts[table] = result.rows[0].count;
    }
    if (counts.patients !== PATIENT_COUNT) throw new Error("Final patient count did not match 3,000.");

    await client.query("COMMIT");
    open = false;
    console.log(JSON.stringify({
      database: "ecis_ehr", hospitalId, syntheticPatients: counts.patients, distinctNames: nameSet.size,
      records: counts, activeAdmissions: admissionEvents.filter((event) => event.isCurrentAdmission).length,
      occupiedBeds: currentBedIds.length,
      syntheticActor: "DATASET_GENERATOR account with a random unknown password and no hospital assignment; it cannot sign in and only identifies generated record authorship",
      warning: "All generated health details are fictional training data, not real patient records and not for clinical use. NICs, phone numbers and radiology image files were not fabricated.",
    }, null, 2));
  } catch (error) {
    if (open) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((error) => {
  console.error(`Synthetic data were not inserted: ${error.message}`);
  process.exitCode = 1;
});
