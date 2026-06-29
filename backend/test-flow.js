require('dotenv').config();
const { connectDB, Team, Checkpoint, Log, Member } = require('./database');
const mongoose = require('mongoose');

// Mock req and res for testing router logic manually
async function testFlow() {
  await connectDB(process.env.MONGO_URI);
  
  // Clean logs first
  await Log.deleteMany({});
  
  const team = await Team.findOne({ name: 'Narks' });
  const cp1 = await Checkpoint.findOne({ code: 'CP1' });
  const cp2 = await Checkpoint.findOne({ code: 'CP2' });
  const cp3 = await Checkpoint.findOne({ code: 'CP3' });
  const cp4 = await Checkpoint.findOne({ code: 'CP4' });
  
  const logApi = require('./routes/api');
  
  // We need to bypass authenticateOrganizer or mock it.
  // Instead, let's just use the internal getTeamsStatusInternal by requiring it.
  // Wait, it's not exported. Let's just create logs via Mongoose and see what /leaderboard or something returns.
  
  // 1. Tap CP1
  const m1 = await Member.findOne({ team: team._id, index: 1 });
  await Log.create({ team: team._id, member: m1._id, checkpoint: cp1._id, tapNumber: 1 });
  
  // 2. Tap CP2
  await Log.create({ team: team._id, member: m1._id, checkpoint: cp2._id, tapNumber: 1 });
  
  // 3. Tap CP3
  const m2 = await Member.findOne({ team: team._id, index: 2 });
  await Log.create({ team: team._id, member: m2._id, checkpoint: cp3._id, tapNumber: 1 });
  
  // Now fetch status for CP4
  const res = {
    json: (data) => console.log('Response:', JSON.stringify(data, null, 2)),
    status: (code) => ({ json: (data) => console.log('Error', code, data) })
  };
  
  const req = {
    params: { checkpointCode: 'CP4' },
    headers: { authorization: 'Bearer dummy' }, // won't use it directly if we call internal
  };
  
  // we can't easily call the route because it requires a valid JWT
  process.exit(0);
}
testFlow();
