import { prisma } from "./db";
import { TextOp, processOperation, processTextUpdate } from "./ot";

export class Document {
  id: string;
  content: string;
  version: number;
  lastUsed: Date;
  ownerId: number | undefined;
  opLog: Map<number, TextOp> = new Map();

  constructor(id: string, content: string, version: number, lastUsed: Date, ownerId?: number) {
    this.id = id;
    this.content = content;
    this.version = version;
    this.lastUsed = lastUsed;
    this.ownerId = ownerId;
  }

  /**
   * Persist the current state of the document to the database.
   */
  async save() {
    await prisma.notes.update({
      where: { id: this.id },
      data: {
        content: this.content,
        lastuse: this.lastUsed,
        ownerId: this.ownerId,
      },
    });
  }

  /**
   * Update the last used timestamp.
   */
  touch() {
    this.lastUsed = new Date();
  }

  /**
   * Update the content of the document and increment the version.
   * This is a simple replacement for now, pending OT integration.
   */
  updateContent(newContent: string) {
    this.content = newContent;
    this.version++;
    this.touch();
  }

  /**
   * Apply a text operation to the document.
   */
  applyOp(op: TextOp, baseVersion: number) {
    const result = processOperation(
      { version: this.version, content: this.content },
      op,
      baseVersion,
      (v) => this.opLog.get(v)
    );

    this.content = result.newDocState.content;
    this.version = result.newDocState.version;
    this.opLog.set(this.version, result.opToBroadcast);
    this.touch();

    return {
      op: result.opToBroadcast,
      version: this.version,
    };
  }

  /**
   * Apply a full text update (diff) to the document.
   */
  applyTextUpdate(newContent: string, baseVersion: number) {
    const result = processTextUpdate(
      { version: this.version, content: this.content },
      this.content,
      newContent,
      baseVersion,
      (v) => this.opLog.get(v)
    );

    this.content = result.newDocState.content;
    this.version = result.newDocState.version;
    this.opLog.set(this.version, result.opToBroadcast);
    this.touch();

    return {
      op: result.opToBroadcast,
      version: this.version,
    };
  }

  /**
   * Get the title/abbreviation of the document.
   */
  getTitle(): string {
    let abbreviation = this.content.split("\n")[0];
    const cutoff = 50;
    if (abbreviation.length > cutoff) {
      abbreviation = abbreviation.slice(0, cutoff);
    }
    return abbreviation;
  }
}
