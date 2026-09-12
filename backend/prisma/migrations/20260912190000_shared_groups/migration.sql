CREATE TABLE "kusama_groups" (
  "slug" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "members" JSONB NOT NULL DEFAULT '[]',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "run" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kusama_groups_pkey" PRIMARY KEY ("slug")
);
