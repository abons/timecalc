/**
 * Storage Manager - Persistente opslag voor Jira instellingen
 */

export const StorageManager = {
  /**
   * Laad opgeslagen Jira settings
   */
  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        {
          jiraUrl: '',
          jiraEmail: '',
          jiraToken: ''
        },
        (items) => {
          resolve(items);
        }
      );
    });
  },

  /**
   * Bewaar Jira settings
   */
  async saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set(settings, () => {
        resolve();
      });
    });
  }
};
