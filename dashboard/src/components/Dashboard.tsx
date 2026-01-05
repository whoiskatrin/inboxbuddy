import { useState, useEffect } from 'react';
import type { User, Conversation, Settings, DashboardState } from '../types';
import { ConversationModal } from './ConversationModal';

interface DashboardProps {
  user: User;
  state: DashboardState | null;
  settings: Settings | null;
  onDeleteConversation: (id: string) => Promise<boolean>;
  onGetConversation: (id: string) => Promise<Conversation | null>;
  onSaveSettings: (settings: Settings) => Promise<boolean>;
  showToast: (message: string) => void;
}

const defaultSettings: Settings = {
  timezone: 'America/Los_Angeles',
  working_hours_start: 9,
  working_hours_end: 17,
  buffer_minutes: 15,
  default_meeting_duration: 30,
  meeting_title_prefix: '',
  include_weekends: false,
};

export function Dashboard({
  user,
  state,
  settings: propSettings,
  onDeleteConversation,
  onGetConversation,
  onSaveSettings,
  showToast
}: DashboardProps) {
  const [filter, setFilter] = useState<string>('all');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Only update local settings from props once when first loaded
  useEffect(() => {
    if (propSettings && !settingsLoaded) {
      setSettings(propSettings);
      setSettingsLoaded(true);
    }
  }, [propSettings, settingsLoaded]);

  const conversations = state?.conversations || [];
  const stats = state?.stats || { active: 0, scheduled: 0, pending: 0 };
  const loading = !state;

  async function handleViewConversation(id: string) {
    const conv = await onGetConversation(id);
    if (conv) {
      setSelectedConversation(conv);
    } else {
      // Fallback to local data
      const localConv = conversations.find(c => c.id === id);
      if (localConv) setSelectedConversation(localConv);
    }
  }

  async function handleDeleteConversation() {
    if (!selectedConversation) return;
    
    const success = await onDeleteConversation(selectedConversation.id);
    if (success) {
      setSelectedConversation(null);
    }
  }

  async function handleSaveSettings() {
    await onSaveSettings(settings);
  }

  function copyEmail() {
    navigator.clipboard.writeText('meetme@inboxbuddy.dev');
    showToast('Email copied!');
  }

  function getOtherParticipants(conv: Conversation): string[] {
    const ownerEmail = user.email.toLowerCase();
    return (conv.participants || []).filter(p => {
      const email = p.toLowerCase();
      return email !== ownerEmail && !email.startsWith('meetme@');
    });
  }

  function formatParticipants(conv: Conversation): string {
    const others = getOtherParticipants(conv);
    if (others.length === 0) return 'Unknown';
    if (others.length === 1) return others[0];
    if (others.length === 2) return `${others[0]} & ${others[1]}`;
    return `${others[0]} +${others.length - 1} others`;
  }

  function timeAgo(ts: number): string {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  }

  function formatStatus(status: string): string {
    const map: Record<string, string> = {
      new: 'New',
      parsing: 'Processing',
      proposed: 'Proposed',
      awaiting_confirmation: 'Pending',
      scheduled: 'Scheduled',
      declined: 'Declined',
      cancelled: 'Cancelled',
      error: 'Error',
    };
    return map[status] || status;
  }

  // Filter conversations
  const filteredConversations = filter === 'all' 
    ? conversations 
    : conversations.filter(c => c.status === filter);

  return (
    <main className="main">
      <div className="topbar">
        <div className="page-title">Overview</div>
        <a href="/auth/logout" className="logout-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <title>Logout</title>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>Logout</span>
        </a>
      </div>

      <div className="content">
        <div className="content-grid three-col">
          {/* Column 1: Intro & Stats */}
          <div className="content-col">
            <h1>AI scheduling assistant</h1>
            <p className="sub">CC your InboxBuddy address in any email. AI checks your calendar and proposes times.</p>

            <div className="quick-box">
              <div className="quick-box-label">Your InboxBuddy Address</div>
              <div className="quick-box-email">
                <code>meetme@inboxbuddy.dev</code>
                <button type="button" className="copy-btn" onClick={copyEmail}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <title>Copy</title>
                    <rect x="9" y="9" width="13" height="13" rx="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  <span>Copy</span>
                </button>
              </div>
            </div>

            <div className="how-to-use">
              <div className="how-to-use-header">
                <div className="how-to-use-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <title>Help</title>
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </div>
                <div className="how-to-use-title">How to use InboxBuddy</div>
              </div>
              <div className="how-to-use-steps">
                <div className="how-to-use-step">
                  <div className="step-number">1</div>
                  <div className="step-text">When emailing someone about scheduling a meeting, add <code>meetme@inboxbuddy.dev</code> to the CC field</div>
                </div>
                <div className="how-to-use-step">
                  <div className="step-number">2</div>
                  <div className="step-text">InboxBuddy will check your calendar and reply with available time slots</div>
                </div>
                <div className="how-to-use-step">
                  <div className="step-number">3</div>
                  <div className="step-text">When someone confirms a time, InboxBuddy automatically creates the calendar event</div>
                </div>
              </div>
            </div>

            <div className="stats">
              <div className="stat">
                <div className="stat-label">Active</div>
                <div className="stat-value">{stats.active}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Scheduled</div>
                <div className="stat-value">{stats.scheduled}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Pending</div>
                <div className="stat-value">{stats.pending}</div>
              </div>
            </div>
          </div>

          {/* Column 2: Conversations */}
          <div className="content-col conversations-col">
            <div className="section-header">
              <div className="section-title">Conversations</div>
              <div className="filters">
                {['all', 'proposed', 'scheduled', 'awaiting_confirmation'].map(f => (
                  <button
                    key={f}
                    type="button"
                    className={`filter-btn ${filter === f ? 'active' : ''}`}
                    onClick={() => setFilter(f)}
                  >
                    {f === 'all' ? 'All' : f === 'awaiting_confirmation' ? 'Pending' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="conversations-list">
              {loading ? (
                <div className="loading"><div className="spinner" /></div>
              ) : filteredConversations.length === 0 ? (
                <div className="empty">
                  <div className="empty-title">No conversations yet</div>
                  <div className="empty-desc">CC meetme@ in any email to start</div>
                </div>
              ) : (
                filteredConversations.map(conv => {
                  const others = getOtherParticipants(conv);
                  const displayName = formatParticipants(conv);
                  const initial = others.length > 0 ? others[0].charAt(0).toUpperCase() : '?';

                  return (
                    <div key={conv.id} className="conversation-card" onClick={() => handleViewConversation(conv.id)}>
                      <div className="conv-card-header">
                        <div className="conv-avatar">{initial}</div>
                        <div className="conv-info">
                          <div className="conv-subject">{conv.subject || '(no subject)'}</div>
                          <div className="conv-participant">{displayName}</div>
                        </div>
                      </div>
                      <div className="conv-card-footer">
                        <span className={`status status-${conv.status}`}>{formatStatus(conv.status)}</span>
                        <span className="time">{timeAgo(conv.last_activity * 1000)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 3: Settings */}
          <div className="content-col settings-col">
            <div className="section-header">
              <div className="section-title">Preferences</div>
            </div>
            <div className="settings-box">
              <div className="settings-row">
                <div>
                  <div className="settings-label">Timezone</div>
                </div>
                <select 
                  value={settings.timezone} 
                  onChange={e => setSettings(prev => ({ ...prev, timezone: e.target.value }))}
                >
                  <option value="America/Los_Angeles">Pacific (PT)</option>
                  <option value="America/Denver">Mountain (MT)</option>
                  <option value="America/Chicago">Central (CT)</option>
                  <option value="America/New_York">Eastern (ET)</option>
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Europe/Berlin">Berlin (CET)</option>
                  <option value="Europe/Paris">Paris (CET)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                </select>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Working Hours</div>
                </div>
                <div className="settings-control">
                  <input 
                    type="number" 
                    min="0" 
                    max="23" 
                    value={settings.working_hours_start}
                    onChange={e => setSettings(prev => ({ ...prev, working_hours_start: parseInt(e.target.value) || 0 }))}
                  />
                  <span>to</span>
                  <input 
                    type="number" 
                    min="0" 
                    max="23" 
                    value={settings.working_hours_end}
                    onChange={e => setSettings(prev => ({ ...prev, working_hours_end: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Buffer</div>
                </div>
                <select 
                  value={settings.buffer_minutes}
                  onChange={e => setSettings(prev => ({ ...prev, buffer_minutes: parseInt(e.target.value) }))}
                >
                  <option value="0">None</option>
                  <option value="5">5 min</option>
                  <option value="10">10 min</option>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                </select>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Default Duration</div>
                </div>
                <select 
                  value={settings.default_meeting_duration}
                  onChange={e => setSettings(prev => ({ ...prev, default_meeting_duration: parseInt(e.target.value) }))}
                >
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">60 min</option>
                </select>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Meeting Title Prefix</div>
                </div>
                <input 
                  type="text" 
                  placeholder="e.g. [MeetMe]"
                  value={settings.meeting_title_prefix}
                  onChange={e => setSettings(prev => ({ ...prev, meeting_title_prefix: e.target.value }))}
                />
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">Weekends</div>
                </div>
                <label className="toggle">
                  <input 
                    type="checkbox" 
                    checked={settings.include_weekends}
                    onChange={e => setSettings(prev => ({ ...prev, include_weekends: e.target.checked }))}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
              <div className="settings-footer">
                <button type="button" className="btn btn-primary" onClick={handleSaveSettings}>Save</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedConversation && (
        <ConversationModal
          conversation={selectedConversation}
          userEmail={user.email}
          onClose={() => setSelectedConversation(null)}
          onDelete={handleDeleteConversation}
        />
      )}
    </main>
  );
}
