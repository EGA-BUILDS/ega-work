import type { NextRequest } from 'next/server';

import { jsonError, jsonResponse, resolveApiContext } from '@/lib/work/api';
import { githubErrorResponse } from '@/lib/work/github/api-response';
import { refreshGithubPullRequest } from '@/lib/work/github/service';
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

   try {
      const pullRequest = await refreshGithubPullRequest(
         { workspaceId: access.context.workspace.id, userId: access.context.user.id },
         issueId
      );
      return jsonResponse({ pullRequest });
   } catch (error) {
      return githubErrorResponse(error);
   }
}
