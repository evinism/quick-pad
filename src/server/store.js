const v4 = require('uuid/v4');
var pg = require('pg');

if (process.env.DATABASE_USE_SSL === true) {
  pg.defaults.ssl = true;
}

pg.connect(process.env.DATABASE_URL, function(err, client) {
  if (err) throw err;
  console.log('Connected to postgres!');
});


/* Fake db store */
const store = {};

function persist(id, content) {
  store[id] = content;
  return new Promise((resolve, reject) => resolve(
    {success: true}
  ));
}

function recall(id) {
  return new Promise((resolve, reject) => resolve(
    store[id]
  ));
}

function exists(id) {
  // this should probably throw on nonexistence (maybe call ensureExists)
  return new Promise((resolve, reject) => resolve(
    store[id] !== undefined
  ));
}

function destroy(id) {
  delete store[id];
  return Promise((resolve, reject) => resolve(
    {success: true}
  ));
}

// a recombination of the above:
function create() {
  // TODO: make this retry infinitely until a new id is found.
  return new Promise((resolve, reject) => {
    let newId;
    newId = v4().split('-')[0];
    persist(newId, '').then(() => resolve(newId));
  });
}

module.exports = {create, persist, recall, exists, destroy};
