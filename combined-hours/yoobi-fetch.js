/**
 * Yoobi Fetch - Bouw een saveTimesheetDay request om uren direct in Yoobi te registreren.
 * Wordt gebruikt voor direct boeken via de open Yoobi tab, en als fetch snippet om te plakken
 * in de DevTools console van een ingelogde Yoobi tab (zelfde origin, dus sessie cookies gaan mee).
 *
 * Gebaseerd op declaration.saveTimesheetDay in de Yoobi repo:
 * - de regels worden doorlopen zolang relation{i} bestaat; projectid{i} moet bestaan maar de waarde
 *   wordt niet gebruikt (project volgt uit de activiteit)
 * - savedduration{i} weglaten = 0, zodat timediff de volledige duur is (budgetcheck)
 * - per activiteit/dag worden de bestaande uren vervangen door de meegestuurde regels
 * - x-requested-with is nodig, anders slaat saveDeclarations niets op (event.isAjax())
 */

const GUID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

export const YoobiFetch = {
  /**
   * Controleer de GUID's in de config. Yoobi meldt "succes" zonder op te slaan bij een onbekende
   * medewerker (geen registratierecht) en negeert een onbekend specificatieveld stil.
   */
  validateSettings(settings) {
    if (!GUID.test(settings.yoobiEmployeeId || '')) return 'Employee ID in de Yoobi configuratie is geen geldige GUID';
    if (!GUID.test(settings.yoobiSpecificationId || '')) return 'Specificatie veld ID in de Yoobi configuratie is geen geldige GUID';
    const invalid = Object.entries(this.parseActivities(settings.yoobiActivities))
      .filter(([, activityId]) => !GUID.test(activityId))
      .map(([jiraProject]) => jiraProject);
    if (invalid.length > 0) return `Activiteit ID is geen geldige GUID voor: ${invalid.join(', ')}`;
    return null;
  },

  /**
   * Parse "JIRAPROJECT=activityid" regels; "*" is de fallback voor tickets zonder eigen activiteit
   */
  parseActivities(text) {
    const activities = {};
    for (const line of (text || '').split('\n')) {
      const [jiraProject, activityId] = line.split('=').map(part => part.trim());
      if (jiraProject && activityId) activities[jiraProject.toUpperCase()] = activityId;
    }
    return activities;
  },

  /**
   * Zoek de Yoobi activiteit voor een ticket op basis van het Jira project (SPR-123 → SPR)
   */
  findActivity(ticket, activities) {
    const jiraProject = ticket.ticket ? ticket.ticket.substring(0, ticket.ticket.lastIndexOf('-')) : null;
    return (jiraProject && activities[jiraProject]) || activities['*'] || null;
  },

  /**
   * Request voor één dag: de te boeken regels, overgeslagen tickets en de form velden.
   * Elke ticketregel krijgt een eigen index (activityid0, activityid1, ...).
   */
  buildDayRequest(date, day, settings) {
    const activities = this.parseActivities(settings.yoobiActivities);
    const rows = [];
    const skipped = [];

    for (const t of day.tickets.filter(t => t.hours > 0)) {
      const activityId = this.findActivity(t, activities);
      if (!activityId) {
        skipped.push(`${t.label} (${t.hours}u)`);
        continue;
      }
      const i = rows.length;
      rows.push({
        label: t.label,
        hours: t.hours,
        note: t.summary || t.label,
        fields: [
          [`relation${i}`, ''],
          [`projectid${i}`, ''],
          [`activityid${i}`, activityId],
          [`duration${i}`, t.hours.toFixed(2)],
          [`specification-${settings.yoobiSpecificationId}${i}`, t.ticket || ''],
          [`note${i}`, t.summary || t.label]
        ]
      });
    }

    const header = [['employeeid', settings.yoobiEmployeeId], ['date', date], ['act', 'save']];
    const body = Object.fromEntries([...header, ...rows.flatMap(row => row.fields)]);
    return { date, rows, skipped, header, body };
  },

  /**
   * Fetch snippet voor één dag, of null als er geen uren zijn
   */
  buildDayFetch(date, day, settings) {
    const { rows, skipped, header } = this.buildDayRequest(date, day, settings);
    const field = ([key, value]) => `    ${/^[a-z]+\d*$/i.test(key) ? key : JSON.stringify(key)}: ${JSON.stringify(value)},`;

    const skippedNote = skipped.length > 0
      ? `// ${date} overgeslagen (geen activiteit): ${skipped.join(', ')}\n`
      : '';
    if (rows.length === 0) return skippedNote ? skippedNote.trimEnd() : null;

    const lines = [
      ...header.map(field),
      ...rows.flatMap(row => [`    // ${row.label} · ${row.hours}u`, ...row.fields.map(field)])
    ];

    return `${skippedNote}await fetch("/declaration/saveTimesheetDay", {
  method: "POST",
  headers: { "x-requested-with": "XMLHttpRequest" },
  body: new URLSearchParams({
${lines.join('\n')}
  })
}).then(r => r.text()).then(t => console.log("${date}", t));`;
  },

  /**
   * Fetch snippets voor alle dagen, oudste eerst; met await draaien ze na elkaar
   */
  buildAllFetches(daily, settings) {
    return Object.keys(daily)
      .sort()
      .map(date => this.buildDayFetch(date, daily[date], settings))
      .filter(Boolean)
      .join('\n\n');
  }
};
