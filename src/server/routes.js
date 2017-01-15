const {create, persist, recall, exists, destroy} = require('./store.js');
const renderClient = require('../client');

const homeScreenText = `
quick-pad:
dead simple collaborative notepad
---

Click the (+) to create a new note
Send the link to share

Notes expire after 30 days of disuse
`;

const noteNotFoundText = `
404: note not found
---

The note at this address either was not created or has been deleted.
Click the (+) to create a new note.
`;

function configureRoutes(app){
  // root is read-only info page
  app.get('/', function(request, response) {
    response.send(renderClient({
      content: homeScreenText,
      readOnly: true,
    }));
  });

  // new will redirect to the properly
  app.get('/new/', function(request, response) {
    const newId = create();
    response.redirect(`/note/${newId}/`)
  });

  // handles 404s too
  app.get('/note/:id/', function(request, response) {
    const id = request.params.id;
    if (exists(id)) {
      response.send(renderClient({
        content: recall(id),
        noteId: id,
        readOnly: false,
      }));
    } else {
      response.status(404).send(renderClient({
        content: noteNotFoundText,
        readOnly: true,
      }));
    }
  });

  app.post('/note/:id/', function(request, response){
    const id = request.params.id;
    persist(id, request.body.content || '')
    response.status(200).json({success: true});
  });
}

module.exports = configureRoutes;
