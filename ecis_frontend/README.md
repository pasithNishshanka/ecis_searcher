# ECIS Hospital EHR Frontend

Vue 3 + TypeScript + Tailwind CSS frontend for the Emergency Clinical Identity Search (ECIS) research prototype.

## Architecture

Normal hospital workflows create the source EHR data: Patient Registration, OPD, Clinics, Wards/Admissions, Treatment, Diagnoses, Investigations, Surgery, Procedures, Fractures, Dental Records and Medical Devices. ECIS searches and joins that existing patient data to produce candidates for authorized human review. ECIS does not maintain a duplicate patient identity database.

## Reusable component design

The UI is built around reusable components so visual changes can be made consistently during supervisor/viva reviews:

- `components/ui/BaseButton.vue` — button variants and sizes
- `components/ui/BaseInput.vue` — text/number/date inputs
- `components/ui/BaseSelect.vue` — selects
- `components/ui/BaseTextarea.vue` — multiline fields
- `components/ui/SectionCard.vue` — reusable content card
- `components/ui/StatusBadge.vue` — status and evidence badges
- `components/forms/FormField.vue` — labels, hints and validation presentation
- `components/forms/FormSection.vue` — numbered form sections
- `components/forms/RangeField.vue` — ECIS Min/Max filters
- `components/patient/PatientLookup.vue` — scalable patient search/autocomplete
- `components/TagInput.vue` — allergy/tag entry

### Central design tokens

Global CSS variables are defined in `src/assets/main.css`:

- `--ecis-primary`
- `--ecis-primary-hover`
- `--ecis-field-radius`
- `--ecis-control-height`
- `--ecis-card-radius`

For example, changing the primary button color or control height can be done centrally instead of editing every page.

## Run

```bash
npm install
npm run dev
```
