import { v4 } from "uuid";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function persist(id: string, content: string) {
  await prisma.notes.update({
    where: { id },
    data: {
      lastuse: new Date(),
      content,
    },
  });
  return { success: true };
}

export async function recall(id: string) {
  const result = await prisma.notes.findUnique({ where: { id } });

  // tee off, but don't wait for query to complete
  if (result) {
    touch(id);
  }
  return result?.content;
}

export async function exists(id: string) {
  return !!(await prisma.notes.findUnique({ where: { id } }));
}

export async function create() {
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
  return prisma.$queryRaw(
    "DELETE FROM notes WHERE lastuse <= (now() - interval '365 days');"
  );
}

export async function touch(id: string) {
  await prisma.notes.update({
    where: { id },
    data: {
      lastuse: new Date(),
    },
  });
  return { success: true };
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
};
