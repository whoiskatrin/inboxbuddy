// Email Handler - Processes inbound emails to meetme@domain.com

import PostalMime from 'postal-mime';
import type { Env, ParsedEmail, ConversationRow } from '../types';
import { generateId, extractEmails, normalizeEmail } from '../utils/helpers';

/**
 * Main email handler - triggered when an email is received
 * This is the entry point for all inbound emails to meetme@domain.com
 */
export async function handleInboundEmail(
	message: ForwardableEmailMessage,
	env: Env,
	ctx: ExecutionContext
): Promise<void> {
	const startTime = Date.now();

	try {
		// Parse the raw email
		const parsedEmail = await parseEmail(message);

		console.log(`[Email] Received from: ${parsedEmail.from}, Subject: ${parsedEmail.subject}`);

		// Extract the bot email from the CC/TO list to determine the owner's domain
		const botEmail = findBotEmail(parsedEmail, env.BOT_EMAIL_PREFIX);
		if (!botEmail) {
			console.log('[Email] Bot email not found in recipients, ignoring');
			return;
		}

		// Determine the owner (the user who set up MeetMe on this domain)
		const ownerEmail = await findOwnerEmail(parsedEmail, botEmail, env);
		if (!ownerEmail) {
			console.log('[Email] No registered owner found for this domain');
			// Could send a "not set up" response here
			return;
		}

		// Check if this is part of an existing conversation thread
		const existingConversation = await findExistingConversation(parsedEmail, env);

		// Log the inbound email
		await logEmail(parsedEmail, existingConversation?.id ?? null, 'inbound', env);

		if (existingConversation) {
			// Continue existing conversation
			await handleExistingConversation(existingConversation, parsedEmail, ownerEmail, env, ctx);
		} else {
			// Start new conversation
			await handleNewConversation(parsedEmail, ownerEmail, botEmail, env, ctx);
		}

		console.log(`[Email] Processed in ${Date.now() - startTime}ms`);
	} catch (error) {
		console.error('[Email] Error processing email:', error);
		// Don't throw - we don't want to reject the email
	}
}

/**
 * Parse raw email message into structured format
 */
async function parseEmail(message: ForwardableEmailMessage): Promise<ParsedEmail> {
	const parser = new PostalMime();
	const rawEmail = await streamToArrayBuffer(message.raw);
	const parsed = await parser.parse(rawEmail);

	// Extract headers into a map
	const headers: Record<string, string> = {};
	for (const header of parsed.headers || []) {
		headers[header.key.toLowerCase()] = header.value;
	}

	return {
		from: message.from,
		to: extractEmails(message.to),
		cc: extractEmails(headers['cc'] || ''),
		subject: parsed.subject || '(no subject)',
		messageId: headers['message-id'] || '',
		inReplyTo: headers['in-reply-to'] || null,
		references: headers['references'] || null,
		textBody: parsed.text || '',
		htmlBody: parsed.html || null,
		date: new Date(headers['date'] || Date.now()),
		headers,
	};
}

/**
 * Find the bot email address from recipients
 */
function findBotEmail(email: ParsedEmail, botPrefix: string): string | null {
	const allRecipients = [...email.to, ...email.cc];

	for (const recipient of allRecipients) {
		const normalized = normalizeEmail(recipient);
		const localPart = normalized.split('@')[0];
		if (localPart.toLowerCase() === botPrefix.toLowerCase()) {
			return normalized;
		}
	}

	return null;
}

/**
 * Find the owner email for this domain
 * The owner is either in the TO/CC list (if they're part of the conversation)
 * or we look up the domain in our users table
 */
async function findOwnerEmail(
	email: ParsedEmail,
	botEmail: string,
	env: Env
): Promise<string | null> {
	const botDomain = botEmail.split('@')[1];

	// First, check if sender is the owner
	const senderDomain = email.from.split('@')[1];
	if (senderDomain === botDomain) {
		const user = await env.DB.prepare('SELECT email FROM users WHERE email = ? AND is_active = 1')
			.bind(normalizeEmail(email.from))
			.first<{ email: string }>();
		if (user) return user.email;
	}

	// Check all recipients for a registered owner on this domain
	const allParticipants = [email.from, ...email.to, ...email.cc];
	for (const participant of allParticipants) {
		const normalized = normalizeEmail(participant);
		if (normalized === botEmail) continue;

		const user = await env.DB.prepare('SELECT email FROM users WHERE email = ? AND is_active = 1')
			.bind(normalized)
			.first<{ email: string }>();

		if (user) return user.email;
	}

	// Look up any registered user for this domain
	const domainUser = await env.DB.prepare(
		"SELECT email FROM users WHERE email LIKE ? AND is_active = 1 LIMIT 1"
	)
		.bind(`%@${botDomain}`)
		.first<{ email: string }>();

	return domainUser?.email ?? null;
}

/**
 * Find existing conversation by thread ID or references
 */
async function findExistingConversation(
	email: ParsedEmail,
	env: Env
): Promise<ConversationRow | null> {
	// Try to find by In-Reply-To header
	if (email.inReplyTo) {
		const conv = await env.DB.prepare(
			'SELECT * FROM conversations WHERE latest_message_id = ? OR thread_id = ?'
		)
			.bind(email.inReplyTo, email.inReplyTo)
			.first<ConversationRow>();
		if (conv) return conv;
	}

	// Try to find by References header
	if (email.references) {
		const refs = email.references.split(/\s+/);
		for (const ref of refs) {
			const conv = await env.DB.prepare(
				'SELECT * FROM conversations WHERE latest_message_id = ? OR thread_id = ?'
			)
				.bind(ref.trim(), ref.trim())
				.first<ConversationRow>();
			if (conv) return conv;
		}
	}

	// Try to find by subject + participants (fuzzy match for re-opened threads)
	// Strip Re:/Fwd: prefixes
	const cleanSubject = email.subject.replace(/^(re:|fwd?:)\s*/gi, '').trim();
	if (cleanSubject) {
		const conv = await env.DB.prepare(
			`SELECT * FROM conversations
       WHERE subject LIKE ?
       AND status NOT IN ('scheduled', 'cancelled', 'declined')
       AND last_activity > ?
       ORDER BY last_activity DESC
       LIMIT 1`
		)
			.bind(`%${cleanSubject}%`, Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60) // Within last 7 days
			.first<ConversationRow>();
		if (conv) return conv;
	}

	return null;
}

/**
 * Handle a new scheduling conversation
 */
async function handleNewConversation(
	email: ParsedEmail,
	ownerEmail: string,
	botEmail: string,
	env: Env,
	ctx: ExecutionContext
): Promise<void> {
	const conversationId = generateId();
	const now = Math.floor(Date.now() / 1000);

	// Collect all participants (excluding the bot)
	const participants = [...new Set([email.from, ...email.to, ...email.cc])]
		.map(normalizeEmail)
		.filter((e) => e !== normalizeEmail(botEmail));

	// Create conversation record
	await env.DB.prepare(
		`INSERT INTO conversations
     (id, owner_email, thread_id, latest_message_id, subject, participants, status, last_activity, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)`
	)
		.bind(
			conversationId,
			ownerEmail,
			email.messageId,
			email.messageId,
			email.subject,
			JSON.stringify(participants),
			now,
			now,
			now
		)
		.run();

	// Delegate to Durable Object for AI processing
	const doId = env.SCHEDULING_AGENT.idFromName(conversationId);
	const stub = env.SCHEDULING_AGENT.get(doId);

	// Determine who to reply to (participants excluding the owner and bot)
	const replyTo = participants.filter(
		(p) => normalizeEmail(p) !== normalizeEmail(ownerEmail)
	);

	// Send to DO for async processing
	ctx.waitUntil(
		stub.fetch(
			new Request('https://internal/process', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'new_conversation',
					conversationId,
					email: {
						from: email.from,
						to: email.to.map(normalizeEmail),
						cc: email.cc.map(normalizeEmail),
						subject: email.subject,
						body: email.textBody,
						messageId: email.messageId,
					},
					ownerEmail,
					botEmail,
					participants,
					replyTo: replyTo.length > 0 ? replyTo : [normalizeEmail(email.from)],
				}),
			})
		)
	);
}

/**
 * Handle a reply to an existing conversation
 */
async function handleExistingConversation(
	conversation: ConversationRow,
	email: ParsedEmail,
	ownerEmail: string,
	env: Env,
	ctx: ExecutionContext
): Promise<void> {
	const now = Math.floor(Date.now() / 1000);

	// Update conversation with latest message info
	await env.DB.prepare(
		`UPDATE conversations
     SET latest_message_id = ?, last_activity = ?, updated_at = ?
     WHERE id = ?`
	)
		.bind(email.messageId, now, now, conversation.id)
		.run();

	// Delegate to Durable Object for processing the reply
	const doId = env.SCHEDULING_AGENT.idFromName(conversation.id);
	const stub = env.SCHEDULING_AGENT.get(doId);

	ctx.waitUntil(
		stub.fetch(
			new Request('https://internal/process', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'process_reply',
					conversationId: conversation.id,
					email: {
						from: email.from,
						subject: email.subject,
						body: email.textBody,
						messageId: email.messageId,
					},
					currentStatus: conversation.status,
					proposedSlots: conversation.proposed_slots
						? JSON.parse(conversation.proposed_slots)
						: null,
				}),
			})
		)
	);
}

/**
 * Log email to database for debugging/auditing
 */
async function logEmail(
	email: ParsedEmail,
	conversationId: string | null,
	direction: 'inbound' | 'outbound',
	env: Env
): Promise<void> {
	try {
		await env.DB.prepare(
			`INSERT INTO email_log
       (id, conversation_id, direction, from_email, to_emails, cc_emails, subject, message_id, in_reply_to, references_header, body_preview)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
			.bind(
				generateId(),
				conversationId,
				direction,
				email.from,
				JSON.stringify(email.to),
				JSON.stringify(email.cc),
				email.subject,
				email.messageId,
				email.inReplyTo,
				email.references,
				email.textBody.substring(0, 500)
			)
			.run();
	} catch (error) {
		console.error('[Email] Failed to log email:', error);
	}
}

/**
 * Convert ReadableStream to ArrayBuffer
 */
async function streamToArrayBuffer(stream: ReadableStream): Promise<ArrayBuffer> {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
	}

	const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}

	return result.buffer;
}
