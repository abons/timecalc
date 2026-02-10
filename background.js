// background.js
chrome.action.onClicked.addListener((tab) => {
  // Dit zorgt ervoor dat de klik op het werkbalkpictogram het zijpaneel opent
  chrome.sidePanel.open({ tabId: tab.id }); 
});
function getTodayKey() {
  // ISO datum (YYYY-MM-DD) in lokale tijd
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Werkt de firstInteraction bij (alleen als deze nog niet bestaat) 
 * en werkt de lastInteraction ALTIJD bij.
 */
async function updateInteraction(type, data = {}) {
  const todayKey = getTodayKey();

  // 1. Bepaal de exacte tijd in HH:MM formaat
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const interactionTime = `${hours}:${minutes}`;

  // 2. Haal het bestaande record op
  const existingRecord = await new Promise(resolve => {
    chrome.storage.local.get(todayKey, result => {
      resolve(result[todayKey]);
    });
  });

  let recordToStore;

  if (existingRecord) {
    // Record bestaat: update alleen de lastInteraction
    recordToStore = {
      ...existingRecord,
      lastInteraction: interactionTime,
      // Optioneel: metadata van de laatste actie toevoegen
      // lastInteractionType: type, 
      // lastInteractionTimestamp: Date.now()
    };
  } else {
    // Geen record: sla de huidige tijd op als zowel first als last
    recordToStore = {
      firstInteraction: interactionTime,
      lastInteraction: interactionTime,
      // Optioneel: metadata van de eerste actie toevoegen
      // firstInteractionType: type,
      // firstInteractionTimestamp: Date.now()
    };
  }

  // 3. Opslaan: datum als sleutel, het object als waarde
  await new Promise(resolve => {
    chrome.storage.local.set({ [todayKey]: recordToStore }, () => resolve());
  });

  console.log('Interaction for', todayKey, 'updated:', recordToStore);
}

// 1) Browser gestart
chrome.runtime.onStartup.addListener(() => {
  updateInteraction('browser_startup');
});

// 2) Eerste paginabezoek (top-level navigatie)
chrome.webNavigation.onCommitted.addListener(details => {
  // Alleen top frame (geen iframes)
  if (details.frameId !== 0) return;

  updateInteraction('page', {
    url: details.url
  });
});