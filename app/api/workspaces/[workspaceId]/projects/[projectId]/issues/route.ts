import type { NextRequest } from 'next/server';

import {
   dataErrorResponse,
   jsonError,
   jsonResponse,
   readJsonObject,
   resolveApiContext,
} from '@/lib/work/api';
import { createIssue } from '@/lib/work/data';
import { validateIssueInput } from '@/lib/work/validation';

export async function POST(
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
      return jsonError(400, 'Enter an issue title.');
   }

   const input = validateIssueInput(body);
   if (!input.ok) {
      return jsonError(400, input.error);
   }

   try {
      const issue = await createIssue(
         access.context.supabase,
         workspaceId,
         projectId,
         access.context.user.id,
         input.value
      );
      return jsonResponse({ issue }, 201);
   } catch (error) {
      return dataErrorResponse(error);
   }
}
