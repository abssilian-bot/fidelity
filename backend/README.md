# Fidelity — Backend

API du réseau social de fidélité restauration. Voir `../FEUILLE-DE-ROUTE.md` pour la stratégie complète.

## Stack

- **Fastify** (Node + TypeScript) — API REST
- **Prisma + PostgreSQL** — base de données (locale via Docker, ou Supabase free tier)
- **Zod** — validation des entrées

## Démarrage rapide (ce soir)

```bash
# 1. Installer les dépendances (déjà fait si node_modules existe)
npm install

# 2. Base PostgreSQL : créer un projet Supabase gratuit (supabase.com)
#    et coller sa "connection string" dans DATABASE_URL (.env)
#    → Docker n'est PAS installé sur ce PC, Supabase est la voie recommandée.
#    (Alternative si Docker disponible plus tard :
#     docker run --name fidelity-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16)

# 3. Configurer l'environnement
cp .env.example .env

# 4. Créer le schéma + données de démo
npm run prisma:migrate -- --name init
npm run seed

# 5. Lancer l'API
npm run dev
```

L'API écoute sur `http://localhost:3001` — tester avec `curl http://localhost:3001/health`.

## Règles métier non négociables (blueprint Wallet)

1. **Aucun point n'est créé sur simple déclaration du client.** Toute écriture du
   ledger a une source (`scan`, `pos:*`, `foodshare`, `admin`), une preuve et un
   auteur.
2. **Idempotence** : `LedgerEntry.idempotencyKey` est unique. Un rejeu renvoie
   le résultat initial, jamais un doublon.
3. **Jamais de suppression** : une erreur se corrige par une écriture
   compensatrice (`REFUND`/`ADJUST`) avec motif et auteur.
4. **Le solde se dérive du ledger** ; `balanceAfter` est un cache écrit dans la
   même transaction SQL que l'écriture.
5. Le QR privé membre (`Membership.publicCode`) est un identifiant aléatoire —
   il ne contient ni téléphone, ni solde, ni e-mail.

## Structure

```
prisma/schema.prisma   → modèle de données complet (fidélité + social)
prisma/seed.ts         → les 6 restaurants de la démo front
src/server.ts          → point d'entrée Fastify (routes à compléter)
```
