const {destroyOldNotes} = require('./store.js');

function initCron(){
  setInterval(destroyOldNotes, 300000);// 5 minutes
}

module.exports = initCron;
