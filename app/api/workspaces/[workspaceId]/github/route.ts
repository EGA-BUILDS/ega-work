import type { NextRequest } from 'next/server';

import { jsonResponse, resolveApiContext } from '@/lib/work/api';
import { getGithubStatus } from '@/lib/work/github/service';

export async function GET(
   request: NextRequest,
   { params }: { params: Promise<{ workspaceId: string }> }
) {
   const { workspaceId } = await params;
   const access = await resolveApiContext(request, workspaceId);
   if (!access.ok) {
      return access.response;
   }

   return jsonResponse(await getGithubStatus(access.context.workspace.id));
}
