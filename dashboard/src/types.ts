export interface User {
  email: string;
  name?: string;
}

export interface TimeSlot {
  start: string;
  end: string;
  label: string;
}

export interface Conversation {
  id: string;
  owner_email: string;
  thread_id: string;
  subject: string;
  participants: string[];
  status: string;
  proposed_slots: TimeSlot[] | null;
  selected_slot: TimeSlot | null;
  meeting_title: string | null;
  meeting_duration_minutes: number;
  calendar_event_id: string | null;
  last_activity: number;
  created_at: number;
}

export interface DashboardState {
  conversations: Conversation[];
  stats: {
    active: number;
    scheduled: number;
    pending: number;
  };
  lastUpdated: number;
}

export interface Settings {
  timezone: string;
  working_hours_start: number;
  working_hours_end: number;
  buffer_minutes: number;
  default_meeting_duration: number;
  meeting_title_prefix: string;
  include_weekends: boolean;
}
