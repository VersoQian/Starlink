import { prisma } from '../prisma'
import { KbService } from './KbService'

export class UsageService {
  static async getUsage() {
    const usage = await KbService.findOrCreateUsage()
    return {
      usedTokens: Number(usage.usedTokens),
      limitTokens: Number(usage.limitTokens),
    }
  }

  static async incrementTokens(tokens: number) {
    const usage = await KbService.findOrCreateUsage()
    await prisma.usage.update({
      where: { id: usage.id },
      data: {
        usedTokens: usage.usedTokens + BigInt(tokens),
      },
    })
  }
}
