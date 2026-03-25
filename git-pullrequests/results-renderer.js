/**
 * Pull Requests Results Renderer
 */

export const PRResultsRenderer = {
  render(reviewerPRsForAction, assigneePRsForAction, allReviewerPRs, allAssigneePRs, closedByDay, closedDays, reviewedMergedByDay, reviewedMergedDays, container) {
    container.innerHTML = '';

    // --- Actielijst ---
    if (reviewerPRsForAction.length === 0 && assigneePRsForAction.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'pr-empty';
      empty.textContent = 'Geen openstaande pull requests gevonden waarvoor actie vereist is.';
      container.appendChild(empty);
    } else {
      if (reviewerPRsForAction.length > 0) {
        container.appendChild(this._renderSection('Review vereist', reviewerPRsForAction));
      }
      if (assigneePRsForAction.length > 0) {
        container.appendChild(this._renderSection('Actie vereist', assigneePRsForAction));
      }
    }

    // --- Overzichtssecties (ingeklapt) ---
    container.appendChild(this._renderCollapsibleSection(
      `Mijn PRs als assignee`,
      allAssigneePRs,
      pr => this._statusBadge(pr._status, 'assignee'),
      pr => pr._reviewerStatus
    ));

    container.appendChild(this._renderCollapsibleSection(
      `Mijn PRs als reviewer`,
      allReviewerPRs,
      pr => this._statusBadge(pr._status, 'reviewer')
    ));

    // --- Gesloten PRs per dag ---
    container.appendChild(this._renderClosedPRsSection(closedByDay, closedDays));

    // --- Door mij gereviewde en gemerge PRs (afgelopen week) ---
    container.appendChild(this._renderReviewedMergedSection(reviewedMergedByDay, reviewedMergedDays));
  },

  _renderSection(title, prs) {
    const section = document.createElement('div');
    section.className = 'pr-section';

    const header = document.createElement('div');
    header.className = 'pr-section-header';
    header.textContent = title;
    section.appendChild(header);

    prs.forEach(pr => section.appendChild(this._renderPRCard(pr)));

    return section;
  },

  _renderCollapsibleSection(title, prs, badgeFn, extraFn) {
    const section = document.createElement('div');
    section.className = 'pr-section pr-collapsible';

    const header = document.createElement('div');
    header.className = 'pr-collapsible-header';

    const titleSpan = document.createElement('span');
    titleSpan.textContent = `${title} (${prs.length})`;
    header.appendChild(titleSpan);

    const icon = document.createElement('span');
    icon.className = 'pr-collapse-icon';
    icon.textContent = '▶';
    header.appendChild(icon);

    section.appendChild(header);

    const body = document.createElement('div');
    body.className = 'pr-collapsible-body collapsed';

    if (prs.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'pr-empty';
      empty.textContent = 'Geen openstaande pull requests.';
      body.appendChild(empty);
    } else {
      prs.forEach(pr => body.appendChild(this._renderPRCard(pr, badgeFn, extraFn)));
    }

    section.appendChild(body);

    header.addEventListener('click', () => {
      const collapsed = body.classList.toggle('collapsed');
      icon.textContent = collapsed ? '▶' : '▼';
    });

    return section;
  },

  _renderPRCard(pr, badgeFn, extraFn) {
    const card = document.createElement('div');
    card.className = 'pr-card';
    card.addEventListener('click', () => {
      chrome.tabs.create({ url: pr.html_url });
    });

    const titleEl = document.createElement('div');
    titleEl.className = 'pr-title';
    titleEl.textContent = pr.title;
    card.appendChild(titleEl);

    const meta = document.createElement('div');
    meta.className = 'pr-meta';

    const prNumber = document.createElement('span');
    prNumber.className = 'pr-number';
    prNumber.textContent = `#${pr.number}`;
    meta.appendChild(prNumber);

    const author = document.createElement('span');
    author.className = 'pr-author';
    author.textContent = `door ${pr.user.login}`;
    meta.appendChild(author);

    const age = document.createElement('span');
    age.className = 'pr-age';
    age.textContent = this._formatAge(pr.created_at, pr.closed_at);
    meta.appendChild(age);

    const badge = badgeFn ? badgeFn(pr) : this._actionBadge(pr);
    meta.appendChild(badge);

    card.appendChild(meta);

    if (extraFn) {
      const reviewerStatus = extraFn(pr);
      if (reviewerStatus && reviewerStatus.length > 0) {
        const reviewerList = document.createElement('div');
        reviewerList.className = 'pr-reviewer-list';
        reviewerStatus.forEach(({ login, state }) => {
          const item = document.createElement('span');
          item.className = 'pr-reviewer-item';
          let icon, cls;
          if (state === 'PENDING') {
            icon = '⏳'; cls = 'pending';
          } else if (state === 'APPROVED') {
            icon = '✅'; cls = 'approved';
          } else if (state === 'CHANGES_REQUESTED') {
            icon = '🔁'; cls = 'changes';
          } else {
            icon = '💬'; cls = 'commented';
          }
          item.className = `pr-reviewer-item ${cls}`;
          item.textContent = `${icon} ${login}`;
          reviewerList.appendChild(item);
        });
        card.appendChild(reviewerList);
      } else {
        const noReviewer = document.createElement('div');
        noReviewer.className = 'pr-waiting';
        noReviewer.textContent = 'Geen reviewers toegewezen';
        card.appendChild(noReviewer);
      }
    }

    return card;
  },

  _actionBadge(pr) {
    const badge = document.createElement('span');
    if (pr._action === 'review-required') {
      badge.className = 'pr-badge review-required';
      badge.textContent = 'Review vereist';
    } else if (pr._action === 'changes-requested') {
      badge.className = 'pr-badge changes-requested';
      badge.textContent = 'Wijzigingen gevraagd';
    } else {
      badge.className = 'pr-badge new-comments';
      badge.textContent = 'Nieuwe reacties';
    }
    return badge;
  },

  _statusBadge(status, role) {
    const badge = document.createElement('span');
    if (role === 'assignee') {
      if (status === 'changes-requested') {
        badge.className = 'pr-badge changes-requested';
        badge.textContent = 'Wijzigingen gevraagd';
      } else if (status === 'approved') {
        badge.className = 'pr-badge approved';
        badge.textContent = 'Goedgekeurd';
      } else {
        badge.className = 'pr-badge pending';
        badge.textContent = 'Wacht op review';
      }
    } else {
      if (status === 'changes-requested-by-me') {
        badge.className = 'pr-badge changes-requested';
        badge.textContent = 'Wijzigingen gevraagd';
      } else {
        badge.className = 'pr-badge review-required';
        badge.textContent = 'Review vereist';
      }
    }
    return badge;
  },

  _renderClosedPRsSection(closedByDay, closedDays) {
    const totalCount = closedDays.reduce((sum, d) => sum + closedByDay[d].length, 0);

    const section = document.createElement('div');
    section.className = 'pr-section pr-collapsible';

    const header = document.createElement('div');
    header.className = 'pr-collapsible-header';

    const titleSpan = document.createElement('span');
    titleSpan.textContent = `Mijn gesloten PRs afgelopen maand (${totalCount})`;
    header.appendChild(titleSpan);

    const icon = document.createElement('span');
    icon.className = 'pr-collapse-icon';
    icon.textContent = '▶';
    header.appendChild(icon);

    section.appendChild(header);

    const body = document.createElement('div');
    body.className = 'pr-collapsible-body collapsed';

    if (closedDays.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'pr-empty';
      empty.textContent = 'Geen gesloten pull requests afgelopen maand.';
      body.appendChild(empty);
    } else {
      closedDays.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'pr-day-header';
        dayHeader.textContent = this._formatDay(day);
        body.appendChild(dayHeader);

        closedByDay[day].forEach(pr => {
          const card = document.createElement('div');
          card.className = 'pr-card pr-card-closed';
          card.addEventListener('click', () => chrome.tabs.create({ url: pr.html_url }));

          const titleEl = document.createElement('div');
          titleEl.className = 'pr-title';
          titleEl.textContent = pr.title;
          card.appendChild(titleEl);

          const meta = document.createElement('div');
          meta.className = 'pr-meta';

          const prNumber = document.createElement('span');
          prNumber.className = 'pr-number';
          prNumber.textContent = `#${pr.number}`;
          meta.appendChild(prNumber);

          const age = document.createElement('span');
          age.className = 'pr-age';
          age.textContent = this._formatAge(pr.created_at, pr.closed_at);
          meta.appendChild(age);

          const stateBadge = document.createElement('span');
          stateBadge.className = `pr-badge ${pr.pull_request?.merged_at ? 'approved' : 'closed'}`;
          stateBadge.textContent = pr.pull_request?.merged_at ? 'Gemerged' : 'Gesloten';
          meta.appendChild(stateBadge);

          card.appendChild(meta);
          body.appendChild(card);
        });
      });
    }

    section.appendChild(body);

    header.addEventListener('click', () => {
      const collapsed = body.classList.toggle('collapsed');
      icon.textContent = collapsed ? '▶' : '▼';
    });

    return section;
  },

  _formatAge(createdAt, closedAt) {
    const start = new Date(createdAt);
    const end = closedAt ? new Date(closedAt) : new Date();
    const diffMs = end - start;
    const diffH = Math.floor(diffMs / 3600000);
    const diffD = Math.floor(diffH / 24);
    if (diffD >= 1) return `${diffD}d`;
    return `${diffH}u`;
  },

  _formatDay(dateStr) {
    if (dateStr === 'onbekend') return 'Onbekend';
    const date = new Date(dateStr);
    return date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  },

  _renderReviewedMergedSection(byDay, days) {
    const totalCount = days.reduce((sum, d) => sum + byDay[d].length, 0);

    const section = document.createElement('div');
    section.className = 'pr-section pr-collapsible';

    const header = document.createElement('div');
    header.className = 'pr-collapsible-header';

    const titleSpan = document.createElement('span');
    titleSpan.textContent = `Door mij gereviewde en gemerge PRs afgelopen week (${totalCount})`;
    header.appendChild(titleSpan);

    const icon = document.createElement('span');
    icon.className = 'pr-collapse-icon';
    icon.textContent = '▶';
    header.appendChild(icon);

    section.appendChild(header);

    const body = document.createElement('div');
    body.className = 'pr-collapsible-body collapsed';

    if (days.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'pr-empty';
      empty.textContent = 'Geen gereviewde en gemerge pull requests afgelopen week.';
      body.appendChild(empty);
    } else {
      days.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'pr-day-header';
        dayHeader.textContent = this._formatDay(day);
        body.appendChild(dayHeader);

        byDay[day].forEach(pr => {
          const card = document.createElement('div');
          card.className = 'pr-card pr-card-closed';
          card.addEventListener('click', () => chrome.tabs.create({ url: pr.html_url }));

          const titleEl = document.createElement('div');
          titleEl.className = 'pr-title';
          titleEl.textContent = pr.title;
          card.appendChild(titleEl);

          const meta = document.createElement('div');
          meta.className = 'pr-meta';

          const prNumber = document.createElement('span');
          prNumber.className = 'pr-number';
          prNumber.textContent = `#${pr.number}`;
          meta.appendChild(prNumber);

          const author = document.createElement('span');
          author.className = 'pr-author';
          author.textContent = `door ${pr.user.login}`;
          meta.appendChild(author);

          const age = document.createElement('span');
          age.className = 'pr-age';
          age.textContent = this._formatAge(pr.created_at, pr.closed_at);
          meta.appendChild(age);

          const badge = document.createElement('span');
          badge.className = 'pr-badge approved';
          badge.textContent = 'Gemerged';
          meta.appendChild(badge);

          card.appendChild(meta);
          body.appendChild(card);
        });
      });
    }

    section.appendChild(body);

    header.addEventListener('click', () => {
      const collapsed = body.classList.toggle('collapsed');
      icon.textContent = collapsed ? '▶' : '▼';
    });

    return section;
  }
};
