-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "appName" TEXT,
ADD COLUMN     "disabledNavItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sidebarColor" TEXT;
