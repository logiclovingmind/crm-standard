require('dotenv').config();
const { getDb } = require('./db');

getDb();
console.log('migrations up to date');
