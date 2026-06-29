import React, { useState, useEffect } from 'react';
import { Waves, Activity, Bike, Users, Award, Clock } from 'lucide-react';

export default function SpectatorView() {
  const [teamsData, setTeamsData] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/leaderboard');
      if (response.ok) {
        const data = await response.json();
        setTeamsData(data);
        setError('');
      } else {
        setError('Failed to fetch progress update.');
      }
    } catch (err) {
      console.warn('Network offline or backend unreachable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll every 3 seconds
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // Set default selection when teams load
  useEffect(() => {
    if (teamsData.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teamsData[0]._id);
    }
  }, [teamsData, selectedTeamId]);

  const selectedTeam = teamsData.find(t => t._id === selectedTeamId);

  const getOrdinal = (num) => {
    if (!num) return '';
    const j = num % 10, k = num % 100;
    if (j === 1 && k !== 11) return num + 'st';
    if (j === 2 && k !== 12) return num + 'nd';
    if (j === 3 && k !== 13) return num + 'rd';
    return num + 'th';
  };

  const renderStatusCell = (legName, legInfo) => {
    if (legInfo.status === 'Completed') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
          <div className="status-green" style={{ height: '3.5rem' }}>
            <span style={{ fontSize: '1rem', fontWeight: '800' }}>
              {getOrdinal(legInfo.placement)} Place
            </span>
          </div>
          {legInfo.completedAt && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--color-success)' }}>
              <Clock size={12} />
              <span>{new Date(legInfo.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
          )}
        </div>
      );
    }

    if (legInfo.status === 'In Progress') {
      let displayStatus = '';
      if (legName === 'Swim') {
        displayStatus = 'Round 1/1';
      } else if (legName === 'Run') {
        if (!legInfo.cp1Completed) displayStatus = 'Checkpoint 1';
        else if (!legInfo.cp2Completed) displayStatus = 'Checkpoint 2';
        else displayStatus = `Lap ${legInfo.rounds} / 4`;
      } else {
        displayStatus = `Round ${legInfo.rounds}/${legInfo.totalRounds}`;
      }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
          <div className="status-amber" style={{ height: '3.5rem' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.8 }}>In Progress</span>
            <span style={{ fontSize: '1.05rem', fontWeight: '700' }}>{displayStatus}</span>
          </div>
        </div>
      );
    }

    return <div className="status-dash" style={{ height: '3.5rem' }}>-</div>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', color: 'var(--color-primary)' }}>Team Progress Tracker</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Select a team below to track their real-time execution progress.
        </p>
      </div>

      {loading && teamsData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
          Loading team data...
        </div>
      ) : (
        <>
          {/* Select Dropdown */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Users size={14} /> SELECT TEAM
            </label>
            <select
              className="input-field"
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              style={{ padding: '0.75rem', fontSize: '1.05rem', fontWeight: 600 }}
            >
              {teamsData.map(team => (
                <option key={team._id} value={team._id} style={{ background: 'var(--bg-card)', color: 'white' }}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          {selectedTeam ? (
            <div className="card" style={{ padding: '1.5rem 1rem' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.75rem', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {selectedTeam.name}
                </h3>
              </div>

              {/* Legs Columns */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                {/* Swim Leg */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                    <div style={{ background: 'rgba(255, 107, 0, 0.1)', color: 'var(--color-primary)', padding: '0.5rem', borderRadius: '50%' }}>
                      <Waves size={20} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Swim</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>(100m)</span>
                  </div>
                  {renderStatusCell('Swim', selectedTeam.legs.Swim)}
                </div>

                {/* Run Leg */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                    <div style={{ background: 'rgba(255, 107, 0, 0.1)', color: 'var(--color-primary)', padding: '0.5rem', borderRadius: '50%' }}>
                      <Activity size={20} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Run</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>(2 CPs + 4 Laps)</span>
                  </div>
                  {renderStatusCell('Run', selectedTeam.legs.Run)}
                </div>

                {/* Cycle Leg */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                    <div style={{ background: 'rgba(255, 107, 0, 0.1)', color: 'var(--color-primary)', padding: '0.5rem', borderRadius: '50%' }}>
                      <Bike size={20} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cycle</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>(3km / 6 Laps)</span>
                  </div>
                  {renderStatusCell('Cycle', selectedTeam.legs.Cycle)}
                </div>

                {/* HYROX Leg */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                    <div style={{ background: 'rgba(255, 107, 0, 0.1)', color: 'var(--color-primary)', padding: '0.5rem', borderRadius: '50%' }}>
                      <Award size={18} />
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>HYROX</span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>(6 Stations)</span>
                  </div>
                  {renderStatusCell('HYROX', selectedTeam.legs.HYROX)}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              No team selected.
            </div>
          )}
        </>
      )}
    </div>
  );
}
