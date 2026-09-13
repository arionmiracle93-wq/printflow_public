export const USER_ROLES = ["owner", "karyawan"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export function roleLabel(role: string) {
  return role === "owner" ? "Owner" : "Karyawan";
}
