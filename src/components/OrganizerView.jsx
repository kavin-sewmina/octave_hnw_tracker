import React, { useState, useEffect } from 'react';
import { LogOut, CheckCircle, RotateCcw, AlertTriangle, RefreshCw, Smartphone, AlertOctagon } from 'lucide-react';
import { syncQueue } from '../utils/syncQueue';
import { triggerFeedback } from '../utils/audio';

export default function OrganizerView({ onLogout }) {
  const [checkpoints, setCheckpoints] = useState([]);
  const [selectedCp, setSelectedCp] = useState('SWIM');
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncStatus, setSyncStatus] = useState({ pendingCount: 0, isOnline: true });
  const [showResetAllModal, setShowResetAllModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetting, setResetting] = useState(false);

  const token = localStorage.getItem('octave_token');

  // Load checkpoints list
  useEffect(() => {
    const loadCheckpoints = async () => {
      try {
        const response = await fetch('/api/checkpoints');
        if (response.ok) {
          const data = await response.json();
          setCheckpoints(data);
        }
      } catch (err) {
        console.error('Failed to load checkpoints list', err);
      }
    };
    loadCheckpoints();
  }, []);

  // Fetch participant status for selected checkpoint
  const fetchParticipants = async (cpCode = selectedCp) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/checkpoint-status/${cpCode}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setParticipants(data.participants);
        setError('');
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(errData.error || 'Failed to fetch participant status');
      }
    } catch (err) {
      console.warn('Network issue: loaded from cache or waiting connection.');
    } finally {
      setLoading(false);
    }
  };

  // Sync state with queue status
  useEffect(() => {
    // Sync queue token setup
    syncQueue.setToken(token);

    const handleQueueStatus = (status) => {
      setSyncStatus(status);
    };

    const handleSyncComplete = (teamId, checkpointCode, result) => {
      // Re-fetch database state to align frontend with server
      fetchParticipants(selectedCp);
      if (result && result.error) {
        alert(`Server validation failed for a tap: ${result.error}`);
        triggerFeedback('undo');
      }
    };

    syncQueue.registerStatusChange(handleQueueStatus);
    syncQueue.registerSyncComplete(handleSyncComplete);

    // Initial load
    fetchParticipants(selectedCp);

    // Poll current view state every 5 seconds to keep up-to-date with other devices
    const interval = setInterval(() => {
      fetchParticipants(selectedCp);
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedCp, token]);

  const handleCpChange = (e) => {
    const val = e.target.value;
    setSelectedCp(val);
    setLoading(true);
    fetchParticipants(val);
  };

  // Log tap with local queueing and optimistic UI updates
  const handleTap = (teamId, memberName) => {
    const cpInfo = checkpoints.find(c => c.code === selectedCp);
    if (!cpInfo) return;

    // Optimistic UI updates (instant local visual feedback)
    let isCompletedLeg = false;
    setParticipants(prev => prev.map(p => {
      if (p.teamId === teamId) {
        if (!p.isTappable) return p;

        let nextRounds = p.roundCounter + 1;
        let nextCompleted = nextRounds >= p.totalRounds;

        if (nextCompleted) {
          isCompletedLeg = true;
        }

        return {
          ...p,
          roundCounter: nextRounds,
          isCompleted: nextCompleted,
          isTappable: !nextCompleted
        };
      }
      return p;
    }));

    // Trigger haptic and audio click feedback
    if (isCompletedLeg) {
      triggerFeedback('success');
    } else {
      triggerFeedback('tap');
    }

    // Queue tap
    syncQueue.addTap(teamId, selectedCp);
  };

  // Undo feature
  const handleUndo = async (teamId) => {
    triggerFeedback('undo');

    // 1. Try to undo from local queue first (if it hasn't synced yet)
    const localUndo = syncQueue.undoLocalTap(teamId, selectedCp);
    if (localUndo.local) {
      // Refresh state from DB to sync UI
      fetchParticipants(selectedCp);
      return;
    }

    // 2. Not in local queue, send API undo request to backend
    try {
      const response = await fetch('/api/logs/undo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          teamId,
          checkpointCode: selectedCp
        })
      });

      if (response.ok) {
        fetchParticipants(selectedCp);
      } else {
        const errData = await response.json();
        alert(errData.error || 'Failed to undo tap');
      }
    } catch (err) {
      alert('Cannot perform undo. Device is offline and tap is already synced.');
    }
  };

  // Reset team progress for a specific section
  const handleResetSection = async (teamId, teamName) => {
    const confirmReset = window.confirm(
      `Are you sure you want to reset this section's progress for team "${teamName}"?`
    );
    if (!confirmReset) return;

    triggerFeedback('undo');

    try {
      // Clear any pending local taps for this team & section
      syncQueue.queue = syncQueue.queue.filter(item => !(item.teamId === teamId && item.checkpointCode === selectedCp));
      syncQueue.saveQueue();

      const response = await fetch('/api/logs/reset-section', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ teamId, checkpointCode: selectedCp })
      });

      if (response.ok) {
        fetchParticipants(selectedCp);
      } else {
        const errData = await response.json();
        alert(errData.error || 'Failed to reset section progress');
      }
    } catch (err) {
      alert('Cannot perform reset. Check network connection.');
    }
  };

  // Reset ALL teams (requires password)
  const handleResetAll = async () => {
    if (!resetPassword) {
      setResetError('Please enter the password');
      return;
    }
    setResetting(true);
    setResetError('');
    try {
      // Clear all local queued taps
      syncQueue.queue = [];
      syncQueue.saveQueue();

      const response = await fetch('/api/logs/reset-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: resetPassword })
      });

      if (response.ok) {
        triggerFeedback('success');
        setShowResetAllModal(false);
        setResetPassword('');
        fetchParticipants(selectedCp);
      } else {
        const errData = await response.json();
        setResetError(errData.error || 'Reset failed');
        triggerFeedback('undo');
      }
    } catch (err) {
      setResetError('Network error. Try again.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header section with logout and queue state */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--color-primary)' }}>Logging Dashboard</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Point Person Panel</span>
        </div>
        <button
          onClick={() => {
            triggerFeedback('undo');
            onLogout();
          }}
          className="btn btn-secondary"
          style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', gap: '0.25rem' }}
        >
          <LogOut size={14} /> Log Out
        </button>
      </div>

      {/* Reset All Button */}
      <button
        onClick={() => { setShowResetAllModal(true); setResetError(''); setResetPassword(''); }}
        className="btn"
        style={{
          width: '100%',
          padding: '0.65rem',
          fontSize: '0.85rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
          background: 'rgba(239, 68, 68, 0.08)',
          color: 'var(--color-danger)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '10px'
        }}
      >
        <AlertOctagon size={16} /> Reset All Teams
      </button>

      {/* Reset All Password Modal */}
      {showResetAllModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div className="card" style={{ padding: '1.5rem', maxWidth: '340px', width: '100%' }}>
            <h3 style={{ color: 'var(--color-danger)', marginBottom: '0.75rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertOctagon size={20} /> Reset All Progress
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              This will permanently delete <strong>all checkpoint logs</strong> for every team. Enter the organizer password to confirm.
            </p>
            <input
              type="password"
              className="input-field"
              placeholder="Enter password..."
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleResetAll()}
              style={{ marginBottom: '0.5rem' }}
              autoFocus
            />
            {resetError && (
              <div style={{ color: 'var(--color-danger)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                {resetError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => setShowResetAllModal(false)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                onClick={handleResetAll}
                className="btn"
                disabled={resetting}
                style={{
                  flex: 1,
                  background: 'var(--color-danger)',
                  color: 'white',
                  fontWeight: 700
                }}
              >
                {resetting ? 'Resetting...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Queue Banner Status */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div className={`sync-badge ${syncStatus.isOnline ? 'online' : 'offline'}`} style={{ flexGrow: 1, justifyContent: 'center' }}>
          <span className={`dot ${syncStatus.syncing ? 'pulse' : ''}`} />
          <span>{syncStatus.isOnline ? 'Network Connected' : 'Offline Mode'}</span>
        </div>
        {syncStatus.pendingCount > 0 && (
          <div className="sync-badge offline animate-pulse-slow" style={{ flexGrow: 1, justifyContent: 'center', background: 'rgba(255, 107, 0, 0.1)', color: 'var(--color-primary)' }}>
            <span>{syncStatus.pendingCount} tap(s) queued for sync</span>
          </div>
        )}
      </div>

      {/* Checkpoint selector drop down */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem' }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          SELECT LOGGING CHECKPOINT
        </label>
        <select
          className="input-field"
          value={selectedCp}
          onChange={handleCpChange}
          style={{ padding: '0.75rem', fontSize: '1.05rem', fontWeight: 600 }}
        >
          {checkpoints.map(cp => (
            <option key={cp._id} value={cp.code} style={{ background: 'var(--bg-card)', color: 'white' }}>
              {cp.name}
            </option>
          ))}
        </select>

        {(() => {
          const currentCpInfo = checkpoints.find(c => c.code === selectedCp);
          if (!currentCpInfo) return null;
          return (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(255, 107, 0, 0.1)', color: 'var(--color-primary)', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                📍 {currentCpInfo.location}
              </span>
              <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-success)', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                ⏱️ {currentCpInfo.requiredTaps === 1 ? '1 Tap' : `${currentCpInfo.requiredTaps} Laps / Rounds`}
              </span>
              <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                🏃 {currentCpInfo.leg} Leg
              </span>
            </div>
          );
        })()}
      </div>

      {/* Error displays */}
      {error && (
        <div className="alert-banner">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Participant List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Active Participant List
        </h3>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            Loading checkpoint active roster...
          </div>
        ) : (
          participants.map(p => {
            const hasTappedAtAll = p.roundCounter > 0;
            const cardBg = p.isCompleted
              ? 'rgba(16, 185, 129, 0.12)'
              : hasTappedAtAll
                ? 'rgba(245, 158, 11, 0.08)'
                : 'var(--bg-card)';

            const cardBorder = p.isCompleted
              ? 'var(--color-success)'
              : hasTappedAtAll
                ? 'var(--color-warning)'
                : 'var(--border-color)';

            return (
              <div
                key={p.teamId}
                className="card organizer-card"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  marginBottom: '0',
                  background: cardBg,
                  borderColor: cardBorder,
                  transition: 'background-color 0.2s ease, border-color 0.2s ease'
                }}
              >
                {/* Roster detail */}
                <div style={{ flex: 1, paddingRight: '0.5rem' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', margin: '2px 0' }}>
                    {p.memberName.replace(/\s[A-Z]$/, '')} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>({p.teamName})</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: p.isCompleted ? 'var(--color-success)' : 'var(--text-secondary)' }}>
                    {p.isCompleted ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {selectedCp === 'RUN_CP1' ? 'Checkpoint 1 Covered' :
                         selectedCp === 'RUN_CP2' ? 'Checkpoint 2 Covered' :
                         selectedCp === 'RUN' ? 'Lap 4 Completed' :
                         p.totalRounds === 1 ? 'Completed' : 
                         p.type === 'Station' ? `Station ${p.totalRounds} Completed` : 
                         `Lap ${p.totalRounds} Completed`}
                        <CheckCircle size={14} />
                      </span>
                    ) : p.roundCounter === 0 ? (
                      'Not Started'
                    ) : p.type === 'Station' ? (
                      `Station ${p.roundCounter} Completed`
                    ) : (
                      `Lap ${p.roundCounter} Completed`
                    )}
                  </div>
                </div>

                {/* Log interaction buttons */}
                <div className="organizer-btn-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {/* Undo Button */}
                  {hasTappedAtAll && (
                    <button
                      onClick={() => handleUndo(p.teamId)}
                      disabled={!p.isResetable}
                      className="btn btn-secondary"
                      style={{
                        width: 'auto',
                        padding: '0.6rem',
                        borderRadius: '8px',
                        background: 'rgba(239, 68, 68, 0.08)',
                        borderColor: 'rgba(239, 68, 68, 0.2)',
                        color: 'var(--color-danger)',
                        opacity: p.isResetable ? 1 : 0.3,
                        pointerEvents: p.isResetable ? 'auto' : 'none'
                      }}
                      title={p.isResetable ? "Undo tap" : "Cannot undo because subsequent legs have progress"}
                    >
                      <RotateCcw size={16} />
                    </button>
                  )}

                  {/* Reset Section Button */}
                  {hasTappedAtAll && (
                    <button
                      onClick={() => handleResetSection(p.teamId, p.teamName)}
                      disabled={!p.isResetable}
                      className="btn btn-secondary"
                      style={{
                        width: 'auto',
                        padding: '0.6rem 0.8rem',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--color-danger)',
                        background: 'rgba(239, 68, 68, 0.05)',
                        borderColor: 'rgba(239, 68, 68, 0.15)',
                        opacity: p.isResetable ? 1 : 0.3,
                        pointerEvents: p.isResetable ? 'auto' : 'none'
                      }}
                      title={p.isResetable ? "Reset Section Progress" : "Cannot reset because subsequent legs have progress"}
                    >
                      Reset
                    </button>
                  )}

                  {/* Tap Action Log Button */}
                  <button
                    onClick={() => handleTap(p.teamId, p.memberName)}
                    disabled={p.isCompleted || !p.isTappable}
                    className="btn btn-primary"
                    style={{
                      width: 'auto',
                      padding: '0.6rem 1rem',
                      borderRadius: '8px',
                      background: p.isCompleted ? 'rgba(16, 185, 129, 0.2)' : (!p.isTappable ? 'rgba(156, 163, 175, 0.2)' : 'var(--color-primary)'),
                      color: p.isCompleted ? 'var(--color-success)' : (!p.isTappable ? 'var(--text-secondary)' : 'white'),
                      borderColor: p.isCompleted ? 'var(--color-success)' : 'transparent',
                      borderWidth: p.isCompleted ? '1px' : '0px',
                      boxShadow: p.isCompleted || !p.isTappable ? 'none' : '0 4px 8px rgba(255, 107, 0, 0.2)',
                      pointerEvents: p.isCompleted || !p.isTappable ? 'none' : 'auto',
                      fontSize: '0.85rem'
                    }}
                  >
                    {p.isCompleted ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <CheckCircle size={14} /> Completed
                      </span>
                    ) : selectedCp === 'SWIM' ? (
                      'Swim Complete'
                    ) : selectedCp === 'RUN_CP1' ? (
                      'CP 1 Complete'
                    ) : selectedCp === 'RUN_CP2' ? (
                      'CP 2 Complete'
                    ) : selectedCp === 'RUN' ? (
                      p.roundCounter === 3 ? 'Run Complete' : `Lap ${p.roundCounter + 1}`
                    ) : selectedCp === 'CYCLE' ? (
                      p.roundCounter === 5 ? 'Cycling Complete' : `Lap ${p.roundCounter + 1}`
                    ) : selectedCp === 'HYROX' ? (
                      `Station ${p.roundCounter + 1} Complete`
                    ) : p.type === 'Station' ? (
                      `Station ${p.roundCounter + 1}`
                    ) : (
                      `Lap ${p.roundCounter + 1}`
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
