const  express = require('express');
const renderClient = require('../client');
var bodyParser = require('body-parser');
const v4 = require('uuid/v4');


const homeScreenText = `
quick-pad:
dead simple collaborative notepad
---

Click the (+) to create a new note
Send the link to share

Notes expire after 30 days of disuse
`;

const store = {}; // haha wow this is dumb.

function run() {
  console.log('quick-pad starting');
  var app = express();
  app.set('port', (process.env.PORT || 8080));

  app.use(bodyParser.json());
  app.use(express.static('/src/client/assets'));

  // root is read-only info page
  app.get('/', function(request, response) {
    response.send(renderClient({content: homeScreenText}));
  });
  app.post('/', function(request, response){
    response.status(200).json({success: true});
  });

  // new will redirect to the properly
  app.get('/new/', function(request, response) {
    response.redirect(`/note/${v4()}/`)
  });

  // Anything in note gets sent appropriately.
  // This is so stupidly lazy
  app.get('/note/:id/', function(request, response) {
    const id = request.params.id;
    response.send(renderClient({content: store[id] || ''}));
  });

  app.post('/note/:id/', function(request, response){
    const id = request.params.id;
    store[id] = request.body.content || '';
    response.status(200).json({success: true});
  });

  app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
  });
}

module.exports = run;
