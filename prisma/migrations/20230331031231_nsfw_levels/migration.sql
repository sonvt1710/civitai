/*
  Warnings:

  - You are about to drop the column `nsfw` on the `Image` table. All the data in the column will be lost.

*/
-- AlterTable
DROP INDEX IF EXISTS "Post_modelVersionId";
CREATE INDEX "Post_modelVersionId" ON "Post" USING HASH ("modelVersionId");

ALTER TABLE "Image" ADD COLUMN     "nsfwLevel" INTEGER NOT NULL DEFAULT 0;

-- Set NSFW Level
WITH moderated_tags AS (
	SELECT
		id,
		name,
		CASE
			WHEN name IN ('weapons', 'revealing clothes', 'partial nudity', 'male swimwear or underwear', 'female swimwear or underwear', 'middle finger', 'weapon violence', 'emaciated bodies', 'explosions and blasts', 'sexual situations', 'corpses', 'physical violence') THEN 'pg13'
			WHEN name IN ('nudity', 'graphic violence or gore', 'adult toys', 'hanging', 'white supremacy', 'nazi party', 'hate symbols', 'extremist') THEN 'r'
			WHEN name IN ('illustrated explicit nudity', 'sexual activity', 'graphic male nudity', 'graphic female nudity') THEN 'x'
			ELSE null
		END rating
	FROM "Tag"
	WHERE type = 'Moderation'
		AND name NOT IN ('suggestive', 'rude gestures', 'visually disturbing', 'violence', 'explicit nudity')
), image_nsfw_level AS (
	SELECT
		i.id,
		CASE
			WHEN pg13.count IS NULL AND r.count IS NULL AND x.count IS NULL THEN 0
			WHEN pg13.count IS NOT NULL AND r.count IS NULL AND x.count IS NULL THEN 1
			WHEN r.count IS NOT NULL AND x.count IS NULL THEN 2
			WHEN x.count IS NOT NULL THEN 3
		END "nsfwLevel"
	FROM "Image" i
	LEFT JOIN (
		SELECT "imageId", COUNT(*) count
		FROM "TagsOnImage"
		WHERE NOT disabled AND "tagId" IN (SELECT id FROM moderated_tags WHERE rating = 'pg13')
		GROUP BY "imageId"
	) pg13 ON i.id = pg13."imageId"
	LEFT JOIN (
		SELECT "imageId", COUNT(*) count
		FROM "TagsOnImage"
		WHERE NOT disabled AND "tagId" IN (SELECT id FROM moderated_tags WHERE rating = 'r')
		GROUP BY "imageId"
	) r ON i.id = r."imageId"
	LEFT JOIN (
		SELECT "imageId", COUNT(*) count
		FROM "TagsOnImage"
		WHERE NOT disabled AND "tagId" IN (SELECT id FROM moderated_tags WHERE rating = 'x')
		GROUP BY "imageId"
	) x ON i.id = x."imageId"
	WHERE "scannedAt" IS NOT NULL
)
UPDATE "Image" i SET "nsfwLevel" = inl."nsfwLevel"
FROM image_nsfw_level inl
WHERE inl.id = i.id;

ALTER TABLE "Image" DROP COLUMN "nsfw";
