import { computed, onMounted, reactive, ref } from "vue";

import { calculateAge } from "../utils/patient";

import {
  apiGet,
  apiPost,
  apiPut,
} from "../services/api";

import type {
  Patient,
  TreatmentRecord,
  Ward,
  EmergencyCase,
  ECISFilters,
} from "../types";

/* ============================================================
   AUTHENTICATED USER HELPERS
   ============================================================ */

/*
 * The authenticated hospital is taken from the user information
 * saved after login.
 *
 * IMPORTANT:
 * This value is only used by the frontend for selecting/loading
 * the current hospital's data.
 *
 * The backend remains responsible for validating the actual
 * hospital ownership using the JWT.
 */
function getHospitalId(): number | null {
  try {
    const rawUser =
      localStorage.getItem(
        "ecis-user",
      );

    if (!rawUser) {
      return null;
    }

    const hospitalId =
      Number(
        JSON.parse(
          rawUser,
        )?.hospitalId,
      );

    return Number.isInteger(
      hospitalId,
    ) && hospitalId > 0
      ? hospitalId
      : null;
  } catch {
    return null;
  }
}

/* ============================================================
   REACTIVE STATE
   ============================================================ */

const db = reactive<{
  patients: Patient[];
  treatments: TreatmentRecord[];
  wards: Ward[];
  emergencies: EmergencyCase[];
}>({
  patients: [],
  treatments: [],
  wards: [],
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
        (item: any) =>
          item?.category ===
          "FOOD",
      )
      .map(
        (item: any) =>
          String(
            item?.name || "",
          ),
      )
      .filter(Boolean);

  const medicalAllergies =
    allergies
      .filter(
        (item: any) =>
          item?.category ===
          "MEDICAL_DRUG",
      )
      .map(
        (item: any) =>
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

    allergies: [
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

    patientId: String(
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
    id: String(
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
        : row?.status ??
          "IN_TREATMENT",
  };
}

/* ============================================================
   MAP WARD
   ============================================================ */

function mapWard(
  ward: any,
  beds: any[],
): Ward {
  return {
    id: String(
      ward?.ward_id ??
        ward?.id ??
        "",
    ),

    name:
      ward?.ward_name ??
      ward?.name ??
      "Unnamed ward",

    department:
      ward?.ward_type ??
      ward?.department ??
      "General",

    floor: String(
      ward?.floor ??
        "—",
    ),

    capacity:
      Number(
        ward?.capacity ??
          ward?.total_beds ??
          beds.length,
      ),

    beds: beds.map(
      (bed) => ({
        id: String(
          bed?.bed_id ??
            bed?.id ??
            "",
        ),

        number: String(
          bed?.bed_number ??
            bed?.number ??
            "",
        ),

        status:
          [
            "AVAILABLE",
            "OCCUPIED",
            "MAINTENANCE",
          ].includes(
            bed?.status,
          )
            ? bed.status
            : "MAINTENANCE",

        patientId:
          bed?.patient_id !=
          null
            ? String(
                bed.patient_id,
              )
            : undefined,
      }),
    ),
  };
}

/* ============================================================
   LOAD PATIENTS
   ============================================================ */

async function loadPatients() {
  /*
   * IMPORTANT:
   *
   * apiGet() now comes from services/api.ts.
   *
   * Therefore an expired access token is automatically refreshed
   * before the request is finally considered failed.
   */
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
   LOAD WARDS AND BEDS
   ============================================================ */

async function loadWards() {
  const hospitalId =
    getHospitalId();

  if (!hospitalId) {
    db.wards.splice(
      0,
      db.wards.length,
    );

    return;
  }

  try {
    const response =
      await apiGet<any>(
        `/wards/hospital/${hospitalId}`,
      );

    const wardRows =
      responseArray(
        response,
      );

    const mappedWards =
      await Promise.all(
        wardRows.map(
          async (
            ward,
          ) => {
            const bedsResponse =
              await apiGet<any>(
                `/wards/${ward.ward_id}/beds`,
              );

            return mapWard(
              ward,
              responseArray(
                bedsResponse,
              ),
            );
          },
        ),
      );

    db.wards.splice(
      0,
      db.wards.length,
      ...mappedWards,
    );
  } catch (error) {
    console.warn(
      "Ward load failed:",
      error,
    );

    db.wards.splice(
      0,
      db.wards.length,
    );
  }
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
  await Promise.all([
    loadTreatments(),
    loadEmergencies(),
    loadWards(),
  ]);

  loading.value =
    false;
}

/* ============================================================
   STORE
   ============================================================ */

export function useEHR() {
  const patients =
    computed(
      () => db.patients,
    );

  const treatments =
    computed(
      () => db.treatments,
    );

  const wards =
    computed(
      () => db.wards,
    );

  const emergencies =
    computed(
      () => db.emergencies,
    );

  /* ----------------------------------------------------------
     FIND PATIENT
     ---------------------------------------------------------- */

  function patientById(
    id: string,
  ) {
    return patients.value.find(
      (patient) =>
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
        (treatment) =>
          String(
            treatment.patientId,
          ) ===
          String(
            patientId,
          ),
      )
      .sort(
        (a, b) =>
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
     PERSIST TREATMENT RECORD
     ---------------------------------------------------------- */

  async function addTreatment(
    data: Omit<
      TreatmentRecord,
      "id"
    >,
  ) {
    const response =
      await apiPost<any>(
        "/treatments",
        {
          patientId:
            Number(
              data.patientId,
            ),

          treatmentDate:
            data.date ||
            null,

          treatmentType:
            data.type,

          treatmentName:
            data.treatment ||
            null,

          description: [
            data.diagnosis
              ? `Diagnosis: ${data.diagnosis}`
              : "",

            data.notes ||
              "",

            data.clinicalFinding
              ? `Clinical finding: ${data.clinicalFinding}`
              : "",

            data.implant
              ? `Implant/device: ${data.implant}`
              : "",

            data.implantSerial
              ? `Device serial: ${data.implantSerial}`
              : "",

            data.scar
              ? `Scar: ${data.scar}`
              : "",

            data.oldFracture
              ? `Old fracture: ${data.oldFracture}`
              : "",

            data.birthmark
              ? `Birthmark: ${data.birthmark}`
              : "",

            data.tattoo
              ? `Tattoo: ${data.tattoo}`
              : "",

            data.missingBodyPart
              ? `Missing body part: ${data.missingBodyPart}`
              : "",
          ]
            .filter(Boolean)
            .join(
              "\n",
            ),

          bodySite:
            data.bodyRegion ||
            null,
        },
      );

    if (!response?.data) {
      throw new Error(
        "Server did not return the saved treatment record.",
      );
    }

    await loadTreatments();

    return mapTreatment(
      response.data,
    );
  }

  /* ----------------------------------------------------------
     WARD
     ---------------------------------------------------------- */

  async function addWard(
    name: string,
    department: string,
    floor: string,
    capacity: number,
  ) {
    const hospitalId =
      getHospitalId();

    if (!hospitalId) {
      throw new Error(
        "Authenticated hospital information is missing.",
      );
    }

    const bedCount =
      Math.max(
        1,
        Math.floor(
          capacity,
        ),
      );

    const wardCode =
      `WARD-${Date.now()}`;

    const response =
      await apiPost<any>(
        "/wards",
        {
          /*
           * Kept for compatibility with the
           * existing frontend.
           *
           * The backend does NOT trust this value.
           * It gets hospitalId from req.user.
           */
          hospitalId,

          wardCode,

          wardName:
            name,

          wardType:
            department,

          floor,

          capacity:
            bedCount,
        },
      );

    const wardId =
      response?.data
        ?.ward_id;

    if (!wardId) {
      throw new Error(
        "Server did not return the created ward.",
      );
    }

    /*
     * Create the requested beds.
     *
     * Each request goes through the central API
     * service, so token refresh is also handled here.
     */
    await Promise.all(
      Array.from(
        {
          length:
            bedCount,
        },
        (
          _,
          index,
        ) =>
          apiPost(
            `/wards/${wardId}/beds`,
            {
              bedNumber:
                `${wardCode}-${String(
                  index + 1,
                ).padStart(
                  2,
                  "0",
                )}`,
            },
          ),
      ),
    );

    await loadWards();
  }

  /* ----------------------------------------------------------
     ASSIGN PATIENT TO BED
     ---------------------------------------------------------- */

  async function assignBed(
    wardId: string,
    bedId: string,
    patientId: string,
  ) {
    const hospitalId =
      getHospitalId();

    if (!hospitalId) {
      throw new Error(
        "Authenticated hospital information is missing.",
      );
    }

    await apiPost(
      "/admissions",
      {
        patientId:
          Number(
            patientId,
          ),

        /*
         * Kept for compatibility.
         * Backend uses the JWT hospital as authoritative.
         */
        hospitalId,

        wardId:
          Number(
            wardId,
          ),

        bedId:
          Number(
            bedId,
          ),

        admissionNumber:
          `ADM-${Date.now()}`,
      },
    );

    await loadWards();
  }

  /* ----------------------------------------------------------
     PERSIST EMERGENCY CASE
     ---------------------------------------------------------- */

  async function addEmergency(
    data: Omit<
      EmergencyCase,
      "id"
    > &
      Record<
        string,
        any
      >,
  ) {
    const response =
      await apiPost<any>(
        "/emergency",
        {
          caseNumber:
            data.caseNumber ||
            `EMG-${Date.now()}`,

          patientId:
            data.patientId
              ? Number(
                  data.patientId,
                )
              : null,

          arrivalDate:
            data.arrival ||
            new Date().toISOString(),

          arrivalMode:
            data.arrivalMode ||
            "WALK_IN",

          triageLevel:
            data.triageLevel ||
            null,

          chiefComplaint:
            data.chiefComplaint ||
            data.description ||
            "Emergency presentation",

          initialCondition:
            data.initialCondition ||
            null,

          unidentifiedPatient:
            !data.patientId,

          temporaryIdentityReference:
            data.temporaryIdentityReference ||
            null,
        },
      );

    await loadEmergencies();

    return response?.data;
  }

  /* ----------------------------------------------------------
     ECIS SEARCH
     ---------------------------------------------------------- */

  async function searchECIS(
    filters: ECISFilters,
  ) {
    const payload = {
      ageMin:
        filters.ageMin,

      ageMax:
        filters.ageMax,

      heightMin:
        filters.heightMin,

      heightMax:
        filters.heightMax,

      weightMin:
        filters.weightMin,

      weightMax:
        filters.weightMax,

      bloodGroup:
        filters.bloodGroup,

      gender:
        filters.gender,

      province:
        filters.province,

      district:
        filters.district,

      partialName:
        filters.name,

      phoneFragment:
        filters.phoneDigits,

      workplace:
        filters.workplace,

      previousSurgery:
        filters.procedure,

      implantOrDevice:
        filters.implant,

      clinicalObservation:
        filters.finding,

      bodyRegion:
        filters.bodyRegion,

      missingBodyPart:
        filters.missingBodyPart,

      scar:
        filters.scar,

      birthmark:
        filters.birthmark,

      tattoo:
        filters.tattoo,

      fracture:
        filters.fracture,
    };

    return apiPost<any>(
      "/ecis/search",
      payload,
    );
  }

  /* ----------------------------------------------------------
     INITIAL LOAD
     ---------------------------------------------------------- */

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