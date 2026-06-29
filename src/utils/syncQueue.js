const QUEUE_KEY = 'octave_tap_queue';

class SyncQueue {
  constructor() {
    this.queue = this.loadQueue();
    this.syncing = false;
    this.onStatusChangeCallbacks = [];
    this.onSyncCompleteCallbacks = [];
    this.token = localStorage.getItem('octave_token') || null;
    this.baseUrl = '/api';
  }

  setToken(token) {
    this.token = token;
  }

  loadQueue() {
    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load queue from localStorage', e);
      return [];
    }
  }

  saveQueue() {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
      this.triggerStatusChange();
    } catch (e) {
      console.error('Failed to save queue to localStorage', e);
    }
  }

  // Register UI updates
  registerStatusChange(callback) {
    this.onStatusChangeCallbacks.push(callback);
    // Initial call
    callback(this.getStatus());
  }

  registerSyncComplete(callback) {
    this.onSyncCompleteCallbacks.push(callback);
  }

  triggerStatusChange() {
    const status = this.getStatus();
    this.onStatusChangeCallbacks.forEach(cb => cb(status));
  }

  triggerSyncComplete(teamId, checkpointCode, result) {
    this.onSyncCompleteCallbacks.forEach(cb => cb(teamId, checkpointCode, result));
  }

  getStatus() {
    return {
      pendingCount: this.queue.length,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      syncing: this.syncing
    };
  }

  // Add tap to queue (Optimistic UI executes immediately in UI)
  addTap(teamId, checkpointCode) {
    const tapItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      teamId,
      checkpointCode,
      timestamp: new Date().toISOString()
    };
    this.queue.push(tapItem);
    this.saveQueue();

    // Start sync process asynchronously
    this.processQueue();
    return tapItem.id;
  }

  // Local Undo: allows deleting a tap that has NOT been synced yet
  undoLocalTap(teamId, checkpointCode) {
    // Find the latest queued tap matching the team and checkpoint
    const index = [...this.queue].reverse().findIndex(
      item => item.teamId === teamId && item.checkpointCode === checkpointCode
    );

    if (index !== -1) {
      // Since we reversed, map index back to original array
      const actualIndex = this.queue.length - 1 - index;
      const removed = this.queue.splice(actualIndex, 1)[0];
      this.saveQueue();
      return { local: true, tap: removed };
    }

    return { local: false };
  }

  async processQueue() {
    if (this.syncing || this.queue.length === 0) return;
    this.syncing = true;
    this.triggerStatusChange();

    while (this.queue.length > 0) {
      const item = this.queue[0];

      // If we don't have token, wait
      if (!this.token) {
        console.warn('Sync delayed: Organizer is not logged in.');
        this.syncing = false;
        this.triggerStatusChange();
        return;
      }

      try {
        const response = await fetch(`${this.baseUrl}/logs/tap`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
          },
          body: JSON.stringify({
            teamId: item.teamId,
            checkpointCode: item.checkpointCode,
            timestamp: item.timestamp
          })
        });

        if (response.status === 200) {
          // Success: remove from queue and move to next
          this.queue.shift();
          this.saveQueue();
          const result = await response.json();
          this.triggerSyncComplete(item.teamId, item.checkpointCode, result);
        } else if (response.status === 401 || response.status === 403) {
          // Auth failed, token might be expired. Stop syncing until login.
          console.error('Sync unauthorized. Halting sync queue.');
          this.syncing = false;
          this.triggerStatusChange();
          return;
        } else {
          // Other error (validation or bad request)
          const errData = await response.json().catch(() => ({}));
          console.error('Tap reject by server:', errData.error || response.statusText);
          // For bad requests (like out of sequence taps), we remove from queue as it cannot be processed
          this.queue.shift();
          this.saveQueue();
          this.triggerSyncComplete(item.teamId, item.checkpointCode, { error: errData.error || 'Server error' });
        }
      } catch (err) {
        // Network error (offline)
        console.warn('Sync failed due to network error. Will retry when connection returns.', err);
        break;
      }
    }

    this.syncing = false;
    this.triggerStatusChange();
  }

  // Trigger sync manual attempt (called on network status restored)
  async retrySync() {
    await this.processQueue();
  }
}

export const syncQueue = new SyncQueue();
