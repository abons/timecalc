/**
 * Commit Analyzer Module - Commit analyse en uren berekeningen
 */

export const CommitAnalyzer = {
  /**
   * Categoriseer een commit op basis van branch of message
   */
  categorizeCommit(branches, message) {
    // Gebruik de branch naam als categorie
    if (branches && branches.length > 0) {
      return branches[0]; // Return de branch naam zelf
    }

    // Fallback: kijk naar JIRA ticket nummer in message (YOOSUP-123, SPR-456)
    const ticketMatch = message.match(/\b(YOOSUP-\d+|SPR-\d+)\b/i);
    if (ticketMatch) {
      return ticketMatch[1].toUpperCase(); // Gebruik ticket nummer zoals YOOSUP-123
    }

    // Als er echt geen info is, gebruik commit message eerste paar woorden
    const shortMsg = message.split(' ').slice(0, 3).join(' ');
    return shortMsg || 'onbekend';
  },

  /**
   * Analyseer commits en bereken uren
   */
  async analyzeCommits(commits, firstInteractions) {
    // Parse en sorteer commits
    const parsedCommits = commits.map(commit => {
      const date = new Date(commit.commit.author.date);
      
      // Haal branch info op
      const htmlUrl = commit.html_url || '';
      const branches = commit.branches || [];
      
      return {
        datetime: date,
        date: date.toISOString().split('T')[0],
        time: date.toTimeString().split(' ')[0].substring(0, 5),
        message: commit.commit.message.split('\n')[0], // Eerste regel
        sha: commit.sha.substring(0, 7),
        fullSha: commit.sha,
        htmlUrl: htmlUrl,
        branches: branches,
        category: this.categorizeCommit(branches, commit.commit.message)
      };
    }).sort((a, b) => a.datetime - b.datetime);

    // Schat uren
    const dailyHours = {};
    const dailyCommits = {};
    const dailyFirstCommits = {}; // Track eerste commit per dag
    const dailyStartTimeSource = {}; // Track of starttijd uit storage komt of default is

    for (const commit of parsedCommits) {
      const { date, category } = commit;

      // Initialiseer dag indien nodig
      if (!dailyHours[date]) {
        dailyHours[date] = {};
        dailyCommits[date] = [];
      }

      // Initialiseer categorie indien nodig
      if (!dailyHours[date][category]) {
        dailyHours[date][category] = 0;
      }

      dailyCommits[date].push(commit);

      let hours = 0;

      // Check of dit de eerste commit van de dag is
      if (!dailyFirstCommits[date]) {
        // Eerste commit van de dag
        dailyFirstCommits[date] = commit;
        
        // Probeer starttijd uit storage te halen
        const firstInteraction = firstInteractions[date];
        let startHour, startMin;
        
        if (firstInteraction) {
          // Parse tijd (HH:MM format) uit storage
          [startHour, startMin] = firstInteraction.split(':').map(Number);
          dailyStartTimeSource[date] = 'storage';
        } else {
          // Gebruik default 9:00
          startHour = 9;
          startMin = 0;
          dailyStartTimeSource[date] = 'default';
        }
        
        const startTime = new Date(commit.datetime);
        startTime.setHours(startHour, startMin, 0, 0);
        
        // Bereken tijd vanaf start tot eerste commit
        const timeDiff = commit.datetime - startTime;
        if (timeDiff > 0) {
          hours = timeDiff / (1000 * 60 * 60);
        }
      } else {
        // Niet de eerste commit - bereken tijd vanaf vorige commit
        const prevCommit = dailyCommits[date][dailyCommits[date].length - 2]; // -2 omdat we al gepusht hebben
        const timeDiff = commit.datetime - prevCommit.datetime;
        hours = timeDiff / (1000 * 60 * 60);
      }

      dailyHours[date][category] += hours;
    }

    return { dailyHours, dailyCommits, dailyStartTimeSource };
  }
};
