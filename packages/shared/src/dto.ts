/**
 * User role type — mirrors @repo/domain's UserRole without creating a circular dep.
 * Canonical definition: @repo/domain/src/user/entities/user.entity.ts — keep in sync.
 */
export type UserRole = "admin" | "member" | "viewer";

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
