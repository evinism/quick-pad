import { Server, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import { store } from "./store";
import { prisma } from "./db";
import { TextOp } from "./ot";

type Message = Object;

const clientsOnIds: { [key: string]: Socket[] } = {};
// Used to track when a user's session is active
const clientsOnUsers: { [key: number]: number } = {}; // UserId -> socket count

export function numClientsForId(id: string) {
  return (clientsOnIds[id] || []).length;
}

function initSockets(server: HTTPServer) {
  const io = new Server(server);

  // fix duplication.
  function broadcastForId(message: Message, id: string, origin: Socket) {
    const currentClients: Socket[] = clientsOnIds[id] || [];
    currentClients
      .filter((socket) => socket !== origin)
      .forEach((socket) => socket.send(message));
  }

  function broadcastForAllInId(message: Message, id: string) {
    const currentClients = clientsOnIds[id] || [];
    currentClients.forEach((socket) => socket.send(message));
  }

  async function registerClientForId(ws: Socket, id: string, email?: string) {
    // Register client for id
    const currentClients = clientsOnIds[id] || [];
    currentClients.push(ws);
    clientsOnIds[id] = currentClients;

    let userId: number | undefined;

    // Resolve user from email if provided
    if (email) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (user) {
            userId = user.id;
            // Register user session
            clientsOnUsers[userId] = (clientsOnUsers[userId] || 0) + 1;
            await store.initUser(userId);
        }
    }

    // Recall note from store (loads from DB if needed)
    const note = await store.recall(id);
    if (note) {
      ws.emit("message", {
        type: "replace",
        content: note.content,
        version: note.version,
      });
    }

    console.log("Client connected to note " + id);
    broadcastForAllInId(
      { type: "viewerCount", content: numClientsForId(id) },
      id
    );

    return userId;
  }

  async function deregisterClientForId(ws: Socket, id: string, userId?: number) {
    const currentClients = clientsOnIds[id];
    if (currentClients) {
        const idx = currentClients.indexOf(ws);
        if (idx !== -1) {
            currentClients.splice(idx, 1);
            clientsOnIds[id] = currentClients;
        }
    }

    if (userId) {
        clientsOnUsers[userId] = (clientsOnUsers[userId] || 1) - 1;
        if (clientsOnUsers[userId] <= 0) {
            delete clientsOnUsers[userId];
            await store.cleanupUser(userId);
        }
    }

    console.log("Client disconnected for note " + id);
    broadcastForAllInId(
      { type: "viewerCount", content: numClientsForId(id) },
      id
    );

    // Evict from memory if no clients are connected
    if (numClientsForId(id) === 0) {
      await store.evict(id);
    }
  }

  io.on("connection", function (ws: Socket) {
    let id: string | undefined;
    let userId: number | undefined;

    ws.on("disconnect", () => {
      if (id) {
        deregisterClientForId(ws, id, userId);
      }
    });

    ws.on("message", async (message: any) => {
      switch (message.type) {
        case "register":
          id = message.id;
          // Register and get resolved userId
          userId = await registerClientForId(ws, message.id, message.email);
          break;
        case "update":
          // Legacy client sending full text update
          try {
            const doc = await store.recall(message.id);
            if (doc) {
              // If client doesn't send version, assume latest (legacy behavior)
              // Ideally client should send the version it's basing this update on.
              const baseVersion = (message as any).version ?? doc.version;

              const result = await store.applyTextUpdate(
                message.id,
                message.content,
                baseVersion
              );

              // Broadcast full replacement to legacy clients
              // TODO: In the future, broadcast 'op' to OT-aware clients
              broadcastForId(
                { type: "replace", content: doc.content },
                message.id,
                ws
              );

              if (userId) {
                store.touchRecent(userId, message.id, doc.content);
              }
            }
          } catch (e) {
            console.error("Error applying update:", e);
          }
          break;

        case "op":
          // OT-aware client sending operation
          try {
            const doc = await store.recall(message.id);
            if (doc) {
              const op = (message as any).op as TextOp;
              const baseVersion = (message as any).version;

              const result = await store.applyOp(message.id, op, baseVersion);

              // Broadcast op to ALL clients (including sender)
              broadcastForAllInId(
                {
                  type: "op",
                  op: result.op,
                  version: result.version,
                  opId: (message as any).opId,
                },
                message.id
              );

              if (userId) {
                store.touchRecent(userId, message.id, doc.content);
              }
            }
          } catch (e) {
             console.error("Error applying op:", e);
          }
          break;
        default:
          console.log(`Unknown message type "${message.type}"-- ignoring!`);
          break;
      }
    });
  });

  return io;
}

export default initSockets;
