// AI Service - Anthropic Claude integration for email analysis and response generation

import Anthropic from '@anthropic-ai/sdk';
import type { Env, EmailAnalysis, TimeSlot } from '../types';

/**
 * Strip markdown code blocks from Claude's response
 */
function stripMarkdownCodeBlocks(text: string): string {
	// Remove ```json ... ``` or ``` ... ``` wrappers
	return text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}

/**
 * Get Anthropic client with optional AI Gateway routing
 */
function getAnthropicClient(env: Env): Anthropic {
	// If AI Gateway is configured, route through it
	if (env.AI_GATEWAY_ACCOUNT_ID && env.AI_GATEWAY_ID) {
		return new Anthropic({
			apiKey: env.ANTHROPIC_API_KEY,
			baseURL: `https://gateway.ai.cloudflare.com/v1/${env.AI_GATEWAY_ACCOUNT_ID}/${env.AI_GATEWAY_ID}/anthropic`,
		});
	}

	// Direct Anthropic API
	return new Anthropic({
		apiKey: env.ANTHROPIC_API_KEY,
	});
}

/**
 * Analyze an email to determine if it's a scheduling request
 * and extract relevant information
 */
export async function analyzeEmail(
	body: string,
	subject: string,
	env: Env
): Promise<EmailAnalysis> {
	const client = getAnthropicClient(env);

	const systemPrompt = `You are a scheduling assistant analyzing emails to determine if they are meeting requests.

Your task is to analyze the email and extract:
1. Whether this is a scheduling/meeting request
2. The proposed meeting title/topic
3. Suggested meeting duration (default to 30 minutes if not specified)
4. Any time preferences mentioned (day of week, time of day)
5. If the user is specifying or confirming a SPECIFIC date and time
6. List of participants to invite
7. Urgency level

IMPORTANT: Look at BOTH the subject line AND the body for scheduling context.
- The subject often contains the meeting request (e.g., "Let's meet Friday at 10am")
- The body might just be a short reply like "Cool", "Sounds good", "Let's do it"
- If the subject mentions a specific day/time, extract that even if the body doesn't repeat it

Today's date is ${new Date().toISOString().split('T')[0]}.

Respond with a JSON object only, no markdown formatting.`;

	const userPrompt = `Analyze this email:

Subject: ${subject}

Body:
${body}

Respond with JSON in this exact format:
{
  "isSchedulingRequest": true/false,
  "meetingTitle": "string or null",
  "suggestedDuration": number (minutes) or null,
  "preferredTimes": ["array of time preferences mentioned"],
  "preferredDay": "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday" | "tomorrow" | "next_week" | null,
  "preferredTimeOfDay": "morning" | "afternoon" | "evening" | null,
  "specificDateTime": "ISO 8601 datetime string if user specified exact date AND time, otherwise null",
  "isConfirmingTime": true/false,
  "participants": ["array of email addresses mentioned"],
  "urgency": "low" | "medium" | "high",
  "additionalContext": "any other relevant context or null"
}

IMPORTANT:
- Extract preferredDay if the email mentions a specific day like "Monday", "let's meet Tuesday", "next week", "tomorrow", etc.
- Extract preferredTimeOfDay if they mention "morning", "afternoon", "after lunch", "evening", etc.
- Set specificDateTime to a full ISO 8601 datetime (e.g., "2025-01-09T10:00:00") if the user specifies BOTH a date AND a time (e.g., "10:00 AM on Friday, January 9th", "let's do 2pm tomorrow"). Use the current year if not specified.
- Set isConfirmingTime to true if the user is clearly agreeing to or confirming a specific time (e.g., "10:00 AM works great", "that time works for me", "yes, let's do Friday at 3pm").`;

	try {
		const response = await client.messages.create({
			model: 'claude-sonnet-4-20250514',
			max_tokens: 1024,
			messages: [
				{
					role: 'user',
					content: userPrompt,
				},
			],
			system: systemPrompt,
		});

		// Extract text content from response
		const textContent = response.content.find((c) => c.type === 'text');
		if (!textContent || textContent.type !== 'text') {
			throw new Error('No text response from Claude');
		}

		// Parse JSON response (strip markdown if present)
		const analysis = JSON.parse(stripMarkdownCodeBlocks(textContent.text)) as EmailAnalysis;
		return analysis;
	} catch (error) {
		console.error('[AI] Error analyzing email:', error);

		// Return default analysis on error
		return {
			isSchedulingRequest: true, // Assume it is to be safe
			meetingTitle: subject,
			suggestedDuration: 30,
			preferredTimes: [],
			preferredDay: null,
			preferredTimeOfDay: null,
			specificDateTime: null,
			isConfirmingTime: false,
			participants: [],
			urgency: 'medium',
			additionalContext: null,
		};
	}
}

/**
 * Generate a proposal email with available time slots
 */
export async function generateProposalEmail(
	slots: TimeSlot[],
	meetingTitle: string,
	participants: string[],
	env: Env,
	isFollowUp: boolean = false
): Promise<{ text: string; html: string }> {
	const client = getAnthropicClient(env);

	const systemPrompt = `You are a friendly, efficient personal scheduling assistant. Your job is to help coordinate meetings seamlessly.
Write in a warm, conversational tone - like a helpful colleague, not a robot. Be brief and get to the point.`;

	const userPrompt = isFollowUp 
		? `Write a very brief follow-up email proposing NEW meeting times (the person asked for different times):

${slots.map((slot, i) => `${i + 1}. ${slot.label}`).join('\n')}

REQUIREMENTS:
1. Do NOT start with "Hi" or any greeting - this is a continuation of an ongoing conversation
2. Start directly with something like "Sure!" or "No problem!" or "Of course!"
3. List the numbered time options clearly
4. Keep it very short - just acknowledge their request and show the new times
5. No sign-off needed, or just a brief "Let me know!"
6. Keep it under 50 words total
7. Sound natural, like a quick reply in an ongoing conversation

Return JSON: {"text": "...", "html": "..."}`
		: `Write a brief email proposing these meeting times for "${meetingTitle}":

${slots.map((slot, i) => `${i + 1}. ${slot.label}`).join('\n')}

REQUIREMENTS:
1. Start with a friendly greeting (just "Hi!" or "Hey!" - no need to introduce yourself by name)
2. Briefly mention you're helping coordinate this meeting
3. List the numbered time options clearly
4. Ask them to reply with their preferred number OR suggest a different time if none work
5. End with a friendly, brief sign-off
6. Keep it under 100 words total
7. Sound like a helpful human assistant, not a corporate bot

Return JSON: {"text": "...", "html": "..."}`;


	try {
		const response = await client.messages.create({
			model: 'claude-sonnet-4-20250514',
			max_tokens: 1024,
			messages: [
				{
					role: 'user',
					content: userPrompt,
				},
			],
			system: systemPrompt,
		});

		const textContent = response.content.find((c) => c.type === 'text');
		if (!textContent || textContent.type !== 'text') {
			throw new Error('No text response from Claude');
		}

		const result = JSON.parse(stripMarkdownCodeBlocks(textContent.text));
		return {
			text: result.text,
			html: result.html || result.text.replace(/\n/g, '<br>'),
		};
	} catch (error) {
		console.error('[AI] Error generating proposal email:', error);

		// Fallback to template
		const text = isFollowUp
			? `Sure! Here are the available times:

${slots.map((slot, i) => `${i + 1}. ${slot.label}`).join('\n')}

Let me know which works!`
			: `Hi!

I'm helping coordinate a time for "${meetingTitle}". Here are some options that work:

${slots.map((slot, i) => `${i + 1}. ${slot.label}`).join('\n')}

Just reply with the number that works best, or let me know if you'd prefer a different time!

Cheers`;

		return {
			text,
			html: text.replace(/\n/g, '<br>'),
		};
	}
}

/**
 * Generate a confirmation email after meeting is booked
 */
export async function generateConfirmationEmail(
	slot: TimeSlot,
	meetingTitle: string,
	calendarLink: string | null,
	env: Env
): Promise<{ text: string; html: string }> {
	const client = getAnthropicClient(env);

	const systemPrompt = `You are a friendly personal scheduling assistant. Write in a warm, casual tone - like a helpful colleague confirming plans. Be brief and genuine.`;

	const userPrompt = `Write a very brief confirmation email for a meeting that's been scheduled:

Meeting: "${meetingTitle}"
Time: ${slot.label}
${calendarLink ? `Calendar Link: ${calendarLink}` : ''}

REQUIREMENTS:
1. Keep it super short (under 50 words)
2. Confirm the time clearly
3. ${calendarLink ? 'Mention the calendar invite was sent' : 'Mention a calendar invite is on the way'}
4. Sound casual and friendly, not corporate
5. End with something brief like "See you then!" - no formal sign-off
6. Do NOT say "Great news!" or similar clichés

Return JSON with "text" (plain text) and "html" (simple HTML) versions.`;

	try {
		const response = await client.messages.create({
			model: 'claude-sonnet-4-20250514',
			max_tokens: 1024,
			messages: [
				{
					role: 'user',
					content: userPrompt,
				},
			],
			system: systemPrompt,
		});

		const textContent = response.content.find((c) => c.type === 'text');
		if (!textContent || textContent.type !== 'text') {
			throw new Error('No text response from Claude');
		}

		const result = JSON.parse(stripMarkdownCodeBlocks(textContent.text));
		return {
			text: result.text,
			html: result.html || result.text.replace(/\n/g, '<br>'),
		};
	} catch (error) {
		console.error('[AI] Error generating confirmation email:', error);

		// Fallback to template
		const text = `All set! ${meetingTitle} is booked for ${slot.label}.

${calendarLink ? `Calendar invite sent.` : "Calendar invite on the way."}

See you then!`;

		return {
			text,
			html: text.replace(/\n/g, '<br>'),
		};
	}
}

/**
 * Interpret an ambiguous reply to determine user intent
 */
export async function interpretReply(
	reply: string,
	context: {
		proposedSlots: TimeSlot[];
		conversationHistory: Array<{ role: string; content: string }>;
		isScheduled?: boolean; // Whether meeting is already booked
		selectedSlot?: TimeSlot | null; // The booked slot if scheduled
	},
	env: Env
): Promise<{
	intent: 'select_slot' | 'request_different_day' | 'suggest_alternative' | 'decline' | 'cancel' | 'reschedule' | 'clarification' | 'thanks' | 'unknown';
	selectedSlotIndex?: number;
	suggestedTime?: string;
	requestedDay?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' | 'tomorrow' | 'next_week';
	requestedTimeOfDay?: 'morning' | 'afternoon' | 'evening';
	message?: string;
}> {
	const client = getAnthropicClient(env);

	const systemPrompt = `You are analyzing a reply to determine the user's scheduling intent.
Today's date is ${new Date().toISOString().split('T')[0]}.
You MUST respond with valid JSON only. No explanations, no markdown, just the JSON object.`;

	const scheduledContext = context.isScheduled && context.selectedSlot
		? `\n\nIMPORTANT: A meeting is ALREADY SCHEDULED for ${context.selectedSlot.label}. The user may be asking to cancel or reschedule it.`
		: '';

	// Extract days from proposed slots to help detect if user wants different day
	const proposedDays = context.proposedSlots.map(s => s.label.toLowerCase());

	const userPrompt = `A user received these time slot proposals:
${context.proposedSlots.map((slot, i) => `${i + 1}. ${slot.label}`).join('\n')}${scheduledContext}

Their reply was:
"${reply}"

Determine their intent. Respond with ONLY this JSON structure (no other text):
{
  "intent": "select_slot" | "request_different_day" | "suggest_alternative" | "decline" | "cancel" | "reschedule" | "clarification" | "thanks" | "unknown",
  "selectedSlotIndex": number (0-indexed, only if intent is "select_slot"),
  "requestedDay": "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday" | "tomorrow" | "next_week" | null,
  "requestedTimeOfDay": "morning" | "afternoon" | "evening" | null,
  "suggestedTime": "specific time if mentioned, e.g. '2pm' or '10:00 AM'",
  "message": "brief explanation of what user wants"
}

CRITICAL RULES:

1. ALWAYS extract requestedDay if the user mentions ANY day of the week (Monday, Tuesday, Wednesday, etc.), even if they're:
   - Correcting the bot ("I suggested Wednesday", "I said Thursday")
   - Repeating their preference ("Wednesday at 10am", "I meant Tuesday")
   - Expressing frustration about wrong day ("Not Monday - Wednesday!")

2. If the user mentions a day that's DIFFERENT from the proposed slots, set intent to "request_different_day".
   The proposed slots are for: ${proposedDays.join(', ')}

3. ALWAYS extract suggestedTime if the user mentions a specific time (10am, 2pm, 11:00, etc.)

4. ALWAYS extract requestedTimeOfDay if they mention morning/afternoon/evening

INTENT CLASSIFICATION:
- "select_slot": User is choosing one of the proposed slots (e.g., "option 1", "the 10am works", "#2")
- "request_different_day": User mentions or asks for a DIFFERENT day than what was proposed (e.g., "I suggested Wednesday", "what about Tuesday?", "Wednesday 10am" when Monday was proposed)
- "suggest_alternative": User suggests a specific time not in the list without mentioning a different day
- "decline": User declines entirely
- "cancel": User wants to CANCEL an already scheduled meeting
- "reschedule": User wants to MOVE an already scheduled meeting
- "thanks": User is just saying thank you after booking
- "clarification": User is asking a question
- "unknown": Can't determine intent`;

	try {
		const response = await client.messages.create({
			model: 'claude-sonnet-4-20250514',
			max_tokens: 512,
			messages: [
				{
					role: 'user',
					content: userPrompt,
				},
			],
			system: systemPrompt,
		});

		const textContent = response.content.find((c) => c.type === 'text');
		if (!textContent || textContent.type !== 'text') {
			throw new Error('No text response from Claude');
		}

		return JSON.parse(stripMarkdownCodeBlocks(textContent.text));
	} catch (error) {
		console.error('[AI] Error interpreting reply:', error);
		return { intent: 'unknown' };
	}
}
