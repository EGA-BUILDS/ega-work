import type { NextRequest } from 'next/server';

import { jsonError, jsonResponse, readJsonObject, resolveApiContext } from '@/lib/work/api';
import { githubErrorResponse } from '@/lib/work/github/api-response';
import { linkGithubPullRequest, unlinkGithubPullRequest } from '@/lib/work/github/service';
import { isUuid } from '@/lib/work/github/url';

export async function POST(
   request: NextRequest,
   { params }: { params: Promise<{ workspaceId: string; issueId: string }> }
) {
   const { workspaceId, issueId } = await params;
   const access = await resolveApiContext(request, workspaceId);
   if (!access.ok) {
      return access.response;
   }
   if (!isUuid(issueId)) {
      return jsonError(404, 'Issue not found.');
   }

   const body = await readJsonObject(request);
   if (!body) {
      return jsonError(400, 'Paste a GitHub pull request URL.');
   }

   try {
      const pullRequest = await linkGithubPullRequest(
         { workspaceId: access.context.workspace.id, userId: access.context.user.id },
         issueId,
         body.url
      );
      return jsonResponse({ pullRequest });
   } catch (error) {
      return githubErrorResponse(error);
   }
}

export async function DELETE(
   request: NextRequest,
   { params }: { params: Promise<{ workspaceId: string; issueId: string }> }
) {
   const { workspaceId, issueId } = await params;
   const access = await resolveApiContext(request, workspaceId);
   if (!access.ok) {
      return access.response;
   }
   if (!isUuid(issueId)) {
      return jsonError(404, 'Issue not found.');
   }

   try {
      await unlinkGithubPullRequest(
         { workspaceId: access.context.workspace.id, userId: access.context.user.id },
         issueId
      );
      return jsonResponse({ pullRequest: null });
   } catch (error) {
      return githubErrorResponse(error);
   }
}
