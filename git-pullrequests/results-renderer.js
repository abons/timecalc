/**
 * Pull Requests Results Renderer
 */

export const PRResultsRenderer = {
  render(reviewerPRsForAction, assigneePRsForAction, allReviewerPRs, allAssigneePRs, container) {
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
  }
};
