import type { FastifyInstance } from 'fastify'
import type { Prisma, PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { applicationSchema, lookupSiret, siretSchema, type RegistryResult } from '../lib/restaurant-registration.js'
import { rateLimit } from '../lib/security.js'
import { randomCode } from '../lib/tokens.js'

const applicantSelect = {
  id: true, siret: true, tradingName: true, cuisine: true, address: true, postalCode: true, city: true,
  contactName: true, contactRole: true, phone: true, website: true, message: true, registry: true,
  status: true, decisionReason: true, reviewedAt: true, createdAt: true, updatedAt: true,
  restaurant: { select: { id: true, slug: true, name: true, status: true } },
} satisfies Prisma.RestaurantApplicationSelect

export function restaurantRegistrationRoutes(app: FastifyInstance, prisma: PrismaClient, lookup = lookupSiret) {
  const limited = rateLimit(12, 60_000, req => req.userId)
  const requireAdmin: typeof app.authenticate = async (req, reply) => { if (req.userRole !== 'ADMIN') return reply.code(403).send({ error: 'Accès réservé à l’administration Fidelity.' }) }
  app.get('/owner/registration/siret/:siret', { preHandler: [app.authenticate, limited] }, async (req, reply) => {
    const parsed = siretSchema.safeParse((req.params as { siret: string }).siret)
    if (!parsed.success) return reply.code(400).send({ error: 'Le SIRET doit contenir 14 chiffres valides. Vérifiez le numéro de cet établissement.' })
    return lookup(parsed.data)
  })
  app.get('/owner/applications', { preHandler: app.authenticate }, async req => prisma.restaurantApplication.findMany({ where: { applicantId: req.userId }, select: applicantSelect, orderBy: { createdAt: 'desc' }, take: 50 }))
  app.post('/owner/applications', { preHandler: [app.authenticate, rateLimit(5, 3600_000, req => req.userId)] }, async (req, reply) => {
    const { authorized, ...input } = applicationSchema.parse(req.body)
    const registry = await lookup(input.siret)
    if (registry.state === 'FOUND' && !registry.active) return reply.code(422).send({ error: 'Cet établissement est fermé dans l’annuaire officiel. Vérifiez le SIRET ou faites corriger votre situation avant l’inscription.' })
    // Aucun droit, restaurant, ni programme créé à la soumission ; une panne du registre reste en attente.
      const saved = await prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${req.userId + ':' + input.siret}))`
        const current = await tx.restaurantApplication.findUnique({ where: { applicantId_siret: { applicantId: req.userId, siret: input.siret } } })
        if (current) return tx.restaurantApplication.findUniqueOrThrow({ where: { id: current.id }, select: applicantSelect })
        if (await tx.restaurant.findUnique({ where: { siret: input.siret }, select: { id: true } })) return null
        if (await tx.restaurantApplication.count({ where: { applicantId: req.userId } }) >= 20) return null
        return tx.restaurantApplication.create({ data: { ...input, applicantId: req.userId, registry: registry as Prisma.InputJsonValue }, select: applicantSelect })
      })
      if (!saved) return reply.code(409).send({ error: 'Ce dossier nécessite l’intervention de Fidelity : établissement déjà rattaché ou limite de demandes atteinte.' })
      return reply.code(201).send(saved)
  })
  app.put('/owner/applications/:id', { preHandler: [app.authenticate, rateLimit(5, 3600_000, req => req.userId)] }, async (req, reply) => {
    const { id } = z.object({ id: z.string().min(1).max(40) }).parse(req.params)
    const { authorized, ...input } = applicationSchema.parse(req.body)
    const current = await prisma.restaurantApplication.findFirst({ where: { id, applicantId: req.userId } })
    if (!current) return reply.code(404).send({ error: 'Dossier introuvable.' })
    if (current.status !== 'REJECTED' || current.siret !== input.siret) return reply.code(409).send({ error: 'Seul un dossier refusé peut être corrigé, avec le même SIRET.' })
    const registry = await lookup(input.siret)
    if (registry.state === 'FOUND' && !registry.active) return reply.code(422).send({ error: 'Cet établissement est fermé dans l’annuaire officiel.' })
    const changed = await prisma.restaurantApplication.updateMany({ where: { id, applicantId: req.userId, status: 'REJECTED' }, data: { ...input, registry: registry as Prisma.InputJsonValue, status: 'PENDING', decisionReason: '', verificationNote: '', reviewerId: null, reviewedAt: null } })
    if (!changed.count) return reply.code(409).send({ error: 'Le dossier a changé. Actualisez la liste.' })
    return prisma.restaurantApplication.findUniqueOrThrow({ where: { id }, select: applicantSelect })
  })
  app.get('/admin/restaurant-applications', { preHandler: [app.authenticate, requireAdmin] }, async req => {
    const { status } = z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING') }).parse(req.query)
    return prisma.restaurantApplication.findMany({ where: { status }, orderBy: { createdAt: 'asc' }, take: 100, select: { ...applicantSelect, verificationNote: true, applicant: { select: { email: true } } } })
  })
  app.post('/admin/restaurant-applications/:id/decision', { preHandler: [app.authenticate, requireAdmin, limited] }, async (req, reply) => {
    const { id } = z.object({ id: z.string().min(1).max(40) }).parse(req.params)
    const decision = z.discriminatedUnion('approve', [
      z.object({ approve: z.literal(true), authorityVerified: z.literal(true), activityVerified: z.literal(true), verificationNote: z.string().trim().min(30).max(1500) }).strict(),
      z.object({ approve: z.literal(false), reason: z.string().trim().min(10).max(500) }).strict(),
    ]).parse(req.body)
    const application = await prisma.restaurantApplication.findUnique({ where: { id } })
    if (!application) return reply.code(404).send({ error: 'Dossier introuvable.' })
    if (application.status !== 'PENDING') return reply.code(409).send({ error: 'Ce dossier a déjà été traité. Actualisez la liste.' })
    let registry: RegistryResult | undefined
    if (decision.approve) {
      registry = await lookup(application.siret)
      if (registry.state !== 'FOUND' || !registry.active || !registry.address || !registry.legalName) return reply.code(409).send({ error: 'Validation impossible : l’annuaire doit confirmer un établissement actif avec une raison sociale et une adresse. Réessayez après vérification.' })
    }
    const result = await prisma.$transaction(async tx => {
      // Une seule décision et un seul restaurant pour un SIRET, même entre plusieurs demandes concurrentes.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${application.siret}))`
      const fresh = await tx.restaurantApplication.findUniqueOrThrow({ where: { id } })
      if (fresh.status !== 'PENDING') return null
      const reviewHistory = [...(Array.isArray(fresh.reviewHistory) ? fresh.reviewHistory : []), { actorId: req.userId, at: new Date().toISOString(), ...decision }] as Prisma.InputJsonValue
      if (decision.approve) {
        if (await tx.restaurant.findUnique({ where: { siret: fresh.siret }, select: { id: true } })) return null
        const slug = fresh.tradingName.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 85) || 'restaurant'
        const restaurant = await tx.restaurant.create({ data: {
          ownerId: fresh.applicantId, name: fresh.tradingName, slug: `${slug}-${randomCode(6).toLowerCase().replace(/[^a-z0-9]/g, '')}`,
          siret: fresh.siret, status: 'VERIFIED', cuisine: fresh.cuisine, address: registry!.address!, district: registry!.city || fresh.city,
          hours: [], diets: [], imageUrl: '/images/table.webp',
          program: { create: { type: 'STAMPS', title: 'Ma carte fidélité', target: 10, reward: 'Récompense à définir', rule: 'Une coche par visite.', active: false } },
        } })
        await tx.user.updateMany({ where: { id: fresh.applicantId, role: 'MEMBER' }, data: { role: 'RESTAURANT' } })
        return tx.restaurantApplication.update({ where: { id }, data: { status: 'APPROVED', restaurantId: restaurant.id, registry: registry as Prisma.InputJsonValue, reviewerId: req.userId, reviewedAt: new Date(), reviewHistory, verificationNote: decision.verificationNote, decisionReason: 'Établissement validé. Configurez et publiez votre programme de fidélité.' }, select: applicantSelect })
      }
      return tx.restaurantApplication.update({ where: { id }, data: { status: 'REJECTED', reviewerId: req.userId, reviewedAt: new Date(), reviewHistory, decisionReason: decision.reason }, select: applicantSelect })
    })
    if (!result) return reply.code(409).send({ error: 'Ce dossier a déjà été traité ou ce SIRET est déjà rattaché. Actualisez la liste.' })
    return result
  })
}
