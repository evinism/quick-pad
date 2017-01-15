const WebSocket = require('ws');

function initSockets(server) {
  const wss = new WebSocket.Server({ server });

  let clientsOnIds = {};
  function broadcastForId(message, id, origin){
    const currentClients = clientsOnIds[id] || [];
    currentClients.filter(client => client !== origin).forEach((client) => {
      client.send(message);
    })
  }

  function registerClientForId(ws, id){
    const currentClients = clientsOnIds[id] || [];
    currentClients.push(ws);
    clientsOnIds[id] = currentClients;
    console.log(`added client for ${id} at pos ${currentClients.length - 1} of table`);
  }

  function deregisterClientForId(ws, id){
    const currentClients = clientsOnIds[id];
    const idx = currentClients.indexOf(ws);
    currentClients.splice(idx, 1);
    clientsOnIds[id] = currentClients;
  }

  wss.on('connection', function(ws){
    let id;
    console.log('Client connected');
    ws.on('close', () => {
      if(id){
        deregisterClientForId(ws, id)
        console.log('Client disconnected');
      };
    });
    ws.on('message', (message) => {
      let parsed = JSON.parse(message);
      if (parsed.type === 'register') {
        registerClientForId(ws, parsed.id);
      } else if(parsed.type === 'update') {
        broadcastForId(parsed.content, parsed.id, ws);
      } else {
        console.log('Unknown message type-- ignoring!');
      }
    });
  });

  return wss;
}

module.exports = initSockets;
