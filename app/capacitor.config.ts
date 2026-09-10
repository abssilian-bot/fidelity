import type { CapacitorConfig } from '@capacitor/cli'

// Configuration de la coque native iOS (voir TRANSFERT-MAC.md pour la soumission).
// L'app embarque le front compilé (dist/) et appelle l'API publique Render —
// l'URL est fixée par app/.env.ios via `npm run build:ios`.
const config: CapacitorConfig = {
  appId: 'com.fidelity.app', // à faire correspondre à l'App ID du portail Apple Developer
  appName: 'Fidelity',
  webDir: 'dist',
}

export default config
