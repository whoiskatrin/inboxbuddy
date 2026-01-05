import type { Conversation } from '../types';

interface ConversationModalProps {
  conversation: Conversation;
  userEmail: string;
  onClose: () => void;
  onDelete: () => void;
}

export function ConversationModal({ conversation, userEmail, onClose, onDelete }: ConversationModalProps) {
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  function getOtherParticipants(): string[] {
    const ownerEmail = userEmail.toLowerCase();
    return (conversation.participants || []).filter(p => {
      const email = p.toLowerCase();
      return email !== ownerEmail && !email.startsWith('meetme@');
    });
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

  const others = getOtherParticipants();
  const conv = conversation;

  // Time box content
  const renderTimeBox = () => {
    if (conv.status === 'scheduled' && conv.selected_slot) {
      return (
        <div className="confirmed-time-box">
          <div className="confirmed-time-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <title>Confirmed</title>
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div className="confirmed-time-content">
            <div className="confirmed-time-label">Confirmed</div>
            <div className="confirmed-time-value">{conv.selected_slot.label}</div>
          </div>
          {conv.calendar_event_id && (
            <div className="confirmed-time-action">
              <a href={`https://calendar.google.com/calendar/event?eid=${conv.calendar_event_id}`} target="_blank" rel="noreferrer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <title>Calendar</title>
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Calendar
              </a>
            </div>
          )}
        </div>
      );
    }
    
    if (conv.status === 'proposed' || conv.status === 'awaiting_confirmation') {
      return (
        <div className="confirmed-time-box pending">
          <div className="confirmed-time-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <title>Pending</title>
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="confirmed-time-content">
            <div className="confirmed-time-label">Awaiting Response</div>
            <div className="confirmed-time-value">{conv.proposed_slots?.length || 0} times proposed</div>
          </div>
        </div>
      );
    }
    
    return null;
  };

  return (
    <div 
      className="modal-overlay" 
      onClick={handleOverlayClick}
      onKeyDown={e => e.key === 'Escape' && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal" role="document">
        <div className="modal-header">
          <div className="modal-title">Meeting Details</div>
          <button type="button" className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <title>Close</title>
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        
        <div className="modal-body">
          <div className="meeting-header">
            <div className="meeting-subject">{conv.meeting_title || conv.subject || '(no subject)'}</div>
            <div className="meeting-meta">
              <div className="meeting-meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <title>Duration</title>
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                {conv.meeting_duration_minutes || 30} min
              </div>
              <span className={`status status-${conv.status}`}>{formatStatus(conv.status)}</span>
            </div>
          </div>
          
          {renderTimeBox()}
          
          <div className="detail-section">
            <div className="detail-section-title">Participants</div>
            {others.length > 0 ? (
              <div className="participants-grid">
                {others.map(p => (
                  <div key={p} className="participant-chip">
                    <div className="participant-avatar">{p.charAt(0).toUpperCase()}</div>
                    {p}
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-slots">No participants</div>
            )}
          </div>
          
          {conv.proposed_slots && conv.proposed_slots.length > 0 && (
            <div className="detail-section">
              <div className="detail-section-title">Proposed Times</div>
              <div className="slots-grid">
                {conv.proposed_slots.map((slot) => {
                  const isSelected = conv.selected_slot && conv.selected_slot.start === slot.start;
                  return (
                    <div key={slot.start} className={`slot ${isSelected ? 'selected' : ''}`}>
                      <div className="slot-time">{slot.label}</div>
                      {isSelected && (
                        <div className="slot-badge">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <title>Selected</title>
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          Selected
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          <div className="detail-section">
            <div className="detail-section-title">Activity</div>
            <div className="meeting-meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <title>Last updated</title>
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Last updated {timeAgo(conv.last_activity * 1000)}
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <div className="modal-footer-left">
            <button type="button" className="btn btn-danger-ghost btn-icon" onClick={onDelete}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <title>Delete</title>
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Delete
            </button>
          </div>
          <div className="modal-footer-right">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
