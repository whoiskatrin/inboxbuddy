// Google Calendar Service - OAuth2 and Calendar API integration

import type { Env, OAuthTokens, CalendarEvent, FreeBusyResponse } from '../types';
import { encrypt, decrypt } from '../utils/helpers';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

const SCOPES = [
	'https://www.googleapis.com/auth/calendar.readonly',
	'https://www.googleapis.com/auth/calendar.events',
	'https://www.googleapis.com/auth/userinfo.email',
	'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

/**
 * Generate OAuth2 authorization URL
 */
export function getAuthorizationUrl(
	redirectUri: string,
	state: string,
	env: Env
): string {
	const params = new URLSearchParams({
		client_id: env.GOOGLE_CLIENT_ID,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: SCOPES,
		access_type: 'offline',
		prompt: 'select_account consent',
		state,
	});

	return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
	code: string,
	redirectUri: string,
	env: Env
): Promise<OAuthTokens> {
	console.log('[OAuth] Exchanging code for tokens, redirectUri:', redirectUri);

	const response = await fetch(GOOGLE_TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({
			client_id: env.GOOGLE_CLIENT_ID,
			client_secret: env.GOOGLE_CLIENT_SECRET,
			code,
			grant_type: 'authorization_code',
			redirect_uri: redirectUri,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error('[OAuth] Token exchange failed:', response.status, errorText);

		// Parse Google's error response for better messages
		try {
			const errorJson = JSON.parse(errorText);
			if (errorJson.error === 'invalid_grant') {
				throw new Error('Authorization expired. Please try logging in again.');
			}
			throw new Error(errorJson.error_description || errorJson.error || 'Token exchange failed');
		} catch (e) {
			if (e instanceof Error && e.message !== 'Token exchange failed') throw e;
			throw new Error(`Token exchange failed: ${errorText}`);
		}
	}

	const data = await response.json<{
		access_token: string;
		refresh_token: string;
		expires_in: number;
		token_type: string;
		scope: string;
	}>();

	return {
		access_token: data.access_token,
		refresh_token: data.refresh_token,
		expires_at: Date.now() + data.expires_in * 1000,
		token_type: data.token_type,
		scope: data.scope,
	};
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
	refreshToken: string,
	env: Env
): Promise<OAuthTokens> {
	const response = await fetch(GOOGLE_TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({
			client_id: env.GOOGLE_CLIENT_ID,
			client_secret: env.GOOGLE_CLIENT_SECRET,
			refresh_token: refreshToken,
			grant_type: 'refresh_token',
		}),
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Token refresh failed: ${error}`);
	}

	const data = await response.json<{
		access_token: string;
		expires_in: number;
		token_type: string;
		scope: string;
	}>();

	return {
		access_token: data.access_token,
		refresh_token: refreshToken, // Keep original refresh token
		expires_at: Date.now() + data.expires_in * 1000,
		token_type: data.token_type,
		scope: data.scope,
	};
}

/**
 * Store OAuth tokens securely in KV
 */
export async function storeTokens(
	userEmail: string,
	tokens: OAuthTokens,
	env: Env
): Promise<void> {
	const encrypted = await encrypt(JSON.stringify(tokens), env.ENCRYPTION_KEY);
	await env.TOKENS.put(`oauth:${userEmail}`, encrypted, {
		// Tokens don't expire in KV, but we track expiry in the data
		expirationTtl: 365 * 24 * 60 * 60, // 1 year
	});
}

/**
 * Retrieve OAuth tokens from KV
 */
export async function getTokens(
	userEmail: string,
	env: Env
): Promise<OAuthTokens | null> {
	const encrypted = await env.TOKENS.get(`oauth:${userEmail}`);
	if (!encrypted) return null;

	try {
		const decrypted = await decrypt(encrypted, env.ENCRYPTION_KEY);
		return JSON.parse(decrypted) as OAuthTokens;
	} catch {
		return null;
	}
}

/**
 * Get valid access token, refreshing if necessary
 */
export async function getValidAccessToken(
	userEmail: string,
	env: Env
): Promise<string | null> {
	let tokens = await getTokens(userEmail, env);
	if (!tokens) return null;

	// Check if token is expired or about to expire (5 min buffer)
	if (tokens.expires_at < Date.now() + 5 * 60 * 1000) {
		try {
			tokens = await refreshAccessToken(tokens.refresh_token, env);
			await storeTokens(userEmail, tokens, env);
		} catch (error) {
			console.error('[Calendar] Failed to refresh token:', error);
			return null;
		}
	}

	return tokens.access_token;
}

/**
 * Get free/busy information for a calendar
 */
export async function getFreeBusy(
	userEmail: string,
	timeMin: Date,
	timeMax: Date,
	env: Env
): Promise<Array<{ start: string; end: string }>> {
	const accessToken = await getValidAccessToken(userEmail, env);
	if (!accessToken) {
		console.error('[Calendar] No valid access token for', userEmail);
		return [];
	}

	const response = await fetch(`${GOOGLE_CALENDAR_API}/freeBusy`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			timeMin: timeMin.toISOString(),
			timeMax: timeMax.toISOString(),
			items: [{ id: userEmail }],
		}),
	});

	if (!response.ok) {
		const error = await response.text();
		console.error('[Calendar] FreeBusy query failed:', error);
		return [];
	}

	const data = await response.json<FreeBusyResponse>();
	return data.calendars[userEmail]?.busy || [];
}

/**
 * Create a calendar event
 */
export async function createCalendarEvent(
	event: {
		summary: string;
		description?: string;
		start: string;
		end: string;
		attendees: string[];
	},
	userEmail: string,
	env: Env
): Promise<CalendarEvent | null> {
	const accessToken = await getValidAccessToken(userEmail, env);
	if (!accessToken) {
		console.error('[Calendar] No valid access token for', userEmail);
		return null;
	}

	// Get user's timezone
	const user = await env.DB.prepare('SELECT timezone FROM users WHERE email = ?')
		.bind(userEmail)
		.first<{ timezone: string }>();
	const timezone = user?.timezone || 'America/Los_Angeles';

	// Ensure owner is included in attendees and all emails are unique
	const allAttendees = [...new Set([userEmail.toLowerCase(), ...event.attendees.map(e => e.toLowerCase())])];
	
	console.log(`[Calendar] Creating event "${event.summary}" for ${userEmail}`);
	console.log(`[Calendar] Attendees: ${allAttendees.join(', ')}`);
	console.log(`[Calendar] Time: ${event.start} to ${event.end}`);

	const response = await fetch(
		`${GOOGLE_CALENDAR_API}/calendars/primary/events?sendUpdates=all`,
		{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				summary: event.summary,
				description:
					event.description ||
					'Meeting scheduled via MeetMe',
				start: {
					dateTime: event.start,
					timeZone: timezone,
				},
				end: {
					dateTime: event.end,
					timeZone: timezone,
				},
				attendees: allAttendees.map((email) => ({ email })),
				reminders: {
					useDefault: true,
				},
			}),
		}
	);

	if (!response.ok) {
		const error = await response.text();
		console.error('[Calendar] Event creation failed:', error);
		console.error('[Calendar] Response status:', response.status);
		return null;
	}

	const data = await response.json<CalendarEvent>();
	console.log(`[Calendar] Event created successfully: ${data.id}`);
	return data;
}

/**
 * Delete/cancel a calendar event
 */
export async function deleteCalendarEvent(
	eventId: string,
	userEmail: string,
	env: Env
): Promise<boolean> {
	const accessToken = await getValidAccessToken(userEmail, env);
	if (!accessToken) return false;

	const response = await fetch(
		`${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}?sendUpdates=all`,
		{
			method: 'DELETE',
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		}
	);

	return response.ok;
}

/**
 * Get user info from Google
 */
export async function getGoogleUserInfo(
	accessToken: string
): Promise<{ email: string; name: string; id: string } | null> {
	const response = await fetch(
		'https://www.googleapis.com/oauth2/v2/userinfo',
		{
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		}
	);

	if (!response.ok) return null;

	const data = await response.json<{
		email: string;
		name: string;
		id: string;
	}>();

	return data;
}

/**
 * List upcoming calendar events
 */
export async function listUpcomingEvents(
	userEmail: string,
	maxResults: number,
	env: Env
): Promise<CalendarEvent[]> {
	const accessToken = await getValidAccessToken(userEmail, env);
	if (!accessToken) return [];

	const params = new URLSearchParams({
		maxResults: maxResults.toString(),
		singleEvents: 'true',
		orderBy: 'startTime',
		timeMin: new Date().toISOString(),
	});

	const response = await fetch(
		`${GOOGLE_CALENDAR_API}/calendars/primary/events?${params}`,
		{
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		}
	);

	if (!response.ok) return [];

	const data = await response.json<{ items: CalendarEvent[] }>();
	return data.items || [];
}
