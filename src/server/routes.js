const {create, persist, recall, exists, destroy} = require('./store.js');
const renderClient = require('../client');

const homeScreenText = `
quick-pad:
dead-simple collaborative notepad
---

Click (+) to create a new note.
Send the link to share.

Notes expire after 30 days of disuse.
`;

const noteNotFoundText = `
404: Note not found
---

The note at this address either has not been created or has been deleted.
Click (+) to create a new note.
`;

const pageNotFoundText = `
404: page not found
---

Oops! Nothing exists here.
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

  app.get('/note/:id/', function(request, response) {
    const id = request.params.id;
    const autofocus = request.query.autofocus !== 'false';
    exists(id).then(
      doesExist => doesExist ? (
        recall(id).then(
          content => response.send(renderClient({
            content: content,
            title: 'quick-pad: note',
            noteId: id,
            readOnly: false,
            autofocus,
          }))
        )
      ) : (
        response.status(404).send(renderClient({
          content: noteNotFoundText,
          title: 'quick-pad: note not found',
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

  app.get('*', function(request, response){
    response.status(404).send(renderClient({
      content: pageNotFoundText,
      title: 'quick-pad: page not found',
      readOnly: true,
    }))
  });
}

module.exports = configureRoutes;
