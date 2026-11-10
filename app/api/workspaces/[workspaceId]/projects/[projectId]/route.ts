import type { NextRequest } from 'next/server';

import {
   dataErrorResponse,
   jsonError,
   jsonResponse,
   readJsonObject,
   resolveApiContext,
} from '@/lib/work/api';
import { updateProject } from '@/lib/work/data';
import { parseVersion, validateProjectInput } from '@/lib/work/validation';

export async function PATCH(
   request: NextRequest,
   { params }: { params: Promise<{ workspaceId: string; projectId: string }> }
) {
   const { workspaceId, projectId } = await params;
   const access = await resolveApiContext(request, workspaceId);
   if (!access.ok) {
      return access.response;
   }

   const body = await readJsonObject(request);
   if (!body) {
      return jsonError(400, 'Enter a project name.');
   }

   const input = validateProjectInput(body);
   if (!input.ok) {
      return jsonError(400, input.error);
   }

   const version = parseVersion(body.version);
   if (version === null) {
      return jsonError(400, 'Reload the project and try again.');
   }

   try {
      const project = await updateProject(
         access.context.supabase,
         workspaceId,
         projectId,
         version,
         input.value
      );
      return jsonResponse({ project });
   } catch (error) {
      return dataErrorResponse(error);
   }
}
