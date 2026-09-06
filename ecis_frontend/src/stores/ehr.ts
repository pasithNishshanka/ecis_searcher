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

type Bed = Ward["beds"][number];

const API_BASE = "http://localhost:5000/api";

const demoWards: Ward[] = [
  {
    id: "W01",
    name: "Medical Ward A",
    department: "Medicine",
    floor: "1",
    capacity: 30,
    beds: Array.from(
      { length: 30 },
      (_: unknown, i: number): Bed => ({
        id: `A-${i + 1}`,
        number: `A-${String(i + 1).padStart(2, "0")}`,
        status: i < 22 ? "OCCUPIED" : "AVAILABLE",
      }),
    ),
  },
  {
    id: "W02",
    name: "Surgical Ward",
    department: "Surgery",
    floor: "2",
    capacity: 24,
    beds: Array.from(
      { length: 24 },
      (_: unknown, i: number): Bed => ({
        id: `S-${i + 1}`,
        number: `S-${String(i + 1).padStart(2, "0")}`,
        status: i < 17 ? "OCCUPIED" : "AVAILABLE",
      }),
    ),
  },
  {
    id: "W03",
    name: "Pediatric Ward",
    department: "Pediatrics",
    floor: "2",
    capacity: 20,
    beds: Array.from(
      { length: 20 },
      (_: unknown, i: number): Bed => ({
        id: `P-${i + 1}`,
        number: `P-${String(i + 1).padStart(2, "0")}`,
        status: i < 12 ? "OCCUPIED" : "AVAILABLE",
      }),
    ),
  },
];

const db = reactive<{
  patients: Patient[];
  treatments: TreatmentRecord[];
  wards: Ward[];
  emergencies: EmergencyCase[];
}>({
  patients: [],
  treatments: [],
  wards: demoWards,
  emergencies: [],
});

const loading = ref(false);
const loadError = ref("");

function getToken(): string {
  return localStorage.getItem("ecis-token") || "";
}

async function apiGet<T>(path: string): Promise<T> {
  const token = getToken();

  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
    },
  });

  const raw = await response.text();

  let data: any = {};

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Request failed with status ${response.status}`,
    );
  }

  return data;
}

function extractArray<T>(response: any): T[] {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.rows)) {
    return response.rows;
  }

  if (Array.isArray(response?.patients)) {
    return response.patients;
  }

  if (Array.isArray(response?.treatments)) {
    return response.treatments;
  }

  if (Array.isArray(response?.emergencies)) {
    return response.emergencies;
  }

  if (Array.isArray(response?.cases)) {
    return response.cases;
  }

  return [];
}

function mapPatient(row: any): Patient {
  return {
    id: String(
      row?.id ??
        row?.patient_id ??
        row?.patientId ??
        row?.patient_number ??
        row?.patientNumber ??
        "",
    ),

    patientNumber: String(
      row?.patientNumber ??
        row?.patient_number ??
        row?.id ??
        row?.patient_id ??
        "",
    ),

    nic:
      row?.nic ??
      row?.nic_number ??
      row?.nicNumber ??
      "",

    firstName:
      row?.firstName ??
      row?.first_name ??
      "",

    lastName:
      row?.lastName ??
      row?.last_name ??
      "",

    dateOfBirth:
      row?.dateOfBirth ??
      row?.date_of_birth ??
      "",

    gender:
      row?.gender ??
      "",

    bloodGroup:
      row?.bloodGroup ??
      row?.blood_group ??
      "",

    phone:
      row?.phone ??
      row?.primaryPhone ??
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

    heightCm:
      row?.heightCm ??
      row?.height_cm ??
      undefined,

    weightKg:
      row?.weightKg ??
      row?.weight_kg ??
      undefined,

    allergies:
      row?.allergies ?? [],

    foodAllergies:
      row?.foodAllergies ??
      [],

    medicalAllergies:
      row?.medicalAllergies ??
      [],

    chronicDiseases:
      row?.chronicDiseases ??
      [],

    workplace:
      row?.workplace ??
      row?.occupation ??
      "",

    createdAt:
      row?.createdAt ??
      row?.created_at ??
      "",
  };
}

function mapTreatment(row: any): TreatmentRecord {
  return {
    id: String(
      row?.id ??
        row?.treatment_id ??
        "",
    ),

    patientId: String(
      row?.patientId ??
        row?.patient_id ??
        "",
    ),

    type:
      row?.type ??
      row?.treatment_type ??
      "OPD",

    date:
      row?.date ??
      row?.treatmentDate ??
      row?.treatment_date ??
      "",

    department:
      row?.department ??
      "",

    doctor:
      row?.doctor ??
      "",

    diagnosis:
      row?.diagnosis ??
      row?.description ??
      "",

    treatment:
      row?.treatment ??
      row?.treatment_name ??
      "",

    notes:
      row?.notes ??
      row?.description ??
      "",

    bodyRegion:
      row?.bodyRegion ??
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
      row?.serial_number ??
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

function mapEmergency(row: any): EmergencyCase {
  const unidentified =
    Boolean(
      row?.unidentified_patient ??
        row?.unidentifiedPatient ??
        false,
    );

  const patientId =
    row?.patientId ??
    row?.patient_id;

  return {
    id: String(
      row?.id ??
        row?.case_number ??
        row?.emergency_case_id ??
        "",
    ),

    arrival:
      row?.arrival ??
      row?.arrival_date ??
      "",

    description:
      row?.description ??
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

    patientId:
      patientId != null
        ? String(patientId)
        : undefined,
  };
}

async function loadBackendData(): Promise<void> {
  loading.value = true;
  loadError.value = "";

  try {
    const [
      patientsResponse,
      treatmentsResponse,
      emergenciesResponse,
    ] = await Promise.all([
      apiGet<any>("/patients"),
      apiGet<any>("/treatments"),
      apiGet<any>("/emergency"),
    ]);

    const patientRows =
      extractArray<any>(
        patientsResponse,
      );

    const treatmentRows =
      extractArray<any>(
        treatmentsResponse,
      );

    const emergencyRows =
      extractArray<any>(
        emergenciesResponse,
      );

    db.patients.splice(
      0,
      db.patients.length,
      ...patientRows.map(mapPatient),
    );

    db.treatments.splice(
      0,
      db.treatments.length,
      ...treatmentRows.map(mapTreatment),
    );

    db.emergencies.splice(
      0,
      db.emergencies.length,
      ...emergencyRows.map(mapEmergency),
    );
  } catch (error) {
    loadError.value =
      error instanceof Error
        ? error.message
        : "Failed to load EHR data.";

    console.error(
      "Failed to load EHR backend data:",
      error,
    );

    /*
     * Do NOT overwrite the backend-independent ward
     * configuration when EHR API loading fails.
     */
  } finally {
    loading.value = false;
  }
}

export function useEHR() {
  const patients = computed(
    () => db.patients,
  );

  const treatments = computed(
    () => db.treatments,
  );

  const wards = computed(
    () => db.wards,
  );

  const emergencies = computed(
    () => db.emergencies,
  );

  const patientById = (
    id: string,
  ) =>
    patients.value.find(
      (patient: Patient) =>
        String(patient.id) === String(id) ||
        String(patient.patientNumber) ===
          String(id),
    );

  const treatmentsForPatient = (
    id: string,
  ) =>
    treatments.value
      .filter(
        (treatment: TreatmentRecord) =>
          String(treatment.patientId) ===
          String(id),
      )
      .sort(
        (
          a: TreatmentRecord,
          b: TreatmentRecord,
        ) =>
          String(b.date).localeCompare(
            String(a.date),
          ),
      );

  async function refresh(): Promise<void> {
    await loadBackendData();
  }

  function addPatient(
    data: Omit<
      Patient,
      "id" | "patientNumber" | "createdAt"
    >,
  ) {
    const next =
      Math.max(
        0,
        ...patients.value.map(
          (patient: Patient) =>
            Number(
              String(
                patient.patientNumber,
              ).replace(/\D/g, ""),
            ) || 0,
        ),
      ) + 1;

    const id =
      `P${String(next).padStart(6, "0")}`;

    db.patients.unshift({
      ...data,
      id,
      patientNumber: id,
      createdAt:
        new Date().toISOString(),
    });

    return id;
  }

  function addTreatment(
    data: Omit<
      TreatmentRecord,
      "id"
    >,
  ) {
    db.treatments.unshift({
      ...data,
      id: `T${Date.now()}`,
    });
  }

  function addWard(
    name: string,
    department: string,
    floor: string,
    capacity: number,
  ) {
    const id =
      `W${String(
        wards.value.length + 1,
      ).padStart(2, "0")}`;

    db.wards.push({
      id,
      name,
      department,
      floor,
      capacity,

      beds: Array.from(
        { length: capacity },
        (
          _unused: unknown,
          i: number,
        ): Bed => ({
          id: `${id}-${i + 1}`,

          number:
            `${name
              .slice(0, 1)
              .toUpperCase()}-${String(
              i + 1,
            ).padStart(2, "0")}`,

          status: "AVAILABLE",
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
        (w: Ward) =>
          w.id === wardId,
      );

    const bed =
      ward?.beds.find(
        (b: Bed) =>
          b.id === bedId,
      );

    if (!bed) {
      return;
    }

    bed.status = "OCCUPIED";
    bed.patientId = patientId;

    addTreatment({
      patientId,

      type: "WARD",

      date: new Date()
        .toISOString()
        .slice(0, 10),

      department:
        ward?.department ||
        "Inpatient",

      doctor: "",

      diagnosis:
        "Ward admission",

      treatment:
        `Admitted to ${
          ward?.name || "ward"
        } — Bed ${bed.number}`,

      notes:
        "Ward admission recorded from Ward & Beds module.",
    });
  }

  function addEmergency(
    data: Omit<
      EmergencyCase,
      "id"
    >,
  ) {
    db.emergencies.unshift({
      ...data,
      id:
        `ER-${Date.now()
          .toString()
          .slice(-5)}`,
    });
  }

  /*
   * Local ECIS helper retained for components
   * that may still call useEHR().searchECIS().
   *
   * The actual ECIS screen should continue using
   * the backend /ecis/search endpoint.
   */
  function searchECIS(
    f: ECISFilters,
  ) {
    const inRange = (
      value: number,
      min?: number,
      max?: number,
    ) =>
      (min == null ||
        value >= min) &&
      (max == null ||
        value <= max);

    return patients.value
      .map(
        (patient: Patient) => {
          const records =
            treatmentsForPatient(
              patient.id,
            );

          const clinicalText =
            records
              .map(
                (
                  treatment: TreatmentRecord,
                ) =>
                  [
                    treatment.diagnosis,
                    treatment.treatment,
                    treatment.notes,
                    treatment.bodyRegion,
                    treatment.clinicalFinding,
                    treatment.implant,
                    treatment.scar,
                    treatment.birthmark,
                    treatment.tattoo,
                    treatment.missingBodyPart,
                    treatment.oldFracture,
                  ]
                    .filter(Boolean)
                    .join(" "),
              )
              .join(" ")
              .toLowerCase();

          const age =
            Math.floor(
              (Date.now() -
                new Date(
                  patient.dateOfBirth,
                ).getTime()) /
                31557600000,
            );

          let score = 0;

          const evidence: string[] =
            [];

          if (
            (
              f.ageMin != null ||
              f.ageMax != null
            ) &&
            inRange(
              age,
              f.ageMin,
              f.ageMax,
            )
          ) {
            score += 10;
            evidence.push("Age");
          }

          if (
            (
              f.heightMin != null ||
              f.heightMax != null
            ) &&
            inRange(
              Number(
                patient.heightCm,
              ),
              f.heightMin,
              f.heightMax,
            )
          ) {
            score += 10;
            evidence.push("Height");
          }

          if (
            (
              f.weightMin != null ||
              f.weightMax != null
            ) &&
            inRange(
              Number(
                patient.weightKg,
              ),
              f.weightMin,
              f.weightMax,
            )
          ) {
            score += 6;
            evidence.push("Weight");
          }

          if (
            f.bloodGroup &&
            patient.bloodGroup ===
              f.bloodGroup
          ) {
            score += 12;
            evidence.push(
              "Blood group",
            );
          }

          if (
            f.gender &&
            patient.gender ===
              f.gender
          ) {
            score += 7;
            evidence.push(
              "Gender/sex",
            );
          }

          if (
            f.province &&
            patient.province ===
              f.province
          ) {
            score += 6;
            evidence.push(
              "Province",
            );
          }

          if (
            f.district &&
            patient.district ===
              f.district
          ) {
            score += 6;
            evidence.push(
              "District",
            );
          }

          if (
            f.name &&
            `${patient.firstName} ${patient.lastName} ${patient.patientNumber}`
              .toLowerCase()
              .includes(
                f.name.toLowerCase(),
              )
          ) {
            score += 12;
            evidence.push(
              "Name clue",
            );
          }

          if (
            f.phoneDigits &&
            patient.phone.endsWith(
              f.phoneDigits,
            )
          ) {
            score += 10;
            evidence.push(
              "Phone digits",
            );
          }

          if (
            f.workplace &&
            patient.workplace
              .toLowerCase()
              .includes(
                f.workplace.toLowerCase(),
              )
          ) {
            score += 8;
            evidence.push(
              "Workplace",
            );
          }

          if (
            f.procedure &&
            clinicalText.includes(
              f.procedure.toLowerCase(),
            )
          ) {
            score += 18;
            evidence.push(
              "Procedure",
            );
          }

          if (
            f.implant &&
            clinicalText.includes(
              f.implant.toLowerCase(),
            )
          ) {
            score += 18;
            evidence.push(
              "Implant/device",
            );
          }

          if (
            f.finding &&
            clinicalText.includes(
              f.finding.toLowerCase(),
            )
          ) {
            score += 15;
            evidence.push(
              "Clinical finding",
            );
          }

          if (
            f.bodyRegion &&
            clinicalText.includes(
              f.bodyRegion.toLowerCase(),
            )
          ) {
            score += 12;
            evidence.push(
              "Body region",
            );
          }

          if (
            f.missingBodyPart &&
            clinicalText.includes(
              f.missingBodyPart.toLowerCase(),
            )
          ) {
            score += 15;
            evidence.push(
              "Missing body part",
            );
          }

          if (
            f.scar &&
            clinicalText.includes(
              f.scar.toLowerCase(),
            )
          ) {
            score += 15;
            evidence.push(
              "Scar",
            );
          }

          if (
            f.birthmark &&
            clinicalText.includes(
              f.birthmark.toLowerCase(),
            )
          ) {
            score += 12;
            evidence.push(
              "Birthmark",
            );
          }

          if (
            f.tattoo &&
            clinicalText.includes(
              f.tattoo.toLowerCase(),
            )
          ) {
            score += 10;
            evidence.push(
              "Tattoo",
            );
          }

          if (
            f.fracture &&
            clinicalText.includes(
              f.fracture.toLowerCase(),
            )
          ) {
            score += 15;
            evidence.push(
              "Old fracture",
            );
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
          result: {
            patient: Patient;
            score: number;
            evidence: string[];
            records: TreatmentRecord[];
          },
        ) => result.score > 0,
      )
      .sort(
        (
          a: { score: number },
          b: { score: number },
        ) =>
          b.score - a.score,
      );
  }

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
    addTreatment,
    addWard,
    assignBed,
    addEmergency,

    searchECIS,
    refresh,
  };
}