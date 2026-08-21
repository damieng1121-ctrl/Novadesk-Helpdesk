import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      /** For a SUPER_ADMIN "managing" a school, this is that school's id — never a real tenant membership. See actingTenantId. */
      tenantId: string | null;
      /** Set only while a SUPER_ADMIN is managing a specific school; null otherwise (including for ordinary tenant users). */
      actingTenantId: string | null;
      twoFactorEnabled: boolean;
      twoFactorVerified: boolean;
      /** MIS classroom access — see User.isTeacher. Only meaningful for staff roles. */
      isTeacher: boolean;
    } & DefaultSession["user"];
  }
}

// `next-auth/jwt` re-exports its JWT type from `@auth/core/jwt`, and the
// callbacks NextAuth() gives us are typed against that original module — so
// the augmentation has to target `@auth/core/jwt` directly to actually merge.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    tenantId: string | null;
    actingTenantId: string | null;
    twoFactorEnabled: boolean;
    twoFactorVerified: boolean;
    isTeacher: boolean;
  }
}
