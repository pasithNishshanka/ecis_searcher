# Optional face clue for ECIS

Patient registration or Edit Patient can capture one clear face photo and enroll a 128-value face descriptor with recorded patient consent. ECIS Search can capture a new photo and return up to ten possible face candidates. The face clue is shown alongside existing EHR evidence. It never confirms or links identity automatically; the existing human review flow remains required.

The photo is processed in the browser and is not uploaded or saved by ECIS. Only an AES-256-GCM encrypted descriptor is stored in `patient_face_profiles`. The model files are served locally from `ecis_frontend/public/face-models`, so runtime internet access is not required. Existing patients do not acquire face profiles automatically: they must be enrolled individually with consent. A profile can be removed from Edit Patient.

## Setup

1. Install frontend dependencies with `npm install` in `ecis_frontend`.
2. Configure `ECIS_FACE_TEMPLATE_KEY` in `ecis_backend/.env` as a persistent, random 32-byte key encoded as 64 hex characters. Generate one with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Do not commit or share this key. Losing it makes enrolled templates unreadable; changing it requires a planned re-enrollment or key migration.
3. Restart the backend after setting the key. The two biometric tables are created automatically on first use, or apply `ecis_backend/sql/patient_face_profiles.sql` with an authorized database account.
4. In Patients, register or edit a patient, capture/choose a single-face photo, record consent and save. In ECIS Search, capture/choose an emergency photo and search, optionally with clinical clues.

Face similarity is an unvalidated clue, not identity proof or a clinical probability. Injuries, bandages, poor light, angle and closed eyes can reduce reliability. The threshold (`MAX_DISTANCE` in `faceProfile.service.js`) needs formal evaluation with an approved dataset before clinical deployment. Deploy behind TLS, limit access to authorized personnel, maintain consent/retention procedures, and protect the encryption key in a managed secret store. Do not enroll actual patient biometrics without institutional authorization.
