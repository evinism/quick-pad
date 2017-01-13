const  express = require('express');
const renderClient = require('../client');
var bodyParser = require('body-parser');

function run(port) {
  console.log('quick-pad starting');
  var app = express();
  app.set('port', (port || 8080));

  app.use(bodyParser.json());
  app.use(express.static('/src/client/assets'));

  // literally just hack in content
  let content = 'hello world';

  app.get('/', function(request, response) {
    response.send(renderClient({
      cssPath: 'main.css',
      jsPath: 'main.js',
      content,
    }));
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
