;(function(){

const {readOnly, noteId, autofocus} = Environment;

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
  var HOST = location.origin.replace(/^http/, 'ws');
  var ws = new WebSocket(HOST);

  ws.onopen = () => {
    ws.send(JSON.stringify({
      type: 'register',
      id: noteId,
    }));
  };

  ws.onmessage = (message) => {
    area.value = message.data;
  }
  area.addEventListener('input', function(){
    throttledSave();
    debouncedSave();
  }, false);
}

})();
