/**
 * Activity Analyzer - Analyseer Jira activities en bereken tijden
 */

export const ActivityAnalyzer = {
  /**
   * Analyseer activities en groepeer per dag
   */
  analyzeActivities(activities) {
    const dailyStats = {};
    let totalLogged = 0;
    let totalIssues = new Set();
    let totalComments = 0;
    let totalUpdates = 0;

    for (const activity of activities) {
      const date = activity.timestamp.substring(0, 10); // YYYY-MM-DD
      
      if (!dailyStats[date]) {
        dailyStats[date] = {
          logged: 0,
          issues: new Set(),
          comments: 0,
          updates: 0,
          activities: []
        };
      }
      
      // Tel totals
      if (activity.type === 'worklog') {
        const hours = activity.timeSpent / 3600; // seconds to hours
        dailyStats[date].logged += hours;
        totalLogged += hours;
      } else if (activity.type === 'comment') {
        dailyStats[date].comments++;
        totalComments++;
      } else if (activity.type === 'update') {
        dailyStats[date].updates++;
        totalUpdates++;
      }
      
      dailyStats[date].issues.add(activity.issue);
      totalIssues.add(activity.issue);
      dailyStats[date].activities.push(activity);
    }

    // Converteer Sets naar arrays en aantallen
    const dailyResults = {};
    for (const [date, stats] of Object.entries(dailyStats)) {
      dailyResults[date] = {
        logged: stats.logged,
        issuesCount: stats.issues.size,
        issues: Array.from(stats.issues),
        comments: stats.comments,
        updates: stats.updates,
        activities: stats.activities
      };
    }

    return {
      daily: dailyResults,
      totals: {
        logged: totalLogged,
        issues: totalIssues.size,
        comments: totalComments,
        updates: totalUpdates
      }
    };
  },

  /**
   * Formatteer tijd in uren
   */
  formatHours(hours) {
    return hours.toFixed(2);
  }
};
