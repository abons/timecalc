/**
 * Jira API Module - Interactie met Jira REST API voor activity streams
 */

export const JiraAPI = {
  /**
   * Helper: Maak API call via background script (bypasses CORS)
   */
  async makeApiCall(url, headers) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'JIRA_API_CALL',
          url: url,
          headers: headers
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response.error || 'Unknown error'));
          }
        }
      );
    });
  },

  /**
   * Haal activity stream op voor een gebruiker binnen een periode
   */
  async fetchActivityStream(jiraUrl, email, token, since, until) {
    // Verwijder trailing slash van jiraUrl
    const baseUrl = jiraUrl.replace(/\/$/, '');
    
    // Bouw basis auth header
    const auth = btoa(`${email}:${token}`);
    const headers = {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    const activities = [];

    try {
      // Stap 1: Zoek eerst de gebruiker op basis van email
      console.log('🔍 Zoek gebruiker met email:', email);
      const userSearchUrl = `${baseUrl}/rest/api/3/user/search?query=${encodeURIComponent(email)}`;
      const users = await this.makeApiCall(userSearchUrl, headers);
      
      if (!users || users.length === 0) {
        throw new Error(`Gebruiker met email ${email} niet gevonden`);
      }
      
      const user = users[0];
      const accountId = user.accountId;
      console.log('✅ Gebruiker gevonden:', user.displayName, '(', accountId, ')');

      // Stap 2: Zoek worklogs van deze gebruiker
      // Gebruik worklog search API (indien beschikbaar) of zoek via issues
      console.log('📊 Zoek activities...');
      
      // Converteer datums naar timestamps
      const sinceTimestamp = new Date(since).getTime();
      const untilTimestamp = new Date(until + 'T23:59:59').getTime();
      
      // Zoek issues waar de gebruiker actief was (worklogs, comments, of updates)
      // Gebruik OR om alle activiteiten te vinden
      const jql = `(worklogAuthor = "${accountId}" AND worklogDate >= ${since} AND worklogDate <= ${until}) OR (comment ~ "${accountId}" AND updated >= ${since} AND updated <= ${until}) OR (assignee was "${accountId}" AND updated >= ${since} AND updated <= ${until})`;
      
      let startAt = 0;
      const maxResults = 50;
      let hasMore = true;

      while (hasMore) {
        const searchUrl = `${baseUrl}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=${maxResults}&fields=summary,worklog,comment,created,updated&expand=changelog`;
        
        try {
          const data = await this.makeApiCall(searchUrl, headers);
          
          if (!data.issues) {
            break;
          }
          
          // Verwerk de worklogs van elke issue
          for (const issue of data.issues) {
            // Worklogs
            if (issue.fields.worklog && issue.fields.worklog.worklogs) {
              const userWorklogs = issue.fields.worklog.worklogs.filter(log => {
                if (!log.author || log.author.accountId !== accountId) {
                  return false;
                }
                const logDate = new Date(log.started).getTime();
                return logDate >= sinceTimestamp && logDate <= untilTimestamp;
              });
              
              for (const worklog of userWorklogs) {
                activities.push({
                  type: 'worklog',
                  issue: issue.key,
                  summary: issue.fields.summary,
                  timestamp: worklog.started,
                  timeSpent: worklog.timeSpentSeconds,
                  comment: worklog.comment || ''
                });
              }
            }
            
            // Comments
            if (issue.fields.comment && issue.fields.comment.comments) {
              const userComments = issue.fields.comment.comments.filter(comment => {
                if (!comment.author || comment.author.accountId !== accountId) {
                  return false;
                }
                const commentDate = new Date(comment.created).getTime();
                return commentDate >= sinceTimestamp && commentDate <= untilTimestamp;
              });
              
              for (const comment of userComments) {
                activities.push({
                  type: 'comment',
                  issue: issue.key,
                  summary: issue.fields.summary,
                  timestamp: comment.created,
                  body: comment.body
                });
              }
            }
            
            // Changelog (updates)
            if (issue.changelog && issue.changelog.histories) {
              const userChanges = issue.changelog.histories.filter(history => {
                if (!history.author || history.author.accountId !== accountId) {
                  return false;
                }
                const changeDate = new Date(history.created).getTime();
                return changeDate >= sinceTimestamp && changeDate <= untilTimestamp;
              });
              
              for (const change of userChanges) {
                activities.push({
                  type: 'update',
                  issue: issue.key,
                  summary: issue.fields.summary,
                  timestamp: change.created,
                  changes: change.items.map(item => 
                    `${item.field}: ${item.fromString || '(empty)'} → ${item.toString || '(empty)'}`
                  )
                });
              }
            }
          }
          
          startAt += maxResults;
          hasMore = data.total > startAt;
          
          console.log(`📝 ${activities.length} worklogs gevonden tot nu toe...`);
        } catch (searchError) {
          console.warn('Search error:', searchError);
          break;
        }
      }
      
      console.log(`✅ Totaal ${activities.length} activities gevonden`);
      return activities;
    } catch (error) {
      console.error('Jira API Error:', error);
      throw error;
    }
  },

  /**
   * Alternatieve methode: gebruik de Activity Stream API (indien beschikbaar)
   * Let op: dit is mogelijk alleen beschikbaar in Jira Server/Data Center
   */
  async fetchActivityStreamDirect(jiraUrl, email, token, since, until) {
    const baseUrl = jiraUrl.replace(/\/$/, '');
    const auth = btoa(`${email}:${token}`);
    const headers = {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json'
    };

    try {
      // Activity streams endpoint (legacy, mogelijk niet in alle Jira Cloud instances)
      const activityUrl = `${baseUrl}/rest/api/3/user/activity?username=${encodeURIComponent(email)}`;
      
      const data = await this.makeApiCall(activityUrl, headers);
      
      // Filter activities binnen de periode
      const sinceDate = new Date(since);
      const untilDate = new Date(until);
      
      return data.items.filter(item => {
        const itemDate = new Date(item.published);
        return itemDate >= sinceDate && itemDate <= untilDate;
      });
    } catch (error) {
      console.error('Jira Activity Stream Error:', error);
      throw error;
    }
  }
};
