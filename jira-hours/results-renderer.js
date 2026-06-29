/**
 * Results Renderer - Weergave van Jira analysis resultaten
 */

export const ResultsRenderer = {
  /**
   * Render totaal overzicht
   */
  renderTotals(totals) {
    document.getElementById('jiraTotalLogged').textContent = totals.logged.toFixed(2);
    document.getElementById('jiraTotalIssues').textContent = totals.issues;
    document.getElementById('jiraTotalComments').textContent = totals.comments;
    document.getElementById('jiraTotalUpdates').textContent = totals.updates;
    
    // Voeg created toe als het bestaat
    const createdElement = document.getElementById('jiraTotalCreated');
    if (createdElement && totals.created !== undefined) {
      createdElement.textContent = totals.created;
    }

    // Voeg emails toe als het bestaat
    const emailsElement = document.getElementById('jiraTotalEmails');
    if (emailsElement && totals.emails !== undefined) {
      emailsElement.textContent = totals.emails;
    }
  },

  /**
   * Render dagelijkse breakdown
   */
  renderDailyBreakdown(dailyData, jiraUrl) {
    const container = document.getElementById('jiraDailyBreakdown');
    container.innerHTML = '';

    // Sorteer op datum (nieuwste eerst)
    const sortedDates = Object.keys(dailyData).sort((a, b) => b.localeCompare(a));

    for (const date of sortedDates) {
      const data = dailyData[date];
      const dateObj = new Date(date);
      const dayName = dateObj.toLocaleDateString('nl-NL', { weekday: 'long' });
      const dateFormatted = dateObj.toLocaleDateString('nl-NL', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });

      const issueBreakdown = this.calculateIssueTimeBreakdown(data.activities, date);
      const issueTimesHtml = Object.entries(issueBreakdown)
        .sort((a, b) => b[1] - a[1])
        .map(([issue, hours]) => `<span class="issue-time-badge">${issue}: ${String(hours).replace(/^0\./, '.')}h</span>`)
        .join('');

      const dayCard = document.createElement('div');
      dayCard.className = 'day-card';

      dayCard.innerHTML = `
        <div class="day-header">
          <div>
            <div class="day-name">${dayName}</div>
            <div class="day-date">${dateFormatted}</div>
          </div>
          <div class="day-header-right">
            <div class="day-total">${data.logged.toFixed(2)}h gelogd</div>
            ${issueTimesHtml ? `<div class="issue-times">${issueTimesHtml}</div>` : ''}
          </div>
        </div>
        <div class="day-stats">
          <span>📋 ${data.issuesCount} issues</span>
          <span>💬 ${data.comments} comments</span>
          <span>✏️ ${data.updates} updates</span>
          ${data.created ? `<span>✨ ${data.created} aangemaakt</span>` : ''}
          ${data.emails ? `<span>📧 ${data.emails} emails</span>` : ''}
        </div>
        <div class="activity-list">
          ${this.renderActivities(data.activities, jiraUrl)}
        </div>
      `;

      container.appendChild(dayCard);
    }
  },

  /**
   * Render individual activities
   */
  renderActivities(activities, jiraUrl) {
    if (activities.length === 0) {
      return '<div class="activity-item">Geen details beschikbaar</div>';
    }

    // Sorteer op tijd
    const sorted = activities.sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    // Verwijder trailing slash van jiraUrl
    const baseUrl = jiraUrl ? jiraUrl.replace(/\/$/, '') : '';

    return sorted.map(activity => {
      const time = new Date(activity.timestamp).toLocaleTimeString('nl-NL', {
        hour: '2-digit',
        minute: '2-digit'
      });

      // Maak issue link met summary als tooltip
      const issueLink = baseUrl 
        ? `<a href="${baseUrl}/browse/${activity.issue}" target="_blank" class="issue-link" title="${activity.summary || activity.issue}">${activity.issue}</a>` 
        : activity.issue;

      let icon, text;
      switch (activity.type) {
        case 'worklog':
          icon = '⏱️';
          const hours = (activity.timeSpent / 3600).toFixed(2);
          text = `${hours}h gelogd${activity.comment ? `: ${activity.comment}` : ''}`;
          break;
        case 'comment':
          icon = '💬';
          text = `Comment toegevoegd`;
          break;
        case 'update':
          icon = '✏️';
          text = activity.changes.join(', ');
          break;
        case 'email':
          icon = '📧';
          text = `Email verstuurd${activity.recipient ? ` naar ${activity.recipient}` : ''}`;
          break;
        case 'created':
          icon = '✨';
          let descriptionText = '';
          if (activity.description) {
            if (typeof activity.description === 'string') {
              descriptionText = activity.description.substring(0, 100);
            } else if (activity.description.content) {
              // Atlassian Document Format - extract text from content
              descriptionText = this.extractTextFromADF(activity.description).substring(0, 100);
            }
            text = `Issue aangemaakt${descriptionText ? ` - ${descriptionText}...` : ''}`;
          } else {
            text = 'Issue aangemaakt';
          }
          break;
        default:
          icon = '📝';
          text = 'Activity';
      }

      return `
        <div class="activity-item">
          <span class="activity-time">${time}</span>
          <span class="activity-icon">${icon}</span>
          <span class="activity-issue">${issueLink}</span>
          <span class="activity-text">${text}</span>
        </div>
      `;
    }).join('');
  },

  /**
   * Bereken geschatte tijd per issue op basis van activiteitsgaten (zoals git-hours)
   * Eerste activity: tijd vanaf 9:00 dag start; opvolgende: tijd vanaf vorige activity
   * Trekt 30 min pauze af als een gap 12:00 overspant; rondt per issue af op halve uren
   */
  calculateIssueTimeBreakdown(activities, date) {
    if (!activities || activities.length === 0) return {};

    const sorted = [...activities].sort((a, b) =>
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    const startTime = new Date(`${date}T09:00:00`);
    const lunchTime = new Date(`${date}T12:00:00`);
    const issueTimes = {};
    let prevTime = startTime;

    for (const activity of sorted) {
      const activityTime = new Date(activity.timestamp);
      let diffMs = activityTime - prevTime;

      // Trek 30 min pauze af als de gap 12:00 overspant
      if (prevTime < lunchTime && activityTime > lunchTime) {
        diffMs -= 30 * 60 * 1000;
      }

      const hours = diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
      issueTimes[activity.issue] = (issueTimes[activity.issue] || 0) + hours;
      prevTime = activityTime;
    }

    // Afronden op halve uren
    for (const issue of Object.keys(issueTimes)) {
      issueTimes[issue] = Math.round(issueTimes[issue] * 2) / 2;
    }

    return issueTimes;
  },

  /**
   * Extract plain text from Atlassian Document Format (ADF)
   */
  extractTextFromADF(adf) {
    if (!adf || !adf.content) {
      return '';
    }

    let text = '';
    const extractFromNode = (node) => {
      if (node.type === 'text') {
        text += node.text || '';
      }
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach(extractFromNode);
      }
    };

    adf.content.forEach(extractFromNode);
    return text.trim();
  }
};
