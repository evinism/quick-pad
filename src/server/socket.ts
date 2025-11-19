import { Server, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import { store } from "./store";
import { prisma } from "./db";

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
        ws.send({
            type: "snapshot",
            docId: id,
            version: note.version,
            text: note.content
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
           // Legacy update message
           const doc = store.get(message.id);
           if (doc) {
               doc.updateContent(message.content);
               if (userId) {
                   store.touchRecent(userId, message.id, message.content);
               }
               broadcastForId(
                { type: "replace", content: message.content },
                message.id,
                ws
               );
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
