/**
 * Pull Requests GitHub API Module
 */

export const PullRequestAPI = {
  _headers(token) {
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (token) headers['Authorization'] = `token ${token}`;
    return headers;
  },

  async getAuthenticatedUser(token) {
    const response = await fetch('https://api.github.com/user', {
      headers: this._headers(token)
    });
    if (!response.ok) throw new Error(`GitHub API fout: ${response.status} ${response.statusText}`);
    return response.json();
  },

  async fetchReviewRequestedPRs(owner, repo, username, token) {
    const q = `is:pr+is:open+review-requested:${username}+repo:${owner}/${repo}`;
    const url = `https://api.github.com/search/issues?q=${q}&per_page=50`;
    const response = await fetch(url, { headers: this._headers(token) });
    if (!response.ok) throw new Error(`GitHub API fout: ${response.status} ${response.statusText}`);
    const data = await response.json();
    return data.items || [];
  },

  async fetchReviewedOpenPRs(owner, repo, username, token) {
    const q = `is:pr+is:open+reviewed-by:${username}+repo:${owner}/${repo}`;
    const url = `https://api.github.com/search/issues?q=${q}&per_page=50`;
    const response = await fetch(url, { headers: this._headers(token) });
    if (!response.ok) throw new Error(`GitHub API fout: ${response.status} ${response.statusText}`);
    const data = await response.json();
    return data.items || [];
  },

  async fetchAssigneePRs(owner, repo, username, token) {
    const q = `is:pr+is:open+assignee:${username}+repo:${owner}/${repo}`;
    const url = `https://api.github.com/search/issues?q=${q}&per_page=50`;
    const response = await fetch(url, { headers: this._headers(token) });
    if (!response.ok) throw new Error(`GitHub API fout: ${response.status} ${response.statusText}`);
    const data = await response.json();
    return data.items || [];
  },

  async fetchPRReviews(owner, repo, prNumber, token) {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`;
    const response = await fetch(url, { headers: this._headers(token) });
    if (!response.ok) return [];
    return response.json();
  },

  async fetchRequestedReviewers(owner, repo, prNumber, token) {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/requested_reviewers`;
    const response = await fetch(url, { headers: this._headers(token) });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.users || []).map(u => u.login);
  },

  async fetchClosedAuthorPRs(owner, repo, username, token, since) {
    const sinceDate = since.toISOString().split('T')[0];
    const q = `is:pr+is:closed+author:${username}+repo:${owner}/${repo}+closed:>=${sinceDate}`;
    const url = `https://api.github.com/search/issues?q=${q}&per_page=100&sort=updated&order=desc`;
    const response = await fetch(url, { headers: this._headers(token) });
    if (!response.ok) throw new Error(`GitHub API fout: ${response.status} ${response.statusText}`);
    const data = await response.json();
    return data.items || [];
  },

  async fetchReviewedMergedPRs(owner, repo, username, token, since) {
    const sinceDate = since.toISOString().split('T')[0];
    const q = `is:pr+is:merged+reviewed-by:${username}+repo:${owner}/${repo}+closed:>=${sinceDate}`;
    const url = `https://api.github.com/search/issues?q=${q}&per_page=100&sort=updated&order=desc`;
    const response = await fetch(url, { headers: this._headers(token) });
    if (!response.ok) throw new Error(`GitHub API fout: ${response.status} ${response.statusText}`);
    const data = await response.json();
    return data.items || [];
  }
};
