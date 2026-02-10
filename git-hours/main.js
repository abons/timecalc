/**
 * Git Hours - Main Entry Point
 * Orkestratie van modules voor tijdsanalyse van commits
 */

import { StorageManager } from './storage.js';
import { PeriodSelector } from './period-selector.js';
import { GitHubAPI } from './github-api.js';
import { CommitAnalyzer } from './commit-analyzer.js';
import { ResultsRenderer } from './results-renderer.js';

document.addEventListener('DOMContentLoaded', async () => {
  // DOM elementen
  const githubToken = document.getElementById('githubToken');
  const repoOwner = document.getElementById('repoOwner');
  const repoName = document.getElementById('repoName');
  const authorEmail = document.getElementById('authorEmail');
  const periodSelect = document.getElementById('periodSelect');
  const customPeriod = document.getElementById('customPeriod');
  const dateFrom = document.getElementById('dateFrom');
  const dateTo = document.getElementById('dateTo');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const loadingMsg = document.getElementById('loadingMsg');
  const errorMsg = document.getElementById('errorMsg');
  const resultsSection = document.getElementById('resultsSection');

  // Tab switching logica
  initTabSwitching();

  // Genereer dynamische periode opties
  PeriodSelector.populatePeriodOptions(periodSelect);

  // Laad opgeslagen settings
  const settings = await StorageManager.loadSettings();
  githubToken.value = settings.githubToken;
  repoOwner.value = settings.repoOwner;
  repoName.value = settings.repoName;
  authorEmail.value = settings.authorEmail;

  // Custom period toggle
  periodSelect.addEventListener('change', () => {
    customPeriod.style.display = periodSelect.value === 'custom' ? 'block' : 'none';
  });

  // Sla settings op bij wijziging
  [githubToken, repoOwner, repoName, authorEmail].forEach(input => {
    input.addEventListener('change', async () => {
      await StorageManager.saveSettings({
        githubToken: githubToken.value,
        repoOwner: repoOwner.value,
        repoName: repoName.value,
        authorEmail: authorEmail.value
      });
    });
  });

  // Main analyse functie
  analyzeBtn.addEventListener('click', async () => {
    try {
      // Reset UI
      errorMsg.style.display = 'none';
      resultsSection.style.display = 'none';
      loadingMsg.style.display = 'block';

      // Bepaal periode
      const { since, until } = PeriodSelector.getPeriod(
        periodSelect.value,
        dateFrom.value,
        dateTo.value
      );
      
      console.log('=== Git Hours Debug ===');
      console.log('Periode:', periodSelect.value);
      console.log('Since:', since);
      console.log('Until:', until);
      console.log('Author:', authorEmail.value);

      // Haal commits op
      const commits = await GitHubAPI.fetchCommits(
        repoOwner.value,
        repoName.value,
        authorEmail.value,
        since,
        until,
        githubToken.value
      );

      if (commits.length === 0) {
        throw new Error('Geen commits gevonden voor deze periode en auteur.');
      }

      // Haal eerst interactie tijden op
      const firstInteractions = await StorageManager.getFirstInteractions();

      // Analyseer commits
      const analysis = await CommitAnalyzer.analyzeCommits(commits, firstInteractions);

      // Toon resultaten
      ResultsRenderer.displayResults(analysis, repoOwner.value, repoName.value);

      loadingMsg.style.display = 'none';
      resultsSection.style.display = 'block';

    } catch (error) {
      console.error('Error:', error);
      loadingMsg.style.display = 'none';
      errorMsg.textContent = `❌ Fout: ${error.message}`;
      errorMsg.style.display = 'block';
    }
  });
});

/**
 * Initialiseer tab switching
 */
function initTabSwitching() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.dataset.tab;
      
      // Update active states
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      button.classList.add('active');
      document.getElementById(`${targetTab}-tab`).classList.add('active');
    });
  });
}
