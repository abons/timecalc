/**
 * Results Renderer - Weergave van gecombineerde tijd per ticket per dag
 */

import { ResultsRenderer as JiraResultsRenderer } from '../jira-hours/results-renderer.js';

export const CombinedResultsRenderer = {
  /**
   * Escape HTML voor veilige weergave
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  formatHours(hours) {
    return String(Math.round(hours * 100) / 100).replace(/^0\./, '.');
  },

  /**
   * Render totaal en dagelijkse breakdown
   */
  render(result, jiraUrl) {
    document.getElementById('combinedTotal').textContent = this.formatHours(result.total);
    document.getElementById('combinedDays').textContent = Object.keys(result.daily).length;

    const container = document.getElementById('combinedDailyBreakdown');
    container.innerHTML = '';

    const baseUrl = jiraUrl ? jiraUrl.replace(/\/$/, '') : '';
    const sortedDates = Object.keys(result.daily).sort((a, b) => b.localeCompare(a));

    for (const date of sortedDates) {
      const day = result.daily[date];
      const dateObj = new Date(date + 'T12:00:00');
      const dayName = dateObj.toLocaleDateString('nl-NL', { weekday: 'long' });
      const dateFormatted = dateObj.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

      const dayCard = document.createElement('div');
      dayCard.className = 'day-card';
      dayCard.innerHTML = `
        <div class="day-header">
          <div>
            <div class="day-name">${dayName}</div>
            <div class="day-date">${dateFormatted}</div>
          </div>
          <div class="day-header-right">
            <div class="day-total">${this.formatHours(day.total)} uur</div>
            ${day.total > 0 ? `
              <div class="yoobi-buttons">
                <button class="yoobi-copy-btn" data-yoobi-date="${date}" title="Kopieer Yoobi fetch voor deze dag">📋 Yoobi</button>
                <button class="yoobi-copy-btn" data-yoobi-book="${date}" title="Boek deze dag direct in de open Yoobi tab">📤 Boek</button>
              </div>` : ''}
          </div>
        </div>
        <div class="yoobi-panel" data-yoobi-panel="${date}"></div>
        ${this.renderDayInfo(day)}
        ${day.startTimeSource === 'default'
          ? '<div class="day-note">⚠️ Starttijd 9:00 gebruikt (geen opgeslagen starttijd)</div>' : ''}
        ${day.tickets.map(t => this.renderTicket(t, baseUrl)).join('')}
      `;
      container.appendChild(dayCard);
    }
  },

  /**
   * Uren als tijdsduur, bv. 2.6667 -> 2:40
   */
  formatDuration(hours) {
    const minutes = Math.round(hours * 60);
    return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
  },

  formatClock(ms) {
    return new Date(ms).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  },

  /**
   * Timecalc werktijd naast de berekende uren, en werk buiten die werktijd
   */
  renderDayInfo(day) {
    const lines = [];
    if (day.timecalc) {
      const shown = day.scaled ? 'geschaald getoond' : 'berekend getoond';
      lines.push(`⏱️ Timecalc werktijd ${day.timecalc.first}–${day.timecalc.last} = ${this.formatDuration(day.timecalc.hours)} (excl. lunch) · berekend ${this.formatDuration(day.computedTotal)}${day.scaledTotal !== null ? ` · geschaald ${this.formatDuration(day.scaledTotal)}` : ''} · ${shown}`);
    }
    const { before, after } = day.outside || {};
    if (before) {
      const range = before.from ? `${this.formatClock(before.from)}–${before.until}` : `voor ${before.until}`;
      lines.push(`🌅 Werk vóór Timecalc starttijd: ${range}${before.hours > 0 ? ` · ${this.formatDuration(before.hours)} Claude` : ''}${before.points ? ` · ${before.points} commit/Jira` : ''}`);
    }
    if (after) {
      const range = after.to ? `${after.since}–${this.formatClock(after.to)}` : `na ${after.since}`;
      lines.push(`🌙 Werk na Timecalc eindtijd: ${range}${after.hours > 0 ? ` · ${this.formatDuration(after.hours)} Claude` : ''}${after.points ? ` · ${after.points} commit/Jira` : ''}`);
    }
    return lines.map(line => `<div class="day-note">${this.escapeHtml(line)}</div>`).join('');
  },

  /**
   * Render één ticket als inklapbare regel
   */
  renderTicket(ticket, baseUrl) {
    const label = ticket.ticket && baseUrl
      ? `<a href="${baseUrl}/browse/${encodeURIComponent(ticket.ticket)}" target="_blank" class="issue-link">${this.escapeHtml(ticket.label)}</a>`
      : `${ticket.ticket ? '' : '🌿 '}${this.escapeHtml(ticket.label)}`;

    const sources = [
      ticket.commits ? `🔨 ${ticket.commits}` : '',
      ticket.jiraActivities ? `🎫 ${ticket.jiraActivities}` : '',
      ticket.claudeMinutes >= 1 ? `<span title="Som van alle Claude sessies op dit ticket. Parallelle sessies tellen hier dubbel; de uren rechts zijn de eerlijk verdeelde klokuren.">🤖 ${this.formatHours(Math.round(ticket.claudeMinutes / 6) / 10)}u sessies</span>` : '',
      ticket.loggedHours ? `⏱️ ${this.formatHours(Math.round(ticket.loggedHours * 100) / 100)}u gelogd` : ''
    ].filter(Boolean).join(' · ');

    const events = [...ticket.events].sort((a, b) => b.datetime - a.datetime);

    return `
      <details class="combined-ticket">
        <summary>
          <span class="combined-ticket-key">${label}</span>
          <span class="combined-ticket-summary" title="${this.escapeHtml(ticket.summary)}">${this.escapeHtml(ticket.summary)}</span>
          <span class="combined-ticket-sources">${sources}</span>
          <span class="issue-time-badge" title="${ticket.scaledHours !== undefined ? `Berekend ${this.formatHours(ticket.computedHours)}u · geschaald ${this.formatHours(ticket.scaledHours)}u` : ''}">${this.formatHours(ticket.hours)}u</span>
        </summary>
        <div class="activity-list">
          ${events.map(e => this.renderEvent(e)).join('')}
        </div>
      </details>
    `;
  },

  /**
   * Render één commit of Jira activity
   */
  renderEvent(event) {
    const time = event.datetime.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });

    if (event.source === 'git') {
      return `
        <div class="activity-item">
          <span class="activity-time">${time}</span>
          <span class="activity-icon">🔨</span>
          <span class="activity-text">
            <a href="${event.url}" target="_blank" class="commit-link" title="Open in GitHub">${this.escapeHtml(event.message)}</a>
          </span>
          ${event.branch ? `<span class="commit-branch">🌿 ${this.escapeHtml(event.branch)}</span>` : ''}
        </div>
      `;
    }

    if (event.source === 'claude') {
      const end = event.endTime.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="activity-item">
          <span class="activity-time">${time}</span>
          <span class="activity-icon">🤖</span>
          <span class="activity-text">${event.title ? this.escapeHtml(event.title) : 'Claude sessie'} · tot ${end} (${Math.round(event.minutes)} min)</span>
        </div>
      `;
    }

    const { icon, text } = this.describeActivity(event.activity);
    return `
      <div class="activity-item">
        <span class="activity-time">${time}</span>
        <span class="activity-icon">${icon}</span>
        <span class="activity-text" title="${this.escapeHtml(text)}">${this.escapeHtml(text)}</span>
      </div>
    `;
  },

  describeActivity(activity) {
    switch (activity.type) {
      case 'worklog': {
        const comment = typeof activity.comment === 'string'
          ? activity.comment
          : JiraResultsRenderer.extractTextFromADF(activity.comment);
        return { icon: '⏱️', text: `${(activity.timeSpent / 3600).toFixed(2)}h gelogd${comment ? `: ${comment}` : ''}` };
      }
      case 'comment':
        return { icon: '💬', text: 'Comment toegevoegd' };
      case 'update':
        return { icon: '✏️', text: activity.changes.join(', ') };
      case 'email':
        return { icon: '📧', text: `Email verstuurd${activity.recipient ? ` naar ${activity.recipient}` : ''}` };
      case 'created': {
        const description = typeof activity.description === 'string'
          ? activity.description
          : JiraResultsRenderer.extractTextFromADF(activity.description);
        return { icon: '✨', text: `Issue aangemaakt${description ? ` - ${description.substring(0, 100)}` : ''}` };
      }
      default:
        return { icon: '📝', text: 'Activity' };
    }
  }
};
