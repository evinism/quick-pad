const { v4 } = require("uuid");
const { Client } = require("pg");
const pgescape = require("pg-escape");

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

async function initDb() {
  let ssl = undefined;
  if (process.env.NODE_ENV === "production") {
    ssl = {
      rejectUnauthorized: false,
    };
  }
  client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl,
  });
  await client.connect();
}

async function persist(id, content) {
  await client.query({
    text: "UPDATE notes SET content = $2, lastuse = now() WHERE id = $1",
    values: [id, content],
  });
  return { success: true };
}

async function recall(id) {
  const result = await client.query({
    text: "SELECT content FROM notes WHERE id = $1",
    values: [id],
  });

  // tee off, but don't wait for query to complete
  touch(id);
  return result.rows[0].content;
}

async function exists(id) {
  const query = {
    text: "select exists(select 1 from notes where id=$1)",
    values: [id],
  };
  const result = await client.query(query);
  return result.rows[0].exists;
}

async function create() {
  // TODO: make this retry infinitely until a new id is found.
  let newId;
  newId = v4().split("-")[0];
  console.log(`Creating note ${newId}`);
  await client.query({
    text: "INSERT INTO notes VALUES ($1, now(), '');", // TODO: move empty string default in postgres, not here
    values: [newId],
  });
  return newId;
}

// destroys notes that are greater than 30 days old;
function destroyOldNotes() {
  console.log("Deleting old notes...");
  return client.query(
    "DELETE FROM notes WHERE lastuse <= (now() - interval '365 days');"
  );
}

async function touch(id) {
  await client.query({
    text: "UPDATE notes SET lastuse = now() WHERE id = $1",
    values: [id],
  });
  return { success: true };
}

async function checkStatus(ids) {
  const query = {
    text: `SELECT id, content FROM notes WHERE id IN (${ids
      .map((id) => pgescape.literal(id))
      .join(", ")});`,
  };
  const queryResult = await client.query(query);
  const statuses = queryResult.rows.map(({ id, content }) => {
    let abbreviation = content.split("\n")[0];
    // Lol this is shit:
    const cutoff = 50;
    if (abbreviation.length > cutoff) {
      abbreviation = abbreviation.slice(0, cutoff);
    }
    return {
      id,
      abbreviation,
    };
  });
  return statuses;
}

module.exports = {
  create,
  persist,
  recall,
  touch,
  exists,
  checkStatus,
  initDb,
  destroyOldNotes,
};
