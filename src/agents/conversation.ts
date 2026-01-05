// ConversationAgent - Legacy stub (kept for migration compatibility)
// All functionality has been moved to SchedulingAgent

import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../types';

export class ConversationAgent extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	// This class is deprecated - use SchedulingAgent instead
	async fetch(request: Request): Promise<Response> {
		return new Response('This agent is deprecated. Use SchedulingAgent instead.', { status: 410 });
	}
}
