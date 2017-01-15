const v4 = require('uuid/v4');
var pg = require('pg');

/* Fake db store */
const store = {};

// Todo: async these (promisify)
function create() {
  let newId;
  do {
    // Dumb id creation
    newId = v4().split('-')[0];
  } while(exists(newId));
  store[newId] = '';

  return newId;
}

function persist(id, content){
  store[id] = content;
}

function recall(id) {
  return store[id];
}

function exists(id) {
  return store[id] !== undefined;
}

function destroy(id) {
  delete store[id];
}

module.exports = {create, persist, recall, exists, destroy};
