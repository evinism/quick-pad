/*
  I have no clue what this format is but here we go!!!
*/

const fs = require('fs');

const cssString = fs.readFileSync('./src/client/assets/application.css');
const listSvg = fs.readFileSync('./src/client/assets/svg/list.svg');
const plusSvg = fs.readFileSync('./src/client/assets/svg/plus.svg');

module.exports = ({
  content,
  readOnly,
  noteId,
  autofocus = true,
  title = 'quick-pad'
}) => `
<!DOCTYPE html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <link rel="icon" href="/favicon.ico" type="image/x-icon">

    <!-- Twitter Card data -->
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="quick-pad">
    <meta name="twitter:description" content="Dead simple collaborative notepad">
    <meta name="twitter:site" content="@evinism">
    <meta name="twitter:image" content="https://quick-pad.org/note_example.png">

    <!-- Open Graph data -->
    <meta property="og:title" content="quick-pad" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://quick-pad.org/" />
    <meta property="og:image" content="https://quick-pad.org/note_example.png" />
    <meta property="og:description" content="Dead simple collaborative notepad" />
    <title>${title}</title>
    <style>
      ${cssString}
    </style>
  </head>
  <body>
    <div id="note-list-wrapper" class="hidden">
      <div>
        <h2>recent notes <br>--- </h2>
        <ul id="note-list">
        </ul>
      </div>
    </div>
    <textarea ${autofocus ? 'autofocus' : ''} id="notepad" name="notepad">${content}</textarea>
    <div class="command-strip">
      <div class="command-button hidden" id="viewer-count-indicator">
        <div id="viewer-count-number"></div>
      </div>
      <a class="command-button hoverable" id="new-note" href="/new/" target="_blank">
        ${plusSvg}
      </a>
      <div class="command-button hoverable" id="list-toggler">
        ${listSvg}
      </div>
    </div>
    <script>
      const Environment = ${JSON.stringify({readOnly, noteId, autofocus})};
    </script>
    <script src="/application.js"></script>
  </body>
</html>
`;
