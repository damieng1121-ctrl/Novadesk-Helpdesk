-- CreateTable
CREATE TABLE "KbAttachment" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileSize" INTEGER,
    "contentType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KbAttachment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "KbAttachment" ADD CONSTRAINT "KbAttachment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KbArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
