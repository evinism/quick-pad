const { destroyOldNotes } = require("./store.js");

function initCron() {
  setInterval(destroyOldNotes, 1000 * 60 * 60 * 24); // 1 day
}

module.exports = initCron;
