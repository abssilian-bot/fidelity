-- Les critères inconnus restent vides ; aucune préférence alimentaire n'est déduite.
ALTER TABLE "Restaurant"
  ADD COLUMN "foodTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "services" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "avgPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "maxGuests" INTEGER NOT NULL DEFAULT 0;

CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- Supabase installe parfois les extensions dans le schéma dédié « extensions ».
SET search_path TO public, extensions;

-- Normalisation immuable pour indexer les noms sans accents ni ponctuation.
CREATE FUNCTION public.fidelity_search_text(value TEXT) RETURNS TEXT
LANGUAGE SQL IMMUTABLE PARALLEL SAFE AS $$
  SELECT trim(regexp_replace(translate(replace(replace(lower(coalesce(value, '')), 'œ', 'oe'), 'æ', 'ae'),
    'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'), '[^a-z0-9]+', ' ', 'g'));
$$;

CREATE INDEX "User_search_name_trgm" ON "User" USING GIN (public.fidelity_search_text("displayName") gin_trgm_ops);
CREATE INDEX "User_search_handle_trgm" ON "User" USING GIN (replace(public.fidelity_search_text("pseudo"), ' ', '') gin_trgm_ops);
RESET search_path;
