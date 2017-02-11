const WebSocket = require('ws');

function initSockets(server) {
  const wss = new WebSocket.Server({ server });

  let clientsOnIds = {};

  // fix duplication.
  function broadcastForId(message, id, origin){
    const currentClients = clientsOnIds[id] || [];
    currentClients
      .filter(socket => socket !== origin)
      // Dumb safeguard against being in a weird state. TODO: figure out why websockets aren't closing properly
      .filter(socket => socket.readyState === 1)
      .forEach((client) => client.send(JSON.stringify(message)));
  }

  function broadcastForAllInId(message, id){
    const currentClients = clientsOnIds[id] || [];
    currentClients
      // Dumb safeguard against being in a weird state. TODO: figure out why websockets aren't closing properly
      .filter(socket => socket.readyState === 1)
      .forEach((client) => client.send(JSON.stringify(message)));
  }

  function numClientsForId(id){
    return (clientsOnIds[id] || []).length;
  }

  function registerClientForId(ws, id){
    const currentClients = clientsOnIds[id] || [];
    currentClients.push(ws);
    clientsOnIds[id] = currentClients;

    console.log('Client connected to note ' + id);
    broadcastForAllInId(
      { type: 'viewerCount', content: numClientsForId(id) },
      id
    );
  }

  function deregisterClientForId(ws, id){
    const currentClients = clientsOnIds[id];
    const idx = currentClients.indexOf(ws);
    currentClients.splice(idx, 1);
    clientsOnIds[id] = currentClients;

    console.log('Client disconnected for note ' + id);
    broadcastForAllInId(
      { type: 'viewerCount', content: numClientsForId(id) },
      id
    );
  }

  wss.on('connection', function(ws){
    let id;
    ws.on('close', () => {
      if(id){
        deregisterClientForId(ws, id)
      };
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

    ws.on('message', (message) => {
      let parsed = JSON.parse(message);
      switch (parsed.type){
        case 'register':
          registerClientForId(ws, parsed.id);
          id = parsed.id
          break;
        case 'update':
          // slap the same update command back to all users
          broadcastForId(
            { type: 'replace', content: parsed.content },
            parsed.id,
            ws
          );
          break;
        default:
          console.log(`Unknown message type "${parsed.type}"-- ignoring!`);
          break;
      }
    });
  });

  return wss;
}

module.exports = initSockets;
