import { KbStatus, KnowledgeBase } from '@prisma/client'
import { prisma } from '../prisma'

export class KbService {
  static async list(workspaceId?: string): Promise<KnowledgeBase[]> {
    return prisma.knowledgeBase.findMany({
      where: workspaceId ? { workspaceId } : undefined,
      orderBy: { updatedAt: 'desc' }
    })
  }

  static async create(options?: { ownerId?: string; workspaceId?: string }): Promise<KnowledgeBase> {
    return prisma.knowledgeBase.create({
      data: {
        name: '新建 Knowledge Base',
        aiChunkingEnabled: true,
        status: 'draft',
        ownerId: options?.ownerId,
        workspaceId: options?.workspaceId,
      },
    })
  }

  static async getById(id: string, workspaceId?: string): Promise<KnowledgeBase> {
    const kb = await prisma.knowledgeBase.findUnique({ where: { id } })
    if (!kb || (workspaceId && kb.workspaceId !== workspaceId)) {
      throw new Error('KnowledgeBase Not Found')
    }
    return kb
  }

  static async update(
    id: string,
    payload: Partial<KnowledgeBase>,
    workspaceId?: string
  ): Promise<KnowledgeBase> {
    await this.getById(id, workspaceId)
    return prisma.knowledgeBase.update({
      where: { id },
      data: payload,
    })
  }

  static async publish(id: string, workspaceId?: string): Promise<KnowledgeBase> {
    await this.getById(id, workspaceId)
    return prisma.knowledgeBase.update({
      where: { id },
      data: {
        status: 'ready',
        publishedAt: new Date(),
      },
    })
  }

  static async setStatus(id: string, status: KbStatus, workspaceId?: string) {
    await this.getById(id, workspaceId)
    await prisma.knowledgeBase.update({ where: { id }, data: { status } })
  }

  static async findOrCreateUsage() {
    const existing = await prisma.usage.findFirst()
    if (existing) return existing
    return prisma.usage.create({ data: {} })
  }
}
