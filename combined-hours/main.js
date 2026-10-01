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

document.addEventListener('DOMContentLoaded', () => {
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

  // Genereer dynamische periode opties
  PeriodSelector.populatePeriodOptions(periodSelect);

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
