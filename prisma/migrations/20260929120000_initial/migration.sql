CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE "Concurso" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "title" TEXT NOT NULL,
    "organization" TEXT,
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "city" TEXT,
    "uf" TEXT,
    "region" TEXT,
    "vacancies" TEXT,
    "salary" TEXT,
    "registrationStart" TIMESTAMP(3),
    "registrationEnd" TIMESTAMP(3),
    "status" TEXT,
    "noticeUrl" TEXT,
    "applicationUrl" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "contentHash" TEXT NOT NULL,
    "raw" JSONB NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Concurso_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "isBaseline" BOOLEAN NOT NULL DEFAULT false,
    "returnedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RadarEvent" (
    "id" TEXT NOT NULL,
    "concursoId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    CONSTRAINT "RadarEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Concurso_sourceKey_key" ON "Concurso"("sourceKey");
CREATE INDEX "Concurso_registrationEnd_idx" ON "Concurso"("registrationEnd");
CREATE INDEX "Concurso_uf_city_idx" ON "Concurso"("uf", "city");
CREATE INDEX "Concurso_firstSeenAt_idx" ON "Concurso"("firstSeenAt");
CREATE INDEX "RadarEvent_createdAt_idx" ON "RadarEvent"("createdAt");
ALTER TABLE "RadarEvent" ADD CONSTRAINT "RadarEvent_concursoId_fkey" FOREIGN KEY ("concursoId") REFERENCES "Concurso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
