import { Server as HTTPServer } from "http";
import WebSocket from "ws";
import WebSocketJSONStream from "@teamwork/websocket-json-stream";
import { backend, getDocContent } from "./sharedb";
import { prisma, getRecentNotesForUser } from "./db";

// Track connected clients per document ID for viewer counts
const clientsOnIds: Map<string, Set<any>> = new Map();

function initSockets(server: HTTPServer) {
  console.log("[Socket] Initializing ShareDB WebSocket server");

  // Create WebSocket server
  const wss = new WebSocket.Server({ server });

  // Connect middleware: resolve noteId + email from query string
  backend.use('connect', async (context: any, callback: any) => {
    const req = context.req;
    if (!req?.url) return callback();

    let noteId: string | undefined;
    let userId: number | undefined;

    try {
      const url = new URL(req.url, 'http://localhost');
      noteId = url.searchParams.get('noteId') || undefined;
      const email = url.searchParams.get('email');

      if (email) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (user) {
          userId = user.id;
          console.log(`[ShareDB] Authenticated user ${user.id} (${email})`);
        }
      }
    } catch (e) {
      // Ignore parse errors
    }

    context.agent.custom = context.agent.custom || {};
    context.agent.custom.noteId = noteId;
    context.agent.custom.userId = userId;

    if (noteId) {
      // Track this client on the document
      if (!clientsOnIds.has(noteId)) {
        clientsOnIds.set(noteId, new Set());
      }
      clientsOnIds.get(noteId)!.add(context.agent);
      console.log(`[ShareDB] Client connected to ${noteId} (${clientsOnIds.get(noteId)!.size} viewers)`);

      // Clean up when agent stream closes
      context.agent.stream.once('close', async () => {
        console.log(`[ShareDB] Close event fired for ${noteId}`);
        const clients = clientsOnIds.get(noteId!);

        // User session lifecycle: update recents for this note and persist
        if (userId) {
          const content = await getDocContent(noteId!);
          const title = content?.split("\n")[0].slice(0, 50) || "";
          const recents = await getRecentNotesForUser(userId);
          const updated = recents.filter(r => r.id !== noteId);
          updated.unshift({ id: noteId!, title, lastUsed: new Date() });

          const recentsArray = updated
              .slice(0, 500)
              .map((r) => ({id: r.id, title: r.title, lastUsed: r.lastUsed.toISOString()}));
          await prisma.user.update({
            where: { id: userId },
            data: { recents: recentsArray as any }
          });
          console.log(`[ShareDB] Persisted recents for user ${userId}`);
        }

        // If a note has no more clients, remove from map and persist note to Postgres
        if (clients) {
          clients.delete(context.agent);
          console.log(`[ShareDB] Client disconnected from ${noteId} (${clients.size} viewers remaining)`);

          if (clients.size === 0) {
            clientsOnIds.delete(noteId!);
            // Last client - persist to Postgres
            console.log(`[ShareDB] Last client left ${noteId}, persisting...`);
            const content = await getDocContent(noteId!);
            if (content !== null) {
              await prisma.notes.update({
                where: { id: noteId },
                data: { content: content, lastuse: new Date() },
              });
            }
          }
        }
      });
    }

    callback();
  });

  wss.on("connection", function (ws: WebSocket, req) {
    const stream = new WebSocketJSONStream(ws);
    backend.listen(stream, req);
  });

  return wss;
}

export default initSockets;
