export interface Patient {
  id: string;

  patientNumber: string;

  nic: string;

  firstName: string;

  lastName: string;

  dateOfBirth: string;

  gender: string;

  bloodGroup: string;

  heightCm: number;

  weightKg: number;

  phone: string;

  email: string;

  address: string;

  province: string;

  district: string;

  workplace: string;

  foodAllergies: string[];

  medicalAllergies: string[];

  allergies: string[];

  chronicDiseases: string[];

  registrationNotes: string;

  createdAt: string;
}


export type TreatmentType =
  | "OPD"
  | "CLINIC"
  | "WARD"
  | "SURGERY"
  | "PROCEDURE"
  | "LAB"
  | "IMAGING"
  | "EMERGENCY";


export interface AdmissionRecord {
  id: string;

  admissionNumber: string;

  admissionDate: string;

  dischargeDate?: string | null;

  admissionReason?: string | null;

  admissionDiagnosis?: string | null;

  dischargeDiagnosis?: string | null;

  dischargeSummary?: string | null;

  status: "ADMITTED" | "DISCHARGED" | string;

  encounterId?: string | null;

  encounterType?: string | null;

  wardId?: string | null;

  wardCode?: string | null;

  wardName?: string | null;

  wardType?: string | null;

  bedId?: string | null;

  bedNumber?: string | null;

  doctorId?: string | null;

  doctorName?: string | null;

  hospitalId?: string | null;

  hospitalName?: string | null;
}


export interface TreatmentRecord {
  id: string;

  patientId: string;

  type: TreatmentType;

  date: string;

  department: string;

  doctor: string;

  diagnosis: string;

  treatment: string;

  notes: string;

  bodyRegion?: string;

  clinicalFinding?: string;

  implant?: string;

  implantSerial?: string;

  scar?: string;

  oldFracture?: string;

  birthmark?: string;

  tattoo?: string;

  missingBodyPart?: string;
}


export interface Bed {
  id: string;

  number: string;

  status:
    | "AVAILABLE"
    | "OCCUPIED"
    | "MAINTENANCE";

  patientId?: string;

  admissionId?: string;

  admissionNumber?: string;
}


export interface Ward {
  id: string;

  name: string;

  department: string;

  floor: string;

  capacity: number;

  beds: Bed[];
}


export interface EmergencyCase {
  id: string;

  patientId?: string;

  arrival: string;

  description: string;

  department: string;

  status:
    | "UNIDENTIFIED"
    | "IDENTIFIED"
    | "ADMITTED";
}


export interface ECISFilters {
  ageMin?: number;

  ageMax?: number;

  heightMin?: number;

  heightMax?: number;

  weightMin?: number;

  weightMax?: number;

  bloodGroup?: string;

  gender?: string;

  province?: string;

  district?: string;

  name?: string;

  phoneDigits?: string;

  workplace?: string;

  procedure?: string;

  implant?: string;

  finding?: string;

  bodyRegion?: string;

  missingBodyPart?: string;

  scar?: string;

  birthmark?: string;

  tattoo?: string;

  fracture?: string;

  hasSurgery?: boolean;
}