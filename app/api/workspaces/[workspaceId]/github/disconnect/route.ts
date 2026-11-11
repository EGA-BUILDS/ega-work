import type { NextRequest } from 'next/server';

import { jsonResponse, resolveApiContext } from '@/lib/work/api';
import { githubErrorResponse } from '@/lib/work/github/api-response';
import { disconnectGithub } from '@/lib/work/github/service';

export async function POST(
   request: NextRequest,
   { params }: { params: Promise<{ workspaceId: string }> }
) {
   const { workspaceId } = await params;
   const access = await resolveApiContext(request, workspaceId);
   if (!access.ok) {
      return access.response;
   }

   try {
      const status = await disconnectGithub({
         workspaceId: access.context.workspace.id,
         userId: access.context.user.id,
      });
      return jsonResponse({ status });
   } catch (error) {
      return githubErrorResponse(error);
   }
}
