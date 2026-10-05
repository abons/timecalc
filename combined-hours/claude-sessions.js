/**
 * Claude Sessions - Lees lokale Claude Code sessies (.claude/projects, per sessie een .jsonl) en zet ze
 * om naar activiteitsblokken per ticket. Het ticket komt uit de prompts (laatst genoemde ticket
 * blijft gelden), met de git branch / werkmap als startpunt.
 */

const DB_NAME = 'timecalc-claude';
const STORE = 'handles';
const HANDLE_KEY = 'projectsDir';

// Na de eerste prompt telt een ticket alleen als het binnen dit aantal tekens vooraan staat
const MENTION_PREFIX_CHARS = 40;

// Pauze langer dan dit telt als afwezig: het blok stopt bij het laatste bericht voor de pauze
const IDLE_GAP_MS = 30 * 60 * 1000;

const NOISE_TAGS = /<(system-reminder|task-notification|browser_instruction|local-command-[a-z]+|ide_[a-z_]+|pasted_content)[^>]*>[\s\S]*?<\/\1>/g;

const openDb = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const dbRequest = async (mode, action) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = action(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const ClaudeSessions = {
  /**
   * Laat de gebruiker de map .claude/projects kiezen en bewaar de handle
   */
  async pickDirectory() {
    // Chrome kent geen %USERPROFILE%: het pad staat op het klembord om in de adresbalk van de dialoog te plakken
    // Niet afwachten: een wachtende klembord-prompt zou de user activation voor de kiezer laten verlopen
    navigator.clipboard.writeText('%USERPROFILE%\\.claude\\projects').catch(() => {});
    const handle = await window.showDirectoryPicker({ id: 'claude-projects', mode: 'read', startIn: 'documents' });
    await dbRequest('readwrite', store => store.put(handle, HANDLE_KEY));
    return handle;
  },

  async getHandle() {
    try {
      return (await dbRequest('readonly', store => store.get(HANDLE_KEY))) || null;
    } catch (error) {
      return null;
    }
  },

  async clearHandle() {
    await dbRequest('readwrite', store => store.delete(HANDLE_KEY));
  },

  async hasPermission(handle) {
    return (await handle.queryPermission({ mode: 'read' })) === 'granted';
  },

  /**
   * Alleen aanroepen vanuit een klik
   */
  async requestPermission(handle) {
    return (await handle.requestPermission({ mode: 'read' })) === 'granted';
  },

  /**
   * Slash command opslag (<command-name>/plan</command-name><command-args>SPR-1</command-args>) -> "/plan SPR-1"
   */
  flattenCommand(text) {
    const name = text.match(/<command-name>([\s\S]*?)<\/command-name>/);
    if (!name) return text;
    const args = text.match(/<command-args>([\s\S]*?)<\/command-args>/);
    return `${name[1].trim()} ${args ? args[1].trim() : ''}`;
  },

  /**
   * Tekst die de gebruiker zelf typte (zonder system reminders e.d.)
   */
  promptText(message) {
    const content = message && message.content;
    if (typeof content === 'string') return this.flattenCommand(content.replace(NOISE_TAGS, ''));
    if (!Array.isArray(content)) return '';
    return this.flattenCommand(content
      .filter(part => part.type === 'text' && typeof part.text === 'string')
      .map(part => part.text.replace(NOISE_TAGS, ''))
      .join('\n'));
  },

  /**
   * Lees alle sessies die in de periode actief kunnen zijn.
   * Geeft per sessie de lijst records { time, text, context } terug.
   */
  async readSessions(rootHandle, sinceMs) {
    const sessions = [];
    for await (const project of rootHandle.values()) {
      if (project.kind !== 'directory') continue;
      try {
        for await (const entry of project.values()) {
          if (entry.kind !== 'file' || !entry.name.endsWith('.jsonl')) continue;
          try {
            const file = await entry.getFile();
            if (file.lastModified < sinceMs) continue;
            const { records, title } = this.parseRecords(await file.text());
            sessions.push({ id: entry.name.replace(/\.jsonl$/, ''), records, title });
          } catch (error) {
            console.warn('Claude sessie overgeslagen:', entry.name, error);
          }
        }
      } catch (error) {
        console.warn('Claude projectmap overgeslagen:', project.name, error);
      }
    }
    return sessions;
  },

  parseRecords(text) {
    const records = [];
    let title = '';
    for (const line of text.split('\n')) {
      if (line.startsWith('{"type":"ai-title"')) {
        try { title = JSON.parse(line).aiTitle || title; } catch (error) { /* negeer */ }
        continue;
      }
      const isUser = line.includes('"type":"user"');
      if (!isUser && !line.includes('"type":"assistant"')) continue;
      let record;
      if (isUser) {
        try { record = JSON.parse(line); } catch (error) { continue; }
      } else {
        const stamp = line.match(/"timestamp":"([^"]+)"/);
        if (!stamp) continue;
        record = { timestamp: stamp[1] };
      }
      const time = Date.parse(record.timestamp);
      if (isNaN(time)) continue;
      const isPrompt = isUser && !record.isSidechain && !record.isMeta;
      records.push({
        time,
        text: isPrompt ? this.promptText(record.message) : '',
        context: isUser ? [record.gitBranch, record.cwd] : null
      });
    }
    return { records: records.sort((a, b) => a.time - b.time), title };
  },

  /**
   * Zet sessies om naar aaneengesloten blokken per sessie en ticket:
   * [{ start, end, ticket, fallbackKey, sessionId }]
   */
  buildSegments(sessions, extractTicket) {
    const segments = [];

    for (const session of sessions) {
      // De sessietitel is door Claude afgeleid van waar de sessie over gaat: sterker dan de branch
      const titleTicket = session.title ? extractTicket([session.title]) : null;
      let ticket = titleTicket;
      let ticketFromPrompt = Boolean(titleTicket);
      let seenPrompt = false;
      let fallbackKey = null;
      let lastContext = '';
      let open = null;

      const flush = () => {
        if (open && open.end > open.start) segments.push(open);
        open = null;
      };

      session.records.forEach((record, index) => {
        if (record.context) {
          const key = record.context.join('|');
          if (key !== lastContext) {
            lastContext = key;
            const cwd = record.context[1] || '';
            fallbackKey = cwd.split(/[\\/]/).filter(Boolean).pop() || 'claude';
            // Branch/map bepaalt het ticket alleen zolang jij (of de sessietitel) er geen noemde:
            // werkmappen en branches worden hergebruikt voor ander werk, jouw woord weegt zwaarder
            if (!ticketFromPrompt) ticket = extractTicket(record.context);
          }
        }
        // Een ticket in een prompt wisselt alleen als het de eerste prompt is of het ticket vooraan staat
        // ("SPR-12 doe X", "/plan SPR-12"); een terloopse vermelding midden in een gesprek niet
        const prompt = record.text.trim();
        const mentioned = prompt
          ? extractTicket([seenPrompt ? prompt.slice(0, MENTION_PREFIX_CHARS) : prompt])
          : null;
        // Korte of lege prompts ("/clear", "/pr") verbruiken de eerste-prompt-regel niet
        if (prompt.length > MENTION_PREFIX_CHARS || mentioned) seenPrompt = true;
        if (mentioned) {
          ticket = mentioned;
          ticketFromPrompt = true;
        }

        const previous = session.records[index - 1];
        const idle = previous && record.time - previous.time > IDLE_GAP_MS;
        if (idle) flush();

        // Zonder ticket splitst ook een andere werkmap het blok
        const sameWork = open && open.ticket === ticket && (ticket || open.fallbackKey === fallbackKey);
        if (sameWork) {
          open.end = record.time;
        } else {
          // Het interval tot dit record hoort nog bij het vorige werk (tenzij je weg was);
          // het nieuwe werk begint bij dit record
          if (open && !idle) open.end = record.time;
          flush();
          open = { start: record.time, end: record.time, ticket, fallbackKey, sessionId: session.id, title: session.title };
        }
      });
      flush();
    }

    return segments;
  }
};
