/*
  I have no clue what this format is but here we go!!!
*/

const fs = require('fs');

const jsString = fs.readFileSync('./src/client/assets/application.js');
const cssString = fs.readFileSync('./src/client/assets/application.css')


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
    <title>${title}</title>
    <style>
      ${cssString}
    </style>
  </head>
  <body>
    <textarea ${autofocus ? 'autofocus' : ''} id="notepad" name="notepad">${content}</textarea>
    <a class="new-note" href='/new/' target="_blank">+</a>
    <script>
      const Environment = ${JSON.stringify({readOnly, noteId, autofocus})};
      ${jsString}
    </script>
  </body>
</html>
`;
