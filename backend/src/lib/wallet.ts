import fs from 'node:fs'
import { createHash, createPrivateKey, timingSafeEqual, X509Certificate } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { PKPass } from 'passkit-generator'
import type { PrismaClient, WalletPass } from '@prisma/client'
import { balanceOf } from './ledger.js'

export interface WalletConfig {
  passTypeIdentifier: string; teamIdentifier: string; webServiceURL: string; appURL: string
  certificates: { wwdr: Buffer; signerCert: Buffer; signerKey: Buffer; signerKeyPassphrase?: string }
}
export function walletConfig(): WalletConfig | null {
  try {
    const passTypeIdentifier = process.env.APPLE_WALLET_PASS_TYPE_ID || ''
    const teamIdentifier = process.env.APPLE_WALLET_TEAM_ID || ''
    if (!/^pass\.[a-zA-Z0-9.-]+$/.test(passTypeIdentifier) || !/^[A-Z0-9]{10}$/.test(teamIdentifier)) return null
    const base = new URL(process.env.APPLE_WALLET_WEB_SERVICE_URL || '')
    const appURL = new URL(process.env.APP_URL || '')
    if (base.protocol !== 'https:' || base.pathname.replace(/\/$/, '') !== '/wallet' || base.username || base.password || base.search || base.hash || appURL.protocol !== 'https:' || appURL.username || appURL.password) return null
    const certificates = {
      wwdr: fs.readFileSync(process.env.APPLE_WALLET_WWDR_CERT_PATH || ''),
      signerCert: fs.readFileSync(process.env.APPLE_WALLET_SIGNER_CERT_PATH || ''),
      signerKey: fs.readFileSync(process.env.APPLE_WALLET_SIGNER_KEY_PATH || ''),
      signerKeyPassphrase: process.env.APPLE_WALLET_SIGNER_KEY_PASSPHRASE || undefined,
    }
    const signer = new X509Certificate(certificates.signerCert), wwdr = new X509Certificate(certificates.wwdr)
    const key = createPrivateKey({ key: certificates.signerKey, passphrase: certificates.signerKeyPassphrase })
    const now = Date.now()
    if (!signer.checkPrivateKey(key) || !signer.verify(wwdr.publicKey) || !/Apple/.test(wwdr.subject)) return null
    if (![signer, wwdr].every(cert => Date.parse(cert.validFrom) <= now && Date.parse(cert.validTo) > now)) return null
    if (!signer.subject.split('\n').includes(`UID=${passTypeIdentifier}`) || !signer.subject.split('\n').includes(`OU=${teamIdentifier}`)) return null
    return { passTypeIdentifier, teamIdentifier, certificates, webServiceURL: base.href.replace(/\/$/, ''), appURL: appURL.href }
  } catch { return null }
}
export const hashDevice = (device: string) => createHash('sha256').update(device).digest('hex')
export function matchesPassToken(header: string | undefined, token: string) {
  if (!header?.startsWith('ApplePass ')) return false
  const supplied = Buffer.from(header.slice(10)), expected = Buffer.from(token)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

// Icône Fidelity simple, encodée en PNG sans dépendance de traitement d'image.
// Le dessin vectoriel du F est décliné aux trois tailles demandées par Wallet.
function icon(size: number): Buffer {
  function crc(bytes: Buffer) { let value = 0xffffffff; for (const byte of bytes) { value ^= byte; for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (0xedb88320 & -(value & 1)) }; return (value ^ 0xffffffff) >>> 0 }
  function chunk(type: string, data: Buffer) { const raw = Buffer.concat([Buffer.from(type), data]), length = Buffer.alloc(4), checksum = Buffer.alloc(4); length.writeUInt32BE(data.length); checksum.writeUInt32BE(crc(raw)); return Buffer.concat([length, raw, checksum]) }
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2
  const pixels = Buffer.alloc((size * 3 + 1) * size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const a = x / size, b = y / size
    const letter = (a >= .29 && a <= .41 && b >= .22 && b <= .78) || (a >= .29 && a <= .72 && b >= .22 && b <= .34) || (a >= .29 && a <= .64 && b >= .44 && b <= .56)
    const color = letter ? [255, 248, 239] : [196, 65, 15], at = y * (size * 3 + 1) + 1 + x * 3
    for (let c = 0; c < 3; c++) pixels[at + c] = color[c]
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))])
}
const icons = { 'icon.png': icon(29), 'icon@2x.png': icon(58), 'icon@3x.png': icon(87) }

export async function renderWalletPass(prisma: PrismaClient, wallet: WalletPass, config: WalletConfig) {
  const membership = await prisma.membership.findUniqueOrThrow({ where: { id: wallet.membershipId }, include: { restaurant: { include: { program: true } } } })
  const { restaurant } = membership, program = restaurant.program
  const balance = await balanceOf(prisma, membership.id)
  const pass = new PKPass(icons, config.certificates, {
    formatVersion: 1, passTypeIdentifier: config.passTypeIdentifier, teamIdentifier: config.teamIdentifier,
    serialNumber: wallet.id, organizationName: 'Fidelity', description: `Carte de fidélité ${restaurant.name}`,
    logoText: restaurant.name, backgroundColor: 'rgb(196, 65, 15)', foregroundColor: 'rgb(255, 248, 239)', labelColor: 'rgb(255, 225, 199)',
    authenticationToken: wallet.authenticationToken, webServiceURL: config.webServiceURL,
    voided: restaurant.status !== 'VERIFIED' || !program?.active,
  })
  pass.type = 'storeCard'
  pass.primaryFields.push({ key: 'balance', label: program?.type === 'STAMPS' ? 'COCHES' : 'POINTS', value: balance })
  pass.secondaryFields.push({ key: 'reward', label: 'VOTRE RÉCOMPENSE', value: program?.reward || 'Programme indisponible' })
  pass.auxiliaryFields.push({ key: 'target', label: 'OBJECTIF', value: program?.target || 0 }, { key: 'remaining', label: 'ENCORE', value: Math.max(0, (program?.target || 0) - balance) })
  const link = new URL(config.appURL); link.searchParams.set('restaurant', restaurant.slug)
  pass.backFields.push({ key: 'rule', label: 'Comment gagner des points', value: program?.rule || '' },
    { key: 'usage', label: 'En caisse', value: 'Présentez ce QR pour recevoir vos points. Pour utiliser une récompense, ouvrez le QR temporaire de votre carte dans Fidelity.' },
    { key: 'website', label: 'Ouvrir Fidelity', value: link.href },
    { key: 'updated', label: 'Dernière mise à jour', value: wallet.updatedAt.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) })
  pass.setBarcodes({ format: 'PKBarcodeFormatQR', message: `fidelity:wallet:${wallet.barcode}`, messageEncoding: 'iso-8859-1', altText: 'Présentez cette carte en caisse' })
  return pass.getAsBuffer()
}
