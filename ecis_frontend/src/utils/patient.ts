/**
 * Shared patient/date helpers.
 *
 * Important:
 * - Age is NEVER stored in the database.
 * - Age is calculated from dateOfBirth.
 * - Date-only values are handled without UTC date shifting.
 */

export function calculateAge(
  dateOfBirth: string | Date | null | undefined,
  referenceDate: Date = new Date(),
): number | null {
  if (!dateOfBirth) {
    return null;
  }

  const dob =
    dateOfBirth instanceof Date
      ? new Date(dateOfBirth.getTime())
      : new Date(`${String(dateOfBirth).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(dob.getTime())) {
    return null;
  }

  if (dob > referenceDate) {
    return null;
  }

  let age =
    referenceDate.getFullYear() -
    dob.getFullYear();

  const monthDifference =
    referenceDate.getMonth() -
    dob.getMonth();

  if (
    monthDifference < 0 ||
    (
      monthDifference === 0 &&
      referenceDate.getDate() < dob.getDate()
    )
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

export function toDateInputValue(
  value: string | Date | null | undefined,
): string {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(
      value.getMonth() + 1,
    ).padStart(2, "0");

    const day = String(
      value.getDate(),
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  return String(value).slice(0, 10);
}

export function todayDateInputValue(): string {
  return toDateInputValue(new Date());
}

export function formatDate(
  value: string | Date | null | undefined,
): string {
  if (!value) {
    return "—";
  }

  const date =
    value instanceof Date
      ? value
      : new Date(
          `${String(value).slice(0, 10)}T00:00:00`,
        );

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(date);
}

export function formatLocation(
  patient: {
    address?: string | null;
    district?: string | null;
    province?: string | null;
  },
): string {
  const values = [
    patient.address,
    patient.district,
    patient.province,
  ]
    .map((value) =>
      String(value ?? "").trim(),
    )
    .filter(Boolean);

  return values.length
    ? values.join(", ")
    : "Not recorded";
}