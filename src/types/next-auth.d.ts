import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      tenantId: string | null;
      companyId: string | null;
      twoFactorEnabled: boolean;
      twoFactorVerified: boolean;
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
    companyId: string | null;
    twoFactorEnabled: boolean;
    twoFactorVerified: boolean;
  }
}
