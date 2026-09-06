import {
  computed,
  reactive,
  watch,
} from "vue";

import type {
  Patient,
  TreatmentRecord,
  Ward,
  EmergencyCase,
  ECISFilters,
} from "../types";

const STORAGE = "ecis-full-frontend-v1";

/*
 * Derive the Bed type from Ward so we do not depend on
 * a separate exported Bed type from ../types.
 */
type Bed = Ward["beds"][number];

const demoPatients: Patient[] = [
  {
    id: "P000002",
    patientNumber: "P000002",
    nic: "901234567V",
    firstName: "Kasun",
    lastName: "Perera",
    dateOfBirth: "1990-06-15",
    gender: "Male",
    bloodGroup: "O+",
    phone: "0771234567",
    email: "kasun@example.com",
    address: "High Level Road, Nugegoda",
    province: "Western Province",
    district: "Colombo",
    heightCm: 174,
    weightKg: 72,
    allergies: ["Penicillin"],
    foodAllergies: [],
    medicalAllergies: ["Penicillin"],
    chronicDiseases: [],
    workplace: "Phoenix",
    createdAt: "2025-01-12",
  },

  {
    id: "P000145",
    patientNumber: "P000145",
    nic: "891112223V",
    firstName: "Saman",
    lastName: "Madushan",
    dateOfBirth: "1989-11-03",
    gender: "Male",
    bloodGroup: "O+",
    phone: "0714567890",
    email: "saman@example.com",
    address: "Kandy Road, Kadawatha",
    province: "Western Province",
    district: "Gampaha",
    heightCm: 171,
    weightKg: 75,
    allergies: [],
    foodAllergies: ["Peanuts"],
    medicalAllergies: [],
    chronicDiseases: ["Asthma"],
    workplace: "ABC Engineering",
    createdAt: "2025-02-04",
  },

  {
    id: "P000298",
    patientNumber: "P000298",
    nic: "920456789V",
    firstName: "Ruwan",
    lastName: "Nishan",
    dateOfBirth: "1992-01-24",
    gender: "Male",
    bloodGroup: "A+",
    phone: "0759988123",
    email: "ruwan@example.com",
    address: "Galle Road, Colombo 03",
    province: "Western Province",
    district: "Colombo",
    heightCm: 178,
    weightKg: 80,
    allergies: [],
    foodAllergies: ["Peanuts"],
    medicalAllergies: [],
    chronicDiseases: ["Hypertension"],
    workplace: "Ceylon Transport",
    createdAt: "2025-03-08",
  },
];

const demoTreatments: TreatmentRecord[] = [
  {
    id: "T001",
    patientId: "P000002",
    type: "SURGERY",
    date: "2028-04-12",
    department: "Orthopedics",
    doctor: "Dr. Silva",
    diagnosis: "Right humerus fracture",
    treatment: "ORIF right humerus",
    notes: "Orthopedic plate inserted during surgery.",
    bodyRegion: "Right arm",
    clinicalFinding:
      "Healed surgical scar on right arm",
    implant: "Orthopedic plate",
    implantSerial: "ORTHO-78421",
    scar: "Long surgical scar on right arm",
    oldFracture: "Right humerus fracture",
  },

  {
    id: "T002",
    patientId: "P000002",
    type: "PROCEDURE",
    date: "2028-04-12",
    department: "Orthopedics",
    doctor: "Dr. Silva",
    diagnosis: "Right arm fracture",
    treatment: "Internal fixation",
    notes:
      "Permanent clinical findings documented after treatment.",
    bodyRegion: "Right arm",
    clinicalFinding: "Surgical scar",
    scar: "Right arm surgical scar",
    implant: "Orthopedic plate",
  },

  {
    id: "T006",
    patientId: "P000002",
    type: "CLINIC",
    date: "2029-03-12",
    department: "Orthopedic Clinic",
    doctor: "Dr. Silva",
    diagnosis: "Post-operative follow-up",
    treatment: "Implant and scar review",
    notes:
      "Existing surgical history reviewed during clinic follow-up.",
    bodyRegion: "Right arm",
    clinicalFinding: "Healed surgical scar",
    implant: "Orthopedic plate",
    scar: "Right arm surgical scar",
  },

  {
    id: "T003",
    patientId: "P000002",
    type: "OPD",
    date: "2029-01-18",
    department: "Cardiology",
    doctor: "Dr. Fernando",
    diagnosis: "Routine review",
    treatment: "Clinical review",
    notes: "Stable.",
  },

  {
    id: "T004",
    patientId: "P000145",
    type: "SURGERY",
    date: "2027-09-05",
    department: "Orthopedics",
    doctor: "Dr. Perera",
    diagnosis: "Right arm fracture",
    treatment: "Fracture fixation",
    notes: "Right arm orthopedic plate.",
    bodyRegion: "Right arm",
    clinicalFinding: "Surgical scar",
    implant: "Orthopedic plate",
    oldFracture: "Right arm fracture",
  },

  {
    id: "T005",
    patientId: "P000298",
    type: "OPD",
    date: "2029-02-14",
    department: "Medicine",
    doctor: "Dr. Jayasuriya",
    diagnosis: "Hypertension",
    treatment: "Medication review",
    notes: "Follow-up.",
  },
];

/* -----------------------------
   Demo bed generator
----------------------------- */

function makeBeds(
  prefix: string,
  count: number,
  occupied: number,
): Bed[] {
  return Array.from(
    { length: count },
    (_: unknown, i: number): Bed => ({
      id: `${prefix}-${i + 1}`,
      number: `${prefix}-${String(
        i + 1,
      ).padStart(2, "0")}`,
      status:
        i < occupied
          ? "OCCUPIED"
          : "AVAILABLE",
    }),
  );
}

/* -----------------------------
   Demo wards
----------------------------- */

const demoWards: Ward[] = [
  {
    id: "W01",
    name: "Medical Ward A",
    department: "Medicine",
    floor: "1",
    capacity: 30,
    beds: makeBeds("A", 30, 22),
  },

  {
    id: "W02",
    name: "Surgical Ward",
    department: "Surgery",
    floor: "2",
    capacity: 24,
    beds: makeBeds("S", 24, 17),
  },

  {
    id: "W03",
    name: "Pediatric Ward",
    department: "Pediatrics",
    floor: "2",
    capacity: 20,
    beds: makeBeds("P", 20, 12),
  },
];

/* -----------------------------
   Demo emergency cases
----------------------------- */

const demoEmergencies: EmergencyCase[] = [
  {
    id: "ER-2048",
    arrival: "10:42 AM",
    description: "Unidentified adult male",
    department: "Emergency",
    status: "UNIDENTIFIED",
  },

  {
    id: "ER-2047",
    arrival: "10:18 AM",
    description: "Chest pain",
    department: "Emergency",
    status: "IDENTIFIED",
    patientId: "P000145",
  },

  {
    id: "ER-2046",
    arrival: "09:54 AM",
    description: "Road traffic injury",
    department: "Trauma",
    status: "ADMITTED",
    patientId: "P000298",
  },
];

/* -----------------------------
   Seed / local state
----------------------------- */

function cloneSeed() {
  return {
    patients: structuredClone(
      demoPatients,
    ),

    treatments: structuredClone(
      demoTreatments,
    ),

    wards: structuredClone(
      demoWards,
    ),

    emergencies: structuredClone(
      demoEmergencies,
    ),
  };
}

function loadState() {
  try {
    const raw =
      localStorage.getItem(STORAGE);

    if (!raw) {
      return cloneSeed();
    }

    const parsed = JSON.parse(raw);

    parsed.patients = (
      parsed.patients || []
    ).map(
      (
        patient: Patient,
      ) => ({
        ...patient,

        foodAllergies:
          patient.foodAllergies ||
          [],

        medicalAllergies:
          patient.medicalAllergies ||
          patient.allergies ||
          [],

        allergies:
          patient.allergies ||
          [
            ...(patient.foodAllergies ||
              []),

            ...(patient.medicalAllergies ||
              []),
          ],
      }),
    );

    return parsed;
  } catch {
    return cloneSeed();
  }
}

const db = reactive(
  loadState(),
);

watch(
  db,
  () => {
    localStorage.setItem(
      STORAGE,
      JSON.stringify(db),
    );
  },
  {
    deep: true,
  },
);

/* -----------------------------
   EHR store
----------------------------- */

export function useEHR() {
  const patients = computed(
    () => db.patients as Patient[],
  );

  const treatments = computed(
    () =>
      db.treatments as TreatmentRecord[],
  );

  const wards = computed(
    () => db.wards as Ward[],
  );

  const emergencies = computed(
    () =>
      db.emergencies as EmergencyCase[],
  );

  /* -----------------------------
     Patient lookup
  ----------------------------- */

  const patientById = (
    id: string,
  ) =>
    patients.value.find(
      (p: Patient) =>
        p.id === id,
    );

  /* -----------------------------
     Treatment lookup
  ----------------------------- */

  const treatmentsForPatient = (
    id: string,
  ) =>
    treatments.value
      .filter(
        (t: TreatmentRecord) =>
          t.patientId === id,
      )
      .sort(
        (
          a: TreatmentRecord,
          b: TreatmentRecord,
        ) =>
          b.date.localeCompare(
            a.date,
          ),
      );

  /* -----------------------------
     Add patient
  ----------------------------- */

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
          (p: Patient) =>
            Number(
              p.patientNumber.slice(
                1,
              ),
            ) || 0,
        ),
      ) + 1;

    const id = `P${String(
      next,
    ).padStart(6, "0")}`;

    db.patients.unshift({
      ...data,
      id,
      patientNumber: id,
      createdAt:
        new Date().toISOString(),
    });

    return id;
  }

  /* -----------------------------
     Add treatment
  ----------------------------- */

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

  /* -----------------------------
     Add ward
  ----------------------------- */

  function addWard(
    name: string,
    department: string,
    floor: string,
    capacity: number,
  ) {
    const id = `W${String(
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
          number: `${name
            .slice(0, 1)
            .toUpperCase()}-${String(
            i + 1,
          ).padStart(2, "0")}`,
          status: "AVAILABLE",
        }),
      ),
    });
  }

  /* -----------------------------
     Assign bed
  ----------------------------- */

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

    bed.status =
      "OCCUPIED";

    bed.patientId =
      patientId;

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
          ward?.name ||
          "ward"
        } — Bed ${bed.number}`,

      notes:
        "Ward admission recorded from Ward & Beds module.",
    });
  }

  /* -----------------------------
     Add emergency
  ----------------------------- */

  function addEmergency(
    data: Omit<
      EmergencyCase,
      "id"
    >,
  ) {
    db.emergencies.unshift({
      ...data,
      id: `ER-${Date.now()
        .toString()
        .slice(-5)}`,
    });
  }

  /* -----------------------------
     Local/demo ECIS search
  ----------------------------- */

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
                  t: TreatmentRecord,
                ) =>
                  [
                    t.diagnosis,
                    t.treatment,
                    t.notes,
                    t.bodyRegion,
                    t.clinicalFinding,
                    t.implant,
                    t.scar,
                    t.birthmark,
                    t.tattoo,
                    t.missingBodyPart,
                    t.oldFracture,
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
              patient.heightCm,
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
              patient.weightKg,
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

          if (
            f.hasSurgery &&
            !records.some(
              (
                t: TreatmentRecord,
              ) =>
                t.type ===
                "SURGERY",
            )
          ) {
            return {
              patient,
              score: 0,
              evidence: [],
              records,
            };
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
        (r: {
          patient: Patient;
          score: number;
          evidence: string[];
          records: TreatmentRecord[];
        }) => r.score > 0,
      )
      .sort(
        (
          a: {
            score: number;
          },
          b: {
            score: number;
          },
        ) =>
          b.score - a.score,
      );
  }

  /* -----------------------------
     Reset demo data
  ----------------------------- */

  function resetDemo() {
    const seed =
      cloneSeed();

    db.patients.splice(
      0,
      db.patients.length,
      ...seed.patients,
    );

    db.treatments.splice(
      0,
      db.treatments.length,
      ...seed.treatments,
    );

    db.wards.splice(
      0,
      db.wards.length,
      ...seed.wards,
    );

    db.emergencies.splice(
      0,
      db.emergencies.length,
      ...seed.emergencies,
    );
  }

  return {
    patients,
    treatments,
    wards,
    emergencies,
    patientById,
    treatmentsForPatient,
    addPatient,
    addTreatment,
    addWard,
    assignBed,
    addEmergency,
    searchECIS,
    resetDemo,
  };
}