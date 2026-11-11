import type { NextRequest } from 'next/server';

import { jsonError, jsonResponse, readJsonObject, resolveApiContext } from '@/lib/work/api';
import { githubErrorResponse } from '@/lib/work/github/api-response';
import { chooseGithubInstallation, listGithubInstallations } from '@/lib/work/github/service';

export async function GET(
   request: NextRequest,
   { params }: { params: Promise<{ workspaceId: string }> }
) {
   const { workspaceId } = await params;
   const access = await resolveApiContext(request, workspaceId);
   if (!access.ok) {
      return access.response;
   }

   try {
      const installations = await listGithubInstallations({
         workspaceId: access.context.workspace.id,
         userId: access.context.user.id,
      });
      return jsonResponse({ installations });
   } catch (error) {
      return githubErrorResponse(error);
   }
}

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
   if (!body || body.installationId === undefined) {
      return jsonError(400, 'Choose a GitHub App installation.');
   }

   try {
      const result = await chooseGithubInstallation(
         { workspaceId: access.context.workspace.id, userId: access.context.user.id },
         body.installationId
      );
      return jsonResponse(result);
   } catch (error) {
      return githubErrorResponse(error);
   }
}
