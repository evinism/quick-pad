import io from 'socket.io-client';
import { throttle, debounce, noteUrlToNoteID, enableTabsOnTextArea } from './util';
const { interactionStyle, noteId: pageLoadNoteId } = Environment;

const area = document.querySelector('textarea');

enableTabsOnTextArea(area);

/* recent notes through localStorage */
(function initRecentNotes(){
  const recentNotes = JSON.parse(
    localStorage.getItem('notes') || '[]'
  ).filter(record => pageLoadNoteId !== record);

  const displayedRecentNotes = recentNotes.filter(record => pageLoadNoteId !== record);
  if (displayedRecentNotes.length > 0) {
    // do a quick status update on all
    const fetchParams = {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids: displayedRecentNotes }),
    };
    fetch('/statusCheck', fetchParams)
      .catch(() => {})
      .then(response => response.json())
      .then(renderAndPersist);
  } else {
    renderAndPersist([]);
  }

  function renderAndPersist(statuses) {
    statuses = statuses.sort(
      (a, b) => (recentNotes.indexOf(a.id) - recentNotes.indexOf(b.id))
    );

    const listHtml = statuses.map(
      ({ id, abbreviation }) => `<li><a href="/note/${id}/">${abbreviation || '[no title]'}</a></li>`
    ).reduce((a, b) => a + b, '');
    document.getElementById('note-list').innerHTML = listHtml;

    // and persist the notes that remain.
    const remainingIds = statuses.map(status => status.id);
    if(pageLoadNoteId){
      remainingIds.unshift(pageLoadNoteId);
    }
    localStorage.setItem('notes', JSON.stringify(remainingIds));
  }
})();

/* Stupid state management soln: */
let state;
function setState(newState){
  state = Object.assign({}, state, newState);
  render(state);
}

// state => [proper view for state]
function render(stateToRender){
  // sidebar stuff
  const listElem = document.getElementById('note-list-wrapper');
  const togglerElem = document.getElementById('note-list-wrapper');
  if(stateToRender.sidebarShown){
    listElem.classList.remove('hidden');
    togglerElem.classList.add('active');
  } else {
    listElem.classList.add('hidden');
    togglerElem.classList.remove('active');
  }

  // view counter stuff
  const viewerElem = document.getElementById('viewer-count-indicator');
  if (stateToRender.viewerCount > 1) {
    viewerElem.classList.remove('hidden');
  } else {
    viewerElem.classList.add('hidden');
  }
  const viewNumberElem = document.getElementById('viewer-count-number');
  viewNumberElem.innerHTML = stateToRender.viewerCount + ' viewing';
}

// Initial state
setState({
  sidebarShown: false,
  viewerCount: 0,
});

document.getElementById('list-toggler').addEventListener('click', function toggleSidebar(){
  setState({sidebarShown: !state.sidebarShown});
}, false);

// Nonstatic page junk
function hookIntoNoteChanges(noteId){
  /* saving logic */
  let save;
  let throttledSave;
  let debouncedSave;

  function attachSocketToApp(socket){
    socket.on('connect', () => {
      socket.send({
        type: 'register',
        id: noteId,
      });
    });

    socket.on('message', (message) => {
      const { type, content } = message;
      switch(type){
        case 'replace':
          // TODO: move area.value to state tree.
          area.value = content;
          break;
        case 'viewerCount':
          setState({
            viewerCount: content
          });
          break;
        default:
          console.warn(`Unknown message type ${type}`);
      }
    });

    save = function(){
      socket.send({
        type: 'update',
        id: noteId,
        content: area.value,
      });
    }

    throttledSave = throttle(save, 200);
    debouncedSave = debounce(save, 500);
  }

  // configure socket
  const HOST = location.origin.replace(/^http/, 'ws');
  const ws = io(HOST);
  attachSocketToApp(ws);

  // Event listeners
  area.addEventListener('input', function(){
    throttledSave();
    debouncedSave();
  }, false);
}

if (interactionStyle === 'editable') {
  hookIntoNoteChanges(pageLoadNoteId);
} else if(interactionStyle === 'createOnEdit'){
  function enableEdit(){
    fetch('new').then((response) => {
      const newNoteId = noteUrlToNoteID(response.url);
      // on creation, append this note to start of local notes
      // TODO: this is not DRY at all
      const lsString = localStorage.getItem('notes') || '[]'
      const noteIds = JSON.parse(lsString);
      noteIds.unshift(newNoteId);
      localStorage.setItem('notes', JSON.stringify(noteIds));

      history.replaceState({ newNoteId }, 'quick-pad: note', '/note/' + newNoteId);
      hookIntoNoteChanges(newNoteId);
    });
    area.removeEventListener('input', enableEdit);
  }
  area.addEventListener('input', enableEdit);
}
