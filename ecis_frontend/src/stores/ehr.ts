import {
  computed,
  onMounted,
  reactive,
  ref,
} from "vue";

import type {
  Patient,
  TreatmentRecord,
  Ward,
  EmergencyCase,
  ECISFilters,
} from "../types";


/* ============================================================
   API
   ============================================================ */

const API_BASE =
  "http://localhost:5000/api";


function getToken(): string {
  return (
    localStorage.getItem(
      "ecis-token",
    ) || ""
  );
}


async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers =
    new Headers(
      options.headers,
    );


  headers.set(
    "Content-Type",
    "application/json",
  );


  const jwt =
    getToken();


  if (jwt) {
    headers.set(
      "Authorization",
      `Bearer ${jwt}`,
    );
  }


  const response =
    await fetch(
      `${API_BASE}${path}`,
      {
        ...options,

        headers,
      },
    );


  const raw =
    await response.text();


  let body: any =
    {};


  try {
    body =
      raw
        ? JSON.parse(raw)
        : {};
  } catch {
    body = {};
  }


  if (!response.ok) {
    throw new Error(
      body?.message ||
        body?.error ||
        `HTTP ${response.status}`,
    );
  }


  return body as T;
}


async function apiGet<T>(
  path: string,
): Promise<T> {
  return request<T>(
    path,
    {
      method: "GET",
    },
  );
}


async function apiPost<T>(
  path: string,
  payload: unknown,
): Promise<T> {
  return request<T>(
    path,
    {
      method: "POST",

      body:
        JSON.stringify(
          payload,
        ),
    },
  );
}


async function apiPut<T>(
  path: string,
  payload: unknown,
): Promise<T> {
  return request<T>(
    path,
    {
      method: "PUT",

      body:
        JSON.stringify(
          payload,
        ),
    },
  );
}


/* ============================================================
   DEMO WARD CONFIGURATION
   ============================================================ */

function makeBeds(
  prefix: string,
  count: number,
  occupied: number,
): Ward["beds"] {
  return Array.from(
    {
      length: count,
    },

    (_, index) => ({
      id:
        `${prefix}-${index + 1}`,

      number:
        `${prefix}-${String(
          index + 1,
        ).padStart(
          2,
          "0",
        )}`,

      status:
        index < occupied
          ? "OCCUPIED"
          : "AVAILABLE",
    }),
  );
}


const demoWards:
  Ward[] = [
    {
      id: "W01",

      name:
        "Medical Ward A",

      department:
        "Medicine",

      floor: "1",

      capacity: 30,

      beds:
        makeBeds(
          "A",
          30,
          22,
        ),
    },

    {
      id: "W02",

      name:
        "Surgical Ward",

      department:
        "Surgery",

      floor: "2",

      capacity: 24,

      beds:
        makeBeds(
          "S",
          24,
          17,
        ),
    },

    {
      id: "W03",

      name:
        "Pediatric Ward",

      department:
        "Pediatrics",

      floor: "2",

      capacity: 20,

      beds:
        makeBeds(
          "P",
          20,
          12,
        ),
    },
  ];


/* ============================================================
   REACTIVE STATE
   ============================================================ */

const db =
  reactive<{
    patients: Patient[];

    treatments:
      TreatmentRecord[];

    wards: Ward[];

    emergencies:
      EmergencyCase[];
  }>({
    patients: [],

    treatments: [],

    wards:
      demoWards,

    emergencies: [],
  });


const loading =
  ref(false);


const loadError =
  ref("");


/* ============================================================
   HELPERS
   ============================================================ */

function responseArray(
  response: any,
): any[] {
  if (
    Array.isArray(
      response,
    )
  ) {
    return response;
  }


  if (
    Array.isArray(
      response?.data,
    )
  ) {
    return response.data;
  }


  if (
    Array.isArray(
      response?.rows,
    )
  ) {
    return response.rows;
  }


  return [];
}


/* ============================================================
   MAP PATIENT
   ============================================================ */

function mapPatient(
  row: any,
): Patient {
  const allergies =
    Array.isArray(
      row?.allergies,
    )
      ? row.allergies
      : [];


  const foodAllergies =
    allergies
      .filter(
        (
          item: any,
        ) =>
          item?.category ===
          "FOOD",
      )
      .map(
        (
          item: any,
        ) =>
          String(
            item?.name || "",
          ),
      )
      .filter(Boolean);


  const medicalAllergies =
    allergies
      .filter(
        (
          item: any,
        ) =>
          item?.category ===
          "MEDICAL_DRUG",
      )
      .map(
        (
          item: any,
        ) =>
          String(
            item?.name || "",
          ),
      )
      .filter(Boolean);


  return {
    id: String(
      row?.patient_id ??
        row?.id ??
        "",
    ),

    patientNumber:
      String(
        row?.patient_number ??
          "",
      ),

    nic:
      row?.nic_number ??
      "",

    firstName:
      row?.first_name ??
      "",

    lastName:
      row?.last_name ??
      "",

    dateOfBirth:
      row?.date_of_birth ??
      "",

    gender:
      row?.gender ??
      "",

    bloodGroup:
      row?.blood_group ??
      "",

    heightCm:
      row?.height_cm != null
        ? Number(
            row.height_cm,
          )
        : 0,

    weightKg:
      row?.weight_kg != null
        ? Number(
            row.weight_kg,
          )
        : 0,

    phone:
      row?.primary_phone ??
      "",

    email:
      row?.email ??
      "",

    address:
      row?.address ??
      "",

    province:
      row?.province ??
      "",

    district:
      row?.district ??
      "",

    workplace:
      row?.occupation ??
      "",

    foodAllergies,

    medicalAllergies,

    allergies:
      [
        ...foodAllergies,
        ...medicalAllergies,
      ],

    chronicDiseases:
      Array.isArray(
        row?.chronicDiseases,
      )
        ? row.chronicDiseases
        : [],

    registrationNotes:
      row?.registration_notes ??
      "",

    createdAt:
      row?.created_at ??
      row?.registered_at ??
      "",
  };
}


/* ============================================================
   MAP TREATMENT
   ============================================================ */

function mapTreatment(
  row: any,
): TreatmentRecord {
  return {
    id: String(
      row?.treatment_id ??
        row?.id ??
        "",
    ),

    patientId:
      String(
        row?.patient_id ??
          row?.patientId ??
          "",
      ),

    type:
      row?.treatment_type ??
      row?.type ??
      "OPD",

    date:
      row?.treatment_date ??
      row?.date ??
      "",

    department:
      row?.department ??
      "",

    doctor:
      row?.doctor ??
      row?.performed_by_name ??
      "",

    diagnosis:
      row?.diagnosis ??
      "",

    treatment:
      row?.treatment_name ??
      row?.treatment ??
      "",

    notes:
      row?.description ??
      row?.notes ??
      "",

    bodyRegion:
      row?.body_site ??
      "",

    clinicalFinding:
      row?.clinicalFinding ??
      "",

    implant:
      row?.implant ??
      "",

    implantSerial:
      row?.implantSerial ??
      "",

    scar:
      row?.scar ??
      "",

    oldFracture:
      row?.oldFracture ??
      "",

    birthmark:
      row?.birthmark ??
      "",

    tattoo:
      row?.tattoo ??
      "",

    missingBodyPart:
      row?.missingBodyPart ??
      "",
  };
}


/* ============================================================
   MAP EMERGENCY
   ============================================================ */

function mapEmergency(
  row: any,
): EmergencyCase {
  const patientId =
    row?.patient_id ??
    row?.patientId;


  const unidentified =
    Boolean(
      row?.unidentified_patient ??
        row?.unidentifiedPatient,
    );


  return {
    id:
      String(
        row?.emergency_case_id ??
          row?.case_number ??
          row?.id ??
          "",
      ),

    patientId:
      patientId != null
        ? String(
            patientId,
          )
        : undefined,

    arrival:
      row?.arrival_date ??
      row?.arrival ??
      "",

    description:
      row?.chief_complaint ??
      row?.initial_condition ??
      "",

    department:
      row?.department ??
      "Emergency",

    status:
      unidentified
        ? "UNIDENTIFIED"
        : (
            row?.status ??
            "IN_TREATMENT"
          ),
  };
}


/* ============================================================
   LOAD PATIENTS
   ============================================================ */

async function loadPatients() {
  const response =
    await apiGet<any>(
      "/patients",
    );


  const rows =
    responseArray(
      response,
    );


  db.patients.splice(
    0,

    db.patients.length,

    ...rows.map(
      mapPatient,
    ),
  );
}


/* ============================================================
   LOAD TREATMENTS
   ============================================================ */

async function loadTreatments() {
  try {
    const response =
      await apiGet<any>(
        "/treatments",
      );


    const rows =
      responseArray(
        response,
      );


    db.treatments.splice(
      0,

      db.treatments.length,

      ...rows.map(
        mapTreatment,
      ),
    );
  } catch (error) {
    /*
     * Treatment API is currently independent.
     * Do not break patients when it fails.
     */

    console.warn(
      "Treatment load failed:",
      error,
    );
  }
}


/* ============================================================
   LOAD EMERGENCIES
   ============================================================ */

async function loadEmergencies() {
  try {
    const response =
      await apiGet<any>(
        "/emergency",
      );


    const rows =
      responseArray(
        response,
      );


    db.emergencies.splice(
      0,

      db.emergencies.length,

      ...rows.map(
        mapEmergency,
      ),
    );
  } catch (error) {
    console.warn(
      "Emergency load failed:",
      error,
    );
  }
}


/* ============================================================
   LOAD EVERYTHING
   ============================================================ */

async function loadBackendData() {
  loading.value =
    true;

  loadError.value =
    "";


  try {
    /*
     * Patients are mandatory.
     */
    await loadPatients();
  } catch (error) {
    console.error(
      "PATIENT LOAD FAILED:",
      error,
    );


    loadError.value =
      error instanceof Error
        ? error.message
        : "Unable to load patients.";
  }


  /*
   * Other modules cannot break
   * the patient registry.
   */
  await loadTreatments();

  await loadEmergencies();


  loading.value =
    false;
}


/* ============================================================
   STORE
   ============================================================ */

export function useEHR() {
  const patients =
    computed(
      () =>
        db.patients,
    );


  const treatments =
    computed(
      () =>
        db.treatments,
    );


  const wards =
    computed(
      () =>
        db.wards,
    );


  const emergencies =
    computed(
      () =>
        db.emergencies,
    );


  /* ----------------------------------------------------------
     FIND PATIENT
     ---------------------------------------------------------- */

  function patientById(
    id: string,
  ) {
    return patients.value.find(
      (
        patient,
      ) =>
        String(
          patient.id,
        ) ===
          String(id) ||

        String(
          patient.patientNumber,
        ) ===
          String(id),
    );
  }


  /* ----------------------------------------------------------
     PATIENT TREATMENTS
     ---------------------------------------------------------- */

  function treatmentsForPatient(
    patientId: string,
  ) {
    return treatments.value
      .filter(
        (
          treatment,
        ) =>
          String(
            treatment.patientId,
          ) ===
            String(
              patientId,
            ),
      )
      .sort(
        (
          a,
          b,
        ) =>
          String(
            b.date,
          ).localeCompare(
            String(
              a.date,
            ),
          ),
      );
  }


  /* ----------------------------------------------------------
     REFRESH
     ---------------------------------------------------------- */

  async function refresh() {
    await loadBackendData();
  }


  /* ----------------------------------------------------------
     CREATE PATIENT
     ---------------------------------------------------------- */

  async function addPatient(
    data: Omit<
      Patient,
      "id" |
      "patientNumber" |
      "createdAt"
    >,
  ) {
    const response =
      await apiPost<any>(
        "/patients",
        {
          firstName:
            data.firstName,

          lastName:
            data.lastName,

          nicNumber:
            data.nic ||
            null,

          dateOfBirth:
            data.dateOfBirth,

          gender:
            data.gender,

          bloodGroup:
            data.bloodGroup,

          heightCm:
            data.heightCm ||
            null,

          weightKg:
            data.weightKg ||
            null,

          primaryPhone:
            data.phone ||
            null,

          email:
            data.email ||
            null,

          address:
            data.address ||
            null,

          province:
            data.province ||
            null,

          district:
            data.district ||
            null,

          occupation:
            data.workplace ||
            null,

          registrationNotes:
            data.registrationNotes ||
            null,

          foodAllergies:
            data.foodAllergies ||
            [],

          medicalAllergies:
            data.medicalAllergies ||
            [],

          status:
            "ACTIVE",
        },
      );


    if (!response?.data) {
      throw new Error(
        "Server did not return the created patient.",
      );
    }


    /*
     * Do NOT manually generate P000xxx.
     * PostgreSQL is authoritative.
     */
    await loadPatients();


    return mapPatient(
      response.data,
    );
  }


  /* ----------------------------------------------------------
     UPDATE PATIENT
     ---------------------------------------------------------- */

  async function updatePatient(
    patientId: string,
    data: Partial<Patient>,
  ) {
    const response =
      await apiPut<any>(
        `/patients/${patientId}`,
        {
          firstName:
            data.firstName,

          lastName:
            data.lastName,

          nicNumber:
            data.nic ||

            undefined,

          dateOfBirth:
            data.dateOfBirth,

          gender:
            data.gender,

          bloodGroup:
            data.bloodGroup,

          heightCm:
            data.heightCm,

          weightKg:
            data.weightKg,

          primaryPhone:
            data.phone,

          email:
            data.email,

          address:
            data.address,

          province:
            data.province,

          district:
            data.district,

          occupation:
            data.workplace,

          registrationNotes:
            data.registrationNotes,

          foodAllergies:
            data.foodAllergies,

          medicalAllergies:
            data.medicalAllergies,

          status:
            "ACTIVE",
        },
      );


    if (!response?.data) {
      throw new Error(
        "Server did not return the updated patient.",
      );
    }


    await loadPatients();


    return mapPatient(
      response.data,
    );
  }


  /* ----------------------------------------------------------
     TEMPORARY LOCAL TREATMENT COMPATIBILITY
     ---------------------------------------------------------- */

  function addTreatment(
    data: Omit<
      TreatmentRecord,
      "id"
    >,
  ) {
    db.treatments.unshift({
      ...data,

      id:
        `LOCAL-${Date.now()}`,
    });
  }


  /* ----------------------------------------------------------
     WARD
     ---------------------------------------------------------- */

  function addWard(
    name: string,
    department: string,
    floor: string,
    capacity: number,
  ) {
    const id =
      `W${String(
        wards.value.length +
          1,
      ).padStart(
        2,
        "0",
      )}`;


    db.wards.push({
      id,

      name,

      department,

      floor,

      capacity,

      beds: Array.from(
        {
          length: capacity,
        },

        (
          _,
          index,
        ) => ({
          id:
            `${id}-${index + 1}`,

          number:
            `${name
              .slice(
                0,
                1,
              )
              .toUpperCase()}-${String(
              index + 1,
            ).padStart(
              2,
              "0",
            )}`,

          status:
            "AVAILABLE",
        }),
      ),
    });
  }


  function assignBed(
    wardId: string,
    bedId: string,
    patientId: string,
  ) {
    const ward =
      db.wards.find(
        (
          item,
        ) =>
          item.id ===
          wardId,
      );


    const bed =
      ward?.beds.find(
        (
          item,
        ) =>
          item.id ===
          bedId,
      );


    if (!bed) {
      return;
    }


    bed.status =
      "OCCUPIED";


    bed.patientId =
      patientId;
  }


  /* ----------------------------------------------------------
     EMERGENCY
     ---------------------------------------------------------- */

  function addEmergency(
    data: Omit<
      EmergencyCase,
      "id"
    >,
  ) {
    db.emergencies.unshift({
      ...data,

      id:
        `LOCAL-${Date.now()}`,
    });
  }


  /* ----------------------------------------------------------
     ECIS LOCAL FALLBACK
     ---------------------------------------------------------- */

  function searchECIS(
    filters: ECISFilters,
  ) {
    const getAge =
      (
        dateString: string,
      ) => {
        const timestamp =
          new Date(
            dateString,
          ).getTime();


        if (
          Number.isNaN(
            timestamp,
          )
        ) {
          return 0;
        }


        return Math.floor(
          (
            Date.now() -
            timestamp
          ) /
            31557600000,
        );
      };


    return patients.value
      .map(
        (
          patient,
        ) => {
          const records =
            treatmentsForPatient(
              patient.id,
            );


          const clinicalText =
            records
              .map(
                (
                  record,
                ) =>
                  [
                    record
                      .diagnosis,

                    record
                      .treatment,

                    record
                      .notes,

                    record
                      .bodyRegion,

                    record
                      .clinicalFinding,

                    record
                      .implant,

                    record
                      .scar,

                    record
                      .oldFracture,

                    record
                      .birthmark,

                    record
                      .tattoo,

                    record
                      .missingBodyPart,
                  ]
                    .filter(
                      Boolean,
                    )
                    .join(
                      " ",
                    ),
              )
              .join(
                " ",
              )
              .toLowerCase();


          let score =
            0;


          const evidence:
            string[] = [];


          const patientAge =
            getAge(
              patient
                .dateOfBirth,
            );


          if (
            (
              filters.ageMin !=
                null ||
              filters.ageMax !=
                null
            ) &&
            (
              filters.ageMin ==
                null ||
              patientAge >=
                filters.ageMin
            ) &&
            (
              filters.ageMax ==
                null ||
              patientAge <=
                filters.ageMax
            )
          ) {
            score += 10;

            evidence.push(
              "Age",
            );
          }


          if (
            filters.bloodGroup &&
            patient.bloodGroup ===
              filters.bloodGroup
          ) {
            score += 12;

            evidence.push(
              "Blood group",
            );
          }


          if (
            filters.gender &&
            patient.gender ===
              filters.gender
          ) {
            score += 7;

            evidence.push(
              "Gender",
            );
          }


          if (
            filters.name &&
            `
              ${patient.firstName}
              ${patient.lastName}
              ${patient.patientNumber}
            `
              .toLowerCase()
              .includes(
                filters.name
                  .toLowerCase(),
              )
          ) {
            score += 12;

            evidence.push(
              "Name",
            );
          }


          if (
            filters.workplace &&
            patient.workplace
              .toLowerCase()
              .includes(
                filters.workplace
                  .toLowerCase(),
              )
          ) {
            score += 8;

            evidence.push(
              "Workplace",
            );
          }


          const clues = [
            [
              filters.procedure,
              18,
              "Procedure",
            ],

            [
              filters.implant,
              18,
              "Implant/device",
            ],

            [
              filters.finding,
              15,
              "Clinical finding",
            ],

            [
              filters.bodyRegion,
              12,
              "Body region",
            ],

            [
              filters.scar,
              15,
              "Scar",
            ],

            [
              filters.birthmark,
              12,
              "Birthmark",
            ],

            [
              filters.tattoo,
              10,
              "Tattoo",
            ],

            [
              filters.missingBodyPart,
              15,
              "Missing body part",
            ],

            [
              filters.fracture,
              15,
              "Fracture",
            ],
          ] as Array<
            [
              string |
                undefined,

              number,

              string,
            ]
          >;


          for (
            const [
              clue,
              weight,
              label,
            ] of clues
          ) {
            if (
              clue &&
              clinicalText.includes(
                clue.toLowerCase(),
              )
            ) {
              score +=
                weight;

              evidence.push(
                label,
              );
            }
          }


          if (
            filters.hasSurgery &&
            !records.some(
              (
                record,
              ) =>
                record.type ===
                "SURGERY",
            )
          ) {
            score =
              0;
          }


          return {
            patient,

            score,

            evidence,

            records,
          };
        },
      )
      .filter(
        (
          item,
        ) =>
          item.score >
          0,
      )
      .sort(
        (
          a,
          b,
        ) =>
          b.score -
          a.score,
      );
  }


  /*
   * Initial load.
   */
  onMounted(() => {
    void refresh();
  });


  return {
    patients,

    treatments,

    wards,

    emergencies,

    loading,

    loadError,

    patientById,

    treatmentsForPatient,

    addPatient,

    updatePatient,

    addTreatment,

    addWard,

    assignBed,

    addEmergency,

    searchECIS,

    refresh,
  };
}