import React, { useState, useEffect } from 'react';
import { Trophy, Waves, Activity, Bike, Award, Clock } from 'lucide-react';

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/leaderboard');
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data);
        setError('');
      } else {
        setError('Failed to refresh leaderboard.');
      }
    } catch (err) {
      console.warn('Leaderboard offline or backend server down.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 3000);
    return () => clearInterval(interval);
  }, []);

  const getOrdinal = (num) => {
    if (!num) return '';
    const j = num % 10, k = num % 100;
    if (j === 1 && k !== 11) return num + 'st';
    if (j === 2 && k !== 12) return num + 'nd';
    if (j === 3 && k !== 13) return num + 'rd';
    return num + 'th';
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const renderStatus = (legName, legInfo) => {
    if (legInfo.status === 'Completed') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="status-green" style={{ width: '100%', height: '2.2rem', padding: '2px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: '800' }}>
              {getOrdinal(legInfo.placement)} <span style={{opacity: 0.8}}>·</span> {legInfo.points}
            </span>
          </div>
        </div>
      );
    }

    if (legInfo.status === 'In Progress') {
      const roundCount = (legName === 'Swim') ? '1/1' : `${legInfo.rounds}/${legInfo.totalRounds}`;
      return (
        <div className="status-amber" style={{ height: '2.2rem', padding: '2px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '700' }}>
            {roundCount}
          </span>
        </div>
      );
    }

    return <div className="status-dash" style={{ height: '2.2rem' }}>-</div>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <Trophy size={24} style={{ color: 'gold', filter: 'drop-shadow(0 0 4px gold)' }} />
          LIVE LEADERBOARD
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Real-time event ranking based on active race progress.
        </p>
      </div>

      {loading && leaderboard.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
          Loading leaderboard data...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {/* Header Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '25px 1fr 55px 55px 55px 55px 55px',
            gap: '6px',
            padding: '0.5rem 0.25rem',
            borderBottom: '2px solid var(--border-color)',
            fontSize: '0.75rem',
            fontWeight: 800,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            textAlign: 'center'
          }}>
            <div style={{ textAlign: 'left' }}>Rk</div>
            <div style={{ textAlign: 'left' }}>Team</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
              <Waves size={10} /> Swim
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
              <Activity size={10} /> Run
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
              <Bike size={10} /> Cycle
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
              <Award size={10} /> HYROX
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', color: 'var(--color-primary)' }}>
              ⭐ Total
            </div>
          </div>

          {/* Grid Rows */}
          {leaderboard.map((team, index) => {
            const isFirst = index === 0;
            return (
              <div
                key={team._id}
                className="card"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '25px 1fr 55px 55px 55px 55px 55px',
                  gap: '6px',
                  padding: '0.75rem 0.5rem',
                  alignItems: 'center',
                  marginBottom: '0.25rem',
                  borderColor: isFirst ? 'var(--color-primary)' : 'var(--border-color)',
                  background: isFirst ? 'linear-gradient(135deg, #1f2833 0%, rgba(255,107,0,0.06) 100%)' : 'var(--bg-card)',
                  boxShadow: isFirst ? '0 0 10px rgba(255, 107, 0, 0.1)' : 'var(--shadow-sm)'
                }}
              >
                {/* Rank */}
                <div style={{
                  fontSize: '1rem',
                  fontWeight: 800,
                  color: isFirst ? 'var(--color-primary)' : 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px'
                }}>
                  {isFirst ? '🏆' : index + 1}
                </div>

                {/* Team Name */}
                <div style={{
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'left'
                }}>
                  {team.name}
                </div>

                {/* Swim */}
                {renderStatus('Swim', team.legs.Swim)}

                {/* Run */}
                {renderStatus('Run', team.legs.Run)}

                {/* Cycle */}
                {renderStatus('Cycle', team.legs.Cycle)}

                {/* HYROX */}
                {renderStatus('HYROX', team.legs.HYROX)}

                {/* Total Points */}
                <div style={{
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  color: 'var(--color-primary)',
                  textAlign: 'center',
                  background: 'rgba(255, 107, 0, 0.1)',
                  borderRadius: '4px',
                  height: '2.2rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {team.totalScore}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
