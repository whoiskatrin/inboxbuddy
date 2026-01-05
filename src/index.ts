// InboxBuddy - AI-Powered Scheduling Assistant
// Main Worker Entry Point

import type { Env, Conversation, ConversationRow, ApiResponse, ConversationListResponse } from './types';
import { ConversationAgent } from './agents/conversation';
import { SchedulingAgent, routeAgentEmail } from './agents/scheduling-agent';
import { DashboardAgent } from './agents/dashboard-agent';
import { routeAgentRequest } from 'agents';
import {
	getAuthorizationUrl,
	exchangeCodeForTokens,
	storeTokens,
	getGoogleUserInfo,
	getTokens,
} from './services/calendar';
import { generateId, normalizeEmail } from './utils/helpers';
import { renderLandingPage } from './handlers/landing';
import { renderPrivacyPolicy, renderTermsOfService } from './handlers/legal';

// Export the Durable Object classes
export { ConversationAgent, SchedulingAgent, DashboardAgent };

/**
 * Create HMAC signature for session data
 */
async function signSession(data: { email: string; exp: number }, secret: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const payload = JSON.stringify(data);
	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
	const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
	// URL-encode the token for cookie safety
	return encodeURIComponent(btoa(JSON.stringify({ payload, sig: sigBase64 })));
}

/**
 * Verify and parse signed session token
 */
async function verifySession(token: string, secret: string): Promise<{ email: string; exp: number } | null> {
	try {
		// URL-decode then base64-decode the token
		const { payload, sig } = JSON.parse(atob(decodeURIComponent(token)));
		const encoder = new TextEncoder();
		const key = await crypto.subtle.importKey(
			'raw',
			encoder.encode(secret),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['verify']
		);
		const sigBytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
		const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(payload));
		if (!valid) return null;
		const data = JSON.parse(payload);
		if (data.exp <= Date.now()) return null;
		return data;
	} catch {
		return null;
	}
}

/**
 * Parse and verify session from cookie
 */
async function getSessionFromCookie(request: Request, secret: string): Promise<{ email: string; exp: number } | null> {
	const cookie = request.headers.get('Cookie');
	if (!cookie) return null;

	const match = cookie.match(/meetme_session=([^;]+)/);
	if (!match) return null;

	return verifySession(match[1], secret);
}

/**
 * Handle logout - clear cookie and show logout page
 */
function handleLogout(request: Request): Response {
	const url = new URL(request.url);
	const isLocalDev = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
	
	console.log(`[Logout] Clearing session cookie, isLocalDev=${isLocalDev}`);

	// Return an HTML page that clears the cookie via JavaScript and redirects
	const html = `<!DOCTYPE html>
<html>
<head>
	<title>Logging out...</title>
	<script>
		// Clear the cookie
		document.cookie = 'meetme_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT';
		document.cookie = 'meetme_session=; Path=/; Max-Age=0';
		// Redirect to landing page
		window.location.href = '/';
	</script>
</head>
<body>
	<p>Logging out...</p>
</body>
</html>`;

	// Also set the cookie deletion header
	const cookieFlags = isLocalDev
		? 'Path=/; Max-Age=0'
		: 'Path=/; Secure; Max-Age=0';

	return new Response(html, {
		status: 200,
		headers: {
			'Content-Type': 'text/html',
			'Set-Cookie': `meetme_session=; ${cookieFlags}; Expires=Thu, 01 Jan 1970 00:00:01 GMT`,
			'Cache-Control': 'no-cache, no-store, must-revalidate',
		},
	});
}

// Main worker export
export default {
	/**
	 * Handle HTTP requests (API endpoints + OAuth callbacks)
	 */
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// CORS headers - restrict to same origin only
		const corsHeaders = {
			'Access-Control-Allow-Origin': url.origin,
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
			'Access-Control-Allow-Credentials': 'true',
		};

		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		try {
			// Route handling
			const path = url.pathname;

			// Landing page - redirect to dashboard if logged in
			if (path === '/') {
				const session = await getSessionFromCookie(request, env.ENCRYPTION_KEY);
				console.log(`[Landing] Session check: ${session ? `email=${session.email}, valid=true` : 'no session'}`);
				if (session) {
					return Response.redirect(`${url.origin}/dashboard`, 302);
				}
				return renderLandingPage();
			}

			// Health check
			if (path === '/health') {
				return jsonResponse({ status: 'ok', service: 'InboxBuddy' }, corsHeaders);
			}

			// Legal pages
			if (path === '/privacy') {
				return renderPrivacyPolicy();
			}
			if (path === '/terms') {
				return renderTermsOfService();
			}

			// Dashboard - serve React app for SPA routing
			// Redirect to login if not authenticated
			if (path === '/dashboard' || path.startsWith('/dashboard/')) {
				const session = await getSessionFromCookie(request, env.ENCRYPTION_KEY);
				if (!session) {
					console.log('[Dashboard] No valid session, redirecting to landing');
					return Response.redirect(`${url.origin}/`, 302);
				}
				return env.ASSETS.fetch(new Request(new URL('/app.html', url.origin)));
			}

			// OAuth routes
			if (path === '/auth/config') {
				// Public endpoint - returns Google Client ID for frontend
				return jsonResponse({ clientId: env.GOOGLE_CLIENT_ID }, corsHeaders);
			}
			if (path === '/auth/google/verify' && request.method === 'POST') {
				return handleGoogleCredentialVerify(request, env, url);
			}
			if (path === '/auth/google') {
				return handleGoogleAuth(request, env);
			}
			if (path === '/auth/callback') {
				return handleOAuthCallback(request, env);
			}
			if (path === '/auth/logout') {
				return handleLogout(request);
			}

			// Agent routes (WebSocket connections via Agents SDK)
			// The routeAgentRequest handles WebSocket upgrade with proper headers
			if (path.startsWith('/agents/') || path.startsWith('/parties/')) {
				const agentResponse = await routeAgentRequest(request, env);
				if (agentResponse) return agentResponse;
			}

			// API routes (require authentication)
			if (path.startsWith('/api/')) {
				return handleApiRequest(request, env, corsHeaders);
			}

			// Serve static assets from public/ for any other paths
			// This handles og-image.png, favicon, robots.txt, etc.
			return env.ASSETS.fetch(request);
		} catch (error) {
			console.error('[Worker] Error:', error);
			return jsonResponse(
				{ success: false, error: 'Internal server error' },
				corsHeaders,
				500
			);
		}
	},

	/**
	 * Handle inbound emails - routes to SchedulingAgent via Agents SDK
	 */
	async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
		try {
			console.log(`[Email] Received from: ${message.from}, to: ${message.to}`);
			
			// Route email to SchedulingAgent using Agents SDK
			// Use a custom resolver that creates unique DOs per conversation thread
			await routeAgentEmail(message, env as unknown as Cloudflare.Env, {
				resolver: async (email: ForwardableEmailMessage) => {
					try {
						// Get headers from the email message
						const headers = email.headers;
						
						if (!headers) {
							console.error('[Email] No headers found on email message');
							// Fall back to using sender + recipient as identifier
							const identifier = `fallback:${email.from}:${email.to}`.toLowerCase();
							const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identifier));
							const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
							return {
								agentName: 'SCHEDULING_AGENT',
								agentId: hashHex.slice(0, 32),
							};
						}
						
						// Extract subject from headers
						let subject = headers.get('subject') || 'unknown';
						console.log(`[Email] Original subject: "${subject}"`);
						
						// Normalize subject: remove Re:, Fwd:, etc.
						subject = subject.replace(/^(Re|Fwd|Fw):\s*/gi, '').trim();
						console.log(`[Email] Normalized subject: "${subject}"`);
						
						// Route based on JUST the normalized subject (not sender)
						// This way all participants in the same thread go to the same DO
						const identifier = `thread:${subject}`.toLowerCase();
						const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identifier));
						const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
						
						console.log(`[Email] Routing to DO: ${identifier} -> ${hashHex.slice(0, 16)}`);
						
						return {
							agentName: 'SCHEDULING_AGENT',
							agentId: hashHex.slice(0, 32),
						};
					} catch (resolverError) {
						console.error('[Email] Resolver error:', resolverError);
						// Fall back to a default routing
						const identifier = `error:${email.from}`.toLowerCase();
						const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identifier));
						const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
						return {
							agentName: 'SCHEDULING_AGENT',
							agentId: hashHex.slice(0, 32),
						};
					}
				},
			});
		} catch (error) {
			console.error('[Email] Fatal error processing email:', error);
			// Don't rethrow - we don't want to reject the email
		}
	},
};

/**
 * Initiate Google OAuth flow
 */
function handleGoogleAuth(request: Request, env: Env): Response {
	const url = new URL(request.url);
	const returnTo = url.searchParams.get('return_to') || '/dashboard';

	// Generate state for CSRF protection
	const state = btoa(JSON.stringify({ returnTo, nonce: crypto.randomUUID() }));

	// Build redirect URI (same origin)
	const redirectUri = `${url.origin}/auth/callback`;

	// Get authorization URL
	const authUrl = getAuthorizationUrl(redirectUri, state, env);

	return Response.redirect(authUrl, 302);
}

/**
 * Handle OAuth callback from Google
 */
async function handleOAuthCallback(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const error = url.searchParams.get('error');

	if (error) {
		return new Response(`Authentication failed: ${error}`, { status: 400 });
	}

	if (!code || !state) {
		return new Response('Missing code or state', { status: 400 });
	}

	try {
		// Parse state
		const stateData = JSON.parse(atob(state));

		// Exchange code for tokens
		const redirectUri = `${url.origin}/auth/callback`;
		const tokens = await exchangeCodeForTokens(code, redirectUri, env);

		// Get user info
		const userInfo = await getGoogleUserInfo(tokens.access_token);
		if (!userInfo) {
			return new Response('Failed to get user info', { status: 500 });
		}

		// Store tokens
		await storeTokens(userInfo.email, tokens, env);

		// Create or update user in D1
		const existingUser = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
			.bind(userInfo.email)
			.first();

		const now = Math.floor(Date.now() / 1000);

		if (existingUser) {
			await env.DB.prepare(
				'UPDATE users SET name = ?, google_id = ?, is_active = 1, updated_at = ? WHERE email = ?'
			)
				.bind(userInfo.name, userInfo.id, now, userInfo.email)
				.run();
		} else {
			await env.DB.prepare(
				'INSERT INTO users (id, email, name, google_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
			)
				.bind(generateId(), userInfo.email, userInfo.name, userInfo.id, now, now)
				.run();
		}

		// Redirect back to dashboard
		const returnTo = stateData.returnTo || '/dashboard';
		const dashboardUrl = returnTo.startsWith('http')
			? returnTo
			: `${url.origin}${returnTo}`;

		// Create signed session token
		const sessionData = { email: userInfo.email, exp: Date.now() + 24 * 60 * 60 * 1000 };
		const sessionToken = await signSession(sessionData, env.ENCRYPTION_KEY);

		// Only use Secure flag in production (HTTPS)
		// SameSite=Lax required for OAuth redirects (cross-site navigation)
		const isLocalDev = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
		const cookieFlags = isLocalDev
			? 'Path=/; HttpOnly; SameSite=Lax; Max-Age=86400'
			: 'Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400';

		return new Response(null, {
			status: 302,
			headers: {
				Location: dashboardUrl,
				'Set-Cookie': `meetme_session=${sessionToken}; ${cookieFlags}`,
			},
		});
	} catch (error) {
		console.error('[OAuth] Callback error:', error);
		// Redirect back to landing page with error - user can try again
		const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
		return new Response(
			`<!DOCTYPE html>
			<html>
			<head>
				<meta charset="UTF-8">
				<title>Login Error - InboxBuddy</title>
				<style>
					body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #fafafa; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
					.error-box { text-align: center; padding: 40px; background: #141414; border-radius: 12px; border: 1px solid #262626; max-width: 400px; }
					h1 { font-size: 24px; margin: 0 0 16px; }
					p { color: #a1a1aa; margin: 0 0 24px; }
					a { display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; }
					a:hover { background: #ea580c; }
				</style>
			</head>
			<body>
				<div class="error-box">
					<h1>Login Error</h1>
					<p>${errorMessage}</p>
					<a href="/">Try Again</a>
				</div>
			</body>
			</html>`,
			{ status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
		);
	}
}

/**
 * Handle Google auth code exchange (from @react-oauth/google useGoogleLogin)
 * This receives an authorization code and exchanges it for tokens
 */
async function handleGoogleCredentialVerify(request: Request, env: Env, url: URL): Promise<Response> {
	const corsHeaders = {
		'Access-Control-Allow-Origin': url.origin,
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
		'Access-Control-Allow-Credentials': 'true',
	};

	try {
		const body = await request.json<{ code: string }>();
		if (!body.code) {
			return jsonResponse({ success: false, error: 'Missing authorization code' }, corsHeaders, 400);
		}

		// Exchange the authorization code for tokens
		// Note: redirect_uri must be 'postmessage' for popup flow
		const tokens = await exchangeCodeForTokens(body.code, 'postmessage', env);

		// Get user info
		const userInfo = await getGoogleUserInfo(tokens.access_token);
		if (!userInfo) {
			return jsonResponse({ success: false, error: 'Failed to get user info' }, corsHeaders, 500);
		}

		// Store tokens for Calendar access
		await storeTokens(userInfo.email, tokens, env);

		// Create or update user in D1
		const existingUser = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
			.bind(userInfo.email)
			.first();

		const now = Math.floor(Date.now() / 1000);

		if (existingUser) {
			await env.DB.prepare(
				'UPDATE users SET name = ?, google_id = ?, is_active = 1, updated_at = ? WHERE email = ?'
			)
				.bind(userInfo.name, userInfo.id, now, userInfo.email)
				.run();
		} else {
			await env.DB.prepare(
				'INSERT INTO users (id, email, name, google_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
			)
				.bind(generateId(), userInfo.email, userInfo.name, userInfo.id, now, now)
				.run();
		}

		// Create signed session token
		const sessionData = { email: userInfo.email, exp: Date.now() + 24 * 60 * 60 * 1000 };
		const sessionToken = await signSession(sessionData, env.ENCRYPTION_KEY);

		// Set cookie
		const isLocalDev = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
		const cookieFlags = isLocalDev
			? 'Path=/; HttpOnly; SameSite=Lax; Max-Age=86400'
			: 'Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400';

		return new Response(JSON.stringify({ success: true }), {
			headers: {
				'Content-Type': 'application/json',
				'Set-Cookie': `meetme_session=${sessionToken}; ${cookieFlags}`,
				...corsHeaders,
			},
		});
	} catch (error) {
		console.error('[Auth] Code exchange error:', error);
		const errorMessage = error instanceof Error ? error.message : 'Verification failed';
		return jsonResponse({ success: false, error: errorMessage }, corsHeaders, 500);
	}
}

/**
 * Handle API requests
 */
async function handleApiRequest(
	request: Request,
	env: Env,
	corsHeaders: Record<string, string>
): Promise<Response> {
	const url = new URL(request.url);
	const path = url.pathname;

	// Authenticate request
	const userEmail = await authenticateRequest(request, env);
	if (!userEmail) {
		return jsonResponse({ success: false, error: 'Unauthorized' }, corsHeaders, 401);
	}

	// API Routes
	if (path === '/api/me') {
		return handleGetMe(userEmail, env, corsHeaders);
	}

	if (path === '/api/conversations') {
		if (request.method === 'GET') {
			return handleListConversations(userEmail, url, env, corsHeaders);
		}
	}

	if (path.match(/^\/api\/conversations\/[\w-]+$/)) {
		const conversationId = path.split('/').pop()!;
		if (request.method === 'GET') {
			return handleGetConversation(conversationId, userEmail, env, corsHeaders);
		}
		if (request.method === 'DELETE') {
			return handleCancelConversation(conversationId, userEmail, env, corsHeaders);
		}
	}

	if (path.match(/^\/api\/conversations\/[\w-]+\/remind$/)) {
		const conversationId = path.split('/')[3];
		if (request.method === 'POST') {
			return handleSendReminder(conversationId, userEmail, env, corsHeaders);
		}
	}

	if (path === '/api/settings') {
		if (request.method === 'GET') {
			return handleGetSettings(userEmail, env, corsHeaders);
		}
		if (request.method === 'PUT') {
			return handleUpdateSettings(request, userEmail, env, corsHeaders);
		}
	}

	return jsonResponse({ success: false, error: 'Not found' }, corsHeaders, 404);
}

/**
 * Authenticate request using session cookie or Authorization header
 */
async function authenticateRequest(request: Request, env: Env): Promise<string | null> {
	// Check Authorization header first (signed token)
	const authHeader = request.headers.get('Authorization');
	if (authHeader?.startsWith('Bearer ')) {
		const token = authHeader.slice(7);
		const session = await verifySession(token, env.ENCRYPTION_KEY);
		if (session) {
			return session.email;
		}
	}

	// Check session cookie (signed token)
	const session = await getSessionFromCookie(request, env.ENCRYPTION_KEY);
	if (session) {
		return session.email;
	}

	return null;
}

/**
 * Get current user info
 */
async function handleGetMe(
	userEmail: string,
	env: Env,
	corsHeaders: Record<string, string>
): Promise<Response> {
	const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?')
		.bind(userEmail)
		.first();

	if (!user) {
		return jsonResponse({ success: false, error: 'User not found' }, corsHeaders, 404);
	}

	// Check if they have valid OAuth tokens
	const tokens = await getTokens(userEmail, env);
	const hasValidTokens = tokens !== null && tokens.expires_at > Date.now();

	return jsonResponse(
		{
			success: true,
			data: {
				...user,
				working_days: JSON.parse((user as { working_days: string }).working_days || '[1,2,3,4,5]'),
				hasValidTokens,
			},
		},
		corsHeaders
	);
}

/**
 * List conversations for a user
 */
async function handleListConversations(
	userEmail: string,
	url: URL,
	env: Env,
	corsHeaders: Record<string, string>
): Promise<Response> {
	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '20'), 100);
	const status = url.searchParams.get('status');
	const offset = (page - 1) * pageSize;

	let query = 'SELECT * FROM conversations WHERE owner_email = ?';
	const params: (string | number)[] = [userEmail];

	if (status) {
		query += ' AND status = ?';
		params.push(status);
	}

	query += ' ORDER BY last_activity DESC LIMIT ? OFFSET ?';
	params.push(pageSize, offset);

	const rows = await env.DB.prepare(query)
		.bind(...params)
		.all<ConversationRow>();

	// Get total count
	let countQuery = 'SELECT COUNT(*) as count FROM conversations WHERE owner_email = ?';
	const countParams: string[] = [userEmail];
	if (status) {
		countQuery += ' AND status = ?';
		countParams.push(status);
	}

	const countResult = await env.DB.prepare(countQuery)
		.bind(...countParams)
		.first<{ count: number }>();

	// Parse JSON fields
	const conversations: Conversation[] = (rows.results || []).map(parseConversationRow);

	const response: ConversationListResponse = {
		conversations,
		total: countResult?.count || 0,
		page,
		pageSize,
	};

	return jsonResponse({ success: true, data: response }, corsHeaders);
}

/**
 * Get a single conversation
 */
async function handleGetConversation(
	conversationId: string,
	userEmail: string,
	env: Env,
	corsHeaders: Record<string, string>
): Promise<Response> {
	const row = await env.DB.prepare('SELECT * FROM conversations WHERE id = ? AND owner_email = ?')
		.bind(conversationId, userEmail)
		.first<ConversationRow>();

	if (!row) {
		return jsonResponse({ success: false, error: 'Conversation not found' }, corsHeaders, 404);
	}

	return jsonResponse({ success: true, data: parseConversationRow(row) }, corsHeaders);
}

/**
 * Delete a conversation (fully remove from database)
 */
async function handleCancelConversation(
	conversationId: string,
	userEmail: string,
	env: Env,
	corsHeaders: Record<string, string>
): Promise<Response> {
	// Fully delete the conversation from the database
	const result = await env.DB.prepare(
		'DELETE FROM conversations WHERE id = ? AND owner_email = ?'
	)
		.bind(conversationId, userEmail)
		.run();

	if (!result.success || result.meta.changes === 0) {
		return jsonResponse(
			{ success: false, error: 'Conversation not found' },
			corsHeaders,
			404
		);
	}

	return jsonResponse({ success: true }, corsHeaders);
}

/**
 * Send a reminder for a conversation
 */
async function handleSendReminder(
	conversationId: string,
	userEmail: string,
	env: Env,
	corsHeaders: Record<string, string>
): Promise<Response> {
	// Get the conversation
	const conv = await env.DB.prepare('SELECT * FROM conversations WHERE id = ? AND owner_email = ?')
		.bind(conversationId, userEmail)
		.first<ConversationRow>();

	if (!conv) {
		return jsonResponse({ success: false, error: 'Conversation not found' }, corsHeaders, 404);
	}

	if (conv.status !== 'proposed' && conv.status !== 'awaiting_confirmation') {
		return jsonResponse(
			{ success: false, error: 'Cannot send reminder for this conversation status' },
			corsHeaders,
			400
		);
	}

	// Trigger reminder via Durable Object
	const doId = env.CONVERSATION_AGENT.idFromName(conversationId);
	const stub = env.CONVERSATION_AGENT.get(doId);

	// Manually trigger alarm
	await stub.fetch(
		new Request('https://internal/trigger-reminder', { method: 'POST' })
	);

	return jsonResponse({ success: true }, corsHeaders);
}

/**
 * Get user settings
 */
async function handleGetSettings(
	userEmail: string,
	env: Env,
	corsHeaders: Record<string, string>
): Promise<Response> {
	const user = await env.DB.prepare(
		'SELECT timezone, working_hours_start, working_hours_end, working_days, buffer_minutes, include_weekends, default_meeting_duration, meeting_title_prefix FROM users WHERE email = ?'
	)
		.bind(userEmail)
		.first();

	if (!user) {
		return jsonResponse({ success: false, error: 'User not found' }, corsHeaders, 404);
	}

	return jsonResponse(
		{
			success: true,
			data: {
				...user,
				working_days: JSON.parse((user as { working_days: string }).working_days || '[1,2,3,4,5]'),
				include_weekends: (user as { include_weekends: number }).include_weekends === 1,
			},
		},
		corsHeaders
	);
}

/**
 * Update user settings
 */
async function handleUpdateSettings(
	request: Request,
	userEmail: string,
	env: Env,
	corsHeaders: Record<string, string>
): Promise<Response> {
	const body = await request.json<{
		timezone?: string;
		working_hours_start?: number;
		working_hours_end?: number;
		working_days?: number[];
		buffer_minutes?: number;
		include_weekends?: boolean;
		default_meeting_duration?: number;
		meeting_title_prefix?: string;
	}>();

	const updates: string[] = [];
	const values: (string | number)[] = [];

	if (body.timezone) {
		updates.push('timezone = ?');
		values.push(body.timezone);
	}
	if (body.working_hours_start !== undefined) {
		updates.push('working_hours_start = ?');
		values.push(body.working_hours_start);
	}
	if (body.working_hours_end !== undefined) {
		updates.push('working_hours_end = ?');
		values.push(body.working_hours_end);
	}
	if (body.working_days) {
		updates.push('working_days = ?');
		values.push(JSON.stringify(body.working_days));
	}
	if (body.buffer_minutes !== undefined) {
		updates.push('buffer_minutes = ?');
		values.push(body.buffer_minutes);
	}
	if (body.include_weekends !== undefined) {
		updates.push('include_weekends = ?');
		values.push(body.include_weekends ? 1 : 0);
	}
	if (body.default_meeting_duration !== undefined) {
		updates.push('default_meeting_duration = ?');
		values.push(body.default_meeting_duration);
	}
	if (body.meeting_title_prefix !== undefined) {
		updates.push('meeting_title_prefix = ?');
		values.push(body.meeting_title_prefix);
	}

	if (updates.length === 0) {
		return jsonResponse({ success: false, error: 'No updates provided' }, corsHeaders, 400);
	}

	updates.push('updated_at = ?');
	values.push(Math.floor(Date.now() / 1000));
	values.push(userEmail);

	await env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE email = ?`)
		.bind(...values)
		.run();

	return jsonResponse({ success: true }, corsHeaders);
}

/**
 * Parse a conversation row from D1, converting JSON strings to objects
 */
function parseConversationRow(row: ConversationRow): Conversation {
	return {
		...row,
		participants: row.participants ? JSON.parse(row.participants) : [],
		proposed_slots: row.proposed_slots ? JSON.parse(row.proposed_slots) : null,
		selected_slot: row.selected_slot ? JSON.parse(row.selected_slot) : null,
	};
}

/**
 * Create a JSON response with CORS headers
 */
function jsonResponse(
	data: ApiResponse | Record<string, unknown>,
	corsHeaders: Record<string, string>,
	status = 200
): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'Content-Type': 'application/json',
			...corsHeaders,
		},
	});
}
