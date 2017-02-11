;(function(){

const {readOnly, noteId, autofocus} = Environment;


/* Utility functions */
// both throttle and debounce from stackOverflow
function throttle(callback, limit) {
  var wait = false;
  return function () {
    if (!wait) {
      callback.call();
      wait = true;
      setTimeout(function () {
          wait = false;
      }, limit);
    }
  }
}

function debounce(func, wait, immediate) {
  var timeout;
  return function() {
    var context = this, args = arguments;
    var later = function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
};

/* end utility functions */

/* recent notes through localStorage */
const recentNotes = JSON.parse(
  localStorage.getItem('notes') || '[]'
).filter(record => noteId !== record);

if(noteId){
  recentNotes.unshift(noteId);
  localStorage.setItem('notes', JSON.stringify(recentNotes));
}

displayedRecentNotes = recentNotes.filter(record => noteId !== record);

const listHtml = displayedRecentNotes.map(
  id => `<li><a href="/note/${id}/">${id}</a></li>`
).reduce((a, b) => a + b, '');

document.getElementById('note-list').innerHTML = listHtml;

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
if(!readOnly){
  const area = document.querySelector('textarea');

  /* saving logic */
  let save;
  let throttledSave;
  let debouncedSave;

  function attachSocketToApp(socket){
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'register',
        id: noteId,
      }));
    };

    ws.onmessage = (message) => {
      const { type, content } = JSON.parse(message.data);
      switch(type){
        case 'replace':
          // TODO: move area.value to state tree.
          area.value = content;
          break;
        case 'viewerCount':
          console.log('recieved viewerCount of ' + content);
          setState({viewerCount: content});
          break;
        default:
          console.log(`Unknown message type ${type}`)
      }
    }

    save = function(){
      // For now do these in parallel
      ws.send(JSON.stringify({
        type: 'update',
        id: noteId,
        content: area.value,
      }));

      // But don't obvs do them in parallel later
      fetch('./', {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        method: "POST",
        body: JSON.stringify({content: area.value})
      });
    }

    throttledSave = throttle(save, 200);
    debouncedSave = debounce(save, 500);
  }

  // configure socket
  const HOST = location.origin.replace(/^http/, 'ws');
  const ws = new WebSocket(HOST);
  attachSocketToApp(ws);

  // Event listeners
  area.addEventListener('input', function(){
    throttledSave();
    debouncedSave();
  }, false);
}

})();
