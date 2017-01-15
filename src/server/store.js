const v4 = require('uuid/v4');
var pg = require('pg');

/*
  TODO: find a better place for this
  pg table init command (this is totally the right way to do things like this):
  // ---
  CREATE TABLE notes (
    id varchar(8) PRIMARY KEY,
    content text NOT NULL
  );
*/

// Postgres config TODO: Make it so that server doesn't listen before
// TODO: pool clients
// pg initialize
if (process.env.DATABASE_USE_SSL === true) {
  pg.defaults.ssl = true;
}
var client = new pg.Client(process.env.DATABASE_URL);

client.connect(function(err, client) {
  if (err) throw err;
  console.log('client connected to postgres!');
});


/* Fake db store */
const store = {};
function persist(id, content) {
  return new Promise((resolve, reject) => {
    client.query(
      {
        text: "UPDATE notes SET content = $2 WHERE id = $1",
        values: [id, content],
      },
      (err, result) => {
        if (err) throw err;
        resolve({success: true});
      }
    );
  });
}

function recall(id) {
  return new Promise((resolve, reject) => {
    client.query(
      {
        text: "SELECT content FROM notes WHERE id = $1",
        values: [id],
      },
      (err, result) => {
        if (err) throw err;
        resolve(result.rows[0].content);
      }
    );
  });
}

function exists(id) {
  // this should probably throw on nonexistence (maybe call ensureExists)
  return new Promise((resolve, reject) => {
    client.query(
      {
        text: "select exists(select 1 from notes where id=$1)",
        values: [id],
      },
      (err, result) => {
        if (err) throw err;
        resolve(result.rows[0].exists);
      }
    );
  });
}

function destroy(id) {
  delete store[id];
  return Promise((resolve, reject) => resolve(
    {success: true}
  ));
}

function create() {
  // TODO: make this retry infinitely until a new id is found.
  return new Promise((resolve, reject) => {
    let newId;
    newId = v4().split('-')[0];
    console.log(`Creating note ${newId}`);
    client.query(
      {
        text: "INSERT INTO notes VALUES ($1, '');", // TODO: move empty string default in postgres, not here
        values: [newId],
      },
      (err) => {
        if (err) throw err;
        resolve(newId);
      }
    );
  });
}

module.exports = {create, persist, recall, exists, destroy};
