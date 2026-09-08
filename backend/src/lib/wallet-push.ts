import http2 from 'node:http2'
import type { PrismaClient } from '@prisma/client'
import { walletConfig, type WalletConfig } from './wallet.js'

export async function sendWalletPush(pushToken: string, config: WalletConfig): Promise<number> {
  return new Promise((resolve, reject) => {
    const session = http2.connect('https://api.push.apple.com', {
      cert: Buffer.concat([config.certificates.signerCert, Buffer.from('\n'), config.certificates.wwdr]), key: config.certificates.signerKey, passphrase: config.certificates.signerKeyPassphrase,
    })
    let finished = false
    const finish = (status?: number) => { if (finished) return; finished = true; clearTimeout(timer); session.destroy(); if (status) resolve(status); else reject(new Error('Notification Wallet indisponible')) }
    const timer = setTimeout(() => finish(), 10_000)
    session.on('error', () => finish())
    const request = session.request({ ':method': 'POST', ':path': `/3/device/${pushToken}`, 'apns-topic': config.passTypeIdentifier, 'apns-priority': '5', 'content-type': 'application/json' })
    request.on('error', () => finish())
    request.on('response', headers => finish(Number(headers[':status'])))
    request.end('{}')
  })
}

// File persistante : un envoi Apple en panne ne fait jamais échouer un crédit.
// Le bail en base évite que deux processus traitent simultanément la même carte.
export async function deliverWalletUpdates(prisma: PrismaClient, config: WalletConfig, send = sendWalletPush) {
  const ids = await prisma.$transaction(async tx => {
    const due = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "WalletPass" WHERE "version" > "pushedVersion" AND "nextPushAt" <= NOW() ORDER BY "nextPushAt" LIMIT 20 FOR UPDATE SKIP LOCKED`
    if (due.length) await tx.walletPass.updateMany({ where: { id: { in: due.map(row => row.id) } }, data: { nextPushAt: new Date(Date.now() + 5 * 60_000) } })
    return due.map(row => row.id)
  })
  for (const id of ids) {
    const pass = await prisma.walletPass.findUnique({ where: { id }, include: { registrations: true } })
    if (!pass) continue
    let failed = false
    for (const registration of pass.registrations) {
      try {
        const status = await send(registration.pushToken, config)
        if (status === 410) await prisma.walletRegistration.deleteMany({ where: { pushToken: registration.pushToken } })
        else if (status !== 200) failed = true
      } catch { failed = true }
    }
    // Une écriture survenue pendant l'envoi reste à distribuer au prochain passage.
    await prisma.walletPass.updateMany({ where: { id, version: pass.version }, data: failed
      ? { pushFailures: { increment: 1 }, nextPushAt: new Date(Date.now() + Math.min(3_600_000, 15_000 * 2 ** Math.min(pass.pushFailures, 8))) }
      : { pushedVersion: pass.version, pushFailures: 0, nextPushAt: new Date() } })
  }
}
export function startWalletUpdates(prisma: PrismaClient, onError: () => void) {
  let busy = false
  const tick = async () => {
    if (busy) return
    const config = walletConfig(); if (!config) return
    busy = true
    try { await deliverWalletUpdates(prisma, config) } catch { onError() } finally { busy = false }
  }
  const timer = setInterval(() => void tick(), 15_000); timer.unref(); void tick()
  return () => clearInterval(timer)
}
