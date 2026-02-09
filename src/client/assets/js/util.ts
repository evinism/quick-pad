export function enableTabsOnTextArea(area: HTMLTextAreaElement) {
  area.addEventListener("keydown", function (e) {
    if (e.code == "Tab") {
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
