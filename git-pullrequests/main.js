/**
 * Git Pull Requests - Main Entry Point
 */

import { PullRequestAPI } from './github-api.js';
import { PRResultsRenderer } from './results-renderer.js';

document.addEventListener('DOMContentLoaded', async () => {
  const githubToken = document.getElementById('prGithubToken');
  const repoOwner = document.getElementById('prRepoOwner');
  const repoName = document.getElementById('prRepoName');
  const githubUsername = document.getElementById('prGithubUsername');
  const refreshBtn = document.getElementById('prRefreshBtn');
  const loadingMsg = document.getElementById('prLoadingMsg');
  const errorMsg = document.getElementById('prErrorMsg');
  const resultsContainer = document.getElementById('prResults');
  const configHeader = document.getElementById('prConfigHeader');
  const configSection = document.getElementById('prConfigSection');

  // Laad opgeslagen settings (gedeeld met git-hours + eigen username key)
  const settings = await loadAllSettings();
  githubToken.value = settings.githubToken;
  repoOwner.value = settings.repoOwner;
  repoName.value = settings.repoName;
  githubUsername.value = settings.githubUsername;

  const isConfigComplete = settings.githubToken && settings.repoOwner && settings.repoName && settings.githubUsername;

  if (isConfigComplete) {
    configHeader.classList.add('collapsed');
    configSection.classList.add('collapsed');
  }

  configHeader.addEventListener('click', () => {
    configHeader.classList.toggle('collapsed');
    configSection.classList.toggle('collapsed');
  });

  // Sla wijzigingen op (per veld, zodat andere tabs niet worden overschreven)
  githubToken.addEventListener('change', () => {
    chrome.storage.local.set({ githubToken: githubToken.value });
    // Probeer automatisch de gebruikersnaam op te halen als die nog leeg is
    if (githubToken.value && !githubUsername.value) {
      fetchAndStoreUsername(githubToken.value);
    }
  });

  repoOwner.addEventListener('change', () => {
    chrome.storage.local.set({ repoOwner: repoOwner.value });
  });

  repoName.addEventListener('change', () => {
    chrome.storage.local.set({ repoName: repoName.value });
  });

  githubUsername.addEventListener('change', () => {
    chrome.storage.local.set({ githubUsername: githubUsername.value });
  });

  // Auto-fill gebruikersnaam als token is ingevuld maar username nog niet
  githubToken.addEventListener('blur', async () => {
    if (githubToken.value && !githubUsername.value) {
      await fetchAndStoreUsername(githubToken.value);
      githubUsername.value = (await loadAllSettings()).githubUsername;
    }
  });

  async function fetchAndStoreUsername(token) {
    try {
      const user = await PullRequestAPI.getAuthenticatedUser(token);
      await new Promise(resolve => chrome.storage.local.set({ githubUsername: user.login }, resolve));
    } catch (e) {
      console.warn('Kon GitHub gebruikersnaam niet ophalen:', e);
    }
  }

  const loadPRs = async () => {
    try {
      errorMsg.style.display = 'none';
      resultsContainer.style.display = 'none';
      loadingMsg.style.display = 'block';

      const owner = repoOwner.value.trim();
      const repo = repoName.value.trim();
      const username = githubUsername.value.trim();
      const token = githubToken.value.trim();

      if (!owner || !repo || !username || !token) {
        throw new Error('Vul alle configuratievelden in (token, owner, repo en gebruikersnaam).');
      }

      // Haal reviewer-PRs en assignee-PRs parallel op
      const [reviewerRaw, reviewedOpenRaw, allAssigneePRs] = await Promise.all([
        PullRequestAPI.fetchReviewRequestedPRs(owner, repo, username, token),
        PullRequestAPI.fetchReviewedOpenPRs(owner, repo, username, token),
        PullRequestAPI.fetchAssigneePRs(owner, repo, username, token)
      ]);

      // Filter reviewer-PRs: sla over als de gebruiker al een CHANGES_REQUESTED review heeft gedaan
      // (bal ligt dan bij de assignee, geen actie nodig van de reviewer)
      // Uitzondering: als de auteur daarna opnieuw een review aanvraagt, is actie wél nodig
      const reviewerPRsForAction = [];
      for (const pr of reviewerRaw) {
        const [reviews, requestedReviewers] = await Promise.all([
          PullRequestAPI.fetchPRReviews(owner, repo, pr.number, token),
          PullRequestAPI.fetchRequestedReviewers(owner, repo, pr.number, token)
        ]);
        const iReRequested = requestedReviewers.some(l => l.toLowerCase() === username.toLowerCase());
        const myLatestReview = reviews
          .filter(r => r.user.login.toLowerCase() === username.toLowerCase())
          .at(-1);
        if (myLatestReview?.state === 'CHANGES_REQUESTED' && !iReRequested) {
          pr._status = 'changes-requested-by-me';
        } else {
          pr._status = 'review-required';
          pr._action = 'review-required';
          reviewerPRsForAction.push(pr);
        }
      }

      // Sluit PRs uit waarbij gebruiker ook reviewer is (voorkom dubbeling in actielijst)
      const reviewerPRNumbers = new Set(reviewerPRsForAction.map(pr => pr.number));

      // Voeg PRs toe waar ik al een review voor gedaan heb maar niet meer in review-requested sta
      // (bijv. na een changes-requested review). Die krijgen _status 'changes-requested-by-me'.
      const reviewerRawNumbers = new Set(reviewerRaw.map(pr => pr.number));
      const reviewedOnlyPRs = reviewedOpenRaw.filter(pr => !reviewerRawNumbers.has(pr.number));
      for (const pr of reviewedOnlyPRs) {
        const reviews = await PullRequestAPI.fetchPRReviews(owner, repo, pr.number, token);
        const myLatestReview = reviews
          .filter(r => r.user.login.toLowerCase() === username.toLowerCase())
          .at(-1);
        pr._status = myLatestReview?.state === 'CHANGES_REQUESTED'
          ? 'changes-requested-by-me'
          : 'review-required';
      }

      // Volledig overzicht = review-requested + reviewed (dedup)
      const allReviewerPRs = [...reviewerRaw, ...reviewedOnlyPRs];

      // Bepaal status + actie voor alle assignee-PRs
      const assigneePRsForAction = [];
      for (const pr of allAssigneePRs) {
        const [reviews, requestedReviewers] = await Promise.all([
          PullRequestAPI.fetchPRReviews(owner, repo, pr.number, token),
          PullRequestAPI.fetchRequestedReviewers(owner, repo, pr.number, token)
        ]);

        const latestByReviewer = {};
        reviews.forEach(r => { latestByReviewer[r.user.login] = r.state; });

        // Als een reviewer opnieuw in requestedReviewers staat, is hun oude review
        // niet meer van toepassing (nieuwe review-aanvraag na pushes)
        const activeLatestByReviewer = Object.fromEntries(
          Object.entries(latestByReviewer).filter(([login]) => !requestedReviewers.includes(login))
        );
        const activeStates = Object.values(activeLatestByReviewer);

        // Bouw een volledig beeld van alle reviewers en hun status
        const reviewerStatus = [
          ...requestedReviewers.map(login => ({ login, state: 'PENDING' })),
          ...Object.entries(activeLatestByReviewer).map(([login, state]) => ({ login, state }))
        ];
        pr._reviewerStatus = reviewerStatus;

        if (activeStates.includes('CHANGES_REQUESTED')) {
          pr._status = 'changes-requested';
        } else if (requestedReviewers.length === 0 && activeStates.length > 0 && activeStates.every(s => s === 'APPROVED')) {
          pr._status = 'approved';
        } else {
          pr._status = 'pending';
        }

        // Alleen toevoegen aan actielijst als geen dubbeling met reviewer-actielijst
        if (!reviewerPRNumbers.has(pr.number)) {
          if (pr._status === 'changes-requested') {
            pr._action = 'changes-requested';
            assigneePRsForAction.push(pr);
          } else if (pr.review_comments > 0) {
            pr._action = 'new-comments';
            assigneePRsForAction.push(pr);
          }
        }
      }

      loadingMsg.style.display = 'none';
      resultsContainer.style.display = 'block';

      // Gesloten PRs (afgelopen maand, auteur = ik)
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const [closedPRs, reviewedMergedPRs] = await Promise.all([
        PullRequestAPI.fetchClosedAuthorPRs(owner, repo, username, token, oneMonthAgo),
        PullRequestAPI.fetchReviewedMergedPRs(owner, repo, username, token, oneWeekAgo)
      ]);

      // Groepeer per dag (closed_at)
      const closedByDay = {};
      closedPRs.forEach(pr => {
        const day = pr.closed_at ? pr.closed_at.split('T')[0] : 'onbekend';
        if (!closedByDay[day]) closedByDay[day] = [];
        closedByDay[day].push(pr);
      });
      const closedDays = Object.keys(closedByDay).sort((a, b) => b.localeCompare(a));

      const reviewedMergedByDay = {};
      reviewedMergedPRs
        .filter(pr => pr.user.login.toLowerCase() !== username.toLowerCase())
        .forEach(pr => {
        const day = pr.closed_at ? pr.closed_at.split('T')[0] : 'onbekend';
        if (!reviewedMergedByDay[day]) reviewedMergedByDay[day] = [];
        reviewedMergedByDay[day].push(pr);
      });
      const reviewedMergedDays = Object.keys(reviewedMergedByDay).sort((a, b) => b.localeCompare(a));

      PRResultsRenderer.render(reviewerPRsForAction, assigneePRsForAction, allReviewerPRs, allAssigneePRs, closedByDay, closedDays, reviewedMergedByDay, reviewedMergedDays, resultsContainer);

    } catch (error) {
      console.error('PR fout:', error);
      loadingMsg.style.display = 'none';
      errorMsg.textContent = `❌ Fout: ${error.message}`;
      errorMsg.style.display = 'block';
    }
  };

  refreshBtn.addEventListener('click', loadPRs);

  if (isConfigComplete) {
    loadPRs();
  }
});

function loadAllSettings() {
  return new Promise(resolve => {
    chrome.storage.local.get(
      ['githubToken', 'repoOwner', 'repoName', 'githubUsername'],
      data => resolve({
        githubToken: data.githubToken || '',
        repoOwner: data.repoOwner || '',
        repoName: data.repoName || '',
        githubUsername: data.githubUsername || ''
      })
    );
  });
}
