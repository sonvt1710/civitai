CREATE OR REPLACE FUNCTION update_nsfw_level(p_created_at TIMESTAMP)
RETURNS VOID AS $$
BEGIN
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
  ), affected AS (
    SELECT DISTINCT "imageId"
    FROM "TagsOnImage" toi
    WHERE "createdAt" > p_created_at
      AND EXISTS (SELECT 1 FROM moderated_tags mt WHERE mt.id = toi."tagId")
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
    WHERE
      "scannedAt" IS NOT NULL
      AND EXISTS (SELECT 1 FROM affected a WHERE a."imageId" = i.id)
  )
  UPDATE "Image" i SET "nsfwLevel" = inl."nsfwLevel"
  FROM image_nsfw_level inl
  WHERE inl.id = i.id;
END;
$$ LANGUAGE plpgsql;