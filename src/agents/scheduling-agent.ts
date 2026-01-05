// SchedulingAgent - Agents SDK implementation for MeetMe
// This is the new implementation using Cloudflare's Agents SDK

import { Agent, type AgentEmail } from 'agents';
import PostalMime from 'postal-mime';
import type { ConversationStatus, TimeSlot, Env } from '../types';
import { analyzeEmail, generateProposalEmail, generateConfirmationEmail, interpretReply } from '../services/ai';
import { getFreeBusy, createCalendarEvent } from '../services/calendar';
import { generateTimeSlots, formatDateTimeShort, normalizeEmail, extractEmails, type SlotGenerationOptions } from '../utils/helpers';
import { sendReply } from '../services/email';

// Re-export routeAgentEmail for use in index.ts
export { routeAgentEmail, createAddressBasedEmailResolver } from 'agents';



// Parsed email content from AgentEmail
interface ParsedEmailContent {
	from: string;
	to: string[];
	cc: string[];
	subject: string;
	text: string;
	html: string | null;
	messageId: string;
	inReplyTo: string | null;
	references: string | null;
}

// Agent state structure
interface SchedulingState {
	conversationId: string;
	ownerEmail: string;
	botEmail: string;
	threadId: string;
	latestMessageId: string;
	subject: string;
	participants: string[];
	replyTo: string[]; // Who to send proposals/confirmations to (excludes owner)
	status: ConversationStatus;
	proposedSlots: TimeSlot[];
	selectedSlot: TimeSlot | null;
	meetingTitle: string | null;
	meetingDurationMinutes: number;
	preferredDay: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' | 'tomorrow' | 'next_week' | null;
	preferredTimeOfDay: 'morning' | 'afternoon' | 'evening' | null;
	processedMessageIds: string[]; // Track processed message IDs to prevent duplicates
	messages: Array<{
		role: 'user' | 'assistant';
		content: string;
		from: string;
		timestamp: number;
	}>;
}

// @ts-expect-error - Env type compatibility with Cloudflare.Env
export class SchedulingAgent extends Agent<Env, SchedulingState> {
	// Initial state for new conversations
	initialState: SchedulingState = {
		conversationId: '',
		ownerEmail: '',
		botEmail: '',
		threadId: '',
		latestMessageId: '',
		subject: '',
		participants: [],
		replyTo: [],
		status: 'new',
		proposedSlots: [],
		selectedSlot: null,
		meetingTitle: null,
		meetingDurationMinutes: 30,
		preferredDay: null,
		preferredTimeOfDay: null,
		processedMessageIds: [],
		messages: [],
	};

	/**
	 * Called when agent starts or wakes up
	 */
	async onStart() {
		console.log(`[SchedulingAgent] Started: ${this.state.conversationId || 'new'}`);
	}

	/**
	 * Parse raw email into structured content
	 */
	private async parseEmail(agentEmail: AgentEmail): Promise<ParsedEmailContent> {
		const rawBytes = await agentEmail.getRaw();
		const parser = new PostalMime();
		const parsed = await parser.parse(rawBytes);

		// Extract headers into a map
		const headers: Record<string, string> = {};
		for (const header of parsed.headers || []) {
			headers[header.key.toLowerCase()] = header.value;
		}
		
		// Debug: log raw values from agentEmail and parsed headers
		console.log(`[SchedulingAgent] agentEmail.from: ${agentEmail.from}`);
		console.log(`[SchedulingAgent] agentEmail.to (type: ${typeof agentEmail.to}): ${JSON.stringify(agentEmail.to)}`);
		console.log(`[SchedulingAgent] headers['to']: ${headers['to']}`);
		console.log(`[SchedulingAgent] headers['cc']: ${headers['cc']}`);
		console.log(`[SchedulingAgent] parsed.to: ${JSON.stringify(parsed.to)}`);
		
		// Use parsed.to which has full recipient list, not agentEmail.to which may only have the routed address
		const toHeader = headers['to'] || (typeof agentEmail.to === 'string' ? agentEmail.to : '');
		const ccHeader = headers['cc'] || '';

		return {
			from: normalizeEmail(agentEmail.from),
			to: extractEmails(toHeader),
			cc: extractEmails(ccHeader),
			subject: parsed.subject || '(no subject)',
			text: parsed.text || '',
			html: parsed.html || null,
			messageId: headers['message-id'] || `<${crypto.randomUUID()}@meetme>`,
			inReplyTo: headers['in-reply-to'] || null,
			references: headers['references'] || null,
		};
	}

	/**
	 * Handle incoming emails routed to this agent
	 * This is the Agents SDK lifecycle method for email handling
	 */
	async onEmail(agentEmail: AgentEmail) {
		try {
			console.log(`[SchedulingAgent] Email received from: ${agentEmail.from}`);

			// Parse the raw email
			const email = await this.parseEmail(agentEmail);
			
			// Debug: log parsed email details
			console.log(`[SchedulingAgent] Parsed email - from: ${email.from}, to: ${JSON.stringify(email.to)}, cc: ${JSON.stringify(email.cc)}, subject: ${email.subject}`);

			// Deduplication check - don't process the same message twice
			const processedIds = this.state.processedMessageIds || [];
			if (email.messageId && processedIds.includes(email.messageId)) {
				console.log(`[SchedulingAgent] Skipping duplicate message: ${email.messageId}`);
				return;
			}

			// Find the bot email in recipients
			const botEmail = this.findBotEmail([...email.to, ...email.cc]);
			if (!botEmail) {
				console.log('[SchedulingAgent] Bot email not found in recipients, checking if sent directly to bot');
				// The email might have been sent directly to the bot (not CC'd)
				// In this case, check if the 'to' field contains the bot
				console.log(`[SchedulingAgent] All recipients: to=${JSON.stringify(email.to)}, cc=${JSON.stringify(email.cc)}`);
				return;
			}
			console.log(`[SchedulingAgent] Bot email found: ${botEmail}`);

			// Find the owner (authenticated user)
			// First check if we have an existing conversation with owner info
			let ownerEmail: string | null = this.state.ownerEmail || null;
			
			if (!ownerEmail) {
				// New conversation - look up owner from email participants
				ownerEmail = await this.findOwnerEmail(email.from, email.to, email.cc, botEmail);
			}
			
			if (!ownerEmail) {
				console.log('[SchedulingAgent] No registered owner found');
				// TODO: Could send a response saying "No one has set up MeetMe on this domain yet"
				return;
			}
			console.log(`[SchedulingAgent] Owner found: ${ownerEmail}`);

			// Determine participants and who to reply to
			const allParticipants = [...new Set([email.from, ...email.to, ...email.cc])]
				.filter(e => e !== botEmail);
			const replyTo = allParticipants.filter(e => e !== ownerEmail);
			
			console.log(`[SchedulingAgent] All participants: ${JSON.stringify(allParticipants)}`);
			console.log(`[SchedulingAgent] Reply to (excluding owner): ${JSON.stringify(replyTo)}`);

			if (this.state.status === 'new' || !this.state.conversationId) {
				// New conversation
				await this.handleNewConversation(agentEmail, email, ownerEmail, botEmail, allParticipants, replyTo);
			} else {
				// Existing conversation - handle reply
				await this.handleReply(agentEmail, email);
			}
		} catch (error) {
			console.error('[SchedulingAgent] Error in onEmail:', error);
			// Log the full error stack if available
			if (error instanceof Error) {
				console.error('[SchedulingAgent] Error stack:', error.stack);
			}
			// Don't rethrow - let the email be accepted even if we can't process it
		}
	}

	/**
	 * Handle a new scheduling conversation
	 */
	private async handleNewConversation(
		agentEmail: AgentEmail,
		email: ParsedEmailContent,
		ownerEmail: string,
		botEmail: string,
		participants: string[],
		replyTo: string[]
	) {
		const conversationId = crypto.randomUUID();

		console.log(`[SchedulingAgent] New conversation: ${conversationId}`);

		// Update state (including marking this message as processed)
		this.setState({
			...this.state,
			conversationId,
			ownerEmail,
			botEmail,
			threadId: email.messageId,
			latestMessageId: email.messageId,
			subject: email.subject,
			participants,
			replyTo: replyTo.length > 0 ? replyTo : [email.from],
			status: 'parsing',
			processedMessageIds: [...(this.state.processedMessageIds || []), email.messageId],
			messages: [
				{
					role: 'user',
					content: email.text,
					from: email.from,
					timestamp: Date.now(),
				},
			],
		});

		// Save to D1
		await this.saveConversationToD1();

		// Analyze the email with Claude
		console.log(`[SchedulingAgent] Analyzing email - subject: "${email.subject}", body: "${email.text.slice(0, 200)}"`);
		const analysis = await analyzeEmail(email.text, email.subject, this.env);
		console.log(`[SchedulingAgent] AI analysis result: ${JSON.stringify(analysis)}`);

		if (!analysis.isSchedulingRequest) {
			await this.sendClarificationEmail(agentEmail, email);
			return;
		}

		// Update meeting details including day/time preferences
		// Trust AI's preferredDay extraction (don't override from specificDateTime - AI may miscalculate dates)
		const preferredDay = analysis.preferredDay || null;
		const preferredTimeOfDay = analysis.preferredTimeOfDay || null;
		const durationMinutes = analysis.suggestedDuration || 30;

		this.setState({
			...this.state,
			meetingTitle: analysis.meetingTitle || email.subject,
			meetingDurationMinutes: durationMinutes,
			preferredDay,
			preferredTimeOfDay,
		});

		console.log(`[SchedulingAgent] Preferred day: ${preferredDay}, time of day: ${preferredTimeOfDay}, specificDateTime: ${analysis.specificDateTime}`);

		// Check if user specified an exact time - if so, try to book it directly
		if (analysis.specificDateTime && analysis.isConfirmingTime) {
			const requestedTime = new Date(analysis.specificDateTime);

			// Adjust for the correct day if AI miscalculated the date
			// Use preferredDay to find the correct date
			if (preferredDay && !isNaN(requestedTime.getTime())) {
				const correctedTime = this.getCorrectDateForDay(requestedTime, preferredDay);
				const isAvailable = await this.checkSlotAvailability(correctedTime, durationMinutes);

				console.log(`[SchedulingAgent] User requested specific time: ${correctedTime.toISOString()}, available: ${isAvailable}`);

				if (isAvailable) {
					// Book directly! Use user's timezone for correct display
					const userTimezone = await this.getUserTimezone();
					const slot = this.formatSingleSlotWithTimezone(correctedTime, durationMinutes, userTimezone);
					await this.handleSlotConfirmation(slot, agentEmail, email);
					return;
				}
				// Not available - fall through to offer alternatives
				console.log(`[SchedulingAgent] Requested time not available, offering alternatives`);
			}
		}

		// Get owner's calendar availability
		const availability = await this.getOwnerAvailability();

		if (availability.length === 0) {
			await this.sendNoAvailabilityEmail(agentEmail, email);
			return;
		}

		// Generate proposed time slots
		const proposedSlots = this.formatTimeSlots(availability);

		this.setState({
			...this.state,
			proposedSlots,
			status: 'proposed',
		});

		// Update D1
		await this.updateConversationInD1();

		// Generate and send proposal email
		const proposalEmail = await generateProposalEmail(
			proposedSlots,
			this.state.meetingTitle || email.subject,
			this.state.participants,
			this.env
		);

		// Send proposal to external participants (not the owner)
		// The owner is always CCed to stay in the loop
		const toRecipients = this.state.replyTo; // External participants (excludes owner)
		const ccRecipients = [this.state.ownerEmail]; // Always CC the owner

		console.log(`[SchedulingAgent] Sending proposal to: ${toRecipients.join(', ')} CC: ${ccRecipients.join(', ')}`);

		await sendReply(
			toRecipients,
			ccRecipients,
			email.messageId,
			email.references,
			email.subject,
			proposalEmail.text,
			proposalEmail.html,
			this.state.botEmail,
			this.env
		);

		// Add assistant message to history
		this.setState({
			...this.state,
			messages: [
				...this.state.messages,
				{
					role: 'assistant',
					content: proposalEmail.text,
					from: this.state.botEmail,
					timestamp: Date.now(),
				},
			],
		});

		// Schedule a reminder for 48 hours
		await this.schedule(48 * 60 * 60, 'sendReminder', { conversationId: this.state.conversationId });
	}

	/**
	 * Handle a reply to an existing conversation
	 */
	private async handleReply(agentEmail: AgentEmail, email: ParsedEmailContent) {
		console.log(`[SchedulingAgent] Processing reply for: ${this.state.conversationId}`);

		// Recalculate replyTo from current email participants (in case state is stale)
		const allCurrentParticipants = [...new Set([email.from, ...email.to, ...email.cc])]
			.filter(e => e !== this.state.botEmail);
		const currentReplyTo = allCurrentParticipants.filter(e => e !== this.state.ownerEmail);
		
		// Update replyTo if we found external participants
		const updatedReplyTo = currentReplyTo.length > 0 ? currentReplyTo : this.state.replyTo;
		console.log(`[SchedulingAgent] Updated replyTo for this reply: ${JSON.stringify(updatedReplyTo)}`);

		// Update state with new message and potentially updated replyTo (also track this message as processed)
		this.setState({
			...this.state,
			latestMessageId: email.messageId,
			replyTo: updatedReplyTo,
			processedMessageIds: [...(this.state.processedMessageIds || []), email.messageId],
			messages: [
				...this.state.messages,
				{
					role: 'user',
					content: email.text,
					from: email.from,
					timestamp: Date.now(),
				},
			],
		});

		console.log(`[SchedulingAgent] handleReply - status: ${this.state.status}, proposedSlots: ${this.state.proposedSlots?.length || 0}`);
		
		if (this.state.status === 'proposed' || this.state.status === 'awaiting_confirmation') {
			// Try to parse a selection from the reply
			const selection = this.parseSlotSelection(email.text, this.state.proposedSlots);
			console.log(`[SchedulingAgent] Slot selection result: ${selection ? selection.label : 'null'}`);

			if (selection) {
				await this.handleSlotConfirmation(selection, agentEmail, email);
			} else {
				// Use AI to interpret the reply
				const interpretation = await interpretReply(
					email.text,
					{
						proposedSlots: this.state.proposedSlots,
						conversationHistory: this.state.messages.map(m => ({
							role: m.role,
							content: m.content,
						})),
					},
					this.env
				);

				console.log(`[SchedulingAgent] AI interpretation: ${JSON.stringify(interpretation)}`);

				// Handle request for different day FIRST - this takes priority
				// The AI now detects when user mentions a day different from proposed slots
				if (interpretation.intent === 'request_different_day' && interpretation.requestedDay) {
					console.log(`[SchedulingAgent] Detected request for different day: ${interpretation.requestedDay}`);
					await this.handleDifferentDayRequest(
						interpretation.requestedDay,
						interpretation.requestedTimeOfDay || null,
						agentEmail,
						email
					);
					return;
				}

				// Also check if AI extracted a requestedDay even with different intent
				// This handles cases like "I suggested Wednesday" that might be classified differently
				if (interpretation.requestedDay) {
					// Check if this day is different from our proposed slots (case-insensitive)
					const proposedDayLabels = this.state.proposedSlots.map(s => s.label.toLowerCase());
					const requestedDayLower = interpretation.requestedDay.toLowerCase();
					const isDifferentDay = !proposedDayLabels.some(label =>
						label.includes(requestedDayLower)
					);

					if (isDifferentDay) {
						console.log(`[SchedulingAgent] User mentioned different day (${interpretation.requestedDay}), switching to that day`);
						await this.handleDifferentDayRequest(
							interpretation.requestedDay,
							interpretation.requestedTimeOfDay || null,
							agentEmail,
							email
						);
						return;
					}
				}

				if (interpretation.intent === 'select_slot' && interpretation.selectedSlotIndex !== undefined) {
					const slot = this.state.proposedSlots[interpretation.selectedSlotIndex];
					if (slot) {
						console.log(`[SchedulingAgent] Confirming slot selection: ${slot.label}`);
						await this.handleSlotConfirmation(slot, agentEmail, email);
						return;
					}
				}

				if (interpretation.intent === 'suggest_alternative' && interpretation.suggestedTime) {
					// User suggested a specific time - try to parse and check availability
					// For now, just acknowledge and ask them to be more specific
					await this.sendAlternativeTimeResponse(interpretation.suggestedTime, agentEmail, email);
					return;
				}

				if (interpretation.intent === 'decline') {
					// User declined - acknowledge
					await this.handleDecline(agentEmail, email);
					return;
				}

				// Couldn't understand - ask for clarification
				await this.sendSlotClarificationEmail(agentEmail, email);
			}
		} else if (this.state.status === 'scheduled') {
			// Meeting already scheduled - handle post-schedule replies
			await this.handlePostScheduleReply(agentEmail, email);
		}
	}

	/**
	 * Handle confirmed slot selection
	 */
	private async handleSlotConfirmation(
		slot: TimeSlot,
		agentEmail: AgentEmail,
		email: ParsedEmailContent
	) {
		console.log(`[SchedulingAgent] Slot confirmed: ${slot.label}`);

		this.setState({
			...this.state,
			selectedSlot: slot,
			status: 'scheduled',
		});

		// Create calendar event
		const event = await createCalendarEvent(
			{
				summary: this.state.meetingTitle || this.state.subject,
				start: slot.start,
				end: slot.end,
				attendees: this.state.participants,
			},
			this.state.ownerEmail,
			this.env
		);

		// Update D1 with final status
		await this.env.DB.prepare(
			`UPDATE conversations
			 SET status = 'scheduled',
			     selected_slot = ?,
			     calendar_event_id = ?,
			     updated_at = ?
			 WHERE id = ?`
		)
			.bind(
				JSON.stringify({
					...slot,
					confirmedBy: email.from,
					confirmedAt: new Date().toISOString(),
				}),
				event?.id || null,
				Math.floor(Date.now() / 1000),
				this.state.conversationId
			)
			.run();

		// Generate and send confirmation email to all participants (except owner)
		const confirmationEmail = await generateConfirmationEmail(
			slot,
			this.state.meetingTitle || this.state.subject,
			event?.htmlLink || null,
			this.env
		);

		// Send confirmation to all participants (including sender who confirmed)
		const confirmTo = this.state.replyTo;
		const confirmCc = [this.state.ownerEmail];
		
		console.log(`[SchedulingAgent] Sending confirmation to: ${confirmTo.join(', ')} CC: ${confirmCc.join(', ')}`);
		await sendReply(
			confirmTo,
			confirmCc,
			email.messageId,
			email.references,
			this.state.subject,
			confirmationEmail.text,
			confirmationEmail.html,
			this.state.botEmail,
			this.env
		);

		// Cancel any pending reminders
		const schedules = this.getSchedules({ type: 'delayed' });
		for (const schedule of schedules) {
			await this.cancelSchedule(schedule.id);
		}
	}

	/**
	 * Scheduled task: Send reminder
	 */
	async sendReminder(data: { conversationId: string }) {
		if (this.state.status !== 'proposed' && this.state.status !== 'awaiting_confirmation') {
			return; // No longer needs reminder
		}

		// Check reminder count
		const conv = await this.env.DB.prepare('SELECT reminder_count FROM conversations WHERE id = ?')
			.bind(data.conversationId)
			.first() as { reminder_count: number } | null;

		if (conv && conv.reminder_count >= 2) {
			// Max reminders sent
			this.setState({ ...this.state, status: 'cancelled' });
			await this.updateConversationInD1();
			return;
		}

		const recipients = this.state.replyTo;
		const reminder = `Hi! Just following up on my earlier message about scheduling a meeting with ${this.state.ownerEmail}.

Here are the available times again:
${this.state.proposedSlots.map((slot, i) => `${i + 1}. ${slot.label}`).join('\n')}

Just reply with your preferred time, or let me know if none of these work.`;

		console.log(`[SchedulingAgent] Reminder - but cannot send without original email context`);

		// Update reminder count
		await this.env.DB.prepare(
			`UPDATE conversations
			 SET reminder_count = reminder_count + 1,
			     last_reminder_at = ?,
			     updated_at = ?
			 WHERE id = ?`
		)
			.bind(
				Math.floor(Date.now() / 1000),
				Math.floor(Date.now() / 1000),
				data.conversationId
			)
			.run();

		// Schedule next reminder
		await this.schedule(48 * 60 * 60, 'sendReminder', data);
	}

	// ===== Helper Methods =====

	private findBotEmail(recipients: string[]): string | null {
		const botPrefix = this.env.BOT_EMAIL_PREFIX.toLowerCase();
		for (const recipient of recipients) {
			const localPart = recipient.split('@')[0].toLowerCase();
			if (localPart === botPrefix) {
				return recipient;
			}
		}
		return null;
	}

	/**
	 * Extract day name from text
	 */
	private extractDayFromText(text: string): 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' | 'tomorrow' | 'next_week' | null {
		const lower = text.toLowerCase();
		if (lower.includes('monday')) return 'monday';
		if (lower.includes('tuesday')) return 'tuesday';
		if (lower.includes('wednesday')) return 'wednesday';
		if (lower.includes('thursday')) return 'thursday';
		if (lower.includes('friday')) return 'friday';
		if (lower.includes('saturday')) return 'saturday';
		if (lower.includes('sunday')) return 'sunday';
		if (lower.includes('tomorrow')) return 'tomorrow';
		if (lower.includes('next week')) return 'next_week';
		return null;
	}

	private async findOwnerEmail(
		from: string,
		to: string[],
		cc: string[],
		botEmail: string
	): Promise<string | null> {
		const allParticipants = [from, ...to, ...cc];

		for (const participant of allParticipants) {
			if (participant === botEmail) continue;

			const user = await this.env.DB.prepare(
				'SELECT email FROM users WHERE email = ? AND is_active = 1'
			)
				.bind(participant)
				.first() as { email: string } | null;

			if (user) return user.email;
		}

		return null;
	}

	private async getOwnerAvailability(): Promise<Date[]> {
		try {
			const user = await this.env.DB.prepare('SELECT * FROM users WHERE email = ?')
				.bind(this.state.ownerEmail)
				.first() as {
					timezone: string;
					working_hours_start: number;
					working_hours_end: number;
					working_days: string;
					include_weekends: number;
				} | null;

			const timezone = user?.timezone || this.env.TIMEZONE;
			const workingHoursStart = user?.working_hours_start || parseInt(this.env.WORKING_HOURS_START);
			const workingHoursEnd = user?.working_hours_end || parseInt(this.env.WORKING_HOURS_END);
			const workingDays = user?.working_days ? JSON.parse(user.working_days) : [1, 2, 3, 4, 5];
			const includeWeekends = user?.include_weekends === 1;

			console.log(`[SchedulingAgent] Getting availability for ${this.state.ownerEmail}`);
			console.log(`[SchedulingAgent] Settings: timezone=${timezone}, hours=${workingHoursStart}-${workingHoursEnd}, days=${JSON.stringify(workingDays)}, duration=${this.state.meetingDurationMinutes}`);
			console.log(`[SchedulingAgent] Preferences: preferredDay=${this.state.preferredDay}, preferredTimeOfDay=${this.state.preferredTimeOfDay}, includeWeekends=${includeWeekends}`);
			
			// Build slot generation options based on preferences
			const slotOptions: SlotGenerationOptions = {
				preferredDay: this.state.preferredDay,
				preferredTimeOfDay: this.state.preferredTimeOfDay,
				includeWeekends: includeWeekends,
			};
			
			const candidateSlots = generateTimeSlots(
				new Date(),
				timezone,
				workingHoursStart,
				workingHoursEnd,
				workingDays,
				this.state.meetingDurationMinutes,
				8, // Generate more candidates to filter
				slotOptions
			);
			
			console.log(`[SchedulingAgent] Generated ${candidateSlots.length} candidate slots`);

			if (candidateSlots.length === 0) {
				console.log(`[SchedulingAgent] No candidate slots found`);
				return [];
			}

			const timeMin = candidateSlots[0];
			const timeMax = new Date(
				candidateSlots[candidateSlots.length - 1].getTime() +
				this.state.meetingDurationMinutes * 60 * 1000
			);

			const freeBusy = await getFreeBusy(this.state.ownerEmail, timeMin, timeMax, this.env);
			console.log(`[SchedulingAgent] FreeBusy returned ${freeBusy.length} busy periods`);

			const availableSlots = candidateSlots.filter((slot) => {
				const slotEnd = new Date(slot.getTime() + this.state.meetingDurationMinutes * 60 * 1000);
				return !freeBusy.some((busy) => {
					const busyStart = new Date(busy.start);
					const busyEnd = new Date(busy.end);
					return slot < busyEnd && slotEnd > busyStart;
				});
			});

			console.log(`[SchedulingAgent] Found ${availableSlots.length} available slots after filtering`);
			return availableSlots.slice(0, 4);
		} catch (error) {
			console.error('[SchedulingAgent] Error getting availability:', error);
			return generateTimeSlots(
				new Date(),
				this.env.TIMEZONE,
				parseInt(this.env.WORKING_HOURS_START),
				parseInt(this.env.WORKING_HOURS_END),
				[1, 2, 3, 4, 5],
				this.state.meetingDurationMinutes,
				4,
				{ includeWeekends: false }
			);
		}
	}

	private async getUserTimezone(): Promise<string> {
		const user = await this.env.DB.prepare('SELECT timezone FROM users WHERE email = ?')
			.bind(this.state.ownerEmail)
			.first<{ timezone: string }>();
		return user?.timezone || this.env.TIMEZONE;
	}

	private formatTimeSlotsWithTimezone(dates: Date[], timezone: string): TimeSlot[] {
		return dates.map((date) => {
			const end = new Date(date.getTime() + this.state.meetingDurationMinutes * 60 * 1000);
			return {
				start: date.toISOString(),
				end: end.toISOString(),
				label: formatDateTimeShort(date, timezone),
			};
		});
	}

	private formatTimeSlots(dates: Date[]): TimeSlot[] {
		// Fallback for sync calls - use env timezone
		return this.formatTimeSlotsWithTimezone(dates, this.env.TIMEZONE);
	}

	private formatSingleSlotWithTimezone(date: Date, durationMinutes: number, timezone: string): TimeSlot {
		const end = new Date(date.getTime() + durationMinutes * 60 * 1000);
		return {
			start: date.toISOString(),
			end: end.toISOString(),
			label: formatDateTimeShort(date, timezone),
		};
	}

	private formatSingleSlot(date: Date, durationMinutes: number): TimeSlot {
		// Fallback for sync calls - use env timezone
		return this.formatSingleSlotWithTimezone(date, durationMinutes, this.env.TIMEZONE);
	}

	/**
	 * Get the correct date for a given day of week, preserving the time
	 */
	private getCorrectDateForDay(
		requestedTime: Date,
		preferredDay: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' | 'tomorrow' | 'next_week'
	): Date {
		const dayMap: Record<string, number> = {
			sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
			thursday: 4, friday: 5, saturday: 6
		};

		const result = new Date();
		const hours = requestedTime.getHours();
		const minutes = requestedTime.getMinutes();

		if (preferredDay === 'tomorrow') {
			result.setDate(result.getDate() + 1);
		} else if (preferredDay === 'next_week') {
			// Next Monday
			const currentDay = result.getDay();
			const daysUntilMonday = currentDay === 0 ? 1 : 8 - currentDay;
			result.setDate(result.getDate() + daysUntilMonday);
		} else {
			const targetDay = dayMap[preferredDay];
			const currentDay = result.getDay();
			let daysToAdd = targetDay - currentDay;
			if (daysToAdd <= 0) {
				daysToAdd += 7; // Next week
			}
			result.setDate(result.getDate() + daysToAdd);
		}

		result.setHours(hours, minutes, 0, 0);
		return result;
	}

	/**
	 * Check if a specific time slot is available
	 */
	private async checkSlotAvailability(slotStart: Date, durationMinutes: number): Promise<boolean> {
		try {
			const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);
			const freeBusy = await getFreeBusy(this.state.ownerEmail, slotStart, slotEnd, this.env);

			// Check if slot overlaps with any busy period
			const isConflict = freeBusy.some((busy) => {
				const busyStart = new Date(busy.start);
				const busyEnd = new Date(busy.end);
				return slotStart < busyEnd && slotEnd > busyStart;
			});

			return !isConflict;
		} catch (error) {
			console.error('[SchedulingAgent] Error checking slot availability:', error);
			return false;
		}
	}

	private parseSlotSelection(body: string, slots: TimeSlot[]): TimeSlot | null {
		const lower = body.toLowerCase();
		console.log(`[SchedulingAgent] parseSlotSelection - body: "${body.slice(0, 100)}", slots: ${slots.length}`);

		for (let i = 0; i < slots.length; i++) {
			const patterns = [
				`option ${i + 1}`,
				`#${i + 1}`,
				`number ${i + 1}`,
				new RegExp(`^\\s*${i + 1}\\s*[.)]?\\s*$`, 'm'),
			];

			for (const pattern of patterns) {
				if (typeof pattern === 'string') {
					if (lower.includes(pattern)) return slots[i];
				} else {
					if (pattern.test(lower)) return slots[i];
				}
			}
		}

		for (const slot of slots) {
			if (lower.includes(slot.label.toLowerCase())) {
				return slot;
			}
		}

		if (slots.length === 1) {
			const affirmatives = ['yes', 'sounds good', 'works for me', 'confirmed', 'perfect'];
			for (const affirm of affirmatives) {
				if (lower.includes(affirm)) return slots[0];
			}
		}

		return null;
	}

	private async saveConversationToD1() {
		const now = Math.floor(Date.now() / 1000);
		await this.env.DB.prepare(
			`INSERT INTO conversations
			 (id, owner_email, thread_id, latest_message_id, subject, participants, status, last_activity, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
			.bind(
				this.state.conversationId,
				this.state.ownerEmail,
				this.state.threadId,
				this.state.latestMessageId,
				this.state.subject,
				JSON.stringify(this.state.participants),
				this.state.status,
				now,
				now,
				now
			)
			.run();
	}

	private async updateConversationInD1() {
		const now = Math.floor(Date.now() / 1000);
		await this.env.DB.prepare(
			`UPDATE conversations
			 SET status = ?,
			     proposed_slots = ?,
			     meeting_title = ?,
			     meeting_duration_minutes = ?,
			     last_activity = ?,
			     updated_at = ?
			 WHERE id = ?`
		)
			.bind(
				this.state.status,
				JSON.stringify(this.state.proposedSlots),
				this.state.meetingTitle,
				this.state.meetingDurationMinutes,
				now,
				now,
				this.state.conversationId
			)
			.run();
	}

	private async sendClarificationEmail(_agentEmail: AgentEmail, email: ParsedEmailContent) {
		const response = `Hi! I'm ${this.state.ownerEmail}'s scheduling assistant. I received your email but wasn't sure if you're trying to schedule a meeting.

If you'd like to set up a meeting, just reply with some details about what you'd like to discuss and any time preferences you have, and I'll find a time that works.`;

		await sendReply(
			this.state.replyTo,
			[this.state.ownerEmail],
			email.messageId,
			email.references,
			email.subject,
			response,
			undefined,
			this.state.botEmail,
			this.env
		);

		this.setState({ ...this.state, status: 'awaiting_confirmation' });
		await this.updateConversationInD1();
	}

	private async sendNoAvailabilityEmail(_agentEmail: AgentEmail, email: ParsedEmailContent) {
		const response = `Hi! I checked ${this.state.ownerEmail}'s calendar but couldn't find any available times in the next two weeks.

Please reply with specific dates/times that work for you, and I'll check if we can make it work.`;

		await sendReply(
			this.state.replyTo,
			[this.state.ownerEmail],
			email.messageId,
			email.references,
			email.subject,
			response,
			undefined,
			this.state.botEmail,
			this.env
		);

		this.setState({ ...this.state, status: 'awaiting_confirmation' });
		await this.updateConversationInD1();
	}

	private async sendSlotClarificationEmail(_agentEmail: AgentEmail, email: ParsedEmailContent) {
		const response = `I couldn't quite understand your preference. Here are the available times again:

${this.state.proposedSlots.map((slot, i) => `${i + 1}. ${slot.label}`).join('\n')}

Just reply with the number of your preferred time, or suggest an alternative that works better for you.`;

		await sendReply(
			this.state.replyTo,
			[this.state.ownerEmail],
			email.messageId,
			email.references,
			this.state.subject,
			response,
			undefined,
			this.state.botEmail,
			this.env
		);
	}

	private async handlePostScheduleReply(agentEmail: AgentEmail, email: ParsedEmailContent) {
		// Use AI to interpret the reply in the context of an already-scheduled meeting
		const interpretation = await interpretReply(
			email.text,
			{
				proposedSlots: this.state.proposedSlots,
				conversationHistory: this.state.messages.map(m => ({
					role: m.role,
					content: m.content,
				})),
				isScheduled: true,
				selectedSlot: this.state.selectedSlot,
			},
			this.env
		);

		console.log(`[SchedulingAgent] Post-schedule interpretation: ${JSON.stringify(interpretation)}`);

		// Also check for explicit keywords as fallback
		const lower = email.text.toLowerCase();
		const wantsCancel = interpretation.intent === 'cancel' || 
			(lower.includes('cancel') && !lower.includes('reschedule'));
		const wantsReschedule = interpretation.intent === 'reschedule' || 
			lower.includes('reschedule') || 
			lower.includes('move the meeting') ||
			lower.includes('change the time') ||
			lower.includes('find another time') ||
			lower.includes('different time');
		const justThanks = interpretation.intent === 'thanks' ||
			(/^(thanks|thank you|great|perfect|sounds good|see you|looking forward)/i.test(lower.trim()));

		if (justThanks) {
			// Don't reply to simple thank you messages
			console.log(`[SchedulingAgent] Ignoring thank you message`);
			return;
		}

		if (wantsCancel) {
			await this.handleCancellation(agentEmail, email);
			return;
		}

		if (wantsReschedule) {
			await this.handleReschedule(agentEmail, email, interpretation.requestedDay, interpretation.requestedTimeOfDay);
			return;
		}

		// Unknown post-schedule message - just acknowledge
		console.log(`[SchedulingAgent] Unknown post-schedule message, not responding`);
	}

	/**
	 * Handle meeting cancellation
	 */
	private async handleCancellation(_agentEmail: AgentEmail, email: ParsedEmailContent) {
		console.log(`[SchedulingAgent] Processing cancellation request`);

		// Get the calendar event ID from D1
		const conv = await this.env.DB.prepare('SELECT calendar_event_id FROM conversations WHERE id = ?')
			.bind(this.state.conversationId)
			.first<{ calendar_event_id: string | null }>();

		// Delete the calendar event if it exists
		if (conv?.calendar_event_id) {
			const { deleteCalendarEvent } = await import('../services/calendar');
			const deleted = await deleteCalendarEvent(conv.calendar_event_id, this.state.ownerEmail, this.env);
			console.log(`[SchedulingAgent] Calendar event deleted: ${deleted}`);
		}

		// Update status
		this.setState({
			...this.state,
			status: 'cancelled',
			selectedSlot: null,
		});

		// Update D1
		await this.env.DB.prepare(
			`UPDATE conversations SET status = 'cancelled', calendar_event_id = NULL, updated_at = ? WHERE id = ?`
		)
			.bind(Math.floor(Date.now() / 1000), this.state.conversationId)
			.run();

		// Send confirmation
		const cancelledTime = this.state.selectedSlot?.label;
		const response = cancelledTime
			? `Done! The ${this.state.meetingTitle || 'meeting'} on ${cancelledTime} has been cancelled. Let me know if you'd like to reschedule.`
			: `Done! The meeting has been cancelled. Let me know if you'd like to reschedule.`;

		await sendReply(
			this.state.replyTo,
			[this.state.ownerEmail],
			email.messageId,
			email.references,
			this.state.subject,
			response,
			undefined,
			this.state.botEmail,
			this.env
		);

		// Add to message history
		this.setState({
			...this.state,
			messages: [
				...this.state.messages,
				{
					role: 'assistant',
					content: response,
					from: this.state.botEmail,
					timestamp: Date.now(),
				},
			],
		});
	}

	/**
	 * Handle meeting reschedule request
	 */
	private async handleReschedule(
		agentEmail: AgentEmail,
		email: ParsedEmailContent,
		requestedDay?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' | 'tomorrow' | 'next_week',
		requestedTimeOfDay?: 'morning' | 'afternoon' | 'evening'
	) {
		console.log(`[SchedulingAgent] Processing reschedule request`);

		// Get the calendar event ID from D1
		const conv = await this.env.DB.prepare('SELECT calendar_event_id FROM conversations WHERE id = ?')
			.bind(this.state.conversationId)
			.first<{ calendar_event_id: string | null }>();

		// Delete the old calendar event if it exists
		if (conv?.calendar_event_id) {
			const { deleteCalendarEvent } = await import('../services/calendar');
			const deleted = await deleteCalendarEvent(conv.calendar_event_id, this.state.ownerEmail, this.env);
			console.log(`[SchedulingAgent] Old calendar event deleted: ${deleted}`);
		}

		// Update preferences if a specific day was requested
		if (requestedDay) {
			this.setState({
				...this.state,
				preferredDay: requestedDay,
				preferredTimeOfDay: requestedTimeOfDay || null,
			});
		}

		// Get new availability
		const availability = await this.getOwnerAvailability();

		if (availability.length === 0) {
			const response = `I've cancelled the original meeting, but couldn't find any available times in the next two weeks. Could you suggest some specific dates/times that work for you?`;

			await sendReply(
				this.state.replyTo,
				[this.state.ownerEmail],
				email.messageId,
				email.references,
				this.state.subject,
				response,
				undefined,
				this.state.botEmail,
				this.env
			);

			this.setState({
				...this.state,
				status: 'awaiting_confirmation',
				selectedSlot: null,
			});
			await this.updateConversationInD1();
			return;
		}

		// Format new slots
		const newSlots = this.formatTimeSlots(availability);
		const oldTime = this.state.selectedSlot?.label || 'the original time';

		// Update state
		this.setState({
			...this.state,
			proposedSlots: newSlots,
			selectedSlot: null,
			status: 'proposed',
		});

		// Update D1
		await this.env.DB.prepare(
			`UPDATE conversations SET status = 'proposed', proposed_slots = ?, selected_slot = NULL, calendar_event_id = NULL, updated_at = ? WHERE id = ?`
		)
			.bind(JSON.stringify(newSlots), Math.floor(Date.now() / 1000), this.state.conversationId)
			.run();

		// Generate response
		const dayContext = requestedDay 
			? `for ${requestedDay === 'tomorrow' ? 'tomorrow' : requestedDay === 'next_week' ? 'next week' : requestedDay.charAt(0).toUpperCase() + requestedDay.slice(1)}`
			: '';
		
		const response = `No problem! I've cancelled the meeting that was at ${oldTime}. Here are some new times ${dayContext}:

${newSlots.map((slot, i) => `${i + 1}. ${slot.label}`).join('\n')}

Which works best for you?`;

		await sendReply(
			this.state.replyTo,
			[this.state.ownerEmail],
			email.messageId,
			email.references,
			this.state.subject,
			response,
			undefined,
			this.state.botEmail,
			this.env
		);

		// Add to message history
		this.setState({
			...this.state,
			messages: [
				...this.state.messages,
				{
					role: 'assistant',
					content: response,
					from: this.state.botEmail,
					timestamp: Date.now(),
				},
			],
		});
	}

	/**
	 * Handle request for a different day
	 */
	private async handleDifferentDayRequest(
		requestedDay: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' | 'tomorrow' | 'next_week',
		requestedTimeOfDay: 'morning' | 'afternoon' | 'evening' | null,
		_agentEmail: AgentEmail,
		email: ParsedEmailContent
	) {
		console.log(`[SchedulingAgent] Handling request for different day: ${requestedDay}, time of day: ${requestedTimeOfDay}`);

		// Update preferences in state
		this.setState({
			...this.state,
			preferredDay: requestedDay,
			preferredTimeOfDay: requestedTimeOfDay,
		});

		// Get new availability for the requested day
		const availability = await this.getOwnerAvailability();

		if (availability.length === 0) {
			// No availability on requested day
			const dayName = requestedDay === 'tomorrow' ? 'tomorrow' : 
				requestedDay === 'next_week' ? 'next week' : 
				requestedDay.charAt(0).toUpperCase() + requestedDay.slice(1);
			
			const response = `I checked and unfortunately there's no availability on ${dayName}. Would any of these times work instead?

${this.state.proposedSlots.map((slot, i) => `${i + 1}. ${slot.label}`).join('\n')}

Or let me know another day that works better for you!`;

			await sendReply(
				this.state.replyTo,
				[this.state.ownerEmail],
				email.messageId,
				email.references,
				this.state.subject,
				response,
				undefined,
				this.state.botEmail,
				this.env
			);
			return;
		}

		// Format new slots
		const newSlots = this.formatTimeSlots(availability);

		// Update state with new proposed slots
		this.setState({
			...this.state,
			proposedSlots: newSlots,
			status: 'proposed',
		});

		// Update D1
		await this.updateConversationInD1();

		// Generate and send new proposal (this is a follow-up, not initial proposal)
		const proposalEmail = await generateProposalEmail(
			newSlots,
			this.state.meetingTitle || this.state.subject,
			this.state.participants,
			this.env,
			true // isFollowUp
		);

		await sendReply(
			this.state.replyTo,
			[this.state.ownerEmail],
			email.messageId,
			email.references,
			this.state.subject,
			proposalEmail.text,
			proposalEmail.html,
			this.state.botEmail,
			this.env
		);

		// Add to message history
		this.setState({
			...this.state,
			messages: [
				...this.state.messages,
				{
					role: 'assistant',
					content: proposalEmail.text,
					from: this.state.botEmail,
					timestamp: Date.now(),
				},
			],
		});
	}

	/**
	 * Handle user suggesting an alternative time
	 */
	private async sendAlternativeTimeResponse(
		suggestedTime: string,
		_agentEmail: AgentEmail,
		email: ParsedEmailContent
	) {
		console.log(`[SchedulingAgent] User suggested alternative time: ${suggestedTime}`);

		const response = `Thanks for suggesting ${suggestedTime}! Could you also let me know which day you're thinking? For example, "Tuesday at ${suggestedTime}" - and I'll check if that works.

Or if you'd like, just pick one of these available times:

${this.state.proposedSlots.map((slot, i) => `${i + 1}. ${slot.label}`).join('\n')}`;

		await sendReply(
			this.state.replyTo,
			[this.state.ownerEmail],
			email.messageId,
			email.references,
			this.state.subject,
			response,
			undefined,
			this.state.botEmail,
			this.env
		);
	}

	/**
	 * Handle user declining the meeting
	 */
	private async handleDecline(_agentEmail: AgentEmail, email: ParsedEmailContent) {
		console.log(`[SchedulingAgent] User declined meeting`);

		this.setState({
			...this.state,
			status: 'declined',
		});

		// Update D1
		await this.env.DB.prepare(
			`UPDATE conversations SET status = 'declined', updated_at = ? WHERE id = ?`
		)
			.bind(Math.floor(Date.now() / 1000), this.state.conversationId)
			.run();

		const response = `No problem at all! I'll let ${this.state.ownerEmail} know. Feel free to reach out if you'd like to schedule something in the future.`;

		await sendReply(
			[email.from],
			[this.state.ownerEmail],
			email.messageId,
			email.references,
			this.state.subject,
			response,
			undefined,
			this.state.botEmail,
			this.env
		);

		// Cancel any pending reminders
		const schedules = this.getSchedules({ type: 'delayed' });
		for (const schedule of schedules) {
			await this.cancelSchedule(schedule.id);
		}
	}
}
