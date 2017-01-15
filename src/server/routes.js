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


// TODO: use promises a little better than I'm doing right now
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
    create().then(
      (newId) => response.redirect(`/note/${newId}/`)
    );
  });

  // handles 404s too
  app.get('/note/:id/', function(request, response) {
    const id = request.params.id;
    exists(id).then(
      doesExist => doesExist ? (
        recall(id).then(
          content => response.send(renderClient({
            content: content,
            noteId: id,
            readOnly: false,
          }))
        )
      ) : (
        response.status(404).send(renderClient({
          content: noteNotFoundText,
          readOnly: true,
        }))
      )
    )
  });

  app.post('/note/:id/', function(request, response){
    const id = request.params.id;
    persist(id, request.body.content || '').then(
      () => response.status(200).json({success: true})
    );
  });
}

module.exports = configureRoutes;
