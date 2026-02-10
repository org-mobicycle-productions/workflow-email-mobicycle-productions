import { describe, it, expect } from 'vitest';
import worker from '../src/index';

describe('Email triage worker', () => {
	it('rejects non-POST requests', async () => {
		const request = new Request('http://example.com', { method: 'GET' });
		const response = await worker.fetch(request, { EMAIL_TRIAGE: {} } as any);
		expect(response.status).toBe(405);
	});

	it('creates a workflow instance on POST and forwards overrides', async () => {
		let receivedParams: any = null;
		const env = {
			EMAIL_TRIAGE: {
				create: async ({ params }: any) => {
					receivedParams = params;
					return { id: 'test-workflow-id' };
				},
			},
		};

		const request = new Request('http://example.com/cron/process-legal-emails', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ mailbox: 'All Mail', limit: 123, unseenOnly: true }),
		});

		const response = await worker.fetch(request, env as any);
		expect(response.status).toBe(200);

		const data = await response.json();
		expect(data).toMatchObject({
			workflowId: 'test-workflow-id',
			status: 'started',
		});

		expect(receivedParams).toMatchObject({
			mailbox: 'All Mail',
			limit: 123,
			unseenOnly: true,
		});
	});
});
