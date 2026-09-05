# Génère FIDELITY-CODE-COMPLET.md : tout le code source du projet en un seul fichier.
from pathlib import Path

ROOT = Path(r"C:\Users\jebza\Documents\Kimi\Workspaces\OnMangeQuoi")
OUT = ROOT / "FIDELITY-CODE-COMPLET.md"

FILES = [
    # Config déploiement
    "render.yaml",
    # Backend
    "backend/package.json",
    "backend/tsconfig.json",
    "backend/prisma/schema.prisma",
    "backend/prisma/seed.ts",
    "backend/src/server.ts",
    "backend/src/lib/auth.ts",
    "backend/src/lib/security.ts",
    "backend/src/lib/tokens.ts",
    "backend/src/routes/auth.ts",
    "backend/src/routes/restaurants.ts",
    "backend/src/routes/memberships.ts",
    "backend/src/routes/ledger.ts",
    "backend/src/routes/shares.ts",
    "backend/scripts/test-api.mjs",
    "backend/scripts/test-shares.mjs",
    "backend/README.md",
    "backend/RECAP.md",
    # Frontend — config
    "app/package.json",
    "app/vite.config.ts",
    "app/tsconfig.json",
    "app/tsconfig.app.json",
    "app/tsconfig.node.json",
    "app/tailwind.config.js",
    "app/postcss.config.js",
    "app/index.html",
    # Frontend — source
    "app/src/main.tsx",
    "app/src/App.tsx",
    "app/src/App.css",
    "app/src/index.css",
    "app/src/nav.ts",
    "app/src/data.ts",
    "app/src/components/kit.tsx",
    "app/src/lib/api.ts",
    "app/src/lib/utils.ts",
    "app/src/hooks/use-mobile.ts",
    "app/src/pages/Home.tsx",
    "app/src/pages/Search.tsx",
    "app/src/pages/Discovery.tsx",
    "app/src/pages/Restaurant.tsx",
    "app/src/pages/Loyalty.tsx",
    "app/src/pages/Settings.tsx",
    "app/src/pages/Member.tsx",
    "app/src/pages/Dashboard.tsx",
    "app/src/pages/Studio.tsx",
    "app/src/pages/Share.tsx",
    # Docs de travail
    "FEUILLE-DE-ROUTE.md",
    "RECAP-CONNEXION.md",
    "GUIDE-DEPLOIEMENT.md",
]

LANG = {
    ".ts": "ts", ".tsx": "tsx", ".js": "js", ".mjs": "js", ".json": "json",
    ".css": "css", ".html": "html", ".md": "md", ".yaml": "yaml", ".prisma": "prisma",
}

parts = [
    "# FIDELITY — Code source complet (dump unique)\n\n",
    "> Généré le 5 septembre 2026. Chaque fichier est précédé de son chemin exact.\n",
    "> Uploade ce fichier dans ChatGPT : il contient TOUT le projet (frontend + backend + config).\n",
    "> Le dossier `app/src/components/ui/` (boilerplate shadcn inutilisé) est volontairement exclu.\n\n",
    "## Table des fichiers\n\n",
]
for f in FILES:
    parts.append(f"- `{f}`\n")
parts.append("\n---\n")

missing = []
for f in FILES:
    path = ROOT / f
    if not path.exists():
        missing.append(f)
        continue
    content = path.read_text(encoding="utf-8")
    lang = LANG.get(path.suffix, "")
    parts.append(f"\n## 📄 `{f}`\n\n```{lang}\n{content}\n```\n")

# .env en dernier, avec avertissement
env_path = ROOT / "backend" / ".env"
if env_path.exists():
    parts.append(
        "\n## 🔐 `backend/.env` — SECRETS (ne jamais publier)\n\n"
        "Inclus pour permettre la continuité du travail sans reconfiguration.\n\n"
        f"```env\n{env_path.read_text(encoding='utf-8')}\n```\n"
    )

OUT.write_text("".join(parts), encoding="utf-8")
size = OUT.stat().st_size
print(f"OK: {OUT.name} — {size/1024:.0f} Ko, {len(FILES) - len(missing)} fichiers")
if missing:
    print("MANQUANTS:", missing)
