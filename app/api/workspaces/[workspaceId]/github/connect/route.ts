import type { NextRequest } from 'next/server';

import { jsonError, jsonResponse, requestSiteOrigin, resolveApiContext } from '@/lib/work/api';
import { githubErrorResponse } from '@/lib/work/github/api-response';
import { startGithubConnect } from '@/lib/work/github/service';

export async function POST(
   request: NextRequest,
   { params }: { params: Promise<{ workspaceId: string }> }
) {
   const { workspaceId } = await params;
   const access = await resolveApiContext(request, workspaceId);
   if (!access.ok) {
      return access.response;
   }

   const origin = requestSiteOrigin(request);
   if (!origin) {
      return jsonError(503, 'GitHub is unavailable in this environment.');
   }

   try {
      const result = await startGithubConnect(
         { workspaceId: access.context.workspace.id, userId: access.context.user.id },
         origin
      );
      return jsonResponse(result);
   } catch (error) {
      return githubErrorResponse(error);
   }
}
