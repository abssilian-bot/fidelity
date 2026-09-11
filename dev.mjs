// Lance le backend (port 3001) ET le front Vite en une seule commande.
// Utilisé par `npm run dev` à la racine — les arguments --port/--host passés
// par Kimi Work sont transmis au serveur Vite.
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))

// Récupère --port / --host (et leurs formes --port=xxxx) depuis la ligne de commande
const args = process.argv.slice(2)
let port = '7100'
let host = undefined
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '--port' && args[i + 1]) port = args[++i]
  else if (a.startsWith('--port=')) port = a.slice(7)
  else if (a === '--host' && args[i + 1]) host = args[++i]
  else if (a.startsWith('--host=')) host = a.slice(7)
}

const children = []
function run(name, command, cwd) {
  const child = spawn(command, { cwd, shell: true, stdio: 'inherit', env: process.env })
  child.on('exit', (code) => {
    console.log(`\n[dev] ${name} s'est arrêté (code ${code}). Arrêt de l'autre processus.`)
    shutdown(code ?? 0)
  })
  children.push(child)
}

function shutdown(code = 0) {
  for (const c of children) {
    try { c.kill() } catch { /* déjà mort */ }
  }
  // Sur Windows, kill() ne tue pas toujours l'arbre : on force via taskkill.
  for (const c of children) {
    if (c.pid) {
      try { spawn('taskkill', ['/PID', String(c.pid), '/T', '/F'], { shell: true, stdio: 'ignore' }) } catch { /* ignore */ }
    }
  }
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

run('backend', 'npm run dev', path.join(root, 'backend'))
const viteArgs = ['npx', 'vite', '--port', port, '--strictPort']
if (host) viteArgs.push('--host', host)
run('frontend', viteArgs.join(' '), path.join(root, 'app'))

console.log(`[dev] backend → http://localhost:3001  |  frontend → http://localhost:${port}`)
