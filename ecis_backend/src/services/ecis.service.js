const pool =
  require("../config/database");


const DEFAULT_LIMIT = 50;


/*
 * ------------------------------------------------------------
 * NORMALIZATION HELPERS
 * ------------------------------------------------------------
 */

function normalizeText(
  value,
) {
  return String(
    value ?? "",
  )
    .trim()
    .toLowerCase();
}


function nullableText(
  value,
) {
  const normalized =
    normalizeText(
      value,
    );

  return normalized ||
    null;
}


function toNumberOrNull(
  value,
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

  return Number.isFinite(
    number,
  )
    ? number
    : null;
}


function positiveInteger(
  value,
  fieldName,
) {
  const number =
    Number(value);

  if (
    !Number.isInteger(
      number,
    ) ||
    number <= 0
  ) {
    throw new Error(
      `${fieldName} must be a positive integer`,
    );
  }

  return number;
}


/*
 * ------------------------------------------------------------
 * SCORE WEIGHTS
 *
 * These are explainable heuristic evidence weights.
 * They are NOT medically validated probabilities.
 * ------------------------------------------------------------
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


/*
 * ------------------------------------------------------------
 * MAXIMUM SCORE
 * ------------------------------------------------------------
 */

const MAX_SCORE =
  Object.values(
    WEIGHTS,
  ).reduce(
    (
      total,
      value,
    ) =>
      total + value,
    0,
  );


/*
 * ------------------------------------------------------------
 * DATE / AGE
 * ------------------------------------------------------------
 */

function calculateAge(
  dateOfBirth,
) {
  if (
    !dateOfBirth
  ) {
    return null;
  }

  const dob =
    new Date(
      dateOfBirth,
    );

  if (
    Number.isNaN(
      dob.getTime(),
    )
  ) {
    return null;
  }

  const today =
    new Date();

  let age =
    today.getFullYear() -
    dob.getFullYear();

  const monthDifference =
    today.getMonth() -
    dob.getMonth();

  if (
    monthDifference < 0 ||
    (
      monthDifference ===
        0 &&
      today.getDate() <
        dob.getDate()
    )
  ) {
    age -= 1;
  }

  return age;
}


/*
 * ------------------------------------------------------------
 * INPUT VALIDATION
 * ------------------------------------------------------------
 */

function normalizeSearchInput(
  input,
) {
  const ageMin =
    toNumberOrNull(
      input.ageMin,
    );

  const ageMax =
    toNumberOrNull(
      input.ageMax,
    );

  const heightMin =
    toNumberOrNull(
      input.heightMin,
    );

  const heightMax =
    toNumberOrNull(
      input.heightMax,
    );

  const weightMin =
    toNumberOrNull(
      input.weightMin,
    );

  const weightMax =
    toNumberOrNull(
      input.weightMax,
    );


  if (
    ageMin !== null &&
    ageMax !== null &&
    ageMin > ageMax
  ) {
    throw new Error(
      "ageMin cannot be greater than ageMax",
    );
  }


  if (
    heightMin !== null &&
    heightMax !== null &&
    heightMin > heightMax
  ) {
    throw new Error(
      "heightMin cannot be greater than heightMax",
    );
  }


  if (
    weightMin !== null &&
    weightMax !== null &&
    weightMin > weightMax
  ) {
    throw new Error(
      "weightMin cannot be greater than weightMax",
    );
  }


  return {
    patientNumber:
      nullableText(
        input.patientNumber,
      ),

    name:
      nullableText(
        input.name,
      ),

    nic:
      nullableText(
        input.nic,
      ),

    phone:
      nullableText(
        input.phone,
      ),

    gender:
      nullableText(
        input.gender,
      ),

    bloodGroup:
      nullableText(
        input.bloodGroup,
      ),

    occupation:
      nullableText(
        input.occupation,
      ),

    district:
      nullableText(
        input.district,
      ),

    province:
      nullableText(
        input.province,
      ),

    surgery:
      nullableText(
        input.surgery,
      ),

    fracture:
      nullableText(
        input.fracture,
      ),

    device:
      nullableText(
        input.device,
      ),

    dental:
      nullableText(
        input.dental,
      ),

    observation:
      nullableText(
        input.observation,
      ),

    treatment:
      nullableText(
        input.treatment,
      ),

    investigation:
      nullableText(
        input.investigation,
      ),

    ageMin,

    ageMax,

    heightMin,

    heightMax,

    weightMin,

    weightMax,
  };
}


/*
 * ------------------------------------------------------------
 * SEARCH
 * ------------------------------------------------------------
 */

async function searchPatients(
  searchInput,
  hospitalIdValue,
) {
  const hospitalId =
    positiveInteger(
      hospitalIdValue,
      "hospitalId",
    );

  const input =
    normalizeSearchInput(
      searchInput || {},
    );


  /*
   * ----------------------------------------------------------
   * Dynamic filter parameters
   * ----------------------------------------------------------
   */

  const values = [
    hospitalId,
  ];

  const where = [
    `
      p.hospital_id = $1
    `,

    `
      p.status = 'ACTIVE'
    `,

    /*
     * ECIS population = adults.
     */
    `
      p.date_of_birth <=
      CURRENT_DATE - INTERVAL '18 years'
    `,
  ];


  function addFilter(
    sql,
    value,
  ) {
    values.push(
      value,
    );

    where.push(
      sql.replace(
        /\$VALUE/g,
        `$${values.length}`,
      ),
    );
  }


  if (
    input.patientNumber
  ) {
    addFilter(
      `
        LOWER(
          p.patient_number
        ) LIKE
        '%' ||
        LOWER($VALUE) ||
        '%'
      `,
      input.patientNumber,
    );
  }


  if (
    input.name
  ) {
    addFilter(
      `
        (
          LOWER(
            CONCAT_WS(
              ' ',
              p.first_name,
              p.middle_name,
              p.last_name
            )
          ) LIKE
          '%' ||
          LOWER($VALUE) ||
          '%'
        )
      `,
      input.name,
    );
  }


  if (
    input.nic
  ) {
    addFilter(
      `
        LOWER(
          COALESCE(
            p.nic_number,
            ''
          )
        ) LIKE
        '%' ||
        LOWER($VALUE) ||
        '%'
      `,
      input.nic,
    );
  }


  if (
    input.phone
  ) {
    addFilter(
      `
        (
          REPLACE(
            COALESCE(
              p.primary_phone,
              ''
            ),
            ' ',
            ''
          ) LIKE
          '%' ||
          REPLACE(
            $VALUE,
            ' ',
            ''
          ) ||
          '%'
        )
      `,
      input.phone,
    );
  }


  if (
    input.gender
  ) {
    addFilter(
      `
        LOWER(
          COALESCE(
            p.gender,
            ''
          )
        ) =
        LOWER($VALUE)
      `,
      input.gender,
    );
  }


  if (
    input.bloodGroup
  ) {
    addFilter(
      `
        LOWER(
          COALESCE(
            p.blood_group,
            ''
          )
        ) =
        LOWER($VALUE)
      `,
      input.bloodGroup,
    );
  }


  if (
    input.occupation
  ) {
    addFilter(
      `
        LOWER(
          COALESCE(
            p.occupation,
            ''
          )
        ) LIKE
        '%' ||
        LOWER($VALUE) ||
        '%'
      `,
      input.occupation,
    );
  }


  if (
    input.district
  ) {
    addFilter(
      `
        LOWER(
          COALESCE(
            p.district,
            ''
          )
        ) LIKE
        '%' ||
        LOWER($VALUE) ||
        '%'
      `,
      input.district,
    );
  }


  if (
    input.province
  ) {
    addFilter(
      `
        LOWER(
          COALESCE(
            p.province,
            ''
          )
        ) LIKE
        '%' ||
        LOWER($VALUE) ||
        '%'
      `,
      input.province,
    );
  }


  /*
   * Age filters
   */

  if (
    input.ageMin !== null
  ) {
    addFilter(
      `
        EXTRACT(
          YEAR
          FROM AGE(
            CURRENT_DATE,
            p.date_of_birth
          )
        ) >= $VALUE
      `,
      input.ageMin,
    );
  }


  if (
    input.ageMax !== null
  ) {
    addFilter(
      `
        EXTRACT(
          YEAR
          FROM AGE(
            CURRENT_DATE,
            p.date_of_birth
          )
        ) <= $VALUE
      `,
      input.ageMax,
    );
  }


  /*
   * Height
   */

  if (
    input.heightMin !== null
  ) {
    addFilter(
      `
        COALESCE(
          p.height_cm,
          0
        ) >= $VALUE
      `,
      input.heightMin,
    );
  }


  if (
    input.heightMax !== null
  ) {
    addFilter(
      `
        COALESCE(
          p.height_cm,
          999999
        ) <= $VALUE
      `,
      input.heightMax,
    );
  }


  /*
   * Weight
   */

  if (
    input.weightMin !== null
  ) {
    addFilter(
      `
        COALESCE(
          p.weight_kg,
          0
        ) >= $VALUE
      `,
      input.weightMin,
    );
  }


  if (
    input.weightMax !== null
  ) {
    addFilter(
      `
        COALESCE(
          p.weight_kg,
          999999
        ) <= $VALUE
      `,
      input.weightMax,
    );
  }


  /*
   * ----------------------------------------------------------
   * Candidate query
   * ----------------------------------------------------------
   */

  const query = `
    SELECT
      p.patient_id,
      p.hospital_id,

      p.patient_number,

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

      p.primary_phone,
      p.occupation,

      p.nationality,

      p.district,
      p.province,

      p.address,

      /*
       * ------------------------------------------------------
       * Surgery evidence
       * ------------------------------------------------------
       */

      COALESCE(
        (
          SELECT
            jsonb_agg(
              jsonb_build_object(
                'surgeryId',
                s.surgery_id,

                'name',
                s.surgery_name,

                'date',
                s.surgery_date,

                'bodySite',
                s.body_site,

                'laterality',
                s.laterality,

                'preoperativeDiagnosis',
                s.preoperative_diagnosis,

                'postoperativeDiagnosis',
                s.postoperative_diagnosis
              )
              ORDER BY
                s.surgery_date DESC
            )
          FROM public.surgeries s
          WHERE
            s.patient_id =
              p.patient_id
          LIMIT 10
        ),
        '[]'::jsonb
      ) AS surgeries,


      /*
       * ------------------------------------------------------
       * Fracture evidence
       * ------------------------------------------------------
       */

      COALESCE(
        (
          SELECT
            jsonb_agg(
              jsonb_build_object(
                'fractureId',
                f.fracture_id,

                'bodyPart',
                f.body_part,

                'laterality',
                f.laterality,

                'fractureType',
                f.fracture_type,

                'date',
                f.fracture_date
              )
              ORDER BY
                f.fracture_date DESC
            )
          FROM public.fractures f
          WHERE
            f.patient_id =
              p.patient_id
          LIMIT 10
        ),
        '[]'::jsonb
      ) AS fractures,


      /*
       * ------------------------------------------------------
       * Device evidence
       * ------------------------------------------------------
       */

      COALESCE(
        (
          SELECT
            jsonb_agg(
              jsonb_build_object(
                'deviceId',
                d.device_id,

                'type',
                d.device_type,

                'name',
                d.device_name,

                'manufacturer',
                d.manufacturer,

                'modelNumber',
                d.model_number,

                'serialNumber',
                d.serial_number,

                'bodySite',
                d.body_site,

                'laterality',
                d.laterality
              )
            )
          FROM public.medical_devices d
          WHERE
            d.patient_id =
              p.patient_id
          LIMIT 10
        ),
        '[]'::jsonb
      ) AS devices,


      /*
       * ------------------------------------------------------
       * Dental evidence
       * ------------------------------------------------------
       */

      COALESCE(
        (
          SELECT
            jsonb_agg(
              jsonb_build_object(
                'dentalRecordId',
                dr.dental_record_id,

                'toothNumber',
                dr.tooth_number,

                'condition',
                dr.condition,

                'treatment',
                dr.treatment,

                'fillingType',
                dr.filling_type
              )
              ORDER BY
                dr.record_date DESC
            )
          FROM public.dental_records dr
          WHERE
            dr.patient_id =
              p.patient_id
          LIMIT 10
        ),
        '[]'::jsonb
      ) AS dental_records,


      /*
       * ------------------------------------------------------
       * Observations
       * ------------------------------------------------------
       */

      COALESCE(
        (
          SELECT
            jsonb_agg(
              jsonb_build_object(
                'observationId',
                o.observation_id,

                'type',
                o.observation_type,

                'value',
                o.observation_value,

                'bodySite',
                o.body_site,

                'laterality',
                o.laterality,

                'date',
                o.observed_date
              )
              ORDER BY
                o.observed_date DESC
            )
          FROM public.clinical_observations o
          WHERE
            o.patient_id =
              p.patient_id
          LIMIT 20
        ),
        '[]'::jsonb
      ) AS observations,


      /*
       * ------------------------------------------------------
       * Treatments
       * ------------------------------------------------------
       */

      COALESCE(
        (
          SELECT
            jsonb_agg(
              jsonb_build_object(
                'treatmentId',
                t.treatment_id,

                'type',
                t.treatment_type,

                'name',
                t.treatment_name,

                'description',
                t.description,

                'bodySite',
                t.body_site,

                'laterality',
                t.laterality,

                'date',
                t.treatment_date
              )
              ORDER BY
                t.treatment_date DESC
            )
          FROM public.treatment_records t
          WHERE
            t.patient_id =
              p.patient_id
          LIMIT 20
        ),
        '[]'::jsonb
      ) AS treatments,


      /*
       * ------------------------------------------------------
       * Investigations
       * ------------------------------------------------------
       */

      COALESCE(
        (
          SELECT
            jsonb_agg(
              jsonb_build_object(
                'investigationId',
                i.investigation_id,

                'type',
                i.investigation_type,

                'name',
                i.investigation_name,

                'date',
                COALESCE(
                  i.performed_date,
                  i.requested_date
                ),

                'result',
                i.result_summary,

                'value',
                i.result_value,

                'bodySite',
                i.body_site
              )
              ORDER BY
                COALESCE(
                  i.performed_date,
                  i.requested_date
                ) DESC
            )
          FROM public.investigations i
          WHERE
            i.patient_id =
              p.patient_id
          LIMIT 20
        ),
        '[]'::jsonb
      ) AS investigations


    FROM public.patients p

    WHERE
      ${where.join(
        "\nAND ",
      )}

    ORDER BY
      p.patient_id DESC

    LIMIT ${DEFAULT_LIMIT};
  `;


  const result =
    await pool.query(
      query,
      values,
    );


  /*
   * ----------------------------------------------------------
   * EXPLAINABLE HEURISTIC SCORING
   * ----------------------------------------------------------
   */

  const candidates =
    result.rows.map(
      (
        row,
      ) => {
        const evidence = [];


        let score = 0;


        /*
         * Gender
         */

        if (
          input.gender &&
          normalizeText(
            row.gender,
          ) ===
            input.gender
        ) {
          score +=
            WEIGHTS.gender;

          evidence.push({
            key: "gender",
            label:
              "Gender match",
            score:
              WEIGHTS.gender,
            details:
              row.gender,
          });
        }


        /*
         * Blood group
         */

        if (
          input.bloodGroup &&
          normalizeText(
            row.blood_group,
          ) ===
            input.bloodGroup
        ) {
          score +=
            WEIGHTS.bloodGroup;

          evidence.push({
            key:
              "bloodGroup",

            label:
              "Blood group match",

            score:
              WEIGHTS.bloodGroup,

            details:
              row.blood_group,
          });
        }


        /*
         * Age
         */

        const age =
          Number(
            row.age,
          );

        if (
          input.ageMin !==
            null ||
          input.ageMax !==
            null
        ) {
          const ageMatches =
            (
              input.ageMin ===
                null ||
              age >=
                input.ageMin
            ) &&
            (
              input.ageMax ===
                null ||
              age <=
                input.ageMax
            );

          if (
            ageMatches
          ) {
            score +=
              WEIGHTS.age;

            evidence.push({
              key: "age",
              label:
                "Age range match",
              score:
                WEIGHTS.age,
              details:
                `${age} years`,
            });
          }
        }


        /*
         * Height
         */

        if (
          row.height_cm !==
            null &&
          (
            input.heightMin !==
              null ||
            input.heightMax !==
              null
          )
        ) {
          const height =
            Number(
              row.height_cm,
            );

          const matches =
            (
              input.heightMin ===
                null ||
              height >=
                input.heightMin
            ) &&
            (
              input.heightMax ===
                null ||
              height <=
                input.heightMax
            );

          if (
            matches
          ) {
            score +=
              WEIGHTS.height;

            evidence.push({
              key:
                "height",

              label:
                "Height match",

              score:
                WEIGHTS.height,

              details:
                `${height} cm`,
            });
          }
        }


        /*
         * Weight
         */

        if (
          row.weight_kg !==
            null &&
          (
            input.weightMin !==
              null ||
            input.weightMax !==
              null
          )
        ) {
          const weight =
            Number(
              row.weight_kg,
            );

          const matches =
            (
              input.weightMin ===
                null ||
              weight >=
                input.weightMin
            ) &&
            (
              input.weightMax ===
                null ||
              weight <=
                input.weightMax
            );

          if (
            matches
          ) {
            score +=
              WEIGHTS.weight;

            evidence.push({
              key:
                "weight",

              label:
                "Weight match",

              score:
                WEIGHTS.weight,

              details:
                `${weight} kg`,
            });
          }
        }


        /*
         * Name
         */

        if (
          input.name
        ) {
          const fullName =
            normalizeText(
              [
                row.first_name,
                row.middle_name,
                row.last_name,
              ]
                .filter(
                  Boolean,
                )
                .join(
                  " ",
                ),
            );

          if (
            fullName.includes(
              input.name,
            )
          ) {
            score +=
              WEIGHTS.name;

            evidence.push({
              key: "name",
              label:
                "Name fragment match",
              score:
                WEIGHTS.name,
              details:
                fullName,
            });
          }
        }


        /*
         * Phone
         */

        if (
          input.phone
        ) {
          const phone =
            normalizeText(
              row.primary_phone,
            ).replace(
              /\s/g,
              "",
            );

          const searchedPhone =
            input.phone.replace(
              /\s/g,
              "",
            );

          if (
            phone.includes(
              searchedPhone,
            )
          ) {
            score +=
              WEIGHTS.phone;

            evidence.push({
              key:
                "phone",

              label:
                "Phone fragment match",

              score:
                WEIGHTS.phone,

              details:
                row.primary_phone,
            });
          }
        }


        /*
         * Occupation
         */

        if (
          input.occupation &&
          normalizeText(
            row.occupation,
          ).includes(
            input.occupation,
          )
        ) {
          score +=
            WEIGHTS.occupation;

          evidence.push({
            key:
              "occupation",

            label:
              "Occupation match",

            score:
              WEIGHTS.occupation,

            details:
              row.occupation,
          });
        }


        /*
         * Surgery
         */

        if (
          input.surgery
        ) {
          const matches =
            (
              row.surgeries ||
              []
            ).filter(
              (
                surgery,
              ) =>
                normalizeText(
                  `${surgery.name || ""} ${surgery.bodySite || ""} ${surgery.preoperativeDiagnosis || ""} ${surgery.postoperativeDiagnosis || ""}`,
                ).includes(
                  input.surgery,
                ),
            );

          if (
            matches.length
          ) {
            score +=
              WEIGHTS.surgery;

            evidence.push({
              key:
                "surgery",

              label:
                "Previous surgery evidence",

              score:
                WEIGHTS.surgery,

              details:
                matches
                  .map(
                    (
                      item,
                    ) =>
                      item.name,
                  )
                  .join(
                    ", ",
                  ),
            });
          }
        }


        /*
         * Fracture
         */

        if (
          input.fracture
        ) {
          const matches =
            (
              row.fractures ||
              []
            ).filter(
              (
                fracture,
              ) =>
                normalizeText(
                  `${fracture.bodyPart || ""} ${fracture.fractureType || ""} ${fracture.laterality || ""}`,
                ).includes(
                  input.fracture,
                ),
            );

          if (
            matches.length
          ) {
            score +=
              WEIGHTS.fracture;

            evidence.push({
              key:
                "fracture",

              label:
                "Fracture history evidence",

              score:
                WEIGHTS.fracture,

              details:
                matches
                  .map(
                    (
                      item,
                    ) =>
                      `${item.bodyPart || ""} ${item.laterality || ""}`.trim(),
                  )
                  .join(
                    ", ",
                  ),
            });
          }
        }


        /*
         * Device
         */

        if (
          input.device
        ) {
          const matches =
            (
              row.devices ||
              []
            ).filter(
              (
                device,
              ) =>
                normalizeText(
                  `${device.type || ""} ${device.name || ""} ${device.manufacturer || ""} ${device.modelNumber || ""} ${device.serialNumber || ""} ${device.bodySite || ""}`,
                ).includes(
                  input.device,
                ),
            );

          if (
            matches.length
          ) {
            score +=
              WEIGHTS.device;

            evidence.push({
              key:
                "device",

              label:
                "Medical-device evidence",

              score:
                WEIGHTS.device,

              details:
                matches
                  .map(
                    (
                      item,
                    ) =>
                      item.name ||
                      item.type,
                  )
                  .join(
                    ", ",
                  ),
            });
          }
        }


        /*
         * Dental
         */

        if (
          input.dental
        ) {
          const matches =
            (
              row.dental_records ||
              []
            ).filter(
              (
                dental,
              ) =>
                normalizeText(
                  `${dental.condition || ""} ${dental.treatment || ""} ${dental.fillingType || ""} ${dental.toothNumber || ""}`,
                ).includes(
                  input.dental,
                ),
            );

          if (
            matches.length
          ) {
            score +=
              WEIGHTS.dental;

            evidence.push({
              key:
                "dental",

              label:
                "Dental history evidence",

              score:
                WEIGHTS.dental,

              details:
                matches
                  .map(
                    (
                      item,
                    ) =>
                      item.toothNumber
                        ? `Tooth ${item.toothNumber}`
                        : "Dental record",
                  )
                  .join(
                    ", ",
                  ),
            });
          }
        }


        /*
         * Observation
         */

        if (
          input.observation
        ) {
          const matches =
            (
              row.observations ||
              []
            ).filter(
              (
                observation,
              ) =>
                normalizeText(
                  `${observation.type || ""} ${observation.value || ""} ${observation.bodySite || ""} ${observation.laterality || ""}`,
                ).includes(
                  input.observation,
                ),
            );

          if (
            matches.length
          ) {
            score +=
              WEIGHTS.observation;

            evidence.push({
              key:
                "observation",

              label:
                "Clinical observation evidence",

              score:
                WEIGHTS.observation,

              details:
                matches
                  .map(
                    (
                      item,
                    ) =>
                      `${item.type}: ${item.value}`,
                  )
                  .join(
                    "; ",
                  ),
            });
          }
        }


        /*
         * Treatment
         */

        if (
          input.treatment
        ) {
          const matches =
            (
              row.treatments ||
              []
            ).filter(
              (
                treatment,
              ) =>
                normalizeText(
                  `${treatment.type || ""} ${treatment.name || ""} ${treatment.description || ""} ${treatment.bodySite || ""}`,
                ).includes(
                  input.treatment,
                ),
            );

          if (
            matches.length
          ) {
            score +=
              WEIGHTS.treatment;

            evidence.push({
              key:
                "treatment",

              label:
                "Treatment history evidence",

              score:
                WEIGHTS.treatment,

              details:
                matches
                  .map(
                    (
                      item,
                    ) =>
                      item.name ||
                      item.type,
                  )
                  .join(
                    ", ",
                  ),
            });
          }
        }


        /*
         * Investigation
         */

        if (
          input.investigation
        ) {
          const matches =
            (
              row.investigations ||
              []
            ).filter(
              (
                investigation,
              ) =>
                normalizeText(
                  `${investigation.type || ""} ${investigation.name || ""} ${investigation.result || ""} ${investigation.value || ""} ${investigation.bodySite || ""}`,
                ).includes(
                  input.investigation,
                ),
            );

          if (
            matches.length
          ) {
            score +=
              WEIGHTS.investigation;

            evidence.push({
              key:
                "investigation",

              label:
                "Investigation history evidence",

              score:
                WEIGHTS.investigation,

              details:
                matches
                  .map(
                    (
                      item,
                    ) =>
                      item.name,
                  )
                  .join(
                    ", ",
                  ),
            });
          }
        }


        const normalizedScore =
          Math.min(
            100,
            Math.round(
              (
                score /
                MAX_SCORE
              ) *
                100,
            ),
          );


        return {
          patient: {
            patientId:
              row.patient_id,

            hospitalId:
              row.hospital_id,

            patientNumber:
              row.patient_number,

            firstName:
              row.first_name,

            middleName:
              row.middle_name,

            lastName:
              row.last_name,

            dateOfBirth:
              row.date_of_birth,

            age:
              row.age,

            gender:
              row.gender,

            bloodGroup:
              row.blood_group,

            heightCm:
              row.height_cm,

            weightKg:
              row.weight_kg,

            primaryPhone:
              row.primary_phone,

            occupation:
              row.occupation,

            district:
              row.district,

            province:
              row.province,
          },

          score,

          normalizedScore,

          evidence,

          sourceCounts: {
            surgeries:
              (
                row.surgeries ||
                []
              ).length,

            fractures:
              (
                row.fractures ||
                []
              ).length,

            devices:
              (
                row.devices ||
                []
              ).length,

            dental:
              (
                row.dental_records ||
                []
              ).length,

            observations:
              (
                row.observations ||
                []
              ).length,

            treatments:
              (
                row.treatments ||
                []
              ).length,

            investigations:
              (
                row.investigations ||
                []
              ).length,
          },
        };
      },
    );


  candidates.sort(
    (
      a,
      b,
    ) => {
      if (
        b.score !==
        a.score
      ) {
        return (
          b.score -
          a.score
        );
      }

      return String(
        a.patient
          .patientNumber ||
          "",
      ).localeCompare(
        String(
          b.patient
            .patientNumber ||
            "",
        ),
      );
    },
  );


  return {
    searchCriteria:
      input,

    weightModel: {
      ...WEIGHTS,

      maximumScore:
        MAX_SCORE,

      note:
        "Explainable heuristic evidence weighting; not a medically validated probability.",
    },

    count:
      candidates.length,

    candidates,
  };
}


module.exports = {
  searchPatients,
  WEIGHTS,
  MAX_SCORE,
};