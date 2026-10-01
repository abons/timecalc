/**
 * Timeline Analyzer - Voeg git commits en Jira activities samen tot één tijdlijn per dag
 * en verdeel de tijd per ticket
 */

import { CommitAnalyzer } from '../git-hours/commit-analyzer.js';

// Projecten die altijd herkend worden, ook in lowercase branch namen (feature/spr-123-...)
const DEFAULT_PROJECT_KEYS = ['SPR', 'YOOSUP', 'YOOMAINT'];

const DEFAULT_START = '09:00';
const LUNCH_MINUTES = 30;

export const TimelineAnalyzer = {
  /**
   * Helper: format date as YYYY-MM-DD (lokale tijd)
   */
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Bouw ticket matcher: alleen bekende projecten (defaults + projecten uit Jira activity),
   * case-insensitive zodat ook lowercase branch namen matchen. Geen generieke KEY-123 match
   * om afkortingen als UTF-8 of SHA-256 niet als ticket te zien.
   */
  buildTicketMatcher(activities) {
    const keys = new Set(DEFAULT_PROJECT_KEYS);
    for (const activity of activities) {
      const dash = activity.issue ? activity.issue.lastIndexOf('-') : -1;
      if (dash > 0) keys.add(activity.issue.substring(0, dash).toUpperCase());
    }
    const projects = [...keys].filter(k => /^[A-Z][A-Z0-9]*$/.test(k)).join('|');
    return new RegExp(`(?<![A-Za-z0-9])((?:${projects})-\\d+)(?!\\d)`, 'i');
  },

  /**
   * Zoek een Jira ticketnummer in commit message of branch naam
   */
  extractTicket(texts, matcher) {
    for (const text of texts) {
      const match = text && text.match(matcher);
      if (match) return match[1].toUpperCase();
    }
    return null;
  },

  /**
   * Zet commits en activities om naar één lijst events
   */
  buildEvents(commits, activities, owner, repo) {
    const matcher = this.buildTicketMatcher(activities);

    const commitEvents = commits.map(commit => {
      const message = commit.commit.message.split('\n')[0];
      const branch = commit.branches && commit.branches.length > 0 ? commit.branches[0] : '';
      const ticket = this.extractTicket([message, branch], matcher);
      return {
        source: 'git',
        datetime: new Date(commit.commit.author.date),
        ticket,
        fallbackKey: ticket ? null : CommitAnalyzer.categorizeCommit(commit.branches, commit.commit.message),
        message,
        branch,
        url: `https://github.com/${owner}/${repo}/commit/${commit.sha}`
      };
    });

    const jiraEvents = activities.map(activity => ({
      source: 'jira',
      datetime: new Date(activity.timestamp),
      ticket: activity.issue,
      fallbackKey: null,
      activity
    }));

    return [...commitEvents, ...jiraEvents];
  },

  /**
   * Verdeel de tijd per dag over tickets.
   * Eerste event: tijd vanaf eerste interactie (Timecalc) of 9:00; opvolgende: tijd vanaf vorig event.
   * Trekt 30 min pauze af als een gap 12:00 overspant; rondt per ticket af op halve uren.
   */
  analyze(events, firstInteractions, since, until) {
    const eventsByDate = {};
    for (const event of events) {
      if (isNaN(event.datetime)) continue;
      const date = this.formatDate(event.datetime);
      if (date < since || date > until) continue;
      (eventsByDate[date] = eventsByDate[date] || []).push(event);
    }

    const daily = {};
    for (const [date, dayEvents] of Object.entries(eventsByDate)) {
      dayEvents.sort((a, b) => a.datetime - b.datetime);

      const startTimeSource = firstInteractions[date] ? 'storage' : 'default';
      const [startHour, startMin] = (firstInteractions[date] || DEFAULT_START).split(':').map(Number);
      let prevTime = new Date(`${date}T00:00:00`);
      prevTime.setHours(startHour, startMin, 0, 0);
      const lunchTime = new Date(`${date}T12:00:00`);
      const tickets = {};

      for (const event of dayEvents) {
        let diffMs = event.datetime - prevTime;
        if (prevTime < lunchTime && event.datetime >= lunchTime) {
          diffMs -= LUNCH_MINUTES * 60 * 1000;
        }

        const key = event.ticket || `branch:${event.fallbackKey}`;
        if (!tickets[key]) {
          tickets[key] = {
            ticket: event.ticket,
            label: event.ticket || event.fallbackKey,
            summary: '',
            hours: 0,
            loggedHours: 0,
            commits: 0,
            jiraActivities: 0,
            events: []
          };
        }

        const entry = tickets[key];
        entry.hours += diffMs > 0 ? diffMs / (1000 * 60 * 60) : 0;
        entry.events.push(event);
        if (event.source === 'git') {
          entry.commits++;
          if (!entry.summary) entry.summary = event.message;
        } else {
          entry.jiraActivities++;
          if (event.activity.summary) entry.summary = event.activity.summary;
          if (event.activity.type === 'worklog') entry.loggedHours += event.activity.timeSpent / 3600;
        }

        if (event.datetime > prevTime) prevTime = event.datetime;
      }

      const ticketList = Object.values(tickets);
      ticketList.forEach(t => { t.hours = Math.round(t.hours * 2) / 2; });
      ticketList.sort((a, b) => b.hours - a.hours);

      daily[date] = {
        tickets: ticketList,
        total: ticketList.reduce((sum, t) => sum + t.hours, 0),
        startTimeSource
      };
    }

    const total = Object.values(daily).reduce((sum, day) => sum + day.total, 0);
    return { daily, total };
  }
};
