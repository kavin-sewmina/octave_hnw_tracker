require('dotenv').config();
const { connectDB, Team, Checkpoint, Log, Member } = require('./database');
const mongoose = require('mongoose');

async function run() {
  await connectDB(process.env.MONGO_URI);
  
  // Clear the DB to force re-seed
  await Team.deleteMany({});
  await Member.deleteMany({});
  await Checkpoint.deleteMany({});
  await Log.deleteMany({});
  console.log('Database cleared for re-seed.');
  
  // Run seed Data which is inside connectDB, but wait connectDB already ran.
  // We can just exit and the next time server starts it will seed.
  process.exit(0);
}
run();
