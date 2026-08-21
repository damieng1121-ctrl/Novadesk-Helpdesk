import type { Role } from "@prisma/client";

export const STAFF_ROLES: Role[] = ["AGENT", "TENANT_ADMIN", "SUPER_ADMIN"];
export const ADMIN_ROLES: Role[] = ["TENANT_ADMIN", "SUPER_ADMIN"];

export function canManageTickets(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

export function isAdmin(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}

/** MIS (pupil-data) access: school admins/leadership always, plus any staff member flagged as a class teacher. */
export function canAccessMis(role: Role, isTeacher: boolean): boolean {
  return ADMIN_ROLES.includes(role) || isTeacher;
}
