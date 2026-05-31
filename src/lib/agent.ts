export const githubAgent = {
  async listRepos(token: string) {
    const r = await fetch('https://api.github.com/user/repos?sort=updated&per_page=20', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return r.json();
  },
  async getCommits(token: string, owner: string, repo: string) {
    const r = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return r.json();
  },
  async listBranches(token: string, owner: string, repo: string) {
    const r = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/branches`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return r.json();
  },
  async listIssues(token: string, owner: string, repo: string) {
    const r = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues?state=open`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return r.json();
  },
  async listPRs(token: string, owner: string, repo: string) {
    const r = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls?state=open`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return r.json();
  },
  async createRepo(token: string, name: string, description = '', isPrivate = false) {
    const r = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, private: isPrivate, auto_init: true }),
    });
    return r.json();
  },
};

export const vercelAgent = {
  async listProjects(token: string) {
    const r = await fetch('https://api.vercel.com/v9/projects', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return r.json();
  },
  async listDeployments(token: string, projectId?: string) {
    const url = projectId
      ? `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=10`
      : 'https://api.vercel.com/v6/deployments?limit=10';
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    return r.json();
  },
};

export const renderAgent = {
  async listServices(token: string) {
    const r = await fetch('https://api.render.com/v1/services?limit=20', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return r.json();
  },
};

export const tavilySearch = async (token: string, query: string) => {
  const r = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: token, query, max_results: 5 }),
  });
  return r.json();
};

export interface AgentIntent {
  platform: 'github' | 'vercel' | 'render' | 'tavily';
  action: string;
  extract?: boolean;
}

export const parseAgentIntent = (text: string): AgentIntent | null => {
  const t = text.toLowerCase();
  if (/list[ae]?\s+(meus\s+)?repos?/.test(t)) return { platform: 'github', action: 'listRepos' };
  if (/(cria|criar)\s+repo/.test(t)) return { platform: 'github', action: 'createRepo' };
  if (/(ver|mostr|list).*(issues?)/.test(t)) return { platform: 'github', action: 'listIssues', extract: true };
  if (/(ver|mostr|list).*(commits?)/.test(t)) return { platform: 'github', action: 'getCommits', extract: true };
  if (/(ver|mostr|list).*(branch)/.test(t)) return { platform: 'github', action: 'listBranches', extract: true };
  if (/(ver|mostr|list).*(pr|pull\s+request)/.test(t)) return { platform: 'github', action: 'listPRs', extract: true };
  if (/(projeto|project).*(vercel)|vercel.*(projeto|project)/.test(t)) return { platform: 'vercel', action: 'listProjects' };
  if (/(deploy).*(vercel)|vercel.*(deploy)/.test(t)) return { platform: 'vercel', action: 'listDeployments' };
  if (/(servi[çc]).*(render)|render.*(servi[çc])/.test(t)) return { platform: 'render', action: 'listServices' };
  if (/(pesquis|busca|search|procur)/.test(t)) return { platform: 'tavily', action: 'search' };
  return null;
};
