/*
  I have no clue what this format is but here we go!!!
*/

const Eta = require("eta");

module.exports = ({
  interactionStyle = "readOnly",
  content,
  noteId,
  title = "quick-pad",
}) =>
  Eta.renderFile("./main.eta", {
    content,
    title,
    env: JSON.stringify({ interactionStyle, noteId }),
    interactionStyle:
      interactionStyle !== "readOnly" ? "autofocus" : "readonly",
  });
