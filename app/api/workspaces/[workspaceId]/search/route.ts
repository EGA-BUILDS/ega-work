import type { NextRequest } from 'next/server';

import { dataErrorResponse, jsonResponse, resolveApiContext } from '@/lib/work/api';
import { searchWorkspace } from '@/lib/work/data';

export async function GET(
   request: NextRequest,
   { params }: { params: Promise<{ workspaceId: string }> }
) {
   const { workspaceId } = await params;
   const access = await resolveApiContext(request, workspaceId);
   if (!access.ok) {
      return access.response;
   }

   const query = request.nextUrl.searchParams.get('q') ?? '';
   try {
      const results = await searchWorkspace(access.context.supabase, workspaceId, query);
      return jsonResponse(results);
   } catch (error) {
      return dataErrorResponse(error);
   }
}
