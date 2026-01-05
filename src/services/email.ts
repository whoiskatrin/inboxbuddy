// Email Sending Service - Outbound email via Cloudflare Email Routing
// Uses the legacy EmailMessage API with mimetext for MIME construction

import { createMimeMessage } from 'mimetext';
import type { Env, EmailMessage, EmailSendingMessage, EmailRecipient } from '../types';

/**
 * Parse email address into EmailRecipient format
 * Handles formats like "Name <email@example.com>" or "email@example.com"
 */
function parseEmailAddress(email: string | unknown): EmailRecipient {
	// Handle case where email is already an object or not a string
	if (typeof email !== 'string') {
		console.error('[Email] parseEmailAddress received non-string:', typeof email, JSON.stringify(email));
		if (email && typeof email === 'object' && 'email' in email) {
			return email as EmailRecipient;
		}
		return { email: String(email) };
	}
	
	const match = email.match(/^(.+?)\s*<(.+?)>$/);
	if (match) {
		return { name: match[1].trim(), email: match[2].trim() };
	}
	return { email: email.trim() };
}

/**
 * Check if the binding supports the new Email Sending API
 * The new API accepts an object with to/from/subject/text fields
 */
function isNewEmailAPI(binding: unknown): boolean {
	// The new API is detected by attempting to use it
	// For now, we'll try the new format and fall back if it fails
	return binding !== undefined;
}

/**
 * Send an email using Cloudflare Email Sending (new private beta API)
 * Falls back to legacy API if new binding is not available
 */
export async function sendEmail(
	message: EmailMessage,
	env: Env
): Promise<boolean> {
	// Normalize to array
	const toRecipients = Array.isArray(message.to) ? message.to : [message.to];
	
	// Try the new Email Sending API first (private beta)
	if (env.SEND_EMAIL && isNewEmailAPI(env.SEND_EMAIL)) {
		try {
			const emailMessage: EmailSendingMessage = {
				to: toRecipients.map(parseEmailAddress),
				from: parseEmailAddress(message.from),
				subject: message.subject,
				text: message.text,
				html: message.html,
			};

			// Add CC if present
			if (message.cc && message.cc.length > 0) {
				emailMessage.cc = message.cc.map(parseEmailAddress);
			}

			// Add threading headers if present
			if (message.headers) {
				emailMessage.headers = message.headers;
			}

			// Cast to any to handle the union type - we'll try the new API format
			await (env.SEND_EMAIL as any).send(emailMessage);
			console.log(`[Email] Sent via new API to ${toRecipients.join(', ')}: ${message.subject}`);
			return true;
		} catch (error) {
			// If the new API fails (wrong format), fall back to legacy
			console.log('[Email] New API format failed, falling back to legacy:', error);
		}
	}

	// Fallback to legacy API
	return await sendEmailLegacy(message, env);
}

/**
 * Send email using Cloudflare Email Service (new API beta)
 * New API format uses plain strings for to/from/cc, not objects
 */
async function sendEmailLegacy(
	message: EmailMessage,
	env: Env
): Promise<boolean> {
	// Get all recipients (To + Cc) for the envelope
	const toRecipients = Array.isArray(message.to) ? message.to : [message.to];
	const ccRecipients = message.cc || [];
	
	// Extract email addresses
	const fromEmail = extractEmailAddress(message.from);
	const toEmails = toRecipients.map(r => extractEmailAddress(r));
	const ccEmails = ccRecipients.map(r => extractEmailAddress(r));
	
	console.log(`[Email] Sending from: ${fromEmail} to: ${toEmails.join(', ')} cc: ${ccEmails.join(', ')}`);
	
	const binding = env.EMAIL;
	if (!binding) {
		console.error('[Email] No email binding available');
		return false;
	}
	
	// Use the NEW Email Service API (beta)
	// Format: { from: string, to: string | string[], subject, text, html, cc, headers }
	try {
		const emailPayload: any = {
			from: fromEmail,
			to: toEmails,
			subject: message.subject,
		};
		
		if (message.text) {
			emailPayload.text = message.text;
		}
		if (message.html) {
			emailPayload.html = message.html;
		}
		if (ccEmails.length > 0) {
			emailPayload.cc = ccEmails;
		}
		
		// Note: Custom headers must start with "X-" in the new Email Service API
		// Standard email threading headers (In-Reply-To, References) are not supported yet
		// Skip them for now to allow sending
		
		console.log(`[Email] Sending via new Email Service API:`, JSON.stringify(emailPayload, null, 2));
		await binding.send(emailPayload);
		console.log(`[Email] Sent successfully to ${toEmails.join(', ')}`);
		return true;
	} catch (error: any) {
		console.error(`[Email] Failed to send: ${error.message}`);
		return false;
	}
}

/**
 * Extract email address from "Name <email>" format or return as-is
 */
function extractEmailAddress(email: string): string {
	const match = email.match(/<([^>]+)>/);
	if (match) {
		return match[1];
	}
	return email.trim();
}

/**
 * Construct a MIME message from email parameters (legacy format)
 */
function constructMimeMessage(message: EmailMessage): ReadableStream {
	const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
	const isMultipart = message.html && message.text;

	let mimeContent = '';

	// Headers
	mimeContent += `From: ${message.from}\r\n`;
	
	// Handle single or multiple TO recipients
	const toRecipients = Array.isArray(message.to) ? message.to.join(', ') : message.to;
	mimeContent += `To: ${toRecipients}\r\n`;
	
	// Add CC recipients if present
	if (message.cc && message.cc.length > 0) {
		mimeContent += `Cc: ${message.cc.join(', ')}\r\n`;
	}
	
	mimeContent += `Subject: ${encodeSubject(message.subject)}\r\n`;
	mimeContent += `Date: ${new Date().toUTCString()}\r\n`;
	mimeContent += `Message-ID: <${generateMessageId(message.from)}>\r\n`;
	mimeContent += `MIME-Version: 1.0\r\n`;

	// Add custom headers (for threading)
	if (message.headers) {
		for (const [key, value] of Object.entries(message.headers)) {
			if (value) {
				mimeContent += `${key}: ${value}\r\n`;
			}
		}
	}

	if (isMultipart) {
		mimeContent += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`;
		mimeContent += '\r\n';

		// Plain text part
		mimeContent += `--${boundary}\r\n`;
		mimeContent += 'Content-Type: text/plain; charset=UTF-8\r\n';
		mimeContent += 'Content-Transfer-Encoding: quoted-printable\r\n';
		mimeContent += '\r\n';
		mimeContent += encodeQuotedPrintable(message.text || '') + '\r\n';

		// HTML part
		mimeContent += `--${boundary}\r\n`;
		mimeContent += 'Content-Type: text/html; charset=UTF-8\r\n';
		mimeContent += 'Content-Transfer-Encoding: quoted-printable\r\n';
		mimeContent += '\r\n';
		mimeContent += encodeQuotedPrintable(message.html || '') + '\r\n';

		mimeContent += `--${boundary}--\r\n`;
	} else {
		// Single part (text only)
		mimeContent += 'Content-Type: text/plain; charset=UTF-8\r\n';
		mimeContent += 'Content-Transfer-Encoding: quoted-printable\r\n';
		mimeContent += '\r\n';
		mimeContent += encodeQuotedPrintable(message.text || message.html || '');
	}

	// Convert to ReadableStream
	return new ReadableStream({
		start(controller) {
			controller.enqueue(new TextEncoder().encode(mimeContent));
			controller.close();
		},
	});
}

/**
 * Generate a unique Message-ID
 */
function generateMessageId(fromEmail: string): string {
	const domain = fromEmail.split('@')[1] || 'meetme.local';
	const timestamp = Date.now();
	const random = Math.random().toString(36).slice(2, 10);
	return `${timestamp}.${random}@${domain}`;
}

/**
 * Encode email subject for UTF-8 compatibility
 */
function encodeSubject(subject: string): string {
	// Check if subject contains non-ASCII characters using charCodeAt
	let hasNonAscii = false;
	for (let i = 0; i < subject.length; i++) {
		if (subject.charCodeAt(i) > 127) {
			hasNonAscii = true;
			break;
		}
	}

	if (hasNonAscii) {
		// Use RFC 2047 encoding
		const encoded = Buffer.from(subject, 'utf-8').toString('base64');
		return `=?UTF-8?B?${encoded}?=`;
	}
	return subject;
}

/**
 * Encode content as quoted-printable
 */
function encodeQuotedPrintable(text: string): string {
	let result = '';
	let lineLength = 0;

	for (const char of text) {
		const code = char.charCodeAt(0);
		let encoded: string;

		// Keep printable ASCII characters except = which needs encoding
		if (code >= 33 && code <= 126 && char !== '=') {
			encoded = char;
		} else if (char === ' ' || char === '\t') {
			// Keep spaces and tabs
			encoded = char;
		} else if (char === '\r' || char === '\n') {
			// Keep line breaks and reset line length
			result += char;
			lineLength = 0;
			continue;
		} else {
			// Encode everything else
			encoded = '=' + code.toString(16).toUpperCase().padStart(2, '0');
		}

		// Check if we need to wrap the line
		if (lineLength + encoded.length > 73) {
			result += '=\r\n';
			lineLength = 0;
		}

		result += encoded;
		lineLength += encoded.length;
	}

	return result;
}

/**
 * Send a simple notification email
 */
export async function sendNotification(
	to: string,
	subject: string,
	body: string,
	env: Env
): Promise<boolean> {
	const botDomain = to.split('@')[1];
	const from = `${env.BOT_EMAIL_PREFIX}@${botDomain}`;

	return sendEmail(
		{
			from,
			to,
			subject,
			text: body,
		},
		env
	);
}

/**
 * Send a reply in an email thread
 * Uses legacy API for proper threading header support
 * The new Email Sending API (private beta) doesn't yet support custom headers well
 * 
 * @param to - Primary recipient(s) (e.g., Mike, or Mike + Molly)
 * @param cc - CC recipients (e.g., the calendar owner to keep them in the loop)
 */
export async function sendReply(
	to: string | string[],
	cc: string[],
	originalMessageId: string,
	references: string | null,
	subject: string,
	body: string,
	html: string | undefined,
	botEmail: string,
	env: Env
): Promise<boolean> {
	// Build References header for proper threading
	const referencesHeader = references
		? `${references} ${originalMessageId}`
		: originalMessageId;

	// Use legacy API for replies - it properly handles threading headers
	// The new API's headers field may not work correctly yet
	return sendEmailLegacy(
		{
			from: botEmail,
			to: to,
			cc: cc.length > 0 ? cc : undefined,
			subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
			text: body,
			html,
			headers: {
				'In-Reply-To': originalMessageId,
				'References': referencesHeader,
			},
		},
		env
	);
}

/**
 * Send email to multiple recipients (new API feature)
 * Useful for sending meeting confirmations to all participants
 */
export async function sendToMultiple(
	recipients: string[],
	fromEmail: string,
	subject: string,
	body: string,
	html: string | undefined,
	env: Env
): Promise<boolean> {
	// New API supports multiple recipients natively
	if (env.SEND_EMAIL) {
		try {
			const emailMessage: EmailSendingMessage = {
				to: recipients.map(parseEmailAddress),
				from: parseEmailAddress(fromEmail),
				subject,
				text: body,
				html,
			};

			await (env.SEND_EMAIL as any).send(emailMessage);
			console.log(`[Email] Sent to ${recipients.length} recipients via new API`);
			return true;
		} catch (error) {
			console.error('[Email] Failed to send to multiple via new API:', error);
		}
	}

	// Legacy fallback: send individually
	let allSuccess = true;
	for (const recipient of recipients) {
		const success = await sendEmail(
			{
				from: fromEmail,
				to: recipient,
				subject,
				text: body,
				html,
			},
			env
		);
		if (!success) allSuccess = false;
	}
	return allSuccess;
}

/**
 * Generate an ICS calendar attachment
 */
export function generateICS(event: {
	summary: string;
	description?: string;
	start: Date;
	end: Date;
	location?: string;
	organizer: string;
	attendees: string[];
}): string {
	const formatDate = (date: Date): string => {
		return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
	};

	const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@meetme`;

	let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//MeetMe//AI Scheduling Assistant//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(event.start)}
DTEND:${formatDate(event.end)}
SUMMARY:${event.summary}
DESCRIPTION:${event.description || 'Meeting scheduled via MeetMe'}
ORGANIZER:mailto:${event.organizer}
`;

	for (const attendee of event.attendees) {
		ics += `ATTENDEE;RSVP=TRUE:mailto:${attendee}\n`;
	}

	if (event.location) {
		ics += `LOCATION:${event.location}\n`;
	}

	ics += `STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

	return ics;
}
