const SYNTHETIC_DISCLOSURE =
  /synthetic training only\s*[—-]\s*not for clinical care/i;

const SYNTHETIC_DATASET_ACTOR =
  /synthetic dataset generator/i;

export function isSyntheticDatasetNote(value: unknown): boolean {
  return typeof value === "string" && SYNTHETIC_DISCLOSURE.test(value);
}

export function isSyntheticDatasetActor(value: unknown): boolean {
  return typeof value === "string" && SYNTHETIC_DATASET_ACTOR.test(value);
}

export function displayClinicalActor(value: unknown): string {
  if (isSyntheticDatasetActor(value)) {
    return "Viva training dataset";
  }

  return typeof value === "string" ? value : "";
}
