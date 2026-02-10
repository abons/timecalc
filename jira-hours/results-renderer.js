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
  },

  /**
   * Render dagelijkse breakdown
   */
  renderDailyBreakdown(dailyData) {
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

      const dayCard = document.createElement('div');
      dayCard.className = 'day-card';
      
      dayCard.innerHTML = `
        <div class="day-header">
          <div>
            <div class="day-name">${dayName}</div>
            <div class="day-date">${dateFormatted}</div>
          </div>
          <div class="day-total">${data.logged.toFixed(2)}h geloogd</div>
        </div>
        <div class="day-stats">
          <span>📋 ${data.issuesCount} issues</span>
          <span>💬 ${data.comments} comments</span>
          <span>✏️ ${data.updates} updates</span>
        </div>
        <div class="activity-list">
          ${this.renderActivities(data.activities)}
        </div>
      `;

      container.appendChild(dayCard);
    }
  },

  /**
   * Render individual activities
   */
  renderActivities(activities) {
    if (activities.length === 0) {
      return '<div class="activity-item">Geen details beschikbaar</div>';
    }

    // Sorteer op tijd
    const sorted = activities.sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    return sorted.map(activity => {
      const time = new Date(activity.timestamp).toLocaleTimeString('nl-NL', {
        hour: '2-digit',
        minute: '2-digit'
      });

      let icon, text;
      switch (activity.type) {
        case 'worklog':
          icon = '⏱️';
          const hours = (activity.timeSpent / 3600).toFixed(2);
          text = `${hours}h geloogd${activity.comment ? `: ${activity.comment}` : ''}`;
          break;
        case 'comment':
          icon = '💬';
          text = `Comment toegevoegd`;
          break;
        case 'update':
          icon = '✏️';
          text = activity.changes.join(', ');
          break;
        default:
          icon = '📝';
          text = 'Activity';
      }

      return `
        <div class="activity-item">
          <span class="activity-time">${time}</span>
          <span class="activity-icon">${icon}</span>
          <span class="activity-issue">${activity.issue}</span>
          <span class="activity-text">${text}</span>
        </div>
      `;
    }).join('');
  }
};
