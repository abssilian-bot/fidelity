-- Fastify est le seul point d'accès. Les clients Supabase anon/authenticated
-- ne doivent jamais pouvoir contourner les contrôles du serveur via PostgREST.
-- Le compte SQL du backend doit être propriétaire des tables ou BYPASSRLS.
DO $$
DECLARE table_name TEXT; client_role TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['User', 'Restaurant', 'MenuItem', 'LoyaltyProgram', 'Membership', 'LedgerEntry', 'RestaurantFavorite', 'Review', 'Post', 'Like', 'Comment', 'Follow', 'UsedMagicLink', 'RevokedSession', 'CardPresentation'] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', table_name);
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', table_name, client_role);
      END IF;
    END LOOP;
  END LOOP;
END $$;
