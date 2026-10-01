/**
 * Yoobi Booker - Voer een saveTimesheetDay request uit in de open (ingelogde) Yoobi tab.
 * De fetch draait in de pagina zelf, dus met de Yoobi origin en sessie cookies,
 * precies zoals een fetch die in de DevTools console geplakt wordt.
 */

const YOOBI_ORIGIN = 'https://e-dynamicsbv.yoobi.nl';

export const YoobiBooker = {
  /**
   * Zoek de laatst gebruikte Yoobi tab
   */
  async findTab() {
    const tabs = await chrome.tabs.query({ url: `${YOOBI_ORIGIN}/*` });
    if (tabs.length === 0) {
      throw new Error(`Open eerst ${YOOBI_ORIGIN} in een tab en log in`);
    }
    return tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
  },

  /**
   * Boek één dag; geeft { ok, message } terug op basis van de Yoobi messages
   */
  async saveTimesheetDay(tabId, body) {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      args: [body],
      func: async (fields) => {
        try {
          const response = await fetch('/declaration/saveTimesheetDay', {
            method: 'POST',
            headers: { 'x-requested-with': 'XMLHttpRequest' },
            body: new URLSearchParams(fields)
          });
          return { status: response.status, text: await response.text() };
        } catch (error) {
          return { error: error.message };
        }
      }
    });
    return this.parseResponse(injection && injection.result);
  },

  /**
   * Vertaal het Yoobi antwoord ({ messages: [{ type, msg }] }) naar { ok, message }
   */
  parseResponse(result) {
    if (!result) return { ok: false, message: 'Geen antwoord van de Yoobi tab' };
    if (result.error) return { ok: false, message: result.error };

    let json;
    try {
      json = JSON.parse(result.text);
    } catch {
      return { ok: false, message: `Geen JSON antwoord (HTTP ${result.status}), is de Yoobi sessie verlopen?` };
    }

    const message = Array.isArray(json.messages) ? json.messages[0] : null;
    if (message && message.type === 'success') return { ok: true, message: message.msg || 'Opgeslagen' };
    return { ok: false, message: (message && message.msg) || `Onbekend antwoord (HTTP ${result.status})` };
  }
};
