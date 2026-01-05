import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('MeetMe Worker', () => {
	describe('Health check', () => {
		it('returns ok status on /', async () => {
			const request = new IncomingRequest('http://localhost/');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data).toEqual({ status: 'ok', service: 'MeetMe' });
		});

		it('returns ok status on /health', async () => {
			const request = new IncomingRequest('http://localhost/health');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data).toEqual({ status: 'ok', service: 'MeetMe' });
		});
	});

	describe('CORS', () => {
		it('handles OPTIONS preflight requests', async () => {
			const request = new IncomingRequest('http://localhost/api/me', {
				method: 'OPTIONS',
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(200);
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
			expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
		});
	});

	describe('Authentication', () => {
		it('returns 401 for unauthenticated API requests', async () => {
			const request = new IncomingRequest('http://localhost/api/me');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(401);
			const data = await response.json();
			expect(data.success).toBe(false);
			expect(data.error).toBe('Unauthorized');
		});

		it('returns 401 for expired session token', async () => {
			const expiredToken = btoa(
				JSON.stringify({ email: 'test@example.com', exp: Date.now() - 1000 })
			);
			const request = new IncomingRequest('http://localhost/api/me', {
				headers: { Authorization: `Bearer ${expiredToken}` },
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(401);
		});
	});

	describe('OAuth routes', () => {
		it('redirects to Google OAuth on /auth/google', async () => {
			const request = new IncomingRequest('http://localhost/auth/google');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(302);
			const location = response.headers.get('Location');
			expect(location).toContain('accounts.google.com');
			expect(location).toContain('oauth2');
		});

		it('handles missing code in OAuth callback', async () => {
			const request = new IncomingRequest('http://localhost/auth/callback');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			const text = await response.text();
			expect(text).toContain('Missing code or state');
		});

		it('handles OAuth error in callback', async () => {
			const request = new IncomingRequest(
				'http://localhost/auth/callback?error=access_denied'
			);
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(400);
			const text = await response.text();
			expect(text).toContain('access_denied');
		});
	});

	describe('404 handling', () => {
		it('returns 404 for unknown routes', async () => {
			const request = new IncomingRequest('http://localhost/unknown-route');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(response.status).toBe(404);
		});
	});
});
