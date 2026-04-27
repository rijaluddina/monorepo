import type { UserRole } from "@repo/domain";

/** Serializable read-model of a User — safe to send over the wire */
export interface UserDTO {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
