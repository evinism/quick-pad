import { v4 } from "uuid";
import { prisma } from "./db";
import { Document } from "./document";

export type RecentNote = {
  id: string;
  title: string;
  lastUsed: string; // stored as ISO string in JSON
};

export class DocumentStore {
  docs = new Map<string, Document>();
  // UserId -> Map<DocId, { title, lastUsed }>
  userRecents = new Map<number, Map<string, { title: string, lastUsed: Date }>>();

  /**
   * Load a document from memory or database.
   */
  async recall(id: string): Promise<Document | undefined> {
    if (this.docs.has(id)) {
      return this.docs.get(id);
    }
    const result = await prisma.notes.findUnique({ where: { id } });
    if (result) {
      const doc = new Document(id, result.content, 0, result.lastuse, result.ownerId ?? undefined);
      this.docs.set(id, doc);
      return doc;
    }
    return undefined;
  }

  /**
   * Create a new document.
   */
  async create(userId?: number): Promise<string> {
    // TODO: make this retry infinitely until a new id is found.
    const newId = v4().split("-")[0];
    console.log(`Creating note ${newId}`);

    const doc = new Document(newId, "", 0, new Date(), userId);
    this.docs.set(newId, doc);

    await prisma.notes.create({
      data: {
        id: newId,
        lastuse: new Date(),
        content: "",
        ownerId: userId,
      },
    });
    return newId;
  }

  /**
   * Get a document from memory if it exists.
   */
  get(id: string): Document | undefined {
    return this.docs.get(id);
  }

  /**
   * Evict a document from memory, persisting it first.
   */
  async evict(id: string) {
    const doc = this.docs.get(id);
    if (doc) {
      await doc.save();
      this.docs.delete(id);
      console.log(`Evicted note ${id} from memory`);
    }
  }

  /**
   * Update a document's content.
   * Updates memory cache if present, otherwise updates DB directly.
   */
  async update(id: string, content: string) {
    const doc = this.docs.get(id);
    if (doc) {
      doc.updateContent(content);
    } else {
      await prisma.notes.update({
        where: { id },
        data: { content, lastuse: new Date() },
      });
    }
  }

  /**
   * Initialize recent notes cache for a user.
   */
  async initUser(userId: number) {
    if (this.userRecents.has(userId)) return;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user && user.recents) {
      const recentsMap = new Map<string, { title: string, lastUsed: Date }>();
      const recentsArray = user.recents as unknown as RecentNote[];
      if (Array.isArray(recentsArray)) {
          recentsArray.forEach(r => {
            recentsMap.set(r.id, { title: r.title, lastUsed: new Date(r.lastUsed) });
          });
      }
      this.userRecents.set(userId, recentsMap);
    } else {
        this.userRecents.set(userId, new Map());
    }
  }

  /**
   * Persist and clear recent notes cache for a user.
   */
  async cleanupUser(userId: number) {
    const recentsMap = this.userRecents.get(userId);
    if (recentsMap) {
      const recentsArray: RecentNote[] = Array.from(recentsMap.entries())
        .sort((a, b) => b[1].lastUsed.getTime() - a[1].lastUsed.getTime())
        .slice(0, 500) // Limit to 500
        .map(([id, data]) => ({
          id,
          title: data.title,
          lastUsed: data.lastUsed.toISOString()
        }));

      await prisma.user.update({
        where: { id: userId },
        data: { recents: recentsArray as any }
      });
      this.userRecents.delete(userId);
    }
  }

  /**
   * Update the recent notes cache for a user.
   */
  touchRecent(userId: number, docId: string, content: string) {
    const recentsMap = this.userRecents.get(userId);
    if (recentsMap) {
        let title = content.split("\n")[0].slice(0, 50);
        recentsMap.set(docId, { title, lastUsed: new Date() });
    }
  }

  /**
   * Get recent notes for a user.
   */
  async getRecentNotes(userId: number) {
      // If user is connected, return from memory
      if (this.userRecents.has(userId)) {
          const map = this.userRecents.get(userId)!;
          return Array.from(map.entries())
              .sort((a, b) => b[1].lastUsed.getTime() - a[1].lastUsed.getTime())
              .map(([id, data]) => ({ id, abbreviation: data.title }));
      }

      // Fallback: fetch from DB
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return [];
      const recentsArray = user.recents as unknown as RecentNote[];
      if (!Array.isArray(recentsArray)) return [];

      return recentsArray
        .map(r => ({ id: r.id, abbreviation: r.title, lastUsed: new Date(r.lastUsed) }))
        .sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())
        .map(r => ({ id: r.id, abbreviation: r.abbreviation }));
  }

  /**
   * Check status of notes by id.
   */
  async checkStatus(ids: string[]) {
    const statuses = [];
    for (const id of ids) {
      let doc = this.docs.get(id);
      if (doc) {
        statuses.push({ id, abbreviation: doc.getTitle() });
      } else {
        const dbNote = await prisma.notes.findUnique({ where: { id } });
        if (dbNote) {
           // Temporary doc to get title logic
           const tempDoc = new Document(id, dbNote.content, 0, dbNote.lastuse);
           statuses.push({ id, abbreviation: tempDoc.getTitle() });
        }
      }
    }
    return statuses;
  }

  /**
   * Destroy notes that are greater than 365 days old.
   */
  destroyOldNotes() {
    console.log("Deleting old notes...");
    return prisma.$queryRaw`
      DELETE FROM notes WHERE lastuse <= (now() - interval '365 days');
    `;
  }
}

export const store = new DocumentStore();
