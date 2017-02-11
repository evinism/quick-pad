;(function(){

const {readOnly, noteId, autofocus} = Environment;

/* recent notes through localStorage */
const recentNotes = JSON.parse(
  localStorage.getItem('notes') || '[]'
).filter(record => noteId !== record);

if(noteId){
  recentNotes.unshift(noteId);
  localStorage.setItem('notes', JSON.stringify(recentNotes));
}

displayedRecentNotes = recentNotes.filter(record => noteId !== record);

/* Stupid state management soln: */
let state;
function setState(newState){
  state = Object.assign({}, state, newState);
  render(state);
}

// state => [proper view for state]
function render(stateToRender){
  if(stateToRender.sidebarShown){
    document.getElementById('note-list-wrapper').classList.remove('hidden');
    document.getElementById('list-toggler').classList.add('active');
  } else {
    document.getElementById('note-list-wrapper').classList.add('hidden');
    document.getElementById('list-toggler').classList.remove('active');
  }

  //can move this outside of render tbh
  const listHtml = stateToRender.displayedRecentNotes.map(
    id => `<li><a href="/note/${id}/">${id}</a></li>`
  ).reduce((a, b) => a + b);
  document.getElementById('note-list').innerHTML = listHtml;
}

// Initial state
setState({sidebarShown: false, displayedRecentNotes});

document.getElementById('list-toggler').addEventListener('click', function toggleSidebar(){
  setState({sidebarShown: !state.sidebarShown});
}, false);

// Nonstatic page junk
if(!readOnly){
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

  function save(){
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

  const throttledSave = throttle(save, 200);
  const debouncedSave = debounce(save, 500);

  const area = document.querySelector('textarea');
  const HOST = location.origin.replace(/^http/, 'ws');
  const ws = new WebSocket(HOST);

  ws.onopen = () => {
    ws.send(JSON.stringify({
      type: 'register',
      id: noteId,
    }));
  };

  ws.onmessage = (message) => {
    area.value = message.data;
  }

  // Event listeners
  area.addEventListener('input', function(){
    throttledSave();
    debouncedSave();
  }, false);
}

})();
