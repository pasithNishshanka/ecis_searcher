const pool =
  require("../config/database");

const {
  isValidProvinceDistrict,
} =
  require("../config/sriLankaLocations");


/*
 * ============================================================
 * BASIC HELPERS
 * ============================================================
 */

function cleanString(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const text =
    String(value).trim();

  return text || null;
}


function cleanArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map(
          (item) =>
            String(
              item ?? "",
            ).trim(),
        )
        .filter(Boolean),
    ),
  ];
}


function parseNullableNumber(
  value,
  field,
  {
    min = 0,
    max =
      Number.MAX_SAFE_INTEGER,
  } = {},
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  if (
    !Number.isFinite(
      number,
    ) ||
    number < min ||
    number > max
  ) {
    throw new Error(
      `${field} must be a valid number between ${min} and ${max}.`,
    );
  }

  return number;
}


/*
 * ============================================================
 * DATE OF BIRTH
 * ============================================================
 */

function validateDateOfBirth(
  value,
) {
  if (!value) {
    throw new Error(
      "Date of birth is required.",
    );
  }

  const normalized =
    String(value).slice(
      0,
      10,
    );

  const date =
    new Date(
      `${normalized}T00:00:00`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new Error(
      "Invalid date of birth.",
    );
  }

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0,
  );

  if (
    date > today
  ) {
    throw new Error(
      "Date of birth cannot be in the future.",
    );
  }

  let age =
    today.getFullYear() -
    date.getFullYear();

  const monthDifference =
    today.getMonth() -
    date.getMonth();

  if (
    monthDifference < 0 ||
    (
      monthDifference ===
        0 &&
      today.getDate() <
        date.getDate()
    )
  ) {
    age -= 1;
  }

  if (
    age < 18 ||
    age > 120
  ) {
    throw new Error(
      "Only patients aged between 18 and 120 years can be registered.",
    );
  }

  return normalized;
}


/*
 * ============================================================
 * PATIENT NUMBER
 * ============================================================
 */

async function generatePatientNumber(
  client,
) {
  await client.query(
    "SELECT pg_advisory_xact_lock($1);",
    [
      271828182,
    ],
  );

  const result =
    await client.query(
      `
        SELECT COALESCE(
          MAX(
            CASE
              WHEN patient_number ~ '^P[0-9]+$'
              THEN CAST(
                SUBSTRING(
                  patient_number
                  FROM 2
                ) AS BIGINT
              )
              ELSE 0
            END
          ),
          0
        ) + 1 AS next_number
        FROM public.patients;
      `,
    );

  return `P${String(
    result.rows[0]
      .next_number,
  ).padStart(
    6,
    "0",
  )}`;
}


/*
 * ============================================================
 * ALLERGY VALIDATION
 * ============================================================
 */

function normalizeAllergyStatus(
  value,
) {
  const status =
    String(
      value ?? "",
    )
      .trim()
      .toUpperCase();

  if (!status) {
    throw new Error(
      "Allergy status is required.",
    );
  }

  const allowed = [
    "NO_KNOWN_ALLERGIES",
    "HAS_ALLERGIES",
    "UNKNOWN",
  ];

  if (
    !allowed.includes(
      status,
    )
  ) {
    throw new Error(
      "Invalid allergy status.",
    );
  }

  return status;
}


function validateAllergyData(
  status,
  foodAllergies,
  medicalAllergies,
) {
  const food =
    cleanArray(
      foodAllergies,
    );

  const medical =
    cleanArray(
      medicalAllergies,
    );

  if (
    status ===
      "HAS_ALLERGIES" &&
    food.length === 0 &&
    medical.length === 0
  ) {
    throw new Error(
      "At least one food or medical / drug allergy is required when allergy status is Has allergies.",
    );
  }

  if (
    status ===
      "NO_KNOWN_ALLERGIES" &&
    (
      food.length > 0 ||
      medical.length > 0
    )
  ) {
    throw new Error(
      "Remove allergy entries or change the allergy status before saving.",
    );
  }

  return {
    food,
    medical,
  };
}


async function saveAllergies(
  client,
  patientId,
  names,
  category,
) {
  for (
    const allergyName of
      cleanArray(names)
  ) {
    const allergy =
      await client.query(
        `
          INSERT INTO public.allergies (
            allergy_name,
            allergy_category
          )
          VALUES ($1, $2)
          ON CONFLICT (
            allergy_name,
            allergy_category
          )
          DO UPDATE SET
            allergy_name =
              EXCLUDED.allergy_name
          RETURNING allergy_id;
        `,
        [
          allergyName,
          category,
        ],
      );

    await client.query(
      `
        INSERT INTO public.patient_allergies (
          patient_id,
          allergy_id
        )
        VALUES ($1, $2)
        ON CONFLICT (
          patient_id,
          allergy_id
        )
        DO NOTHING;
      `,
      [
        patientId,
        allergy.rows[0]
          .allergy_id,
      ],
    );
  }
}


/*
 * ============================================================
 * PATIENT SELECT
 * ============================================================
 */

const patientSelect = `
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

    p.allergy_status,

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

    h.hospital_code,
    h.hospital_name,

    COALESCE(
      (
        SELECT jsonb_agg(
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

        JOIN public.allergies a
          ON a.allergy_id =
             pa.allergy_id

        WHERE
          pa.patient_id =
            p.patient_id
      ),
      '[]'::jsonb
    ) AS allergies
`;


/*
 * ============================================================
 * CREATE PATIENT
 * ============================================================
 */

async function createPatient(
  data,
) {
  const hospitalId =
    Number(
      data.hospitalId,
    );

  if (
    !Number.isInteger(
      hospitalId,
    ) ||
    hospitalId <= 0
  ) {
    throw new Error(
      "Hospital context is required.",
    );
  }


  const firstName =
    cleanString(
      data.firstName,
    );

  const lastName =
    cleanString(
      data.lastName,
    );

  if (
    !firstName ||
    !lastName
  ) {
    throw new Error(
      "First name and last name are required.",
    );
  }


  const dateOfBirth =
    validateDateOfBirth(
      data.dateOfBirth,
    );


  const heightCm =
    parseNullableNumber(
      data.heightCm,
      "Height",
      {
        min: 1,
        max: 300,
      },
    );


  const weightKg =
    parseNullableNumber(
      data.weightKg,
      "Weight",
      {
        min: 1,
        max: 500,
      },
    );


  const gender =
    cleanString(
      data.gender,
    );

  if (!gender) {
    throw new Error(
      "Gender is required.",
    );
  }


  const province =
    cleanString(
      data.province,
    );

  const district =
    cleanString(
      data.district,
    );


  if (!province) {
    throw new Error(
      "Province is required.",
    );
  }

  if (!district) {
    throw new Error(
      "District is required.",
    );
  }

  if (
    !isValidProvinceDistrict(
      province,
      district,
    )
  ) {
    throw new Error(
      "District does not belong to the selected province.",
    );
  }


  const allergyStatus =
    normalizeAllergyStatus(
      data.allergyStatus,
    );


  const allergyData =
    validateAllergyData(
      allergyStatus,
      data.foodAllergies,
      data.medicalAllergies,
    );


  const client =
    await pool.connect();


  try {
    await client.query(
      "BEGIN",
    );


    const hospital =
      await client.query(
        `
          SELECT 1
          FROM public.hospitals
          WHERE hospital_id = $1;
        `,
        [
          hospitalId,
        ],
      );


    if (
      !hospital.rowCount
    ) {
      throw new Error(
        "Hospital not found.",
      );
    }


    const nic =
      cleanString(
        data.nicNumber,
      );


    if (nic) {
      const duplicate =
        await client.query(
          `
            SELECT 1
            FROM public.patients
            WHERE nic_number = $1
            LIMIT 1;
          `,
          [
            nic,
          ],
        );

      if (
        duplicate.rowCount
      ) {
        throw new Error(
          "A patient with this NIC already exists.",
        );
      }
    }


    const patientNumber =
      await generatePatientNumber(
        client,
      );


    const result =
      await client.query(
        `
          INSERT INTO public.patients (
            hospital_id,
            patient_number,

            nic_number,
            passport_number,

            first_name,
            middle_name,
            last_name,

            date_of_birth,

            gender,
            blood_group,

            height_cm,
            weight_kg,

            allergy_status,

            nationality,

            primary_phone,
            secondary_phone,
            email,

            occupation,

            address,
            province,
            district,

            registration_notes,

            status
          )
          VALUES (
            $1, $2,
            $3, $4,
            $5, $6, $7,
            $8,
            $9, $10,
            $11, $12,
            $13,
            $14,
            $15, $16, $17,
            $18,
            $19, $20, $21,
            $22,
            $23
          )
          RETURNING patient_id;
        `,
        [
          hospitalId,
          patientNumber,

          nic,
          cleanString(
            data.passportNumber,
          ),

          firstName,
          cleanString(
            data.middleName,
          ),
          lastName,

          dateOfBirth,

          gender,
          cleanString(
            data.bloodGroup,
          ),

          heightCm,
          weightKg,

          allergyStatus,

          cleanString(
            data.nationality,
          ) || "Sri Lankan",

          cleanString(
            data.primaryPhone,
          ),
          cleanString(
            data.secondaryPhone,
          ),
          cleanString(
            data.email,
          ),

          cleanString(
            data.occupation,
          ),

          cleanString(
            data.address,
          ),
          province,
          district,

          cleanString(
            data.registrationNotes,
          ),

          "ACTIVE",
        ],
      );


    const patientId =
      result.rows[0]
        .patient_id;


    await saveAllergies(
      client,
      patientId,
      allergyData.food,
      "FOOD",
    );


    await saveAllergies(
      client,
      patientId,
      allergyData.medical,
      "MEDICAL_DRUG",
    );


    await client.query(
      "COMMIT",
    );


    return getPatientById(
      patientId,
      hospitalId,
    );
  } catch (
    error
  ) {
    await client.query(
      "ROLLBACK",
    );

    throw error;
  } finally {
    client.release();
  }
}


/*
 * ============================================================
 * GET PATIENT
 * ============================================================
 */

async function getPatientById(
  patientId,
  hospitalId,
) {
  const params = [
    Number(patientId),
  ];

  let where =
    "p.patient_id = $1";


  if (
    hospitalId !==
    undefined
  ) {
    params.push(
      Number(
        hospitalId,
      ),
    );

    where +=
      " AND p.hospital_id = $2";
  }


  const result =
    await pool.query(
      `
        ${patientSelect}

        FROM public.patients p

        JOIN public.hospitals h
          ON h.hospital_id =
             p.hospital_id

        WHERE ${where}

        LIMIT 1;
      `,
      params,
    );


  return (
    result.rows[0] ||
    null
  );
}


/*
 * ============================================================
 * GET ALL PATIENTS
 * ============================================================
 */

async function getAllPatients(
  hospitalId,
) {
  const result =
    await pool.query(
      `
        ${patientSelect}

        FROM public.patients p

        JOIN public.hospitals h
          ON h.hospital_id =
             p.hospital_id

        WHERE
          p.hospital_id = $1

        ORDER BY
          p.created_at DESC,
          p.patient_id DESC;
      `,
      [
        Number(
          hospitalId,
        ),
      ],
    );

  return result.rows;
}


/*
 * ============================================================
 * SEARCH PATIENTS
 * ============================================================
 */

async function searchPatients(
  hospitalId,
  searchTerm,
) {
  const term =
    `%${String(
      searchTerm,
    ).trim()}%`;


  const result =
    await pool.query(
      `
        ${patientSelect}

        FROM public.patients p

        JOIN public.hospitals h
          ON h.hospital_id =
             p.hospital_id

        WHERE
          p.hospital_id = $1

          AND (
            p.patient_number ILIKE $2

            OR p.first_name ILIKE $2

            OR p.middle_name ILIKE $2

            OR p.last_name ILIKE $2

            OR p.nic_number ILIKE $2

            OR p.primary_phone ILIKE $2

            OR p.address ILIKE $2

            OR p.district ILIKE $2

            OR p.province ILIKE $2
          )

        ORDER BY
          p.first_name,
          p.last_name

        LIMIT 50;
      `,
      [
        Number(
          hospitalId,
        ),
        term,
      ],
    );


  return result.rows;
}


/*
 * ============================================================
 * UPDATE PATIENT
 * ============================================================
 */

async function updatePatient(
  patientId,
  hospitalId,
  data,
) {
  const id =
    Number(
      patientId,
    );

  const hospital =
    Number(
      hospitalId,
    );


  const client =
    await pool.connect();


  try {
    await client.query(
      "BEGIN",
    );


    const current =
      await client.query(
        `
          SELECT
            patient_id,
            date_of_birth,
            nic_number,
            province,
            district,
            gender,
            allergy_status
          FROM public.patients
          WHERE
            patient_id = $1
            AND hospital_id = $2
          FOR UPDATE;
        `,
        [
          id,
          hospital,
        ],
      );


    if (
      !current.rowCount
    ) {
      await client.query(
        "ROLLBACK",
      );

      return null;
    }


    const currentDetails =
      current.rows[0];


    const provided =
      (key) =>
        Object.prototype.hasOwnProperty.call(
          data,
          key,
        );


    const finalProvince =
      provided(
        "province",
      )
        ? cleanString(
            data.province,
          )
        : cleanString(
            currentDetails.province,
          );


    const finalDistrict =
      provided(
        "district",
      )
        ? cleanString(
            data.district,
          )
        : cleanString(
            currentDetails.district,
          );


    if (!finalProvince) {
      throw new Error(
        "Province is required.",
      );
    }


    if (!finalDistrict) {
      throw new Error(
        "District is required.",
      );
    }


    if (
      !isValidProvinceDistrict(
        finalProvince,
        finalDistrict,
      )
    ) {
      throw new Error(
        "District does not belong to the selected province.",
      );
    }


    const finalGender =
      provided("gender")
        ? cleanString(
            data.gender,
          )
        : cleanString(
            currentDetails.gender,
          );


    if (!finalGender) {
      throw new Error(
        "Gender is required.",
      );
    }


    const fields = [];
    const values = [];


    function add(
      column,
      value,
    ) {
      fields.push(
        `${column} = $${values.length + 1}`,
      );

      values.push(value);
    }


    if (
      provided(
        "firstName",
      )
    ) {
      add(
        "first_name",
        cleanString(
          data.firstName,
        ),
      );
    }


    if (
      provided(
        "middleName",
      )
    ) {
      add(
        "middle_name",
        cleanString(
          data.middleName,
        ),
      );
    }


    if (
      provided(
        "lastName",
      )
    ) {
      add(
        "last_name",
        cleanString(
          data.lastName,
        ),
      );
    }


    if (
      provided(
        "dateOfBirth",
      )
    ) {
      add(
        "date_of_birth",
        validateDateOfBirth(
          data.dateOfBirth,
        ),
      );
    }


    if (
      provided(
        "gender",
      )
    ) {
      add(
        "gender",
        finalGender,
      );
    }


    if (
      provided(
        "bloodGroup",
      )
    ) {
      add(
        "blood_group",
        cleanString(
          data.bloodGroup,
        ),
      );
    }


    if (
      provided(
        "heightCm",
      )
    ) {
      add(
        "height_cm",
        parseNullableNumber(
          data.heightCm,
          "Height",
          {
            min: 1,
            max: 300,
          },
        ),
      );
    }


    if (
      provided(
        "weightKg",
      )
    ) {
      add(
        "weight_kg",
        parseNullableNumber(
          data.weightKg,
          "Weight",
          {
            min: 1,
            max: 500,
          },
        ),
      );
    }


    if (
      provided(
        "nationality",
      )
    ) {
      add(
        "nationality",
        cleanString(
          data.nationality,
        ),
      );
    }


    if (
      provided(
        "primaryPhone",
      )
    ) {
      add(
        "primary_phone",
        cleanString(
          data.primaryPhone,
        ),
      );
    }


    if (
      provided(
        "secondaryPhone",
      )
    ) {
      add(
        "secondary_phone",
        cleanString(
          data.secondaryPhone,
        ),
      );
    }


    if (
      provided(
        "email",
      )
    ) {
      add(
        "email",
        cleanString(
          data.email,
        ),
      );
    }


    if (
      provided(
        "occupation",
      )
    ) {
      add(
        "occupation",
        cleanString(
          data.occupation,
        ),
      );
    }


    if (
      provided(
        "address",
      )
    ) {
      add(
        "address",
        cleanString(
          data.address,
        ),
      );
    }


    if (
      provided(
        "province",
      )
    ) {
      add(
        "province",
        finalProvince,
      );
    }


    if (
      provided(
        "district",
      )
    ) {
      add(
        "district",
        finalDistrict,
      );
    }


    if (
      provided(
        "registrationNotes",
      )
    ) {
      add(
        "registration_notes",
        cleanString(
          data.registrationNotes,
        ),
      );
    }


    if (
      provided(
        "nicNumber",
      )
    ) {
      const nic =
        cleanString(
          data.nicNumber,
        );


      if (nic) {
        const duplicate =
          await client.query(
            `
              SELECT 1
              FROM public.patients
              WHERE
                nic_number = $1
                AND patient_id <> $2
              LIMIT 1;
            `,
            [
              nic,
              id,
            ],
          );


        if (
          duplicate.rowCount
        ) {
          throw new Error(
            "A patient with this NIC already exists.",
          );
        }
      }


      add(
        "nic_number",
        nic,
      );
    }


    if (
      provided(
        "passportNumber",
      )
    ) {
      add(
        "passport_number",
        cleanString(
          data.passportNumber,
        ),
      );
    }


    let allergyData =
      null;


    if (
      provided(
        "allergyStatus",
      ) ||
      provided(
        "foodAllergies",
      ) ||
      provided(
        "medicalAllergies",
      )
    ) {
      const allergyStatus =
        normalizeAllergyStatus(
          provided(
            "allergyStatus",
          )
            ? data.allergyStatus
            : currentDetails.allergy_status ||
              "UNKNOWN",
        );


      allergyData =
        validateAllergyData(
          allergyStatus,

          provided(
            "foodAllergies",
          )
            ? data.foodAllergies
            : [],

          provided(
            "medicalAllergies",
          )
            ? data.medicalAllergies
            : [],
        );


      add(
        "allergy_status",
        allergyStatus,
      );
    }


    if (fields.length) {
      fields.push(
        "updated_at = CURRENT_TIMESTAMP",
      );


      const updated =
        await client.query(
          `
            UPDATE public.patients
            SET
              ${fields.join(
                ", ",
              )}
            WHERE
              patient_id = $${values.length + 1}
              AND hospital_id = $${values.length + 2}
            RETURNING patient_id;
          `,
          [
            ...values,
            id,
            hospital,
          ],
        );


      if (
        !updated.rowCount
      ) {
        throw new Error(
          "Patient update failed.",
        );
      }
    }


    if (allergyData) {
      await client.query(
        `
          DELETE FROM public.patient_allergies
          WHERE patient_id = $1;
        `,
        [
          id,
        ],
      );


      await saveAllergies(
        client,
        id,
        allergyData.food,
        "FOOD",
      );


      await saveAllergies(
        client,
        id,
        allergyData.medical,
        "MEDICAL_DRUG",
      );
    }


    await client.query(
      "COMMIT",
    );


    return getPatientById(
      id,
      hospital,
    );
  } catch (
    error
  ) {
    await client.query(
      "ROLLBACK",
    );

    throw error;
  } finally {
    client.release();
  }
}


module.exports = {
  createPatient,
  getPatientById,
  getAllPatients,
  searchPatients,
  updatePatient,
};