-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "rating" INTEGER,
ADD COLUMN     "status" "PostStatus" NOT NULL DEFAULT 'PUBLISHED';

-- CreateIndex
CREATE INDEX "Post_taggedRestaurantId_status_idx" ON "Post"("taggedRestaurantId", "status");
