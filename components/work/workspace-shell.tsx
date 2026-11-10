'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CircleDot, ExternalLink, FolderKanban, LayoutDashboard, Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { WorkspaceCommandPalette } from '@/components/work/workspace-command-palette';
import {
   Sidebar,
   SidebarContent,
   SidebarFooter,
   SidebarGroup,
   SidebarGroupContent,
   SidebarGroupLabel,
   SidebarHeader,
   SidebarInset,
   SidebarMenu,
   SidebarMenuButton,
   SidebarMenuItem,
   SidebarProvider,
   SidebarTrigger,
} from '@/components/ui/sidebar';

type WorkspaceShellProps = {
   workspace: { id: string; name: string };
   user: { email: string | null };
   children: React.ReactNode;
};

function navItems(workspaceId: string) {
   return [
      { href: `/w/${workspaceId}`, label: 'Overview', icon: LayoutDashboard, exact: true },
      { href: `/w/${workspaceId}/projects`, label: 'Projects', icon: FolderKanban, exact: false },
      { href: `/w/${workspaceId}/my-issues`, label: 'My issues', icon: CircleDot, exact: false },
      { href: `/w/${workspaceId}/settings`, label: 'Settings', icon: Settings, exact: false },
   ];
}

export function WorkspaceShell({ workspace, user, children }: WorkspaceShellProps) {
   const pathname = usePathname();
   const items = navItems(workspace.id);

   return (
      <SidebarProvider>
         <Sidebar collapsible="offcanvas">
            <SidebarHeader className="border-b px-4 py-3">
               <div className="min-w-0">
                  <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                     Private workspace
                  </p>
                  <p className="truncate text-sm font-semibold">{workspace.name}</p>
               </div>
            </SidebarHeader>
            <SidebarContent>
               <SidebarGroup>
                  <SidebarGroupLabel>Work</SidebarGroupLabel>
                  <SidebarGroupContent>
                     <SidebarMenu>
                        {items.map((item) => {
                           const active = item.exact
                              ? pathname === item.href
                              : pathname === item.href || pathname.startsWith(`${item.href}/`);
                           return (
                              <SidebarMenuItem key={item.href}>
                                 <SidebarMenuButton asChild isActive={active}>
                                    <Link href={item.href}>
                                       <item.icon className="size-4" />
                                       <span>{item.label}</span>
                                    </Link>
                                 </SidebarMenuButton>
                              </SidebarMenuItem>
                           );
                        })}
                     </SidebarMenu>
                  </SidebarGroupContent>
               </SidebarGroup>
            </SidebarContent>
            <SidebarFooter className="gap-2 border-t p-3">
               <p className="text-muted-foreground truncate text-xs">{user.email ?? 'Signed in'}</p>
               <form action="/auth/signout" method="post">
                  <Button type="submit" variant="outline" size="sm" className="w-full">
                     Sign out
                  </Button>
               </form>
               <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
                  <Link href="/demo" target="_blank" rel="noopener noreferrer">
                     <ExternalLink className="size-4" />
                     Open labeled demo
                  </Link>
               </Button>
            </SidebarFooter>
         </Sidebar>
         <SidebarInset>
            <header className="bg-container flex h-14 shrink-0 items-center gap-3 border-b px-4">
               <SidebarTrigger />
               <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{workspace.name}</p>
                  <p className="text-muted-foreground truncate text-xs">Saved private work</p>
               </div>
               <WorkspaceCommandPalette workspaceId={workspace.id} />
               <Button variant="ghost" size="sm" asChild>
                  <Link href="/demo" target="_blank" rel="noopener noreferrer">
                     Demo
                  </Link>
               </Button>
            </header>
            <div className="min-h-0 flex-1 overflow-auto">{children}</div>
         </SidebarInset>
      </SidebarProvider>
   );
}
