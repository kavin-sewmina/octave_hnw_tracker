const express = require('express');
const jwt = require('jsonwebtoken');
const { Team, Member, Checkpoint, Log } = require('../database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_octave_key_2026';

// Middleware to authenticate Organizer using JWT
function authenticateOrganizer(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token missing or invalid' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'Organizer') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Section definitions: code -> { requiredTaps, leg }
const SECTIONS = {
  SWIM: { requiredTaps: 1, leg: 'Swim' },
  RUN_CP1: { requiredTaps: 1, leg: 'Run' },
  RUN_CP2: { requiredTaps: 1, leg: 'Run' },
  RUN: { requiredTaps: 4, leg: 'Run' },
  CYCLE: { requiredTaps: 6, leg: 'Cycle' },
  HYROX: { requiredTaps: 6, leg: 'HYROX' }
};

// The sequential order of sections
const SECTION_ORDER = ['SWIM', 'RUN_CP1', 'RUN_CP2', 'RUN', 'CYCLE', 'HYROX'];

// Helper: Calculate placements for completed legs
async function getLegPlacements() {
  const logs = await Log.find({ isUndone: false }).populate('checkpoint');

  const completions = { Swim: [], Run: [], Cycle: [], HYROX: [] };

  for (const log of logs) {
    const code = log.checkpoint.code;
    const section = SECTIONS[code];
    if (section) {
      if (section.leg === 'Run') {
        // Only RUN (the 4 laps) counts as completion for the Run event
        if (code === 'RUN' && log.tapNumber === section.requiredTaps) {
          completions.Run.push({ teamId: log.team.toString(), timestamp: log.timestamp });
        }
      } else {
        if (log.tapNumber === section.requiredTaps) {
          completions[section.leg].push({ teamId: log.team.toString(), timestamp: log.timestamp });
        }
      }
    }
  }

  const sortByTime = (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  Object.values(completions).forEach(list => list.sort(sortByTime));

  const pointScale = [10, 8, 6, 5, 4, 3, 2];

  const mapPlacements = (list) => {
    const map = {};
    list.forEach((item, idx) => {
      const pts = pointScale[idx] || 0;
      map[item.teamId] = { placement: idx + 1, points: pts };
    });
    return map;
  };

  return {
    Swim: mapPlacements(completions.Swim),
    Run: mapPlacements(completions.Run),
    Cycle: mapPlacements(completions.Cycle),
    HYROX: mapPlacements(completions.HYROX)
  };
}

// Helper: Get status details of all teams
async function getTeamsStatusInternal() {
  const teams = await Team.find({});
  const members = await Member.find({});
  const checkpoints = await Checkpoint.find({});
  const logs = await Log.find({ isUndone: false }).sort({ timestamp: 1 });

  const placements = await getLegPlacements();

  const cpMap = {};
  checkpoints.forEach(cp => { cpMap[cp.code] = cp; });

  // Group logs by team
  const teamLogs = {};
  teams.forEach(team => { teamLogs[team._id] = []; });
  logs.forEach(log => {
    if (teamLogs[log.team]) {
      teamLogs[log.team].push(log);
    }
  });

  const teamStatusList = teams.map(team => {
    const tLogs = teamLogs[team._id] || [];

    // Count taps per section
    const sectionTaps = {};
    for (const code of SECTION_ORDER) {
      const cpId = cpMap[code]?._id?.toString();
      sectionTaps[code] = cpId ? tLogs.filter(l => l.checkpoint.toString() === cpId) : [];
    }

    // Build status for each leg
    const buildLegStatus = (code) => {
      const section = SECTIONS[code];
      const tapList = sectionTaps[code];
      const tapCount = tapList.length;

      let status = 'Not Started';
      let completedAt = null;

      if (tapCount >= section.requiredTaps) {
        status = 'Completed';
        const lastTap = tapList.find(l => l.tapNumber === section.requiredTaps);
        completedAt = lastTap ? lastTap.timestamp : null;
      } else if (tapCount > 0) {
        status = 'In Progress';
      }

      return {
        status,
        rounds: tapCount,
        totalRounds: section.requiredTaps,
        completedAt
      };
    };

    const swimLeg = buildLegStatus('SWIM');
    
    // Custom builder for Run leg
    const getRunLegStatus = () => {
      const cp1Taps = sectionTaps['RUN_CP1'] || [];
      const cp2Taps = sectionTaps['RUN_CP2'] || [];
      const runTaps = sectionTaps['RUN'] || [];

      const cp1Completed = cp1Taps.length >= SECTIONS['RUN_CP1'].requiredTaps;
      const cp2Completed = cp2Taps.length >= SECTIONS['RUN_CP2'].requiredTaps;
      const runCompleted = runTaps.length >= SECTIONS['RUN'].requiredTaps;

      let status = 'Not Started';
      let completedAt = null;
      let rounds = 0;
      let totalRounds = 4;

      if (runCompleted) {
        status = 'Completed';
        const lastTap = runTaps.find(l => l.tapNumber === SECTIONS['RUN'].requiredTaps);
        completedAt = lastTap ? lastTap.timestamp : null;
        rounds = 4;
      } else if (runTaps.length > 0) {
        status = 'In Progress';
        rounds = runTaps.length;
      } else if (cp2Completed || cp1Completed || cp1Taps.length > 0 || cp2Taps.length > 0) {
        status = 'In Progress';
        rounds = 0;
      }

      return {
        status,
        rounds,
        totalRounds,
        completedAt,
        cp1Completed,
        cp2Completed
      };
    };

    const runLeg = getRunLegStatus();
    const cycleLeg = buildLegStatus('CYCLE');
    const hyroxLeg = buildLegStatus('HYROX');

    // Progress Score (0 to 4.0) for sorting
    let progressScore = 0;
    let lastTapTime = null;

    if (hyroxLeg.status === 'Completed') {
      progressScore = 4.0;
      lastTapTime = hyroxLeg.completedAt;
    } else if (hyroxLeg.status === 'In Progress') {
      progressScore = 3.0 + (hyroxLeg.rounds / 6) * 0.99;
      const lastTap = sectionTaps['HYROX'].find(l => l.tapNumber === hyroxLeg.rounds);
      lastTapTime = lastTap ? lastTap.timestamp : cycleLeg.completedAt;
    } else if (cycleLeg.status === 'Completed') {
      progressScore = 3.0;
      lastTapTime = cycleLeg.completedAt;
    } else if (cycleLeg.status === 'In Progress') {
      progressScore = 2.0 + (cycleLeg.rounds / 6) * 0.99;
      const lastTap = sectionTaps['CYCLE'].find(l => l.tapNumber === cycleLeg.rounds);
      lastTapTime = lastTap ? lastTap.timestamp : null;
    } else if (runLeg.status === 'Completed') {
      progressScore = 2.0;
      lastTapTime = runLeg.completedAt;
    } else if (runLeg.status === 'In Progress') {
      let runProgress = 0;
      if (runLeg.cp2Completed) {
        runProgress = 0.5 + (runLeg.rounds / 4) * 0.49;
      } else if (runLeg.cp1Completed) {
        runProgress = 0.25;
      } else {
        runProgress = 0.05;
      }
      progressScore = 1.0 + runProgress;

      // Determine last tap time for Run in progress
      const cp1Taps = sectionTaps['RUN_CP1'] || [];
      const cp2Taps = sectionTaps['RUN_CP2'] || [];
      const runTaps = sectionTaps['RUN'] || [];
      if (runTaps.length > 0) {
        const lastTap = runTaps.find(l => l.tapNumber === runLeg.rounds);
        lastTapTime = lastTap ? lastTap.timestamp : null;
      } else if (cp2Taps.length > 0) {
        lastTapTime = cp2Taps[0].timestamp;
      } else if (cp1Taps.length > 0) {
        lastTapTime = cp1Taps[0].timestamp;
      } else {
        lastTapTime = null;
      }
    } else if (swimLeg.status === 'Completed') {
      progressScore = 1.0;
      lastTapTime = swimLeg.completedAt;
    } else if (swimLeg.status === 'In Progress') {
      progressScore = 0.5;
      const lastTap = sectionTaps['SWIM'][0];
      lastTapTime = lastTap ? lastTap.timestamp : null;
    }

    const teamIdStr = team._id.toString();
    const swimData = placements.Swim[teamIdStr] || { placement: null, points: 0 };
    const runData = placements.Run[teamIdStr] || { placement: null, points: 0 };
    const cycleData = placements.Cycle[teamIdStr] || { placement: null, points: 0 };
    const hyroxData = placements.HYROX[teamIdStr] || { placement: null, points: 0 };
    const totalScore = swimData.points + runData.points + cycleData.points + hyroxData.points;

    return {
      _id: team._id,
      name: team.name,
      lastTapTime,
      progressScore,
      totalScore,
      legs: {
        Swim: { ...swimLeg, placement: swimData.placement, points: swimData.points },
        Run: { ...runLeg, placement: runData.placement, points: runData.points },
        Cycle: { ...cycleLeg, placement: cycleData.placement, points: cycleData.points },
        HYROX: { ...hyroxLeg, placement: hyroxData.placement, points: hyroxData.points }
      }
    };
  });

  return { teamStatusList, cpMap, members };
}

// GET /api/checkpoints
router.get('/checkpoints', async (req, res) => {
  try {
    const checkpoints = await Checkpoint.find({}).sort({ sortOrder: 1 });
    return res.json(checkpoints);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/leaderboard (public)
router.get('/leaderboard', async (req, res) => {
  try {
    const { teamStatusList } = await getTeamsStatusInternal();

    teamStatusList.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.progressScore !== a.progressScore) return b.progressScore - a.progressScore;
      const timeA = a.lastTapTime ? new Date(a.lastTapTime).getTime() : Infinity;
      const timeB = b.lastTapTime ? new Date(b.lastTapTime).getTime() : Infinity;
      return timeA - timeB;
    });

    return res.json(teamStatusList);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/checkpoint-status/:sectionCode (Organizer)
router.get('/checkpoint-status/:checkpointCode', authenticateOrganizer, async (req, res) => {
  try {
    const sectionCode = req.params.checkpointCode;
    const { teamStatusList, cpMap, members } = await getTeamsStatusInternal();

    const checkpoint = cpMap[sectionCode];
    if (!checkpoint) {
      return res.status(404).json({ error: 'Section not found' });
    }

    const section = SECTIONS[sectionCode];
    if (!section) {
      return res.status(404).json({ error: 'Unknown section' });
    }

    // Find the index of this section in the order to check prerequisites
    const sectionIdx = SECTION_ORDER.indexOf(sectionCode);

    const participantStatus = teamStatusList.map(status => {
      const teamIdStr = status._id.toString();
      const teamMembers = members.filter(m => m.team.toString() === teamIdStr);

      // Get the tap counts specifically for this checkpoint code
      let cpTapsCount = 0;
      if (sectionCode === 'RUN_CP1') {
        cpTapsCount = status.legs.Run.cp1Completed ? 1 : 0;
      } else if (sectionCode === 'RUN_CP2') {
        cpTapsCount = status.legs.Run.cp2Completed ? 1 : 0;
      } else {
        cpTapsCount = status.legs[section.leg].rounds;
      }

      const totalRounds = section.requiredTaps;
      const isCompleted = cpTapsCount >= totalRounds;

      // Check if this section is tappable:
      // 1. The section is not yet completed
      // 2. The previous section (if any) is completed
      let isTappable = false;
      if (!isCompleted) {
        if (sectionIdx === 0) {
          isTappable = true;
        } else {
          const prevSectionCode = SECTION_ORDER[sectionIdx - 1];
          const prevSection = SECTIONS[prevSectionCode];
          let prevCompleted = false;
          if (prevSectionCode === 'RUN_CP1') {
            prevCompleted = status.legs.Run.cp1Completed;
          } else if (prevSectionCode === 'RUN_CP2') {
            prevCompleted = status.legs.Run.cp2Completed;
          } else {
            prevCompleted = status.legs[prevSection.leg].status === 'Completed';
          }
          isTappable = prevCompleted;
        }
      }

      // Determine the active member based on section and round
      let activeIndex = 1;
      if (sectionCode === 'SWIM') {
        activeIndex = 1;
      } else if (sectionCode === 'RUN_CP1') {
        activeIndex = 2;
      } else if (sectionCode === 'RUN_CP2') {
        activeIndex = 2;
      } else if (sectionCode === 'RUN') {
        activeIndex = 3;
      } else if (sectionCode === 'CYCLE') {
        activeIndex = cpTapsCount < 3 ? 4 : 5; // Cycle A for rounds 0-2, Cycle B for rounds 3-5
      } else if (sectionCode === 'HYROX') {
        activeIndex = 6;
      }

      // Check if this section can be reset/undone (all subsequent sections must be 'Not Started')
      let isResetable = true;
      for (let i = sectionIdx + 1; i < SECTION_ORDER.length; i++) {
        const subCode = SECTION_ORDER[i];
        const subSection = SECTIONS[subCode];
        let subStarted = false;
        if (subCode === 'RUN_CP1') {
          subStarted = status.legs.Run.cp1Completed;
        } else if (subCode === 'RUN_CP2') {
          subStarted = status.legs.Run.cp2Completed;
        } else if (subCode === 'RUN') {
          subStarted = status.legs.Run.rounds > 0;
        } else {
          subStarted = status.legs[subSection.leg].status !== 'Not Started';
        }
        
        if (subStarted) {
          isResetable = false;
          break;
        }
      }

      const activeMember = teamMembers.find(m => m.index === activeIndex);

      return {
        teamId: status._id,
        teamName: status.name,
        memberId: activeMember ? activeMember._id : null,
        memberName: activeMember ? activeMember.name : 'Unknown Member',
        isCompleted,
        isTappable,
        isResetable,
        roundCounter: cpTapsCount,
        totalRounds,
        type: checkpoint.type
      };
    });

    return res.json({
      checkpoint,
      participants: participantStatus
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/logs/tap (Organizer)
router.post('/logs/tap', authenticateOrganizer, async (req, res) => {
  try {
    const { teamId, checkpointCode: sectionCode, timestamp } = req.body;

    if (!teamId || !sectionCode) {
      return res.status(400).json({ error: 'Team ID and Section Code are required' });
    }

    const team = await Team.findById(teamId);
    const checkpoint = await Checkpoint.findOne({ code: sectionCode });
    if (!team || !checkpoint) {
      return res.status(404).json({ error: 'Team or Section not found' });
    }

    const section = SECTIONS[sectionCode];
    if (!section) {
      return res.status(404).json({ error: 'Unknown section' });
    }

    const { teamStatusList, members } = await getTeamsStatusInternal();
    const status = teamStatusList.find(s => s._id.toString() === teamId.toString());
    if (!status) {
      return res.status(404).json({ error: 'Team status not found' });
    }

    // Count current taps for this specific checkpoint
    const currentCpLogs = await Log.countDocuments({
      team: team._id,
      checkpoint: checkpoint._id,
      isUndone: false
    });
    
    if (currentCpLogs >= section.requiredTaps) {
      return res.status(400).json({ error: `${checkpoint.name} is already completed` });
    }

    // Check prerequisite: previous section in SECTION_ORDER must be completed
    const sectionIdx = SECTION_ORDER.indexOf(sectionCode);
    if (sectionIdx > 0) {
      const prevCode = SECTION_ORDER[sectionIdx - 1];
      const prevSection = SECTIONS[prevCode];
      
      // If the previous section belongs to a different leg, check if that leg is completed.
      if (prevSection.leg !== section.leg) {
        if (status.legs[prevSection.leg].status !== 'Completed') {
          return res.status(400).json({ error: `Must complete ${prevSection.leg} before starting this section.` });
        }
      } else {
        // If it's the same leg (like RUN_CP1 -> RUN_CP2 -> RUN), check if the team has completed the previous section.
        const prevCheckpoint = await Checkpoint.findOne({ code: prevCode });
        const prevLogsCount = prevCheckpoint ? await Log.countDocuments({
          team: team._id,
          checkpoint: prevCheckpoint._id,
          isUndone: false
        }) : 0;
        if (prevLogsCount < prevSection.requiredTaps) {
          return res.status(400).json({ error: `Must complete ${prevCheckpoint ? prevCheckpoint.name : prevCode} first.` });
        }
      }
    }

    // Determine tap number
    const tapNumber = currentCpLogs + 1;

    // Determine active member
    let activeIndex = 1;
    if (sectionCode === 'SWIM') {
      activeIndex = 1;
    } else if (sectionCode === 'RUN_CP1') {
      activeIndex = 2;
    } else if (sectionCode === 'RUN_CP2') {
      activeIndex = 2;
    } else if (sectionCode === 'RUN') {
      activeIndex = 3;
    } else if (sectionCode === 'CYCLE') {
      activeIndex = tapNumber <= 3 ? 4 : 5;
    } else if (sectionCode === 'HYROX') {
      activeIndex = 6;
    }

    const teamMembers = members.filter(m => m.team.toString() === teamId.toString());
    const activeMember = teamMembers.find(m => m.index === activeIndex);
    if (!activeMember) {
      return res.status(500).json({ error: 'Active member mapping failed' });
    }

    const newLog = new Log({
      team: team._id,
      member: activeMember._id,
      checkpoint: checkpoint._id,
      tapNumber,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    });

    await newLog.save();
    return res.json({ success: true, log: newLog });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/logs/undo (Organizer)
router.post('/logs/undo', authenticateOrganizer, async (req, res) => {
  try {
    const { teamId, checkpointCode: sectionCode } = req.body;

    if (!teamId || !sectionCode) {
      return res.status(400).json({ error: 'Team ID and Section Code are required' });
    }

    const team = await Team.findById(teamId);
    const checkpoint = await Checkpoint.findOne({ code: sectionCode });
    if (!team || !checkpoint) {
      return res.status(404).json({ error: 'Team or Section not found' });
    }

    const latestLog = await Log.findOne({
      team: team._id,
      checkpoint: checkpoint._id,
      isUndone: false
    }).sort({ timestamp: -1, tapNumber: -1 });

    if (!latestLog) {
      return res.status(400).json({ error: 'No taps found to undo for this section' });
    }

    await Log.findByIdAndDelete(latestLog._id);
    return res.json({ success: true, undoneLog: latestLog });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/logs/reset-section (Organizer)
router.post('/logs/reset-section', authenticateOrganizer, async (req, res) => {
  try {
    const { teamId, checkpointCode } = req.body;
    if (!teamId || !checkpointCode) {
      return res.status(400).json({ error: 'Team ID and Section Code are required' });
    }

    const team = await Team.findById(teamId);
    const checkpoint = await Checkpoint.findOne({ code: checkpointCode });
    if (!team || !checkpoint) {
      return res.status(404).json({ error: 'Team or Section not found' });
    }

    const { teamStatusList } = await getTeamsStatusInternal();
    const status = teamStatusList.find(s => s._id.toString() === teamId.toString());
    if (!status) {
      return res.status(404).json({ error: 'Team status not found' });
    }

    const sectionIdx = SECTION_ORDER.indexOf(checkpointCode);
    if (sectionIdx === -1) {
      return res.status(400).json({ error: 'Unknown section' });
    }

    // Validate that all subsequent sections are already reset (Not Started)
    for (let i = sectionIdx + 1; i < SECTION_ORDER.length; i++) {
      const subCode = SECTION_ORDER[i];
      const subLeg = SECTIONS[subCode].leg;
      if (status.legs[subLeg].status !== 'Not Started') {
        return res.status(400).json({
          error: `Cannot reset ${checkpoint.name} because ${status.legs[subLeg].status !== 'Completed' ? 'subsequent' : ''} section (${subLeg}) has progress and must be reset first.`
        });
      }
    }

    // Delete logs for this section
    const result = await Log.deleteMany({ team: team._id, checkpoint: checkpoint._id });
    return res.json({ success: true, deletedCount: result.deletedCount });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/logs/reset-team (Organizer)
router.post('/logs/reset-team', authenticateOrganizer, async (req, res) => {
  try {
    const { teamId } = req.body;
    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const result = await Log.deleteMany({ team: team._id });
    return res.json({ success: true, deletedCount: result.deletedCount });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/logs/reset-all (Organizer - requires password re-confirmation)
router.post('/logs/reset-all', authenticateOrganizer, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password is required to reset all data' });
    }

    const plainPassword = process.env.ORGANIZER_PASSWORD || 'octave2026';
    if (password !== plainPassword) {
      return res.status(403).json({ error: 'Incorrect password' });
    }

    const result = await Log.deleteMany({});
    return res.json({ success: true, deletedCount: result.deletedCount });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
