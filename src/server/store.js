const v4 = require('uuid/v4');
const pg = require('pg');
const pgescape = require('pg-escape');

/*
  TODO: find a better place for this
  pg table init command (this is totally the right way to do things like this):
  // ---
  CREATE TABLE notes (
    id varchar(8) PRIMARY KEY,
    lastuse timestamp NOT NULL,
    content text NOT NULL
  );
*/

// TODO: pool clients
// pg initialize
let client;

function initDb(){
  return new Promise((resolve, reject) => {
    if (process.env.DATABASE_USE_SSL === true) {
      pg.defaults.ssl = true;
    }
    client = new pg.Client(process.env.DATABASE_URL);
    client.connect(function(err, client) {
      if (err) throw err;
      console.log('client connected to postgres!');
      resolve({success: true});
    });
  })
}



/* Fake db store */
const store = {};
function persist(id, content) {
  return new Promise((resolve, reject) => {
    client.query(
      {
        text: "UPDATE notes SET content = $2, lastuse = now() WHERE id = $1",
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
        text: "INSERT INTO notes VALUES ($1, now(), '');", // TODO: move empty string default in postgres, not here
        values: [newId],
      },
      (err) => {
        if (err) throw err;
        resolve(newId);
      }
    );
  });
}

// destroys notes that are greater than 30 days old;
function destroyOldNotes() {
  return new Promise((resolve, reject) => {
    console.log('Deleting old notes...');
    client.query(
      {
        text: "DELETE FROM notes WHERE lastuse <= (now() - interval '30 days');"
      },
      (err) => {
        if (err) throw err;
        console.log('Deleted!');
        resolve({success: true});
      }
    );
  });
}

function checkStatus(ids){
  return new Promise((resolve, reject) => {
    client.query(
      {
        text: `SELECT id, content FROM notes WHERE id IN (${ids.map(id => pgescape.literal(id)).join(', ')});`,
      },
      (err, queryResult) => {
        if (err) throw err;
        const statuses = queryResult.rows.map(({id, content}) => {
          let abbreviation = content.split('\n')[0];
          // Lol this is shit:
          const cutoff = 50
          if (abbreviation.length > cutoff) {
            abbreviation = abbreviation.slice(0, cutoff);
          }
          return ({
            id,
            abbreviation,
          });
        });
        resolve(statuses);
      }
    );
  });
}

module.exports = {create, persist, recall, exists, checkStatus, destroy, initDb, destroyOldNotes};
