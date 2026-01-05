// MeetMe Type Definitions

// Conversation status enum
export type ConversationStatus =
	| 'new'
	| 'parsing'
	| 'proposed'
	| 'awaiting_confirmation'
	| 'scheduled'
	| 'declined'
	| 'cancelled'
	| 'error';

// Proposed time slot structure
export interface TimeSlot {
	start: string; // ISO 8601 datetime
	end: string; // ISO 8601 datetime
	label: string; // Human-readable label e.g., "Tuesday, Jan 14 at 2:00 PM"
}

// Selected/confirmed slot with additional context
export interface SelectedSlot extends TimeSlot {
	confirmedBy: string; // Email of person who confirmed
	confirmedAt: string; // ISO 8601 datetime
}

// Conversation record from D1
export interface Conversation {
	id: string;
	owner_email: string;
	thread_id: string | null;
	latest_message_id: string | null;
	subject: string | null;
	participants: string[]; // Parsed from JSON
	status: ConversationStatus;
	proposed_slots: TimeSlot[] | null; // Parsed from JSON
	selected_slot: SelectedSlot | null; // Parsed from JSON
	calendar_event_id: string | null;
	meeting_title: string | null;
	meeting_duration_minutes: number;
	last_activity: number;
	reminder_count: number;
	last_reminder_at: number | null;
	created_at: number;
	updated_at: number;
}

// Raw conversation row from D1 (with JSON as strings)
export interface ConversationRow {
	id: string;
	owner_email: string;
	thread_id: string | null;
	latest_message_id: string | null;
	subject: string | null;
	participants: string | null;
	status: ConversationStatus;
	proposed_slots: string | null;
	selected_slot: string | null;
	calendar_event_id: string | null;
	meeting_title: string | null;
	meeting_duration_minutes: number;
	last_activity: number;
	reminder_count: number;
	last_reminder_at: number | null;
	created_at: number;
	updated_at: number;
}

// User record from D1
export interface User {
	id: string;
	email: string;
	name: string | null;
	google_id: string | null;
	timezone: string;
	working_hours_start: number;
	working_hours_end: number;
	working_days: number[]; // Parsed from JSON
	buffer_minutes: number;
	is_active: boolean;
	created_at: number;
	updated_at: number;
}

// Parsed email structure
export interface ParsedEmail {
	from: string;
	to: string[];
	cc: string[];
	subject: string;
	messageId: string;
	inReplyTo: string | null;
	references: string | null;
	textBody: string;
	htmlBody: string | null;
	date: Date;
	headers: Record<string, string>;
}

// AI analysis result from Claude
export interface EmailAnalysis {
	isSchedulingRequest: boolean;
	meetingTitle: string | null;
	suggestedDuration: number | null; // minutes
	preferredTimes: string[]; // Natural language preferences mentioned
	preferredDay: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' | 'tomorrow' | 'next_week' | null;
	preferredTimeOfDay: 'morning' | 'afternoon' | 'evening' | null;
	specificDateTime: string | null; // ISO 8601 datetime if user specified exact date and time
	isConfirmingTime: boolean; // True if user is confirming/agreeing to a specific time
	participants: string[];
	urgency: 'low' | 'medium' | 'high';
	additionalContext: string | null;
}

// Google Calendar event structure
export interface CalendarEvent {
	id: string;
	summary: string;
	description: string | null;
	start: {
		dateTime: string;
		timeZone: string;
	};
	end: {
		dateTime: string;
		timeZone: string;
	};
	attendees: Array<{
		email: string;
		responseStatus?: string;
	}>;
	htmlLink: string;
}

// Google Calendar free/busy response
export interface FreeBusyResponse {
	calendars: {
		[calendarId: string]: {
			busy: Array<{
				start: string;
				end: string;
			}>;
		};
	};
}

// OAuth token structure stored in KV
export interface OAuthTokens {
	access_token: string;
	refresh_token: string;
	expires_at: number; // Unix timestamp
	token_type: string;
	scope: string;
}

// Environment bindings
export interface Env {
	// D1 Database
	DB: D1Database;

	// KV for OAuth tokens
	TOKENS: KVNamespace;

	// Durable Object bindings
	CONVERSATION_AGENT: DurableObjectNamespace;
	SCHEDULING_AGENT: DurableObjectNamespace;
	DASHBOARD_AGENT: DurableObjectNamespace;

	// Email sending binding (raw MIME format)
	EMAIL: SendEmail;

	// Email Sending binding (new simplified API - private beta)
	// When the private beta is fully rolled out, this will use the EmailSending interface
	// For now, we check at runtime if the new API is available
	SEND_EMAIL: EmailSending | SendEmail;

	// Static assets binding
	ASSETS: Fetcher;

	// Environment variables
	ENVIRONMENT: string;
	BOT_EMAIL_PREFIX: string;
	DEFAULT_MEETING_DURATION_MINUTES: string;
	WORKING_HOURS_START: string;
	WORKING_HOURS_END: string;
	TIMEZONE: string;

	// Secrets (set via wrangler secret)
	ANTHROPIC_API_KEY: string;
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
	ENCRYPTION_KEY: string; // For encrypting tokens in KV

	// Optional: AI Gateway
	AI_GATEWAY_ACCOUNT_ID?: string;
	AI_GATEWAY_ID?: string;
}

// Legacy Email sending interface (Cloudflare binding)
export interface SendEmail {
	send(message: CloudflareEmailMessage): Promise<void>;
}

// Legacy Cloudflare Email Message for the binding
export interface CloudflareEmailMessage {
	from: string;
	to: string;
	raw: ReadableStream;
}

// New Email Sending API (private beta)
// See: https://blog.cloudflare.com/email-service/
export interface EmailRecipient {
	email: string;
	name?: string;
}

export interface EmailSendingMessage {
	to: EmailRecipient[];
	from: EmailRecipient;
	subject: string;
	text?: string;
	html?: string;
	replyTo?: EmailRecipient[];
	cc?: EmailRecipient[];
	bcc?: EmailRecipient[];
	headers?: Record<string, string>;
}

export interface EmailSending {
	send(message: EmailSendingMessage): Promise<void>;
}

// Email message for sending
export interface EmailMessage {
	from: string;
	to: string | string[];  // Primary recipient(s)
	cc?: string[];  // CC recipients
	subject: string;
	text?: string;
	html?: string;
	headers?: Record<string, string>;
}

// Durable Object state for conversation handling
export interface ConversationAgentState {
	conversationId: string;
	ownerEmail: string;
	threadId: string;
	status: ConversationStatus;
	messages: Array<{
		role: 'user' | 'assistant';
		content: string;
		timestamp: number;
	}>;
	proposedSlots: TimeSlot[];
	lastProcessedAt: number;
}

// API response types
export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
}

export interface ConversationListResponse {
	conversations: Conversation[];
	total: number;
	page: number;
	pageSize: number;
}
