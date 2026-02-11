document.addEventListener('DOMContentLoaded', () => {
  const startInput = document.getElementById('starttime');
  const endInput = document.getElementById('endtime');
  const pauseInput = document.getElementById('pause');
  const totalTimeEl = document.getElementById('totalTime');
  const closeBtn = document.getElementById('closeBtn');

  // Nieuwe elementen voor geschiedenis
  const historyTableBody = document.getElementById('historyTableBody');
  const noHistoryMessage = document.getElementById('noHistoryMessage');

  // --- Core Calculatie Logica ---

  // Default waarden zoals in TimeHelp.vue
  startInput.value = '08:00';
  endInput.value = '17:00';
  pauseInput.value = '00:30';

  // Focus op start (zoals mounted() this.$refs.start.focus())
  startInput.focus();

  function toMinutes(time) {
    if (!time) return 0;
    const [h, m] = time.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return 0;
    return h * 60 + m;
  }

  function calculateTotalTime() {
    const start = toMinutes(startInput.value);
    const end = toMinutes(endInput.value);
    const pause = toMinutes(pauseInput.value);

    let diff = end - start - pause;
    if (diff < 0) diff = 0;

    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;

    const hh = hours.toString().padStart(2, '0');
    const mm = minutes.toString().padStart(2, '0');

    totalTimeEl.textContent = `${hh}:${mm}`;
  }

  // --- Geschiedenis Logica ---

  // Functie om records te verwijderen tot de geselecteerde datum (inclusief)
  function deleteRecordsUntilDate(targetDate) {
    if (typeof chrome.storage === 'undefined') {
        alert('Kan opslag niet benaderen. Chrome extensie omgeving vereist.');
        return;
    }

    if (!confirm(`Weet u zeker dat u alle opgeslagen starttijden tot en met ${targetDate} wilt verwijderen? Dit is onomkeerbaar.`)) {
      return;
    }

    chrome.storage.local.get(null, (items) => {
      // Zoek alle sleutels die eruitzien als een datum en kleiner of gelijk zijn aan de targetDate
      const keysToDelete = Object.keys(items).filter(key => {
        // Controleer of de sleutel het YYYY-MM-DD formaat heeft
        if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
          // Vergelijken als string is prima voor YYYY-MM-DD
          return key <= targetDate;
        }
        // Sluit andere sleutels uit (zoals extensie-instellingen)
        return false; 
      });

      if (keysToDelete.length > 0) {
        chrome.storage.local.remove(keysToDelete, () => {
          console.log(`Verwijderd: ${keysToDelete.join(', ')}`);
          alert(`${keysToDelete.length} records tot en met ${targetDate} zijn succesvol verwijderd.`);
          loadAndRenderHistory(); // Geschiedenis opnieuw laden
        });
      } else {
        alert(`Geen records gevonden om te verwijderen tot en met ${targetDate}.`);
      }
    });
  }

  // Functie om de geschiedenis uit de opslag te laden en de tabel te vullen
  function loadAndRenderHistory() {
    if (typeof chrome.storage === 'undefined') {
      noHistoryMessage.textContent = 'Kan opslag niet benaderen. Chrome extensie omgeving vereist.';
      noHistoryMessage.style.display = 'block';
      return;
    }

    // Haal alle opgeslagen items op
    chrome.storage.local.get(null, (items) => {
      // Filter alleen de items die eruitzien als een datum-sleutel en een waarde hebben
      const historyRecords = Object.keys(items)
        .filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key)) // Controleer YYYY-MM-DD formaat
        .map(key => ({
          date: key,
          // LEES NU DE OBJECT STRUCTUUR:
          firstInteraction: items[key].firstInteraction || 'N/A', // Haal de nieuwe sleutel op
          lastInteraction: items[key].lastInteraction || 'N/A' // Nieuwe sleutel
        }))
        .sort((a, b) => b.date.localeCompare(a.date)); // Sorteer nieuwste datum bovenaan

      historyTableBody.innerHTML = ''; // Maak de tabel leeg

      if (historyRecords.length === 0) {
        noHistoryMessage.style.display = 'block';
      } else {
        noHistoryMessage.style.display = 'none';

        historyRecords.forEach(record => {
          const row = historyTableBody.insertRow();
          const cellDate = row.insertCell();
          const cellTimeFirst = row.insertCell(); // Hernoemd/aangepast
          const cellTimeLast = row.insertCell(); // Nieuwe cel
          const cellAction = row.insertCell();

          cellDate.textContent = record.date;
          cellTimeFirst.textContent = record.firstInteraction; // Eerste interactie
          cellTimeLast.textContent = record.lastInteraction; // Laatste interactie

          // --- NIEUWE LOGICA VOOR KLIKKEN OP RIJ ---
          // Maak de rij klikbaar en geef een visuele hint
          row.style.cursor = 'pointer'; 
          
          row.addEventListener('click', () => {
            // Update de inputs
            // We gaan er hier van uit dat de 'N/A' checks al gebeuren en we willen alleen 
            // bijwerken als het een geldige tijd is (H:MM formaat)
            if (record.firstInteraction !== 'N/A') {
              startInput.value = record.firstInteraction;
            }
            if (record.lastInteraction !== 'N/A') {
              endInput.value = record.lastInteraction;
            }
            
            // Zorg ervoor dat de totale tijd opnieuw wordt berekend na de wijziging
            calculateTotalTime(); 

            // Optioneel: geef visuele feedback dat de tijd is geladen (bijv. kortstondig markeren)
            row.style.backgroundColor = '#e0f7fa'; // Lichtblauw
            setTimeout(() => {
              row.style.backgroundColor = ''; // Terug naar normaal
            }, 300);
          });
          // ------------------------------------------

          const deleteButton = document.createElement('button');
          deleteButton.textContent = `Verwijder tot hier`;
          deleteButton.className = 'button';
          deleteButton.style.fontSize = '0.8em';
          deleteButton.style.padding = '5px 10px';
          deleteButton.style.margin = '0';
          deleteButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Voorkom dat de rij-klik-event ook afgaat
            deleteRecordsUntilDate(record.date);
          });

          cellAction.appendChild(deleteButton);
        });
      }
    });
  }
  
  // --- Initialisatie ---

  // Re-calc bij wijzigingen
  [startInput, endInput, pauseInput].forEach(input => {
    input.addEventListener('input', calculateTotalTime);
  });

  // Initiele berekening
  calculateTotalTime();

  // Laad en render de geschiedenis bij het opstarten
  loadAndRenderHistory();

  // “Sluiten”-knop – popup sluiten
  closeBtn.addEventListener('click', () => {
    window.close();
  });
});