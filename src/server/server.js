const  express = require('express');
const renderClient = require('../client');
var bodyParser = require('body-parser');

function run() {
  console.log('quick-pad starting');
  var app = express();
  app.set('port', (process.env.PORT || 8080));

  app.use(bodyParser.json());
  app.use(express.static('/src/client/assets'));

  // literally just hack in content
  let content = 'type here to begin...';

  app.get('/', function(request, response) {
    response.send(renderClient({content}));
  });

  app.post('/', function(request, response){
    content = request.body.content;
    response.status(200).json({content});
  })

  app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
  });
}

module.exports = run;
