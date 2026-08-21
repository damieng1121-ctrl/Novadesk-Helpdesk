import type { AttendanceMark } from "@prisma/client";

/**
 * Curated set of DfE attendance register codes (not the full statutory list,
 * which runs to several dozen codes and changes periodically — this covers
 * the ones a primary school register actually uses day to day). Each maps
 * to the broader `AttendanceMark` enum used for reporting/filtering, and
 * flags whether it counts as authorised for the census-readiness export.
 */
export type AttendanceCode = {
  code: string;
  label: string;
  mark: AttendanceMark;
  authorised: boolean;
};

export const ATTENDANCE_CODES: AttendanceCode[] = [
  { code: "/", label: "Present (AM)", mark: "PRESENT", authorised: true },
  { code: "\\", label: "Present (PM)", mark: "PRESENT", authorised: true },
  { code: "L", label: "Late (before register closed)", mark: "LATE", authorised: true },
  { code: "U", label: "Late (after register closed) — unauthorised", mark: "UNAUTHORISED_ABSENCE", authorised: false },
  { code: "B", label: "Educated off-site (approved activity)", mark: "APPROVED_ACTIVITY", authorised: true },
  { code: "C", label: "Authorised — leave of absence", mark: "AUTHORISED_ABSENCE", authorised: true },
  { code: "E", label: "Excluded, no alternative provision", mark: "AUTHORISED_ABSENCE", authorised: true },
  { code: "H", label: "Authorised holiday", mark: "AUTHORISED_ABSENCE", authorised: true },
  { code: "I", label: "Illness", mark: "AUTHORISED_ABSENCE", authorised: true },
  { code: "M", label: "Medical/dental appointment", mark: "AUTHORISED_ABSENCE", authorised: true },
  { code: "R", label: "Religious observance", mark: "AUTHORISED_ABSENCE", authorised: true },
  { code: "S", label: "Study leave", mark: "AUTHORISED_ABSENCE", authorised: true },
  { code: "T", label: "Traveller family — travelling for occupation", mark: "AUTHORISED_ABSENCE", authorised: true },
  { code: "G", label: "Unauthorised holiday", mark: "UNAUTHORISED_ABSENCE", authorised: false },
  { code: "N", label: "No reason yet provided", mark: "UNAUTHORISED_ABSENCE", authorised: false },
  { code: "O", label: "Unauthorised absence", mark: "UNAUTHORISED_ABSENCE", authorised: false },
];

export function getAttendanceCode(code: string): AttendanceCode | undefined {
  return ATTENDANCE_CODES.find((c) => c.code === code);
}

/** Attendance % is computed only across sessions actually taken (excludes NOT_RECORDED). */
export function isAttendedSession(mark: AttendanceMark): boolean {
  return mark === "PRESENT" || mark === "LATE" || mark === "APPROVED_ACTIVITY";
}

/** DfE's "persistent absence" threshold: a pupil below 90% attendance. */
export const PERSISTENT_ABSENCE_THRESHOLD = 0.9;
