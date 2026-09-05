export type TreatmentType = 'OPD' | 'CLINIC' | 'WARD' | 'SURGERY' | 'PROCEDURE' | 'LAB' | 'IMAGING' | 'EMERGENCY'

export interface Patient {
  id: string
  patientNumber: string
  nic: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: 'Male' | 'Female' | 'Other'
  bloodGroup: string
  phone: string
  email: string
  address: string
  province: string
  district: string
  heightCm: number
  weightKg: number
  allergies: string[]
  foodAllergies: string[]
  medicalAllergies: string[]
  chronicDiseases: string[]
  workplace: string
  createdAt: string
}

export interface TreatmentRecord {
  id: string
  patientId: string
  type: TreatmentType
  date: string
  department: string
  doctor: string
  diagnosis: string
  treatment: string
  notes: string
  bodyRegion?: string
  clinicalFinding?: string
  implant?: string
  implantSerial?: string
  scar?: string
  birthmark?: string
  tattoo?: string
  missingBodyPart?: string
  oldFracture?: string
}

export interface Bed {
  id: string
  number: string
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE'
  patientId?: string
}

export interface Ward {
  id: string
  name: string
  department: string
  floor: string
  capacity: number
  beds: Bed[]
}

export interface EmergencyCase {
  id: string
  patientId?: string
  arrival: string
  description: string
  department: string
  status: 'UNIDENTIFIED' | 'IDENTIFIED' | 'ADMITTED'
}

export interface ECISFilters {
  ageMin?: number
  ageMax?: number
  heightMin?: number
  heightMax?: number
  weightMin?: number
  weightMax?: number
  bloodGroup?: string
  province?: string
  district?: string
  gender?: string
  name?: string
  phoneDigits?: string
  workplace?: string
  procedure?: string
  implant?: string
  finding?: string
  bodyRegion?: string
  missingBodyPart?: string
  scar?: string
  birthmark?: string
  tattoo?: string
  fracture?: string
  previousHospital?: string
  hasSurgery?: boolean
}
