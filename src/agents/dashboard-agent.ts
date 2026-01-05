// DashboardAgent - Real-time dashboard updates via Agents SDK
// Uses WebSocket state sync and @callable methods for RPC

import { Agent, callable } from 'agents';
import type { Env, Conversation, ConversationRow } from '../types';

// Dashboard state that syncs to connected clients automatically
export interface DashboardState {
	conversations: Conversation[];
	stats: {
		active: number;
		scheduled: number;
		pending: number;
	};
	lastUpdated: number;
}

// @ts-expect-error - Env type compatibility
export class DashboardAgent extends Agent<Env, DashboardState> {
	// Initial state - synced to all connected clients
	initialState: DashboardState = {
		conversations: [],
		stats: { active: 0, scheduled: 0, pending: 0 },
		lastUpdated: 0,
	};

	/**
	 * Called when agent starts or wakes from hibernation
	 */
	async onStart() {
		console.log(`[DashboardAgent] Started for: ${this.name}`);
		// Load initial data
		await this.loadConversations();
	}

	/**
	 * Called when a WebSocket client connects
	 * State is automatically sent to the client by the SDK
	 */
	async onConnect(connection: import('agents').Connection, ctx: import('agents').ConnectionContext) {
		console.log(`[DashboardAgent] Client connected: ${connection.id}`);
		// Refresh data on new connection
		await this.loadConversations();
	}

	/**
	 * Load conversations from D1 and update state
	 * State changes via setState() are automatically synced to all clients
	 */
	private async loadConversations() {
		const userEmail = this.name; // Agent name is the user email
		
		try {
			const result = await this.env.DB.prepare(
				`SELECT * FROM conversations 
				 WHERE owner_email = ? 
				 ORDER BY last_activity DESC 
				 LIMIT 50`
			)
				.bind(userEmail)
				.all<ConversationRow>();

			const conversations = (result.results || []).map(this.parseConversationRow);

			// Calculate stats
			const stats = {
				active: conversations.filter(c =>
					['proposed', 'awaiting_confirmation', 'new', 'parsing'].includes(c.status)
				).length,
				scheduled: conversations.filter(c => c.status === 'scheduled').length,
				pending: conversations.filter(c => c.status === 'awaiting_confirmation').length,
			};

			// setState automatically syncs to all connected WebSocket clients
			this.setState({
				conversations,
				stats,
				lastUpdated: Date.now(),
			});
			
			console.log(`[DashboardAgent] Loaded ${conversations.length} conversations for ${userEmail}`);
		} catch (error) {
			console.error('[DashboardAgent] Error loading conversations:', error);
		}
	}

	/**
	 * Parse a conversation row from D1
	 */
	private parseConversationRow(row: ConversationRow): Conversation {
		return {
			...row,
			participants: row.participants ? JSON.parse(row.participants) : [],
			proposed_slots: row.proposed_slots ? JSON.parse(row.proposed_slots) : null,
			selected_slot: row.selected_slot ? JSON.parse(row.selected_slot) : null,
		};
	}

	/**
	 * Refresh conversations - callable from client via RPC
	 */
	@callable({ description: 'Refresh conversations list' })
	async refresh() {
		await this.loadConversations();
		return { success: true, count: this.state.conversations.length };
	}

	/**
	 * Get a single conversation by ID - callable from client via RPC
	 */
	@callable({ description: 'Get conversation details' })
	async getConversation(conversationId: string) {
		const userEmail = this.name;
		
		try {
			const result = await this.env.DB.prepare(
				'SELECT * FROM conversations WHERE id = ? AND owner_email = ?'
			)
				.bind(conversationId, userEmail)
				.first<ConversationRow>();

			if (!result) {
				return { success: false, error: 'Conversation not found' };
			}

			return { success: true, data: this.parseConversationRow(result) };
		} catch (error) {
			console.error('[DashboardAgent] Error getting conversation:', error);
			return { success: false, error: 'Failed to get conversation' };
		}
	}

	/**
	 * Delete a conversation - callable from client via RPC
	 */
	@callable({ description: 'Delete a conversation' })
	async deleteConversation(conversationId: string) {
		const userEmail = this.name;

		try {
			await this.env.DB.prepare('DELETE FROM conversations WHERE id = ? AND owner_email = ?')
				.bind(conversationId, userEmail)
				.run();

			// Refresh state - will auto-sync to all clients
			await this.loadConversations();
			
			return { success: true };
		} catch (error) {
			console.error('[DashboardAgent] Error deleting conversation:', error);
			return { success: false, error: 'Failed to delete conversation' };
		}
	}

	/**
	 * Get user settings - callable from client via RPC
	 */
	@callable({ description: 'Get user settings' })
	async getSettings() {
		const userEmail = this.name;

		try {
			const result = await this.env.DB.prepare(
				'SELECT * FROM users WHERE email = ?'
			)
				.bind(userEmail)
				.first<{
					email: string;
					timezone: string;
					working_hours_start: number;
					working_hours_end: number;
					buffer_minutes: number;
					default_meeting_duration: number;
					meeting_title_prefix: string | null;
					include_weekends: number;
				}>();

			if (!result) {
				// Return defaults
				return {
					success: true,
					data: {
						timezone: 'America/Los_Angeles',
						working_hours_start: 9,
						working_hours_end: 17,
						buffer_minutes: 15,
						default_meeting_duration: 30,
						meeting_title_prefix: '',
						include_weekends: false,
					},
				};
			}

			return {
				success: true,
				data: {
					timezone: result.timezone,
					working_hours_start: result.working_hours_start,
					working_hours_end: result.working_hours_end,
					buffer_minutes: result.buffer_minutes,
					default_meeting_duration: result.default_meeting_duration,
					meeting_title_prefix: result.meeting_title_prefix || '',
					include_weekends: result.include_weekends === 1,
				},
			};
		} catch (error) {
			console.error('[DashboardAgent] Error getting settings:', error);
			return { success: false, error: 'Failed to get settings' };
		}
	}

	/**
	 * Update user settings - callable from client via RPC
	 */
	@callable({ description: 'Update user settings' })
	async updateSettings(settings: {
		timezone?: string;
		working_hours_start?: number;
		working_hours_end?: number;
		buffer_minutes?: number;
		default_meeting_duration?: number;
		meeting_title_prefix?: string;
		include_weekends?: boolean;
	}) {
		const userEmail = this.name;
		
		console.log(`[DashboardAgent] Saving settings for ${userEmail}:`, JSON.stringify(settings));

		try {
			const result = await this.env.DB.prepare(
				`UPDATE users SET
					timezone = ?,
					working_hours_start = ?,
					working_hours_end = ?,
					buffer_minutes = ?,
					default_meeting_duration = ?,
					meeting_title_prefix = ?,
					include_weekends = ?
				WHERE email = ?`
			)
				.bind(
					settings.timezone,
					settings.working_hours_start,
					settings.working_hours_end,
					settings.buffer_minutes,
					settings.default_meeting_duration,
					settings.meeting_title_prefix || '',
					settings.include_weekends ? 1 : 0,
					userEmail
				)
				.run();
			
			console.log(`[DashboardAgent] Update result:`, result);

			return { success: true };
		} catch (error) {
			console.error('[DashboardAgent] Error updating settings:', error);
			return { success: false, error: 'Failed to update settings' };
		}
	}

	/**
	 * Called externally when a conversation is updated (by SchedulingAgent)
	 * This is called via Durable Object stub, not WebSocket
	 */
	async notifyUpdate() {
		console.log(`[DashboardAgent] Received update notification`);
		await this.loadConversations();
	}
}
