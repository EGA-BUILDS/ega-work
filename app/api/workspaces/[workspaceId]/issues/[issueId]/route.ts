import type { NextRequest } from 'next/server';

import {
   dataErrorResponse,
   jsonError,
   jsonResponse,
   readJsonObject,
   resolveApiContext,
} from '@/lib/work/api';
import { setIssueStatus, updateIssue } from '@/lib/work/data';
import { isIssueStatus, parseVersion, validateIssueInput } from '@/lib/work/validation';

export async function PATCH(
   request: NextRequest,
   { params }: { params: Promise<{ workspaceId: string; issueId: string }> }
) {
   const { workspaceId, issueId } = await params;
   const access = await resolveApiContext(request, workspaceId);
   if (!access.ok) {
      return access.response;
   }

   const body = await readJsonObject(request);
   if (!body) {
      return jsonError(400, 'Nothing to update.');
   }

   const version = parseVersion(body.version);
   if (version === null) {
      return jsonError(400, 'Reload the issue and try again.');
   }

   try {
      if (body.status !== undefined) {
         if (!isIssueStatus(body.status)) {
            return jsonError(400, 'Choose open or completed.');
         }
         const issue = await setIssueStatus(
            access.context.supabase,
            workspaceId,
            issueId,
            version,
            body.status
         );
         return jsonResponse({ issue });
      }

      const input = validateIssueInput(body);
      if (!input.ok) {
         return jsonError(400, input.error);
      }

      const issue = await updateIssue(
         access.context.supabase,
         workspaceId,
         issueId,
         version,
         input.value
      );
      return jsonResponse({ issue });
   } catch (error) {
      return dataErrorResponse(error);
   }
}
