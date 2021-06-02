export function throttle(callback, limit) {
  var wait = false;
  return function () {
    if (!wait) {
      callback.call();
      wait = true;
      setTimeout(function () {
        wait = false;
      }, limit);
    }
  };
}

export function debounce(func, wait, immediate = false) {
  var timeout;
  return function () {
    var context = this,
      args = arguments;
    var later = function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}

export function noteUrlToNoteID(url) {
  return url.split("/").slice(-2)[0];
}

export function enableTabsOnTextArea(area) {
  area.addEventListener("keydown", function (e) {
    if (e.keyCode == 9 || e.which == 9) {
      e.preventDefault();
      var s = this.selectionStart;
      this.value =
        this.value.substring(0, this.selectionStart) +
        "\t" +
        this.value.substring(this.selectionEnd);
      this.selectionEnd = s + 1;
      var event = new Event("input", {
        bubbles: true,
        cancelable: true,
      });
      area.dispatchEvent(event);
    }
  });
}
