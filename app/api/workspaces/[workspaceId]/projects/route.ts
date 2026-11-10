import type { NextRequest } from 'next/server';

import {
   dataErrorResponse,
   jsonError,
   jsonResponse,
   readJsonObject,
   resolveApiContext,
} from '@/lib/work/api';
import { createProject } from '@/lib/work/data';
import { validateProjectInput } from '@/lib/work/validation';

export async function POST(
   request: NextRequest,
   { params }: { params: Promise<{ workspaceId: string }> }
) {
   const { workspaceId } = await params;
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

   try {
      const project = await createProject(access.context.supabase, workspaceId, input.value);
      return jsonResponse({ project }, 201);
   } catch (error) {
      return dataErrorResponse(error);
   }
}
