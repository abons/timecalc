/**
 * GitHub API Module - GitHub API calls en branch info
 */

export const GitHubAPI = {
  /**
   * Fetch commits van GitHub API - alleen van actieve branches
   */
  async fetchCommits(owner, repo, author, since, until, token) {
    const headers = {
      'Accept': 'application/vnd.github.v3+json'
    };

    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    console.log(`Fetching commits for ${author} from ${since} to ${until}...`);

    // Haal alleen de belangrijkste/actieve branches op (bijv. de eerste 10-20)
    const branches = await this.fetchActiveBranches(owner, repo, headers, 20);
    console.log(`Checking ${branches.length} active branches:`, branches.join(', '));

    // Map om duplicaten te voorkomen (gebaseerd op SHA)
    const commitMap = new Map();

    // Haal commits op van elke actieve branch
    for (const branch of branches) {
      const branchCommits = await this.fetchCommitsFromBranch(
        owner, repo, author, since, until, branch, headers
      );
      
      if (branchCommits.length > 0) {
        console.log(`Branch ${branch}: ${branchCommits.length} commits`);
      }
      
      // Voeg commits toe aan map (duplicaten worden automatisch overgeslagen)
      for (const commit of branchCommits) {
        if (!commitMap.has(commit.sha)) {
          commitMap.set(commit.sha, commit);
        }
      }
    }

    const allCommits = Array.from(commitMap.values());
    
    // Haal branch info op voor unieke commits
    console.log('Fetching branch info for commits...');
    for (const commit of allCommits) {
      commit.branches = await this.fetchBranchInfo(owner, repo, commit.sha, headers);
    }

    console.log(`Total unique commits: ${allCommits.length}`);
    return allCommits;
  },

  /**
   * Fetch alleen de actieve/belangrijke branches (vermijd stale branches)
   */
  async fetchActiveBranches(owner, repo, headers, limit = 20) {
    const url = `https://api.github.com/repos/${owner}/${repo}/branches?per_page=${limit}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const branches = await response.json();
    return branches.map(b => b.name);
  },

  /**
   * Fetch commits van een specifieke branch
   */
  async fetchCommitsFromBranch(owner, repo, author, since, until, branch, headers) {
    const commits = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const url = `https://api.github.com/repos/${owner}/${repo}/commits?` +
        `author=${encodeURIComponent(author)}&` +
        `since=${since}&` +
        `until=${until}&` +
        `sha=${encodeURIComponent(branch)}&` +
        `per_page=${perPage}&` +
        `page=${page}`;

      const response = await fetch(url, { headers });

      if (!response.ok) {
        // Stille fail voor branches waar we geen toegang toe hebben
        break;
      }

      const pageCommits = await response.json();
      if (pageCommits.length === 0) break;

      // Filter merge commits
      const nonMergeCommits = pageCommits.filter(commit => {
        return !commit.commit.message.toLowerCase().startsWith('merge');
      });

      commits.push(...nonMergeCommits);

      if (pageCommits.length < perPage) break;
      page++;
    }

    return commits;
  },

  /**
   * Haal branch informatie op voor een commit
   */
  async fetchBranchInfo(owner, repo, sha, headers) {
    const branches = [];
    
    // Probeer PR info op te halen (bevat de bron branch)
    try {
      const prUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}/pulls`;
      const prResponse = await fetch(prUrl, { 
        headers: {
          ...headers,
          'Accept': 'application/vnd.github.groot-preview+json'
        }
      });
      
      if (prResponse.ok) {
        const prs = await prResponse.json();
        if (prs.length > 0) {
          // Gebruik de head branch van de eerste PR
          const headBranch = prs[0].head.ref;
          branches.push(headBranch);
          return branches;
        }
      }
    } catch (error) {
      console.warn(`Could not fetch PR info for commit ${sha}:`, error);
    }
    
    // Als we via PR geen branch hebben, probeer branches-where-head
    if (branches.length === 0) {
      try {
        const branchUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}/branches-where-head`;
        const branchResponse = await fetch(branchUrl, { headers });
        
        if (branchResponse.ok) {
          const branchesData = await branchResponse.json();
          return branchesData.map(b => b.name);
        }
      } catch (error) {
        console.warn(`Could not fetch branches for commit ${sha}:`, error);
      }
    }
    
    return branches;
  }
};
