import { v4 } from "uuid";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function persist(id: string, content: string, userId?: number) {
  await prisma.notes.update({
    where: { id },
    data: {
      lastuse: new Date(),
      content,
      ownerId: userId,
    },
  });
  await touch(id, userId);
  return { success: true };
}

export async function recall(id: string, userId?: number) {
  const result = await prisma.notes.findUnique({ where: { id } });

  // tee off, but don't wait for query to complete
  if (result) {
    touch(id, userId);
  }
  return result?.content;
}

export async function exists(id: string) {
  return !!(await prisma.notes.findUnique({ where: { id } }));
}

export async function create(userId?: number) {
  // TODO: make this retry infinitely until a new id is found.
  let newId = v4().split("-")[0];
  console.log(`Creating note ${newId}`);
  await prisma.notes.create({
    data: {
      id: newId,
      lastuse: new Date(),
      content: "",
    },
  });
  return newId;
}

// destroys notes that are greater than 30 days old;
export function destroyOldNotes() {
  console.log("Deleting old notes...");
  return prisma.$queryRaw`
    "DELETE FROM notes WHERE lastuse <= (now() - interval '365 days');"
  `;
}

const MAX_RECENT_NOTES = 500;

export async function touch(id: string, userId?: number) {
  await prisma.notes.update({
    where: { id },
    data: {
      lastuse: new Date(),
    },
  });
  if (userId) {
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

  return { success: true };
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
  let { recents } = (await prisma.user.findUnique({ where: { id: userId } }))!;
  recents = recents.slice(0, MAX_RECENT_NOTES);
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

export async function checkStatus(ids: string[]) {
  const notes = await prisma.notes.findMany({
    where: {
      id: {
        in: ids,
      },
    },
  });
  const statuses = notes.map(({ id, content }) => {
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
  touch,
  exists,
  checkStatus,
  destroyOldNotes,
  getRecentNotesForUser,
};
