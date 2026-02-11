/**
 * Jira Hours - Main Entry Point
 * Orkestratie van modules voor tijdsanalyse via Jira activity streams
 */

import { StorageManager } from './storage.js';
import { PeriodSelector } from './period-selector.js';
import { JiraAPI } from './jira-api.js';
import { ActivityAnalyzer } from './activity-analyzer.js';
import { ResultsRenderer } from './results-renderer.js';

document.addEventListener('DOMContentLoaded', async () => {
  // DOM elementen
  const jiraUrl = document.getElementById('jiraUrl');
  const jiraEmail = document.getElementById('jiraEmail');
  const jiraToken = document.getElementById('jiraToken');
  const periodSelect = document.getElementById('jiraPeriodSelect');
  const customPeriod = document.getElementById('jiraCustomPeriod');
  const dateFrom = document.getElementById('jiraDateFrom');
  const dateTo = document.getElementById('jiraDateTo');
  const analyzeBtn = document.getElementById('jiraAnalyzeBtn');
  const loadingMsg = document.getElementById('jiraLoadingMsg');
  const errorMsg = document.getElementById('jiraErrorMsg');
  const resultsSection = document.getElementById('jiraResultsSection');
  const configHeader = document.getElementById('jiraConfigHeader');
  const configSection = document.getElementById('jiraConfigSection');

  // Genereer dynamische periode opties
  PeriodSelector.populatePeriodOptions(periodSelect);

  // Laad opgeslagen settings
  const settings = await StorageManager.loadSettings();
  jiraUrl.value = settings.jiraUrl;
  jiraEmail.value = settings.jiraEmail;
  jiraToken.value = settings.jiraToken;

  // Collapse config section als alles is ingevuld
  const isConfigComplete = settings.jiraUrl && settings.jiraEmail && settings.jiraToken;
  if (isConfigComplete) {
    configHeader.classList.add('collapsed');
    configSection.classList.add('collapsed');
  }

  // Collapse toggle
  configHeader.addEventListener('click', () => {
    configHeader.classList.toggle('collapsed');
    configSection.classList.toggle('collapsed');
  });

  // Custom period toggle
  periodSelect.addEventListener('change', () => {
    customPeriod.style.display = periodSelect.value === 'custom' ? 'block' : 'none';
  });

  // Sla settings op bij wijziging
  [jiraUrl, jiraEmail, jiraToken].forEach(input => {
    input.addEventListener('change', async () => {
      await StorageManager.saveSettings({
        jiraUrl: jiraUrl.value,
        jiraEmail: jiraEmail.value,
        jiraToken: jiraToken.value
      });
    });
  });

  // Analyse button handler
  analyzeBtn.addEventListener('click', async () => {
    // Reset UI
    loadingMsg.style.display = 'block';
    errorMsg.style.display = 'none';
    resultsSection.style.display = 'none';

    try {
      // Valideer inputs
      if (!jiraUrl.value) {
        throw new Error('Vul een Jira URL in');
      }
      if (!jiraEmail.value) {
        throw new Error('Vul je email in');
      }
      if (!jiraToken.value) {
        throw new Error('Vul een API token in');
      }

      // Bepaal periode
      const { since, until } = PeriodSelector.getPeriod(
        periodSelect.value,
        dateFrom.value,
        dateTo.value
      );

      if (!since || !until) {
        throw new Error('Selecteer een geldige periode');
      }

      console.log(`📊 Analyseren van ${since} tot ${until}...`);

      // Haal activities op
      const activities = await JiraAPI.fetchActivityStream(
        jiraUrl.value,
        jiraEmail.value,
        jiraToken.value,
        since,
        until
      );

      console.log(`✅ ${activities.length} activities gevonden`);

      // Analyseer activities
      const results = ActivityAnalyzer.analyzeActivities(activities);

      // Render resultaten
      ResultsRenderer.renderTotals(results.totals);
      ResultsRenderer.renderDailyBreakdown(results.daily, jiraUrl.value);

      // Toon resultaten
      loadingMsg.style.display = 'none';
      resultsSection.style.display = 'block';
    } catch (error) {
      console.error('❌ Error:', error);
      loadingMsg.style.display = 'none';
      errorMsg.textContent = `Error: ${error.message}`;
      errorMsg.style.display = 'block';
    }
  });
});
