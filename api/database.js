const mongoose = require('mongoose');

const Schema = mongoose.Schema;

// Team Schema
const TeamSchema = new Schema({
  name: { type: String, required: true, unique: true }
});

// Member Schema
const MemberSchema = new Schema({
  name: { type: String, required: true },
  team: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
  leg: { type: String, enum: ['Swim', 'Run', 'Cycle', 'HYROX', 'Gauntlet'], required: true },
  index: { type: Number, required: true, min: 1, max: 7 } // 1-7
});

const CheckpointSchema = new Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  location: { type: String, required: true },
  type: { type: String, enum: ['Start', 'Complete', 'Pass', 'Round', 'Station', 'Single'], required: true },
  requiredTaps: { type: Number, required: true, default: 1 },
  leg: { type: String, enum: ['Swim', 'Run', 'Cycle', 'HYROX', 'Gauntlet'], required: true },
  sortOrder: { type: Number, default: 0 }
});

// Log Schema (for atomic tracking)
const LogSchema = new Schema({
  team: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
  member: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
  checkpoint: { type: Schema.Types.ObjectId, ref: 'Checkpoint', required: true },
  tapNumber: { type: Number, required: true, default: 1 }, // E.g., Round 1, Round 2, or just 1 for complete
  timestamp: { type: Date, default: Date.now },
  isUndone: { type: Boolean, default: false }
});

const Team = mongoose.model('Team', TeamSchema);
const Member = mongoose.model('Member', MemberSchema);
const Checkpoint = mongoose.model('Checkpoint', CheckpointSchema);
const Log = mongoose.model('Log', LogSchema);

async function connectDB(mongoUri) {
  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully');
    await seedData();
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

async function seedData() {
  const teamCount = await Team.countDocuments();
  const cpCount = await Checkpoint.countDocuments();

  if (teamCount === 0 || cpCount === 0) {
    console.log('Database empty, starting seeding...');

    // Clear existing to avoid partial seeds
    await Team.deleteMany({});
    await Member.deleteMany({});
    await Checkpoint.deleteMany({});
    await Log.deleteMany({});

    // Seed Checkpoints (4 Sections)
    const checkpoints = [
      { code: 'SWIM', name: 'Swimming', location: 'Pool', type: 'Single', requiredTaps: 1, leg: 'Swim', sortOrder: 1 },
      { code: 'RUN', name: 'Running', location: 'Track', type: 'Round', requiredTaps: 4, leg: 'Run', sortOrder: 2 },
      { code: 'CYCLE', name: 'Cycling', location: 'Cycle Track', type: 'Round', requiredTaps: 6, leg: 'Cycle', sortOrder: 3 },
      { code: 'HYROX', name: 'HYROX Fitness', location: 'Fitness Area', type: 'Station', requiredTaps: 6, leg: 'HYROX', sortOrder: 4 }
    ];

    const seededCPs = await Checkpoint.insertMany(checkpoints);
    console.log('Checkpoints seeded:', seededCPs.length);

    // Seed Teams & Members
    const teamNames = [
      'Narks',
      'Union Place SA',
      'Apex Crew',
      'The Unstoppable',
      'Krish',
      'The Fit Five',
      "Rohan's Angels"
    ];

    for (const name of teamNames) {
      const team = new Team({ name });
      await team.save();

      // Seed 5 members per team mapped to legs
      // Member 1: Swim
      // Member 2 & 3: Run (Part 1 and 2)
      // Member 4 & 5: Cycle (Part 1 and 2)
      // Member 6: HYROX
      // Member 7: Gauntlet (Placeholder for entire team later)
      const members = [
        { name: `${name} Swim`, team: team._id, leg: 'Swim', index: 1 },
        { name: `${name} Run A`, team: team._id, leg: 'Run', index: 2 },
        { name: `${name} Run B`, team: team._id, leg: 'Run', index: 3 },
        { name: `${name} Cycle A`, team: team._id, leg: 'Cycle', index: 4 },
        { name: `${name} Cycle B`, team: team._id, leg: 'Cycle', index: 5 },
        { name: `${name} HYROX`, team: team._id, leg: 'HYROX', index: 6 },
        { name: `${name} Gauntlet`, team: team._id, leg: 'Gauntlet', index: 7 }
      ];
      await Member.insertMany(members);
    }
    console.log('Teams and Members seeded.');
  } else {
    console.log('Database already has data. Skipping seed.');
  }
}

module.exports = {
  Team,
  Member,
  Checkpoint,
  Log,
  connectDB
};
