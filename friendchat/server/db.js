const Datastore = require('nedb-promises');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = {
  users: Datastore.create({ filename: path.join(DATA_DIR, 'users.db'), autoload: true }),
  messages: Datastore.create({ filename: path.join(DATA_DIR, 'messages.db'), autoload: true }),
  privateMessages: Datastore.create({ filename: path.join(DATA_DIR, 'private_messages.db'), autoload: true }),
  requests: Datastore.create({ filename: path.join(DATA_DIR, 'requests.db'), autoload: true }),
};

async function initIndexes() {
  await db.users.ensureIndex({ fieldName: 'username', unique: true });
  await db.messages.ensureIndex({ fieldName: 'createdAt' });
  await db.privateMessages.ensureIndex({ fieldName: 'createdAt' });
  await db.requests.ensureIndex({ fieldName: 'username', unique: true });
}

module.exports = { db, initIndexes };
