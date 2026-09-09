require("dotenv").config();

const pool = require("../config/database");

const firstNames = {
  male: [
    "Ashen",
    "Bimal",
    "Chathura",
    "Dilshan",
    "Eshan",
    "Gihan",
    "Harsha",
    "Janith",
    "Kavindu",
    "Lakmal",
    "Madusha",
    "Nadeesh",
    "Oshan",
    "Praveen",
    "Ravindu",
    "Sachin",
    "Thilina",
    "Udara",
    "Vihanga",
    "Yohan",
  ],
  female: [
    "Amandi",
    "Bhagya",
    "Chathuni",
    "Dinithi",
    "Erandi",
    "Hansika",
    "Ishara",
    "Janani",
    "Kavisha",
    "Lakmini",
    "Madushi",
    "Nadeesha",
    "Oshadi",
    "Pabasara",
    "Rashmi",
    "Sachini",
    "Tharushi",
    "Upeksha",
    "Vihangi",
    "Yasasvi",
  ],
};

const lastNames = [
  "Abeysekera",
  "Balasooriya",
  "Chandrasiri",
  "De Alwis",
  "Ekanayake",
  "Gamage",
  "Hapuarachchi",
  "Illangakoon",
  "Jayanetti",
  "Karunaratne",
  "Liyanage",
  "Mendis",
  "Nanayakkara",
  "Pathirana",
  "Rajapaksha",
  "Samarasekara",
  "Thilakaratne",
  "Udugampola",
  "Vithanage",
  "Wickramasinghe",
];

const seededDemoNamePairs = [
  ["Kasun", "Perera"],
  ["Amal", "Jayasinghe"],
  ["Chamara", "Herath"],
  ["Dinesh", "Rathnayake"],
  ["Isuru", "Senanayake"],
  ["Lahiru", "Dissanayake"],
  ["Nimal", "Bandara"],
  ["Ruwan", "Silva"],
  ["Saman", "Fernando"],
  ["Tharindu", "Wijesinghe"],
];

const normalizeGender = (value) =>
  String(value || "").trim().toLowerCase() === "female"
    ? "female"
    : "male";

async function assignUniqueDemoPatientNames() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingNames = await client.query(`
      SELECT first_name, last_name
      FROM public.patients
    `);

    const usedNames = new Set(
      existingNames.rows.map(
        (patient) => `${patient.first_name}\u0000${patient.last_name}`,
      ),
    );

    const duplicatePatients = await client.query(`
      WITH ranked_patients AS (
        SELECT
          patient_id,
          gender,
          ROW_NUMBER() OVER (
            PARTITION BY first_name, middle_name, last_name
            ORDER BY patient_id
          ) AS duplicate_rank
        FROM public.patients
        WHERE (first_name, last_name) IN (
          ${seededDemoNamePairs
            .map(
              (_, index) =>
                `($${index * 2 + 1}, $${index * 2 + 2})`,
            )
            .join(", ")}
        )
      )
      SELECT patient_id, gender
      FROM ranked_patients
      WHERE duplicate_rank > 1
      ORDER BY patient_id
    `, seededDemoNamePairs.flat());

    const availableNames = {
      male: [],
      female: [],
    };

    for (const gender of Object.keys(availableNames)) {
      for (const firstName of firstNames[gender]) {
        for (const lastName of lastNames) {
          const key = `${firstName}\u0000${lastName}`;

          if (!usedNames.has(key)) {
            availableNames[gender].push({ firstName, lastName });
          }
        }
      }
    }

    const nextNameIndex = {
      male: 0,
      female: 0,
    };

    for (const patient of duplicatePatients.rows) {
      const gender = normalizeGender(patient.gender);
      const name = availableNames[gender][nextNameIndex[gender]];

      if (!name) {
        throw new Error(`Not enough unique ${gender} names are available`);
      }

      nextNameIndex[gender] += 1;
      usedNames.add(`${name.firstName}\u0000${name.lastName}`);

      await client.query(
        `
          UPDATE public.patients
          SET
            first_name = $1,
            last_name = $2
          WHERE patient_id = $3
        `,
        [name.firstName, name.lastName, patient.patient_id],
      );
    }

    await client.query("COMMIT");

    console.log(
      `Updated ${duplicatePatients.rowCount} duplicate demo patient names.`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

assignUniqueDemoPatientNames()
  .catch((error) => {
    console.error("Unable to update demo patient names:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
