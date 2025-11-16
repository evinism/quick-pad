import { v4 } from "uuid";
import { PrismaClient } from "@prisma/client";
import { numClientsForId } from "./socket";

// Mirrors schema.prisma, with the addition of a version number that is used for
// OT.
export type NoteInMemory = {
  version: number;
  id: string;
  lastuse: Date;
  content: string;
  ownerId?: number;
}

// Memory-cache.
export let notesInMemory = new Map<string, NoteInMemory>();

export const prisma = new PrismaClient();

// If clients connected, update memory cache. Otherwise, persist to db.
export async function persist(id: string, content: string, userId?: number) {
  if (numClientsForId(id) > 0) {
    notesInMemory.set(id, {
      version: (notesInMemory.get(id)?.version ?? 0) + 1,
      id,
      lastuse: new Date(),
      content: content,
      ownerId: userId ?? undefined,
    });
    console.log("Persisted note to memory cache", id);
    console.log("Memory cache", notesInMemory);
  } else {
    await prisma.notes.update({
      where: { id },
      data: {
        lastuse: new Date(),
        content,
        ownerId: userId ?? undefined,
      },
    });
  }
  if (userId) {
    await touchUserRecent(id, userId);
  }
  return { success: true };
}

// Load note from memory cache or db, and update memory cache.
export async function recall(id: string) {
  if (notesInMemory.has(id)) {
    return notesInMemory.get(id);
  }
  const result = await prisma.notes.findUnique({ where: { id } });
  if (result) {
    const note: NoteInMemory = {
      version: 0,
      id,
      lastuse: new Date(),
      content: result.content,
      ownerId: result.ownerId ?? undefined,
    };
    notesInMemory.set(id, note);
    return notesInMemory.get(id);
  }
  return undefined;
}

// Check if note exists in memory cache, then db.
export async function exists(id: string) {
  if (notesInMemory.has(id)) {
    return true;
  }
  return !!(await prisma.notes.findUnique({ where: { id } }));
}

// Create new note in memory cache and db.
export async function create(userId?: number) {
  // TODO: make this retry infinitely until a new id is found.
  let newId = v4().split("-")[0];
  console.log(`Creating note ${newId}`);
  notesInMemory.set(newId, {
    version: 0,
    id: newId,
    lastuse: new Date(),
    content: "",
    ownerId: userId ?? undefined,
  });
  await prisma.notes.create({
    data: {
      id: newId,
      lastuse: new Date(),
      content: "",
      ownerId: userId ?? undefined,
    },
  });
  return newId;
}

// Destroy notes that are greater than 30 days old.
export function destroyOldNotes() {
  console.log("Deleting old notes...");
  return prisma.$queryRaw`
    "DELETE FROM notes WHERE lastuse <= (now() - interval '365 days');"
  `;
}

const MAX_RECENT_NOTES = 500;

// Update lastuse timestamp for note.
export async function touchUserRecent(id: string, userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (user) {
    let { recents } = user;

    // Add the recent notes
    recents.unshift(id);

    await prisma.user.update({
      where: { id: userId },
      data: { recents },
    });
  }
}

const noteToRecentsRecord = ({
  id,
  content,
}: {
  id: string;
  content: string;
}) => {
  let abbreviation = content.split("\n")[0];
  // Lol this is shit:
  const cutoff = 50;
  if (abbreviation.length > cutoff) {
    abbreviation = abbreviation.slice(0, cutoff);
  }
  return {
    id,
    abbreviation,
  };
};

export async function getRecentNotesForUser(userId: number) {
  let recentIdsInMemory = Array.from(notesInMemory.values())
                         .filter((note) => note.ownerId === userId)
                         .sort((a, b) => b.lastuse.getTime() - a.lastuse.getTime())
                         .map((note) => note.id);
  let recentsIdsInDb = (await prisma.user.findUnique({ where: { id: userId } }))!.recents;
  console.log("Recent IDs in memory", recentIdsInMemory);
  console.log("Recent IDs in db", recentsIdsInDb);
  // Combine: DB recents first (already most recent first), then add memory IDs not in DB
  let recents = [...recentIdsInMemory, ...recentsIdsInDb.filter(id => !recentIdsInMemory.includes(id))].slice(0, MAX_RECENT_NOTES);
  let actualNoteRecords = await prisma.notes.findMany({
    where: {
      id: {
        in: recents,
      },
    },
  });

  // Maintain order
  actualNoteRecords = actualNoteRecords.sort(
    (a, b) => recents.indexOf(a.id) - recents.indexOf(b.id)
  );

  // repersist recent notes back to user
  prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      recents: actualNoteRecords.map((note) => note.id),
    },
  });
  return actualNoteRecords.map(noteToRecentsRecord);
}

// Check status of notes by id.
export async function checkStatus(ids: string[]) {
  const idsInMemory = ids
    .filter((id) => notesInMemory.has(id))
    .map((id) => ({ id, content: notesInMemory.get(id)!.content }));
  const idsInDb = (await prisma.notes.findMany({
    where: {
      id: {
        in: ids,
      },
    },
  })).filter(note => !ids.includes(note.id)).map(note => ({ id: note.id, content: note.content }));
  const idsToCheck = [...idsInMemory, ...idsInDb];
  const statuses = idsToCheck.map(({ id, content }) => {
    let abbreviation = content.split("\n")[0];
    // Lol this is shit:
    const cutoff = 50;
    if (abbreviation.length > cutoff) {
      abbreviation = abbreviation.slice(0, cutoff);
    }
    return {
      id,
      abbreviation,
    };
  });
  return statuses;
}

export default {
  prisma,
  create,
  persist,
  recall,
  touchUserRecent,
  exists,
  checkStatus,
  destroyOldNotes,
  getRecentNotesForUser,
};
