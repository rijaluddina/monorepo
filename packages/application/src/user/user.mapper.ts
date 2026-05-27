import type { User } from "@repo/domain";
import type { UserDTO } from "@repo/shared";

/** Map domain User aggregate → serializable UserDTO */
export function mapUserToDTO(user: User): UserDTO {
  return {
    id: user.id.value,
    firstName: user.name.firstName,
    lastName: user.name.lastName,
    fullName: user.name.fullName,
    email: user.email.value,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
