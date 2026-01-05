// Utility functions for MeetMe

/**
 * Generate a UUID v4
 */
export function generateId(): string {
	return crypto.randomUUID();
}

/**
 * Normalize an email address (lowercase, trim whitespace)
 */
export function normalizeEmail(email: string): string {
	// Handle format: "Name <email@domain.com>" or just "email@domain.com"
	const match = email.match(/<([^>]+)>/) || [null, email];
	return (match[1] || email).toLowerCase().trim();
}

/**
 * Extract email addresses from a header string
 * Handles formats like: "user@domain.com", "Name <user@domain.com>", multiple comma-separated
 */
export function extractEmails(header: string): string[] {
	if (!header) return [];

	const emails: string[] = [];
	// Match email patterns
	const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
	const matches = header.match(emailRegex);

	if (matches) {
		for (const email of matches) {
			emails.push(normalizeEmail(email));
		}
	}

	return [...new Set(emails)]; // Deduplicate
}

/**
 * Format a date for display in emails
 */
export function formatDateTime(date: Date, timezone: string): string {
	return date.toLocaleString('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		timeZone: timezone,
		timeZoneName: 'short',
	});
}

/**
 * Format a date for calendar display (shorter format)
 */
export function formatDateTimeShort(date: Date, timezone: string): string {
	return date.toLocaleString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		timeZone: timezone,
	});
}

/**
 * Parse a natural language time reference relative to now
 * This is a simple implementation - Claude will do the heavy lifting
 */
export function parseTimeReference(text: string, timezone: string): Date | null {
	const now = new Date();
	const lower = text.toLowerCase();

	// Simple patterns
	if (lower.includes('tomorrow')) {
		const tomorrow = new Date(now);
		tomorrow.setDate(tomorrow.getDate() + 1);
		return tomorrow;
	}

	if (lower.includes('next week')) {
		const nextWeek = new Date(now);
		nextWeek.setDate(nextWeek.getDate() + 7);
		return nextWeek;
	}

	// Try to parse as ISO date
	const isoDate = new Date(text);
	if (!isNaN(isoDate.getTime())) {
		return isoDate;
	}

	return null;
}

/**
 * Check if a time slot falls within working hours
 */
export function isWithinWorkingHours(
	date: Date,
	timezone: string,
	workingHoursStart: number,
	workingHoursEnd: number,
	workingDays: number[]
): boolean {
	// Get the day and hour in the specified timezone
	const options: Intl.DateTimeFormatOptions = {
		hour: 'numeric',
		hour12: false,
		timeZone: timezone,
	};
	const hour = parseInt(date.toLocaleString('en-US', options), 10);

	const dayOptions: Intl.DateTimeFormatOptions = {
		weekday: 'narrow',
		timeZone: timezone,
	};
	const dayStr = date.toLocaleString('en-US', dayOptions);
	const dayMap: Record<string, number> = { S: 0, M: 1, T: 2, W: 3, R: 4, F: 5, A: 6 };

	// Note: JavaScript getDay() returns 0-6 (Sun-Sat), but we use 1-7 (Mon-Sun)
	const jsDay = date.getDay();
	const day = jsDay === 0 ? 7 : jsDay; // Convert Sunday from 0 to 7

	return workingDays.includes(day) && hour >= workingHoursStart && hour < workingHoursEnd;
}

// Options for smart slot generation
export interface SlotGenerationOptions {
	preferredDay?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' | 'tomorrow' | 'next_week' | null;
	preferredTimeOfDay?: 'morning' | 'afternoon' | 'evening' | null;
	includeWeekends?: boolean;
}

/**
 * Map day names to day numbers (1=Mon, 7=Sun)
 */
function getDayNumber(day: string): number | null {
	const dayMap: Record<string, number> = {
		monday: 1,
		tuesday: 2,
		wednesday: 3,
		thursday: 4,
		friday: 5,
		saturday: 6,
		sunday: 7,
	};
	return dayMap[day.toLowerCase()] || null;
}

/**
 * Get the next occurrence of a specific day of week
 */
function getNextDayOfWeek(startDate: Date, targetDay: number, timezone: string): Date {
	const result = new Date(startDate);
	const currentDay = result.getDay();
	// Convert JS day (0=Sun) to our format (1=Mon, 7=Sun)
	const currentDayNum = currentDay === 0 ? 7 : currentDay;
	
	let daysToAdd = targetDay - currentDayNum;
	if (daysToAdd <= 0) {
		daysToAdd += 7; // Next week
	}
	
	result.setDate(result.getDate() + daysToAdd);
	return result;
}

/**
 * Filter working days to exclude weekends unless explicitly included
 */
function filterWorkingDays(workingDays: number[], includeWeekends: boolean): number[] {
	if (includeWeekends) {
		return workingDays;
	}
	// Filter out Saturday (6) and Sunday (7)
	return workingDays.filter(day => day !== 6 && day !== 7);
}

/**
 * Get time range for preferred time of day
 */
function getTimeOfDayRange(preferredTimeOfDay: 'morning' | 'afternoon' | 'evening' | null, workingHoursStart: number, workingHoursEnd: number): { start: number; end: number } {
	if (!preferredTimeOfDay) {
		return { start: workingHoursStart, end: workingHoursEnd };
	}
	
	switch (preferredTimeOfDay) {
		case 'morning':
			return { start: Math.max(workingHoursStart, 8), end: Math.min(12, workingHoursEnd) };
		case 'afternoon':
			return { start: Math.max(workingHoursStart, 12), end: Math.min(17, workingHoursEnd) };
		case 'evening':
			return { start: Math.max(workingHoursStart, 17), end: workingHoursEnd };
		default:
			return { start: workingHoursStart, end: workingHoursEnd };
	}
}

/**
 * Generate time slots for the next N business days
 */
export function generateTimeSlots(
	startDate: Date,
	timezone: string,
	workingHoursStart: number,
	workingHoursEnd: number,
	workingDays: number[],
	durationMinutes: number,
	numberOfSlots: number = 4,
	options?: SlotGenerationOptions
): Date[] {
	const slots: Date[] = [];
	const includeWeekends = options?.includeWeekends ?? false;
	
	// Filter out weekends from working days unless explicitly included
	const effectiveWorkingDays = filterWorkingDays(workingDays, includeWeekends);
	
	// If no working days left after filtering, fall back to weekdays
	const finalWorkingDays = effectiveWorkingDays.length > 0 ? effectiveWorkingDays : [1, 2, 3, 4, 5];
	
	// Determine start date based on preferred day
	let searchStartDate = new Date(startDate);
	let priorityDate: Date | null = null;
	
	if (options?.preferredDay) {
		if (options.preferredDay === 'tomorrow') {
			priorityDate = new Date(startDate);
			priorityDate.setDate(priorityDate.getDate() + 1);
		} else if (options.preferredDay === 'next_week') {
			// Start from next Monday
			priorityDate = getNextDayOfWeek(startDate, 1, timezone);
		} else {
			const dayNum = getDayNumber(options.preferredDay);
			if (dayNum) {
				priorityDate = getNextDayOfWeek(startDate, dayNum, timezone);
			}
		}
	}
	
	// Get time of day preferences
	const timeRange = getTimeOfDayRange(options?.preferredTimeOfDay || null, workingHoursStart, workingHoursEnd);
	
	// First, try to find slots on the preferred day
	if (priorityDate) {
		const prioritySlots = generateSlotsForDay(
			priorityDate,
			timezone,
			timeRange.start,
			timeRange.end,
			finalWorkingDays,
			durationMinutes,
			numberOfSlots
		);
		slots.push(...prioritySlots);

		// If we have enough priority slots, return them (don't mix with other days)
		if (slots.length >= numberOfSlots) {
			return slots.slice(0, numberOfSlots);
		}
	}

	// Only fill from other days if we don't have enough priority slots
	const current = new Date(startDate);
	current.setMinutes(0, 0, 0);
	current.setHours(current.getHours() + 1);

	let daysChecked = 0;
	const maxDays = 14;

	while (slots.length < numberOfSlots && daysChecked < maxDays) {
		// Skip the priority date if we already processed it
		if (priorityDate && isSameDay(current, priorityDate, timezone)) {
			current.setDate(current.getDate() + 1);
			current.setHours(workingHoursStart, 0, 0, 0);
			daysChecked++;
			continue;
		}

		if (isWithinWorkingHours(current, timezone, workingHoursStart, workingHoursEnd, finalWorkingDays)) {
			// Check if this slot is already in our list
			const isDuplicate = slots.some(s => s.getTime() === current.getTime());
			if (!isDuplicate) {
				slots.push(new Date(current));
			}
		}

		current.setMinutes(current.getMinutes() + durationMinutes + 15);

		const hour = current.getHours();
		if (hour >= workingHoursEnd) {
			current.setDate(current.getDate() + 1);
			current.setHours(workingHoursStart, 0, 0, 0);
			daysChecked++;
		}
	}

	// Return priority slots first, then fill with others (sorted)
	return slots.slice(0, numberOfSlots);
}

/**
 * Generate slots for a specific day
 */
function generateSlotsForDay(
	date: Date,
	timezone: string,
	workingHoursStart: number,
	workingHoursEnd: number,
	workingDays: number[],
	durationMinutes: number,
	maxSlots: number
): Date[] {
	const slots: Date[] = [];
	const current = new Date(date);
	current.setHours(workingHoursStart, 0, 0, 0);
	
	// Skip if this day is in the past
	if (current < new Date()) {
		const now = new Date();
		if (isSameDay(current, now, timezone)) {
			// Same day - start from next hour
			current.setHours(now.getHours() + 1, 0, 0, 0);
		} else {
			return slots; // Day is in the past
		}
	}
	
	while (slots.length < maxSlots && current.getHours() < workingHoursEnd) {
		if (isWithinWorkingHours(current, timezone, workingHoursStart, workingHoursEnd, workingDays)) {
			slots.push(new Date(current));
		}
		current.setMinutes(current.getMinutes() + durationMinutes + 15);
	}
	
	return slots;
}

/**
 * Check if two dates are the same day in a timezone
 */
function isSameDay(date1: Date, date2: Date, timezone: string): boolean {
	const d1 = date1.toLocaleDateString('en-US', { timeZone: timezone });
	const d2 = date2.toLocaleDateString('en-US', { timeZone: timezone });
	return d1 === d2;
}

/**
 * Create email threading headers
 */
export function createThreadingHeaders(
	originalMessageId: string,
	existingReferences: string | null
): { 'In-Reply-To': string; References: string } {
	const references = existingReferences
		? `${existingReferences} ${originalMessageId}`
		: originalMessageId;

	return {
		'In-Reply-To': originalMessageId,
		References: references,
	};
}

/**
 * Strip common prefixes from email subject
 */
export function cleanSubject(subject: string): string {
	return subject.replace(/^(re:|fwd?:|fw:)\s*/gi, '').trim();
}

/**
 * Add Re: prefix if not already present
 */
export function addReplyPrefix(subject: string): string {
	const clean = cleanSubject(subject);
	return `Re: ${clean}`;
}

/**
 * Encrypt data using AES-GCM
 */
export async function encrypt(data: string, key: string): Promise<string> {
	const encoder = new TextEncoder();
	const dataBuffer = encoder.encode(data);

	// Derive key from string
	const keyBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(key));
	const cryptoKey = await crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-GCM' }, false, [
		'encrypt',
	]);

	// Generate IV
	const iv = crypto.getRandomValues(new Uint8Array(12));

	// Encrypt
	const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, dataBuffer);

	// Combine IV + encrypted data and base64 encode
	const combined = new Uint8Array(iv.length + encrypted.byteLength);
	combined.set(iv);
	combined.set(new Uint8Array(encrypted), iv.length);

	return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data using AES-GCM
 */
export async function decrypt(encryptedData: string, key: string): Promise<string> {
	const encoder = new TextEncoder();

	// Derive key from string
	const keyBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(key));
	const cryptoKey = await crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-GCM' }, false, [
		'decrypt',
	]);

	// Decode base64
	const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));

	// Extract IV and encrypted data
	const iv = combined.slice(0, 12);
	const encrypted = combined.slice(12);

	// Decrypt
	const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, encrypted);

	return new TextDecoder().decode(decrypted);
}
