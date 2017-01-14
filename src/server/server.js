require('dotenv').config();
const  express = require('express');
const renderClient = require('../client');
const bodyParser = require('body-parser');
const http = require('http');
const v4 = require('uuid/v4');
const WebSocket = require('ws');

const homeScreenText = `
quick-pad:
dead simple collaborative notepad
---

Click the (+) to create a new note
Send the link to share

Notes expire after 30 days of disuse
`;

const store = {}; // haha wow this is dumb.

function persist(id, content){
  store[id] = content;
}

function recall(id){
  return store[id] || '';
}

function run() {
  console.log('quick-pad starting');

  // Main app!
  var app = express();
  app.set('port', (process.env.PORT || 8080));

  app.use(bodyParser.json());
  app.use(express.static('/src/client/assets'));

  /* ---- ROUTES CONFIGURATION ---- */

  // root is read-only info page
  app.get('/', function(request, response) {
    response.send(renderClient({
      content: homeScreenText,
      readOnly: true,
    }));
  });

  // new will redirect to the properly
  app.get('/new/', function(request, response) {
    response.redirect(`/note/${v4()}/`)
  });

  app.get('/note/:id/', function(request, response) {
    const id = request.params.id;
    response.send(renderClient({
      content: recall(id),
      noteId: id,
      readOnly: false,
    }));
  });

  app.post('/note/:id/', function(request, response){
    const id = request.params.id;
    persist(id, request.body.content || '')
    response.status(200).json({success: true});
  });

  const server = app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
  });

  //-- Sockets! --
  const wss = new WebSocket.Server({ server });

  // ---- live update ----
  // Super super super rough
  let clientsOnIds = {};

  function broadcastForId(message, id, origin){
    console.log('broadcasting ' + message + ' for ' + id);
    const currentClients = clientsOnIds[id] || [];
    currentClients.filter(client => client !== origin).forEach((client) => {
      console.log('sending message: %s', message);
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
      console.log('Message recieved: ' +  message);
      let parsed = JSON.parse(message);
      if (parsed.type === 'register') {
        registerClientForId(ws, parsed.id);
      } else if(parsed.type === 'update') {
        console.log('Update recieved');
        broadcastForId(parsed.content, parsed.id, ws);
      } else {
        console.log('Unknown message type-- ignoring!');
      }
    });
  });
}

module.exports = run;
