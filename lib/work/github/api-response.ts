import 'server-only';

import type { NextResponse } from 'next/server';

import { jsonError } from '../api';
import { GithubServiceError, type GithubServiceErrorCode } from './service';

const RESPONSES: Readonly<Record<GithubServiceErrorCode, { status: number; message: string }>> = {
   unconfigured: {
      status: 503,
      message: 'GitHub is not configured in this environment.',
   },
   disconnected: {
      status: 409,
      message: 'Connect GitHub in workspace settings first.',
   },
   reauthorization_required: {
      status: 409,
      message: 'Reconnect GitHub in workspace settings to continue.',
   },
   installation_unavailable: {
      status: 409,
      message: 'The GitHub App installation cannot access this repository. Check the installation.',
   },
   not_found: {
      status: 404,
      message: 'That pull request or issue was not found.',
   },
   rate_limited: {
      status: 429,
      message: 'GitHub is rate limiting requests. Try again later.',
   },
   outage: {
      status: 502,
      message: 'GitHub did not respond. Nothing was changed.',
   },
   denied: {
      status: 403,
      message: 'GitHub did not authorize this request.',
   },
   conflict: {
      status: 409,
      message: 'GitHub is already being updated. Reload and try again.',
   },
   invalid_input: {
      status: 400,
      message: 'Enter a valid GitHub pull request URL or installation.',
   },
};

/**
 * Maps the fixed integration error taxonomy to a sanitized browser response.
 * Provider response text, tokens, and request details are never included.
 */
export function githubErrorResponse(error: unknown): NextResponse {
   if (error instanceof GithubServiceError) {
      const response = RESPONSES[error.code];
      return jsonError(response.status, response.message);
   }
   return jsonError(503, 'GitHub is unavailable in this environment. Nothing was changed.');
}
