/**
 * Storage Module - Chrome storage management voor settings en first interactions
 */

export const StorageManager = {
  /**
   * Laad opgeslagen settings
   */
  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['githubToken', 'repoOwner', 'repoName', 'authorEmail'], (data) => {
        resolve({
          githubToken: data.githubToken || '',
          repoOwner: data.repoOwner || '',
          repoName: data.repoName || '',
          authorEmail: data.authorEmail || ''
        });
      });
    });
  },

  /**
   * Sla settings op
   */
  async saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set(settings, () => {
        resolve();
      });
    });
  },

  /**
   * Haal eerste interactie tijden op uit storage
   */
  async getFirstInteractions() {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (items) => {
        const interactions = {};
        Object.keys(items).forEach(key => {
          if (/^\d{4}-\d{2}-\d{2}$/.test(key) && items[key].firstInteraction) {
            interactions[key] = items[key].firstInteraction;
          }
        });
        resolve(interactions);
      });
    });
  }
};
