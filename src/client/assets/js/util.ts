export function throttle<A extends Function, B>(callback: A, limit: number) {
  var wait = false;
  return function (this: B) {
    var context = this;
    if (!wait) {
      callback.call(context);
      wait = true;
      setTimeout(function () {
        wait = false;
      }, limit);
    }
  };
}

export function debounce<A extends Function, B>(
  func: A,
  wait: number,
  immediate = false
) {
  var timeout: NodeJS.Timeout | null;
  return function (this: B) {
    var context = this,
      args = arguments;
    var later = function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    var callNow = immediate && !timeout;
    timeout && clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}

export function noteUrlToNoteID(url: string) {
  return url.split("/").slice(-2)[0];
}

export function enableTabsOnTextArea(area: HTMLTextAreaElement) {
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
