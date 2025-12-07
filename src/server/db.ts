import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export type RecentNote = {
  id: string;
  title: string;
  lastUsed: Date;
};

export async function getRecentNotesForUser(userId: number): Promise<RecentNote[]> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.recents) return [];
  const recents = user.recents as unknown as RecentNote[];
  if (!Array.isArray(recents)) return [];
  return recents.map(r => ({ id: r.id, title: r.title, lastUsed: new Date(r.lastUsed) }));
}
