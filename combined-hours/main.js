/**
 * Combined Hours - Main Entry Point
 * Voegt git commits en Jira activity samen tot tijd per ticket per dag
 */

import { StorageManager as GitStorage } from '../git-hours/storage.js';
import { GitHubAPI } from '../git-hours/github-api.js';
import { StorageManager as JiraStorage } from '../jira-hours/storage.js';
import { PeriodSelector } from '../jira-hours/period-selector.js';
import { JiraAPI } from '../jira-hours/jira-api.js';
import { TimelineAnalyzer } from './timeline-analyzer.js';
import { CombinedResultsRenderer } from './results-renderer.js';
import { StorageManager as YoobiStorage } from './storage.js';
import { YoobiFetch } from './yoobi-fetch.js';
import { YoobiBooker } from './yoobi-booker.js';

document.addEventListener('DOMContentLoaded', async () => {
  // DOM elementen
  const tabButton = document.querySelector('.tab-button[data-tab="combined"]');
  const periodSelect = document.getElementById('combinedPeriodSelect');
  const customPeriod = document.getElementById('combinedCustomPeriod');
  const dateFrom = document.getElementById('combinedDateFrom');
  const dateTo = document.getElementById('combinedDateTo');
  const analyzeBtn = document.getElementById('combinedAnalyzeBtn');
  const loadingMsg = document.getElementById('combinedLoadingMsg');
  const warningMsg = document.getElementById('combinedWarningMsg');
  const errorMsg = document.getElementById('combinedErrorMsg');
  const resultsSection = document.getElementById('combinedResultsSection');
  const dailyBreakdown = document.getElementById('combinedDailyBreakdown');
  const copyAllBtn = document.getElementById('yoobiCopyAllBtn');
  const bookAllBtn = document.getElementById('yoobiBookAllBtn');
  const allPanel = document.getElementById('yoobiAllPanel');
  const configHeader = document.getElementById('yoobiConfigHeader');
  const configSection = document.getElementById('yoobiConfigSection');
  const yoobiInputs = ['yoobiEmployeeId', 'yoobiActivities', 'yoobiSpecificationId']
    .map(id => document.getElementById(id));

  // Genereer dynamische periode opties
  PeriodSelector.populatePeriodOptions(periodSelect);

  // Laad Yoobi settings; collapse config als alles is ingevuld
  const yoobiSettings = await YoobiStorage.loadSettings();
  yoobiInputs.forEach(input => { input.value = yoobiSettings[input.id]; });
  if (yoobiInputs.every(input => input.value)) {
    configHeader.classList.add('collapsed');
    configSection.classList.add('collapsed');
  }

  configHeader.addEventListener('click', () => {
    configHeader.classList.toggle('collapsed');
    configSection.classList.toggle('collapsed');
  });

  yoobiInputs.forEach(input => {
    input.addEventListener('change', async () => {
      yoobiSettings[input.id] = input.value.trim();
      await YoobiStorage.saveSettings({ [input.id]: yoobiSettings[input.id] });
    });
  });

  // Kopieer Yoobi fetch(es) naar klembord
  let lastResult = null;
  const copyToClipboard = async (button, text) => {
    const original = button.textContent;
    try {
      if (!text) throw new Error('geen uren');
      await navigator.clipboard.writeText(text);
      button.textContent = '✅ Gekopieerd';
    } catch (error) {
      console.error('❌ Kopiëren mislukt:', error);
      button.textContent = '❌ Mislukt';
    }
    setTimeout(() => { button.textContent = original; }, 1500);
  };

  copyAllBtn.addEventListener('click', () => {
    if (!lastResult) return;
    copyToClipboard(copyAllBtn, YoobiFetch.buildAllFetches(lastResult.daily, yoobiSettings));
  });

  // Boek direct in de open Yoobi tab, na bevestiging (bestaande uren per activiteit/dag worden vervangen)
  const esc = (text) => CombinedResultsRenderer.escapeHtml(text);
  const dayPanel = (date) => dailyBreakdown.querySelector(`[data-yoobi-panel="${date}"]`);

  const setStatus = (panel, type, text) => {
    if (panel) panel.innerHTML = `<div class="yoobi-status ${type}">${esc(text)}</div>`;
  };

  const describeRequest = (request) => `
    <ul class="yoobi-lines">
      ${request.rows.map(row => `<li><strong>${esc(row.label)}</strong> ${row.hours}u · ${esc(row.note)}</li>`).join('')}
    </ul>
    ${request.skipped.length > 0
      ? `<div class="yoobi-skipped">Overgeslagen (geen activiteit): ${esc(request.skipped.join(', '))}</div>` : ''}
  `;

  const showConfirm = (panel, html, onConfirm) => {
    panel.innerHTML = `
      <div class="yoobi-confirm">
        <div class="yoobi-warning">⚠️ Bestaande uren op deze activiteiten worden voor die dag vervangen.</div>
        ${html}
        <div class="yoobi-buttons">
          <button class="yoobi-copy-btn" data-action="confirm">📤 Boek in Yoobi</button>
          <button class="yoobi-copy-btn" data-action="cancel">Annuleer</button>
        </div>
      </div>
    `;
    panel.querySelector('[data-action="confirm"]').addEventListener('click', (event) => {
      event.currentTarget.disabled = true;
      onConfirm();
    });
    panel.querySelector('[data-action="cancel"]').addEventListener('click', () => { panel.innerHTML = ''; });
  };

  // Panel opnieuw opzoeken na een await: een nieuwe analyse kan de dagen opnieuw gerenderd hebben
  const bookRequest = async (tabId, request) => {
    setStatus(dayPanel(request.date), 'busy', '⏳ Boeken in Yoobi...');
    try {
      const result = await YoobiBooker.saveTimesheetDay(tabId, request.body);
      setStatus(dayPanel(request.date), result.ok ? 'ok' : 'error', `${result.ok ? '✅' : '❌'} ${result.message}`);
      return result.ok;
    } catch (error) {
      setStatus(dayPanel(request.date), 'error', `❌ ${error.message}`);
      return false;
    }
  };

  let booking = false;
  const bookRequests = async (requests, statusPanel) => {
    const settingsError = YoobiFetch.validateSettings(yoobiSettings);
    if (settingsError) {
      setStatus(statusPanel, 'error', `❌ ${settingsError}`);
      return;
    }
    if (booking) return;
    booking = true;
    try {
      if (requests.length > 1) setStatus(statusPanel, 'busy', `⏳ ${requests.length} dagen boeken in Yoobi...`);
      const tab = await YoobiBooker.findTab();
      let booked = 0;
      for (const request of requests) {
        if (await bookRequest(tab.id, request)) booked++;
      }
      if (requests.length > 1) {
        setStatus(statusPanel, booked === requests.length ? 'ok' : 'error', `${booked} van ${requests.length} dagen geboekt`);
      }
    } catch (error) {
      setStatus(statusPanel, 'error', `❌ ${error.message}`);
    } finally {
      booking = false;
    }
  };

  dailyBreakdown.addEventListener('click', (event) => {
    if (!lastResult) return;

    const copyButton = event.target.closest('[data-yoobi-date]');
    if (copyButton) {
      const date = copyButton.dataset.yoobiDate;
      copyToClipboard(copyButton, YoobiFetch.buildDayFetch(date, lastResult.daily[date], yoobiSettings));
      return;
    }

    const bookButton = event.target.closest('[data-yoobi-book]');
    if (bookButton && !booking) {
      const date = bookButton.dataset.yoobiBook;
      const panel = dayPanel(date);
      const request = YoobiFetch.buildDayRequest(date, lastResult.daily[date], yoobiSettings);
      if (request.rows.length === 0) {
        panel.innerHTML = `<div class="yoobi-status error">Niets te boeken</div>${describeRequest(request)}`;
        return;
      }
      showConfirm(panel, describeRequest(request), () => bookRequests([request], panel));
    }
  });

  bookAllBtn.addEventListener('click', () => {
    if (!lastResult || booking) return;
    const requests = Object.keys(lastResult.daily)
      .sort()
      .map(date => YoobiFetch.buildDayRequest(date, lastResult.daily[date], yoobiSettings))
      .filter(request => request.rows.length > 0);
    if (requests.length === 0) {
      setStatus(allPanel, 'error', 'Niets te boeken');
      return;
    }
    const html = requests.map(request => `
      <div class="yoobi-day-title">${esc(request.date)}</div>
      ${describeRequest(request)}
    `).join('');
    showConfirm(allPanel, html, () => bookRequests(requests, allPanel));
  });

  // Main analyse functie; alleen de laatst gestarte analyse mag renderen
  let currentRequest = 0;
  const performAnalysis = async () => {
    const requestId = ++currentRequest;
    loadingMsg.style.display = 'block';
    warningMsg.style.display = 'none';
    errorMsg.style.display = 'none';
    resultsSection.style.display = 'none';

    try {
      const { since, until } = PeriodSelector.getPeriod(periodSelect.value, dateFrom.value, dateTo.value);
      if (!since || !until) {
        throw new Error('Selecteer een geldige periode');
      }

      // Settings uit de Git Commits en Jira Activity tabs
      const [git, jira] = await Promise.all([GitStorage.loadSettings(), JiraStorage.loadSettings()]);
      const gitConfigured = git.repoOwner && git.repoName && git.authorEmail;
      const jiraConfigured = jira.jiraUrl && jira.jiraEmail && jira.jiraToken;
      if (!gitConfigured && !jiraConfigured) {
        throw new Error('Vul eerst de configuratie in bij de tabs Git Commits en Jira Activity');
      }

      const [commitsResult, activitiesResult] = await Promise.allSettled([
        gitConfigured
          ? GitHubAPI.fetchCommits(
              git.repoOwner,
              git.repoName,
              git.authorEmail,
              new Date(`${since}T00:00:00`).toISOString(),
              new Date(`${until}T23:59:59`).toISOString(),
              git.githubToken
            )
          : Promise.reject(new Error('configuratie ontbreekt (tab Git Commits)')),
        jiraConfigured
          ? JiraAPI.fetchActivityStream(jira.jiraUrl, jira.jiraEmail, jira.jiraToken, since, until)
          : Promise.reject(new Error('configuratie ontbreekt (tab Jira Activity)'))
      ]);

      if (commitsResult.status === 'rejected' && activitiesResult.status === 'rejected') {
        throw new Error(`Git: ${commitsResult.reason.message} — Jira: ${activitiesResult.reason.message}`);
      }

      const warnings = [];
      if (commitsResult.status === 'rejected') warnings.push(`Git commits niet meegenomen: ${commitsResult.reason.message}`);
      if (activitiesResult.status === 'rejected') warnings.push(`Jira activity niet meegenomen: ${activitiesResult.reason.message}`);

      const commits = commitsResult.status === 'fulfilled' ? commitsResult.value : [];
      const activities = activitiesResult.status === 'fulfilled' ? activitiesResult.value : [];

      const events = TimelineAnalyzer.buildEvents(commits, activities, git.repoOwner, git.repoName);
      const firstInteractions = await GitStorage.getFirstInteractions();
      const result = TimelineAnalyzer.analyze(events, firstInteractions, since, until);
      if (requestId !== currentRequest) return;

      lastResult = result;
      allPanel.innerHTML = '';
      CombinedResultsRenderer.render(result, jira.jiraUrl);

      if (warnings.length > 0) {
        warningMsg.textContent = `⚠️ ${warnings.join(' | ')}`;
        warningMsg.style.display = 'block';
      }
      loadingMsg.style.display = 'none';
      resultsSection.style.display = 'block';
    } catch (error) {
      if (requestId !== currentRequest) return;
      console.error('❌ Error:', error);
      loadingMsg.style.display = 'none';
      errorMsg.textContent = `❌ Fout: ${error.message}`;
      errorMsg.style.display = 'block';
    }
  };

  // Custom period toggle en auto-analyse
  periodSelect.addEventListener('change', () => {
    customPeriod.style.display = periodSelect.value === 'custom' ? 'block' : 'none';
    if (periodSelect.value !== 'custom') {
      performAnalysis();
    }
  });

  [dateFrom, dateTo].forEach(input => {
    input.addEventListener('change', () => {
      if (periodSelect.value === 'custom' && dateFrom.value && dateTo.value) {
        performAnalysis();
      }
    });
  });

  analyzeBtn.addEventListener('click', performAnalysis);

  // Pas laden bij eerste keer openen van de tab (voorkomt dubbele API calls bij opstarten)
  let loaded = false;
  tabButton.addEventListener('click', () => {
    if (!loaded) {
      loaded = true;
      performAnalysis();
    }
  });
});
