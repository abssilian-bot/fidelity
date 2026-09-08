// Exécuter sur le poste administrateur, jamais depuis une route publique.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import forge from 'node-forge'
const directory = path.resolve(fileURLToPath(new URL('../../.local/apple-wallet/certs/', import.meta.url)))
const privatePath = path.join(directory, 'fidelity-wallet.key.pem'), csrPath = path.join(directory, 'fidelity-wallet.certSigningRequest')
fs.mkdirSync(directory, { recursive: true })
if (fs.existsSync(privatePath) || fs.existsSync(csrPath)) {
  if (!fs.existsSync(privatePath) || !fs.existsSync(csrPath)) throw new Error('Préparation partielle : aucun fichier existant n’a été remplacé.')
  console.log('Demande existante conservée : ' + csrPath)
} else {
  const keys = forge.pki.rsa.generateKeyPair(2048), csr = forge.pki.createCertificationRequest()
  csr.publicKey = keys.publicKey; csr.setSubject([{ name: 'commonName', value: 'Fidelity Wallet' }]); csr.sign(keys.privateKey, forge.md.sha256.create())
  if (!csr.verify()) throw new Error('Demande de certificat invalide')
  fs.writeFileSync(privatePath, forge.pki.privateKeyToPem(keys.privateKey), { flag: 'wx', mode: 0o600 })
  fs.writeFileSync(csrPath, forge.pki.certificationRequestToPem(csr), { flag: 'wx' })
  console.log('Demande à transmettre à Apple : ' + csrPath)
  console.log('Clé privée conservée localement dans le dossier certs exclu de Git.')
}
