import { PrismaClient } from "@prisma/client"

declare global {
  var __qltrackerPrisma: PrismaClient | undefined
}

export function getPrisma() {
  if (!global.__qltrackerPrisma) {
    global.__qltrackerPrisma = new PrismaClient()
  }

  return global.__qltrackerPrisma
}
