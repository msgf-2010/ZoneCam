-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT,
    "customerId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "provider" TEXT NOT NULL DEFAULT 'internal',
    "providerTransactionId" TEXT,
    "shareTokenHash" TEXT,
    "payerName" TEXT NOT NULL DEFAULT '',
    "payerEmail" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amountCents", "companyId", "createdAt", "currency", "customerId", "description", "id", "paidAt", "projectId", "provider", "providerTransactionId", "status", "updatedAt") SELECT "amountCents", "companyId", "createdAt", "currency", "customerId", "description", "id", "paidAt", "projectId", "provider", "providerTransactionId", "status", "updatedAt" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE UNIQUE INDEX "Payment_shareTokenHash_key" ON "Payment"("shareTokenHash");
CREATE INDEX "Payment_companyId_status_idx" ON "Payment"("companyId", "status");
CREATE INDEX "Payment_companyId_projectId_idx" ON "Payment"("companyId", "projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
