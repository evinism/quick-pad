import { Server, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import { persist } from "./store.js";
import { notesInMemory, recall } from "./store";


type Message = Object;
type TextOp = Array<
  | { retain: number }
  | { insert: string }
  | { delete: number }
>
interface Pending {
  opId: string;
  clientId: string;
  baseVersion: number;
  ops: TextOp;
}

const clientsOnIds: { [key: string]: Socket[] } = {};

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

  function registerClientForId(ws: Socket, id: string) {
    // Register client for id
    const currentClients = clientsOnIds[id] || [];
    currentClients.push(ws);
    clientsOnIds[id] = currentClients;

    // Recall note from db if not in cache
    recall(id);

    console.log("Client connected to note " + id);
    broadcastForAllInId(
      { type: "viewerCount", content: numClientsForId(id) },
      id
    );
  }

  function deregisterClientForId(ws: Socket, id: string) {
    const currentClients = clientsOnIds[id];
    const idx = currentClients.indexOf(ws);
    currentClients.splice(idx, 1);
    clientsOnIds[id] = currentClients;

    console.log("Client disconnected for note " + id);
    broadcastForAllInId(
      { type: "viewerCount", content: numClientsForId(id) },
      id
    );

    // Persist to db if no clients are connected and clear cache
    if (numClientsForId(id) === 0) {
      persist(id, notesInMemory.get(id)?.content ?? "", notesInMemory.get(id)?.ownerId ?? undefined);
      notesInMemory.delete(id);
    }
  }

  io.on("connection", function (ws: Socket) {
    let id: string | undefined;
    ws.on("disconnect", () => {
      if (id) {
        deregisterClientForId(ws, id);
      }
    });

    ws.on("message", (message) => {
      switch (message.type) {
        case "register":
          registerClientForId(ws, message.id);
          id = message.id;
          break;
        case "update":
          // TODO: Implement OT.
          recall
          // slap the same update command back to all users
          broadcastForId(
            { type: "replace", content: message.content },
            message.id,
            ws
          );
          // Persist changes to in-memory cache.
          persist(message.id, message.content);
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
