import React, { useState, useEffect } from 'react';
import { Trophy, Users, ShieldAlert, Zap, Wifi, WifiOff } from 'lucide-react';
import Leaderboard from './components/Leaderboard';
import SpectatorView from './components/SpectatorView';
import OrganizerView from './components/OrganizerView';
import Login from './components/Login';
import { syncQueue } from './utils/syncQueue';
import { triggerFeedback } from './utils/audio';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('leaderboard'); // 'leaderboard', 'spectator', 'organizer'
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('octave_token'));
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingTaps, setPendingTaps] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  // Sync state with queue and listen to browser online/offline events
  useEffect(() => {
    const handleStatus = (status) => {
      setIsOnline(status.isOnline);
      setPendingTaps(status.pendingCount);
    };

    // Register with sync queue
    syncQueue.registerStatusChange(handleStatus);

    const handleOnline = () => {
      syncQueue.retrySync();
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    setCurrentView('organizer');
  };

  const handleLogout = () => {
    localStorage.removeItem('octave_token');
    syncQueue.setToken(null);
    setIsLoggedIn(false);
  };

  const handleTabChange = (viewName) => {
    triggerFeedback('tap');
    setCurrentView(viewName);
  };

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#0b0c10',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        fontFamily: 'system-ui, sans-serif'
      }}>
        {/* Animated Zap Logo */}
        <div style={{
          marginBottom: '1.5rem',
          animation: 'pulse 1.5s infinite ease-in-out',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255, 107, 0, 0.1)',
          padding: '1.5rem',
          borderRadius: '50%',
          border: '1px solid rgba(255, 107, 0, 0.2)'
        }}>
          <Zap size={48} color="var(--color-primary)" fill="var(--color-primary)" />
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: '1.8rem',
          fontWeight: 800,
          color: '#fff',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          margin: '0 0 0.5rem 0',
          textAlign: 'center'
        }}>
          OCTAVE H&W 2026
        </h1>

        {/* Subtext */}
        <p style={{
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
          margin: 0,
          opacity: 0.8
        }}>
          System Powered By <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>VeeN</span>
        </p>

        {/* CSS animation injection */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; filter: drop-shadow(0 0 2px var(--color-primary)); }
            50% { transform: scale(1.08); opacity: 0.8; filter: drop-shadow(0 0 12px var(--color-primary)); }
          }
        `}} />
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header Bar */}
      <header>
        <div className="logo-container">
          <Zap size={20} className="logo-icon" fill="var(--color-primary)" />
          <h1 className="logo-text">Octave H&W 2026</h1>
        </div>

        {/* Global Connection Badge */}
        <div className={`sync-badge ${isOnline ? 'online' : 'offline'}`}>
          {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
          <span>{isOnline ? 'Online' : 'Offline'}</span>
          {pendingTaps > 0 && <span style={{ fontWeight: 800 }}>({pendingTaps})</span>}
        </div>
      </header>

      {/* Main View Area */}
      <main className="main-content">
        {currentView === 'leaderboard' && <Leaderboard />}
        {currentView === 'spectator' && <SpectatorView />}
        {currentView === 'organizer' && (
          isLoggedIn ? (
            <OrganizerView onLogout={handleLogout} />
          ) : (
            <Login onLoginSuccess={handleLoginSuccess} />
          )
        )}
      </main>

      {/* Sticky Bottom Tab bar Navigation */}
      <nav className="nav-bar">
        <button
          onClick={() => handleTabChange('leaderboard')}
          className={`nav-button ${currentView === 'leaderboard' ? 'active' : ''}`}
        >
          <Trophy size={20} />
          <span>Leaderboard</span>
        </button>

        <button
          onClick={() => handleTabChange('spectator')}
          className={`nav-button ${currentView === 'spectator' ? 'active' : ''}`}
        >
          <Users size={20} />
          <span>Spectator</span>
        </button>

        <button
          onClick={() => handleTabChange('organizer')}
          className={`nav-button ${currentView === 'organizer' ? 'active' : ''}`}
        >
          <ShieldAlert size={20} />
          <span>Organizer</span>
        </button>
      </nav>

      <footer style={{
        textAlign: 'center',
        padding: '0.5rem 0 calc(70px + 0.5rem)',
        fontSize: '0.7rem',
        color: 'var(--text-secondary)',
        opacity: 0.6
      }}>
        System Powered By <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>VeeN</span>
      </footer>
    </div>
  );
}
