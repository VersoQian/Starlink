import { KbStatus, KnowledgeBase } from '@prisma/client'
import { prisma } from '../prisma'

export class KbService {
  static async create(ownerId?: string): Promise<KnowledgeBase> {
    return prisma.knowledgeBase.create({
      data: {
        name: '新建 Knowledge Base',
        aiChunkingEnabled: true,
        status: 'draft',
        ownerId,
      },
    })
  }

  static async getById(id: string): Promise<KnowledgeBase> {
    const kb = await prisma.knowledgeBase.findUnique({ where: { id } })
    if (!kb) {
      throw new Error('KnowledgeBase Not Found')
    }
    return kb
  }

  static async update(id: string, payload: Partial<KnowledgeBase>): Promise<KnowledgeBase> {
    return prisma.knowledgeBase.update({
      where: { id },
      data: payload,
    })
  }

  static async publish(id: string): Promise<KnowledgeBase> {
    return prisma.knowledgeBase.update({
      where: { id },
      data: {
        status: 'ready',
        publishedAt: new Date(),
      },
    })
  }

  static async setStatus(id: string, status: KbStatus) {
    await prisma.knowledgeBase.update({ where: { id }, data: { status } })
  }

  static async findOrCreateUsage() {
    const existing = await prisma.usage.findFirst()
    if (existing) return existing
    return prisma.usage.create({ data: {} })
  }
}
