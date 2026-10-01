/**
 * Storage Manager - Persistente opslag voor Yoobi instellingen (urenregistratie fetch)
 */

export const StorageManager = {
  /**
   * Laad opgeslagen Yoobi settings
   */
  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        {
          yoobiEmployeeId: '',
          yoobiActivities: '',
          yoobiSpecificationId: ''
        },
        (items) => {
          resolve(items);
        }
      );
    });
  },

  /**
   * Bewaar Yoobi settings
   */
  async saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set(settings, () => {
        resolve();
      });
    });
  }
};
