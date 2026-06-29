require('dotenv').config();
const { connectDB, Team, Checkpoint, Log, Member } = require('./database');
const mongoose = require('mongoose');

async function testFlow() {
  await connectDB(process.env.MONGO_URI);
  await Log.deleteMany({});
  
  const team = await Team.findOne({ name: 'Narks' });
  const checkpoints = await Checkpoint.find({});
  const getCp = (code) => checkpoints.find(c => c.code === code);
  
  const m1 = await Member.findOne({ team: team._id, index: 1 });
  const m2 = await Member.findOne({ team: team._id, index: 2 });
  
  // CP1
  await Log.create({ team: team._id, member: m1._id, checkpoint: getCp('CP1')._id, tapNumber: 1 });
  // CP2
  await Log.create({ team: team._id, member: m1._id, checkpoint: getCp('CP2')._id, tapNumber: 1 });
  // CP3
  await Log.create({ team: team._id, member: m2._id, checkpoint: getCp('CP3')._id, tapNumber: 1 });
  
  const { getTeamsStatusInternal } = require('./routes/api');
  // Wait, getTeamsStatusInternal is not exported! I'll just write a mock or I'll copy the code here.
  process.exit(0);
}
testFlow();
