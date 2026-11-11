export type GithubTimestamp = Date | string | null;

export type GithubConnectionRecord = Readonly<{
   workspace_id: string;
   provider_user_id: string;
   login: string;
   token_ciphertext: string | null;
   token_iv: string | null;
   token_tag: string | null;
   token_expires_at: GithubTimestamp;
   refresh_token_ciphertext: string | null;
   refresh_token_iv: string | null;
   refresh_token_tag: string | null;
   refresh_token_expires_at: GithubTimestamp;
   installation_id: string | number | null;
   connection_generation: number;
   token_version: number;
   refresh_lease_id: string | null;
   refresh_lease_expires_at: GithubTimestamp;
   connected_at: GithubTimestamp;
   revoked_at: GithubTimestamp;
   updated_at: GithubTimestamp;
}>;

export type GithubOauthStateRecord = Readonly<{
   id: string;
   state_hash: string;
   workspace_id: string;
   user_id: string;
   code_verifier_ciphertext: string;
   code_verifier_iv: string;
   code_verifier_tag: string;
   connection_generation: number;
   expires_at: GithubTimestamp;
   consumed_at: GithubTimestamp;
}>;

export type PullRequestRecord = Readonly<{
   id: string;
   workspace_id: string;
   issue_id: string;
   repo_owner: string;
   repo_name: string;
   pr_number: number;
   url: string | null;
   title: string | null;
   state: 'open' | 'closed' | 'merged' | null;
   last_checked_at: GithubTimestamp;
   last_check_error: string | null;
   is_stale: boolean;
   hidden: boolean;
   attempt: number;
   connection_generation: number;
   refresh_lease_id: string | null;
   refresh_lease_expires_at: GithubTimestamp;
   linked_by: string | null;
   created_at: GithubTimestamp;
   updated_at: GithubTimestamp;
}>;

export type GithubConnectionStatus =
   | 'unconfigured'
   | 'unavailable'
   | 'disconnected'
   | 'reauthorization_required'
   | 'connected';

export type GithubStatusView = Readonly<{
   configured: boolean;
   status: GithubConnectionStatus;
   login: string | null;
   installationId: string | null;
   connectedAt: string | null;
}>;

export type GithubInstallationView = Readonly<{
   id: string;
   accountLogin: string;
   accountType: 'User' | 'Organization' | 'Enterprise' | 'Unknown';
   repositorySelection: string | null;
}>;

export type GithubPullRequestView = Readonly<{
   id: string;
   owner: string;
   repository: string;
   number: number;
   url: string;
   title: string;
   state: 'open' | 'closed' | 'merged';
   lastCheckedAt: string | null;
   lastCheckedLabel: string | null;
   isStale: boolean;
   error: string | null;
}>;

export type GithubIssueView = Readonly<{
   configured: boolean;
   status: GithubConnectionStatus;
   pullRequest: GithubPullRequestView | null;
   needsRelink: boolean;
   installUrl: string | null;
}>;
