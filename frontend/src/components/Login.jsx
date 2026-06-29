import React, { useState } from 'react';
import { Lock, Play, AlertCircle } from 'lucide-react';
import { triggerFeedback } from '../utils/audio';
import { syncQueue } from '../utils/syncQueue';

export default function Login({ onLoginSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    triggerFeedback('tap');

    try {
      const response = await fetch('http://localhost:5001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('octave_token', data.token);
        syncQueue.setToken(data.token);
        triggerFeedback('success');
        onLoginSuccess();
      } else {
        setError(data.error || 'Login failed. Please try again.');
        triggerFeedback('undo');
      }
    } catch (err) {
      setError('Cannot connect to server. Check connection.');
      triggerFeedback('undo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: 'var(--color-primary)' }}>Organizer Login</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Enter the event access password to enable checkpoint tap logging and synchronization.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {error && (
          <div className="alert-banner">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="password">Access Password</label>
          <div style={{ position: 'relative' }}>
            <input
              id="password"
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
              required
            />
            <Lock size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Authenticating...' : 'Sign In'}
          <Play size={16} />
        </button>
      </form>
    </div>
  );
}
