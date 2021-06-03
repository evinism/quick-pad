-- CreateTable
CREATE TABLE "notes" (
    "id" VARCHAR(8) NOT NULL,
    "lastuse" TIMESTAMP(6) NOT NULL,
    "content" TEXT NOT NULL,

    PRIMARY KEY ("id")
);
