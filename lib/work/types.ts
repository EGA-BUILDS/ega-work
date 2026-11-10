export type WorkWorkspace = {
   id: string;
   owner_id: string;
   name: string;
   created_at: string;
   updated_at: string;
};

export type WorkProject = {
   id: string;
   workspace_id: string;
   name: string;
   description: string | null;
   version: number;
   created_at: string;
   updated_at: string;
};

export type WorkIssueStatus = 'open' | 'completed';

export type WorkIssue = {
   id: string;
   workspace_id: string;
   project_id: string;
   number: number;
   title: string;
   description: string | null;
   status: WorkIssueStatus;
   assignee_id: string | null;
   version: number;
   created_at: string;
   updated_at: string;
};

export type WorkPullRequest = {
   id: string;
   workspace_id: string;
   issue_id: string;
   repo_owner: string;
   repo_name: string;
   pr_number: number;
   url: string;
   title: string | null;
   state: 'open' | 'closed' | 'merged' | null;
   last_checked_at: string | null;
   last_check_error: string | null;
   is_stale: boolean;
   hidden: boolean;
   created_at: string;
   updated_at: string;
};

export type WorkGithubConnection = {
   workspace_id: string;
   provider_user_id: string;
   login: string;
   scopes: string | null;
   connected_at: string;
   revoked_at: string | null;
   updated_at: string;
};

export type WorkspaceSearchResults = {
   projects: WorkProject[];
   issues: WorkIssue[];
};
