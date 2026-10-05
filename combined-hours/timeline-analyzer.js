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
   * Verdeel een aantal halve uren over waarden (in uren) naar grootste restant (largest remainder).
   * Geeft per waarde het aantal halve uren terug; de som is gelijk aan targetHalves.
   */
  allocateHalves(hours, targetHalves) {
    const halves = hours.map(h => Math.max(0, h || 0) * 2);
    const floors = halves.map(Math.floor);
    let spare = targetHalves - floors.reduce((sum, h) => sum + h, 0);
    const byRemainder = halves.map((h, i) => ({ i, rest: h - floors[i] })).sort((x, y) => y.rest - x.rest);
    for (const { i } of byRemainder) {
      if (spare <= 0) break;
      floors[i]++;
      spare--;
    }
    return floors;
  },

  /**
   * Rond de uren af op halve uren zonder dat het dagtotaal oploopt: het totaal wordt één keer afgerond.
   */
  roundToHalfHours(tickets) {
    const hours = tickets.map(t => Math.max(0, t.hours || 0));
    const halves = this.allocateHalves(hours, Math.round(hours.reduce((sum, h) => sum + h, 0) * 2));
    tickets.forEach((t, i) => { t.hours = halves[i] / 2; });
  },

  /**
   * Activiteit buiten je Timecalc werktijd: Claude-tijd (samengevoegd, dus parallelle sessies tellen
   * één keer) en git/Jira events voor de eerste of na de laatste interactie.
   */
  outsideTimecalc(date, first, last, claims, dayEvents) {
    const at = (time) => {
      const [h, m] = time.split(':').map(Number);
      const d = new Date(`${date}T00:00:00`);
      d.setHours(h, m, 0, 0);
      return d.getTime();
    };
    const firstMs = first ? at(first) : null;
    const lastMs = last ? at(last) : null;
    if (firstMs === null && lastMs === null) return null;

    const claude = claims.filter(c => !c.isGap).sort((a, b) => a.start - b.start);
    const merged = [];
    for (const c of claude) {
      const tail = merged[merged.length - 1];
      if (tail && c.start <= tail.end) tail.end = Math.max(tail.end, c.end);
      else merged.push({ start: c.start, end: c.end });
    }
    const measure = (from, to) => merged.reduce((sum, m) => sum + Math.max(0, Math.min(m.end, to) - Math.max(m.start, from)), 0) / 3600000;
    const span = (from, to) => merged.filter(m => m.end > from && m.start < to)
      .map(m => [Math.max(m.start, from), Math.min(m.end, to)]);

    const result = { before: null, after: null };
    if (firstMs !== null) {
      const hours = measure(-Infinity, firstMs);
      const points = dayEvents.filter(e => e.source !== 'claude' && e.datetime.getTime() < firstMs).length;
      if (hours > 0 || points > 0) {
        const spans = span(-Infinity, firstMs);
        result.before = { until: first, hours, points, from: spans.length ? Math.min(...spans.map(s => s[0])) : null };
      }
    }
    if (lastMs !== null) {
      const hours = measure(lastMs, Infinity);
      const points = dayEvents.filter(e => e.source !== 'claude' && e.datetime.getTime() > lastMs).length;
      if (hours > 0 || points > 0) {
        const spans = span(lastMs, Infinity);
        result.after = { since: last, hours, points, to: spans.length ? Math.max(...spans.map(s => s[1])) : null };
      }
    }
    return result.before || result.after ? result : null;
  },

  /**
   * Werktijd uit Timecalc (eerste tot laatste interactie, min lunch als die erin valt)
   */
  timecalcWindow(first, last) {
    if (!first || !last) return null;
    const toMinutes = (time) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };
    const start = toMinutes(first);
    const end = toMinutes(last);
    if (isNaN(start) || isNaN(end) || end <= start) return null;
    const lunch = start < 12 * 60 && end >= 12 * 60 + LUNCH_MINUTES ? LUNCH_MINUTES : 0;
    return { first, last, hours: (end - start - lunch) / 60 };
  },

  /**
   * Verdeel de tijd per dag over tickets.
   * Git/Jira events claimen de tijd sinds het vorige event (eerste event: vanaf eerste interactie
   * of 9:00; de lunchpauze 12:00-12:30 gaat eraf als de gap erover heen loopt). Claude sessie-blokken
   * claimen hun eigen tijdvak. Tijd die door meerdere tickets geclaimd wordt (parallelle sessies)
   * wordt gelijk verdeeld, zodat een dag nooit meer uren krijgt dan er klokuren zijn.
   * Rondt af op halve uren (zie roundToHalfHours). Bij een bekende Timecalc-werktijd wordt ook een
   * voorstel berekend (scaledHours) waarbij de ticketverhoudingen gelijk blijven maar het dagtotaal
   * gelijk is aan die werktijd.
   */
  analyze(events, firstInteractions, since, until, claudeSegments = [], lastInteractions = {}) {
    const eventsByDate = {};
    const addEvent = (date, event) => {
      if (date < since || date > until) return;
      (eventsByDate[date] = eventsByDate[date] || []).push(event);
    };

    for (const event of events) {
      if (isNaN(event.datetime)) continue;
      addEvent(this.formatDate(event.datetime), event);
    }

    // Een blok over middernacht wordt per kalenderdag gesplitst
    for (const segment of claudeSegments) {
      let start = segment.start;
      while (start < segment.end) {
        const date = this.formatDate(new Date(start));
        const nextMidnight = new Date(`${date}T00:00:00`);
        nextMidnight.setDate(nextMidnight.getDate() + 1);
        const end = Math.min(segment.end, nextMidnight.getTime());
        addEvent(date, {
          source: 'claude',
          datetime: new Date(start),
          endTime: new Date(end),
          ticket: segment.ticket,
          fallbackKey: segment.ticket ? null : (segment.fallbackKey || 'claude'),
          sessionId: segment.sessionId,
          title: segment.title
        });
        start = end;
      }
    }

    const daily = {};
    for (const [date, dayEvents] of Object.entries(eventsByDate)) {
      dayEvents.sort((a, b) => a.datetime - b.datetime);

      const startTimeSource = firstInteractions[date] ? 'storage' : 'default';
      const [startHour, startMin] = (firstInteractions[date] || DEFAULT_START).split(':').map(Number);
      let prevTime = new Date(`${date}T00:00:00`);
      prevTime.setHours(startHour, startMin, 0, 0);
      const lunchStart = new Date(`${date}T12:00:00`).getTime();
      const lunchEnd = lunchStart + LUNCH_MINUTES * 60 * 1000;
      const tickets = {};
      const claims = [];
      const claudeTitles = {};

      for (const event of dayEvents) {
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
            claudeMinutes: 0,
            events: []
          };
        }

        const entry = tickets[key];
        entry.events.push(event);

        if (event.source === 'claude') {
          event.minutes = (event.endTime - event.datetime) / 60000;
          entry.claudeMinutes += event.minutes;
          if (event.title && !(claudeTitles[key] || []).includes(event.title)) {
            (claudeTitles[key] = claudeTitles[key] || []).push(event.title);
          }
          claims.push({ key, start: event.datetime.getTime(), end: event.endTime.getTime(), isGap: false });
          continue;
        }

        if (event.source === 'git') {
          entry.commits++;
          if (!entry.summary) entry.summary = event.message;
        } else {
          entry.jiraActivities++;
          if (event.activity.summary) entry.summary = event.activity.summary;
          if (event.activity.type === 'worklog') entry.loggedHours += event.activity.timeSpent / 3600;
        }

        if (event.datetime > prevTime) {
          claims.push({ key, start: prevTime.getTime(), end: event.datetime.getTime(), isGap: true });
          prevTime = event.datetime;
        }
      }

      // Sweep over alle grenzen; elk stuk tijd gaat gelijk naar de tickets die het claimen.
      // Gaps (git/jira) tellen niet mee tijdens de lunchpauze, Claude sessies wel (echte activiteit).
      const bounds = [...new Set([...claims.flatMap(c => [c.start, c.end]), lunchStart, lunchEnd])]
        .sort((a, b) => a - b);
      for (let i = 0; i < bounds.length - 1; i++) {
        const [from, to] = [bounds[i], bounds[i + 1]];
        const inLunch = from >= lunchStart && to <= lunchEnd;
        // Claude-activiteit is bewezen, een git/Jira-gap is een aanname: bij overlap winnen de Claude-tickets
        const claudeKeys = new Set();
        const gapKeys = new Set();
        for (const claim of claims) {
          if (claim.start > from || claim.end < to) continue;
          if (claim.isGap && inLunch) continue;
          (claim.isGap ? gapKeys : claudeKeys).add(claim.key);
        }
        const keys = claudeKeys.size > 0 ? claudeKeys : gapKeys;
        for (const key of keys) tickets[key].hours += (to - from) / keys.size / (1000 * 60 * 60);
      }

      // Zonder git/Jira samenvatting (vooral groepen zonder ticketnummer) tonen we de sessietitel(s)
      for (const [key, titles] of Object.entries(claudeTitles)) {
        if (!tickets[key].summary) tickets[key].summary = titles.join(' · ');
      }

      // Claude-only tickets die op 0 uur afronden (korte sessies) zijn ruis
      const ticketList = Object.values(tickets);
      const outside = this.outsideTimecalc(date, firstInteractions[date], lastInteractions[date], claims, dayEvents);
      const rawHours = ticketList.map(t => t.hours);
      const rawSum = rawHours.reduce((sum, h) => sum + h, 0);
      this.roundToHalfHours(ticketList);

      const timecalc = this.timecalcWindow(firstInteractions[date], lastInteractions[date]);
      if (timecalc && rawSum > 0) {
        const scaled = this.allocateHalves(rawHours.map(h => h / rawSum * timecalc.hours), Math.round(timecalc.hours * 2));
        ticketList.forEach((t, i) => { t.scaledHours = scaled[i] / 2; });
      }

      ticketList.splice(0, ticketList.length, ...ticketList.filter(t =>
        t.hours > 0 || t.scaledHours > 0 || t.commits > 0 || t.jiraActivities > 0));
      ticketList.sort((a, b) => b.hours - a.hours);

      daily[date] = {
        tickets: ticketList,
        total: ticketList.reduce((sum, t) => sum + t.hours, 0),
        // Alleen aanwezig als er een Timecalc-werktijd is
        scaledTotal: timecalc && rawSum > 0 ? ticketList.reduce((sum, t) => sum + t.scaledHours, 0) : null,
        timecalc,
        outside,
        startTimeSource
      };
    }

    const total = Object.values(daily).reduce((sum, day) => sum + day.total, 0);
    return { daily, total };
  }
};
