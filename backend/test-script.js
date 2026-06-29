require('dotenv').config();
const { connectDB, Team, Checkpoint, Log, Member } = require('./database');
const mongoose = require('mongoose');

async function run() {
  await connectDB(process.env.MONGO_URI);
  const narks = await Team.findOne({ name: 'Narks' });
  console.log('Narks:', narks);

  // let's see members of Narks
  const members = await Member.find({ team: narks._id });
  console.log('Narks members:', members.map(m => m.name));

  // try deleting logs for Narks
  const result = await Log.deleteMany({ team: narks._id });
  console.log('Deleted Narks logs:', result);

  process.exit(0);
}

run();
