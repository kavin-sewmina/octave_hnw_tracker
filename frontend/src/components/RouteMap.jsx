import React, { useState, useEffect } from 'react';
import { RefreshCw, MapPin } from 'lucide-react';

export default function RouteMap() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Define physical checkpoint positions relative to the image (0-100% for CSS top/left)
  // We approximate these based on the map visual given in the brief.
  // The map has CP1 (top right), CP2 (top middle), CP3 (left side), CP4 (bottom left center)
  // CP5 (near CP4), CP6 (bottom left loop), CP7 (bottom middle fitness area)
  const checkpointPositions = {
    CP1: { top: '15%', left: '75%' }, // Swim Pool
    CP2: { top: '10%', left: '40%' }, // Transition 1 exit
    CP3: { top: '35%', left: '25%' }, // Running path
    CP4: { top: '60%', left: '40%' }, // Run track base
    CP5: { top: '65%', left: '35%' }, // Cycle start
    CP6: { top: '45%', left: '25%' }, // Cycle loop
    CP7: { top: '80%', left: '25%' }, // Indoor fitness
    Start: { top: '90%', left: '10%' } // Starting default point if no taps
  };

  const fetchTeams = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/leaderboard');
      if (response.ok) {
        const data = await response.json();
        setTeams(data);
        setError('');
      } else {
        setError('Failed to fetch tracking data');
      }
    } catch (err) {
      setError('Network connection error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
    const interval = setInterval(fetchTeams, 3000);
    return () => clearInterval(interval);
  }, []);

  // Determine current position based on team progress
  const getTeamMarkerData = (team) => {
    const { Swim, Run, Cycle, HYROX } = team.legs;
    let currentCp = 'Start';
    let badgeText = '';

    if (HYROX.status === 'Completed') {
      currentCp = 'CP7';
      badgeText = '✅';
    } else if (HYROX.status === 'In Progress') {
      currentCp = 'CP7';
      badgeText = `${HYROX.rounds}/6`;
    } else if (Cycle.status === 'Completed') {
      currentCp = 'CP6';
      badgeText = '✅';
    } else if (Cycle.status === 'In Progress') {
      currentCp = 'CP6';
      badgeText = `${Cycle.rounds}/6`;
    } else if (Run.status === 'Completed') {
      currentCp = 'CP4';
      badgeText = '✅';
    } else if (Run.status === 'In Progress') {
      // If they are past CP3, they are on CP4 track.
      if (Run.rounds > 0) {
        currentCp = 'CP4';
        badgeText = `${Run.rounds}/4`;
      } else {
        currentCp = 'CP3';
      }
    } else if (Swim.status === 'Completed') {
      currentCp = 'CP2';
    } else if (Swim.status === 'In Progress') {
      currentCp = 'CP1';
    }

    return { cpCode: currentCp, badgeText };
  };

  // Define team colors for markers
  const teamColors = {
    'Narks': '#FF3B30',
    'Union Place SA': '#FF9500',
    'Apex Crew': '#FFCC00',
    'The Unstoppable': '#4CD964',
    'Krish': '#5AC8FA',
    'The Fit Five': '#007AFF',
    "Rohan's Angels": '#5856D6'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.4rem', color: 'var(--color-primary)' }}>Live Route Map</h2>
        <button onClick={fetchTeams} className="btn" style={{ padding: '0.4rem', width: 'auto' }}>
          <RefreshCw size={16} className={loading ? "spin" : ""} />
        </button>
      </div>

      {error && <div className="alert-banner">{error}</div>}

      <div className="card" style={{ padding: '1rem', flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* We use a placeholder div for the map if the actual image isn't loaded yet */}
        <div style={{ 
          width: '100%', 
          height: '400px', 
          backgroundColor: '#1C1C1E', 
          borderRadius: '12px',
          position: 'relative',
          backgroundImage: 'url(/map-background.jpg)', // Image to be placed in public folder
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}>
          {/* Map Overlay Text */}
          <div style={{ position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>
            Map Visualizer
          </div>

          {/* Render markers for each team */}
          {teams.map((team, idx) => {
            const { cpCode, badgeText } = getTeamMarkerData(team);
            const position = checkpointPositions[cpCode] || { top: '50%', left: '50%' };
            
            // Add slight offset for multiple teams at the same CP
            const offsetX = (idx % 3) * 15 - 15;
            const offsetY = Math.floor(idx / 3) * 15 - 10;

            return (
              <div 
                key={team._id} 
                style={{
                  position: 'absolute',
                  top: `calc(${position.top} + ${offsetY}px)`,
                  left: `calc(${position.left} + ${offsetX}px)`,
                  transition: 'all 0.5s ease-in-out',
                  zIndex: 10 + idx,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  transform: 'translate(-50%, -100%)'
                }}
              >
                {/* Badge text (rounds or completion) */}
                {badgeText && (
                  <div style={{ 
                    backgroundColor: 'var(--bg-card)', 
                    color: '#fff', 
                    fontSize: '0.65rem', 
                    padding: '2px 4px', 
                    borderRadius: '10px', 
                    marginBottom: '-4px', 
                    zIndex: 2,
                    border: `1px solid ${teamColors[team.name] || '#FFF'}`
                  }}>
                    {badgeText}
                  </div>
                )}
                <MapPin size={28} fill={teamColors[team.name] || '#FFF'} color="#000" />
                <div style={{ 
                  backgroundColor: 'rgba(0,0,0,0.7)', 
                  color: '#fff', 
                  fontSize: '0.6rem', 
                  padding: '2px 6px', 
                  borderRadius: '4px',
                  whiteSpace: 'nowrap',
                  marginTop: '2px'
                }}>
                  {team.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
