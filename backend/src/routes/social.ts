import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { rateLimit } from '../lib/security.js'

/** Interactions idempotentes : l'état souhaité est explicite. */
export function socialRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const limited = rateLimit(90, 60_000, req => req.userId || req.ip)
  const params = z.object({ id: z.string().min(1).max(40) }), input = z.object({ active: z.boolean() }).strict()
  app.get('/social/mine', { preHandler: app.authenticate }, async req => {
    const [likes, following] = await Promise.all([
      prisma.like.findMany({ where: { userId: req.userId }, select: { postId: true }, take: 1000 }),
      prisma.follow.findMany({ where: { followerId: req.userId }, select: { followedId: true }, take: 1000 }),
    ])
    return { likedPostIds: likes.map(row => row.postId), followedMemberIds: following.map(row => row.followedId) }
  })
  app.put('/social/posts/:id/like', { preHandler: [app.authenticate, limited] }, async (req, reply) => {
    const { id } = params.parse(req.params), { active } = input.parse(req.body)
    const post = await prisma.post.findFirst({ where: { id, status: 'PUBLISHED' }, select: { id: true } })
    if (!post) return reply.code(404).send({ error: 'Publication introuvable.' })
    if (active) await prisma.like.upsert({ where: { userId_postId: { userId: req.userId, postId: id } }, update: {}, create: { userId: req.userId, postId: id } })
    else await prisma.like.deleteMany({ where: { userId: req.userId, postId: id } })
    return { active, count: await prisma.like.count({ where: { postId: id } }) }
  })
  app.put('/social/members/:id/follow', { preHandler: [app.authenticate, limited] }, async (req, reply) => {
    const { id } = params.parse(req.params), { active } = input.parse(req.body)
    if (id === req.userId) return reply.code(400).send({ error: 'Tu ne peux pas t’abonner à ton propre compte.' })
    const user = await prisma.user.findFirst({ where: { id, OR: [{ role: 'MEMBER', pseudo: { not: null } }, { posts: { some: { status: 'PUBLISHED' } } }] }, select: { id: true } })
    if (!user) return reply.code(404).send({ error: 'Profil introuvable.' })
    if (active) await prisma.follow.upsert({ where: { followerId_followedId: { followerId: req.userId, followedId: id } }, update: {}, create: { followerId: req.userId, followedId: id } })
    else await prisma.follow.deleteMany({ where: { followerId: req.userId, followedId: id } })
    return { active, count: await prisma.follow.count({ where: { followedId: id } }) }
  })
}
