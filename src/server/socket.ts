import { Server, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import { persist } from "./store.js";

type Message = Object;

function initSockets(server: HTTPServer) {
  const io = new Server(server);

  let clientsOnIds: { [key: string]: Socket[] } = {};

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

  function numClientsForId(id: string) {
    return (clientsOnIds[id] || []).length;
  }

  function registerClientForId(ws: Socket, id: string) {
    const currentClients = clientsOnIds[id] || [];
    currentClients.push(ws);
    clientsOnIds[id] = currentClients;

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
  }

  io.on("connection", function (ws: Socket) {
    let id: string | undefined;
    ws.on("disconnect", () => {
      if (id) {
        deregisterClientForId(ws, id);
      }
    });

    /*
      message interface:
        {
          type, // action to be taken
          content, // value of the message
          id, // note id (which we shouldn't even need for anything other than register)
        }

      server:
        'update' broadcasts changes to all registered clients
        'register' registers a client as observing a certain note
      client: [id is not required]
        'replace' replaces foreign content with local content
        'viewerCount' indicates the viewer count has changed.
    */

    ws.on("message", (message) => {
      switch (message.type) {
        case "register":
          registerClientForId(ws, message.id);
          id = message.id;
          break;
        case "update":
          // slap the same update command back to all users
          broadcastForId(
            { type: "replace", content: message.content },
            message.id,
            ws
          );
          // and persist changes to db
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
