/**
 * Results Renderer Module - Display resultaten en HTML generatie
 */

export const ResultsRenderer = {
  /**
   * Escape HTML voor veilige weergave
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Display analyse resultaten
   */
  displayResults(analysis, owner, repo) {
    const { dailyHours, dailyCommits, dailyStartTimeSource } = analysis;

    // Bereken totalen per branch
    const totals = {};

    Object.values(dailyHours).forEach(day => {
      Object.keys(day).forEach(category => {
        if (!totals[category]) {
          totals[category] = 0;
        }
        totals[category] += day[category];
      });
    });

    // Update summary cards - toon top 4 branches
    const sortedCategories = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    const summaryCards = document.querySelectorAll('.summary-card');
    sortedCategories.forEach(([category, hours], index) => {
      if (summaryCards[index]) {
        summaryCards[index].querySelector('.card-label').textContent = category;
        summaryCards[index].querySelector('.card-value').textContent = hours.toFixed(2);
        summaryCards[index].style.display = 'block';
      }
    });

    // Verberg ongebruikte cards
    for (let i = sortedCategories.length; i < summaryCards.length; i++) {
      summaryCards[i].style.display = 'none';
    }

    // Genereer dagelijks overzicht
    this.renderDailyBreakdown(dailyHours, dailyCommits, dailyStartTimeSource, owner, repo);
  },

  /**
   * Render dagelijks overzicht
   */
  renderDailyBreakdown(dailyHours, dailyCommits, dailyStartTimeSource, owner, repo) {
    const dailyBreakdown = document.getElementById('dailyBreakdown');
    dailyBreakdown.innerHTML = '<h3>Per Dag</h3>';

    const sortedDates = Object.keys(dailyHours).sort().reverse();

    sortedDates.forEach(date => {
      const dayData = dailyHours[date];
      const dayCommits = dailyCommits[date];
      const dayTotal = Object.values(dayData).reduce((sum, hours) => sum + hours, 0);

      const dayCard = document.createElement('div');
      dayCard.className = 'day-card';

      const dateObj = new Date(date + 'T12:00:00');
      const dayName = dateObj.toLocaleDateString('nl-NL', { weekday: 'long' });
      const dateFormatted = dateObj.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

      // Sorteer branches voor deze dag op uren
      const sortedDayCategories = Object.entries(dayData).sort((a, b) => b[1] - a[1]);

      dayCard.innerHTML = `
        <div class="day-header">
          <strong>${dayName} ${dateFormatted}</strong>
          <span class="day-total">${dayTotal.toFixed(2)} uur</span>
        </div>
        ${dailyStartTimeSource[date] === 'default' ? 
          '<div class="day-note">⚠️ Starttijd 9:00 gebruikt (geen opgeslagen starttijd)</div>' : ''}
        <div class="day-breakdown">
          ${sortedDayCategories.map(([cat, hours]) => 
            `<div class="breakdown-item">${this.escapeHtml(cat)}: ${hours.toFixed(2)}u</div>`
          ).join('')}
        </div>
        <div class="commits-list">
          <strong>Commits (${dayCommits.length}):</strong>
          ${dayCommits.map(c => {
            const commitUrl = `https://github.com/${owner}/${repo}/commit/${c.fullSha}`;
            const branchInfo = c.branches && c.branches.length > 0 ? c.branches[0] : c.category;
            return `
            <div class="commit-item">
              <span class="commit-time">${c.time}</span>
              <span class="commit-branch">🌿 ${this.escapeHtml(branchInfo)}</span>
              <span class="commit-message">
                <a href="${commitUrl}" target="_blank" class="commit-link" title="Open in GitHub">${this.escapeHtml(c.message)}</a>
              </span>
            </div>
          `}).join('')}
        </div>
      `;

      dailyBreakdown.appendChild(dayCard);
    });
  }
};
