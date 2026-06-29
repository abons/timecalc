// content.js — monitor.yoobi.nl grid layout injector

function applyGridLayout() {
  if (document.getElementById('yoobi-monitor-grid')) return

  const style = document.createElement('style')
  style.id = 'yoobi-monitor-grid'
  style.textContent = `
    @media (max-width: 900px) {

    /* Laat de grid-menu-rij wrappen als flex-grid */
    .grid-menu.grid-menu-2col .no-gutters.row {
      display: flex !important;
      flex-wrap: wrap !important;
      align-items: flex-start !important;
    }

    /* Elk serverblok: vaste breedte */
    .serverblok {
      flex: 0 0 260px !important;
      max-width: 260px !important;
      width: 260px !important;
      box-sizing: border-box !important;
    }

    /* Servernaam inline met icon + stats op één rij */
    .serverblok .widget-chart {
      padding: 2px 6px !important;
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      gap: 6px !important;
    }
    .serverblok .serverheader {
      font-size: 11px !important;
      font-weight: bold !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      min-width: 40px !important;
      flex-shrink: 0 !important;
    }

    /* Verklein het icoon */
    .serverblok .icon-wrapper {
      width: 32px !important;
      height: 32px !important;
      min-width: 32px !important;
      flex-shrink: 0 !important;
    }
    .serverblok .icon-wrapper i {
      font-size: 15px !important;
      line-height: 32px !important;
    }
    .serverblok .icon-wrapper-bg {
      border-radius: 50% !important;
    }

    /* Zet de card (kolom met icon + stats) horizontaal */
    .serverblok .col-sm-3.col-md-4.col-xl-4 {
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      gap: 6px !important;
      padding: 0 !important;
    }

    /* Lijstitems (CPU, mem, UP) horizontaal naast elkaar */
    .serverblok .list-group {
      display: flex !important;
      flex-direction: row !important;
      flex-wrap: nowrap !important;
      gap: 6px !important;
      min-width: 0 !important;
    }
    .serverblok .list-group-item {
      padding: 0 4px !important;
      border: none !important;
      background: transparent !important;
      font-size: 11px !important;
      line-height: 32px !important;
      white-space: nowrap !important;
    }

    /* Verberg de labels (CPU:, Mem:, UP/DOWN:) */
    .serverblok .widget-content-left[id="verborgen"] {
      display: none !important;
    }

    /* Verberg legenda en popover knoppen */
    #showserverlegenda,
    #serverspopover,
    #mem {
      display: none !important;
    }

    /* Verberg eerste p bovenin tab-monitor */
    #tab-monitor > p:first-child {
      display: none !important;
    }

    /* Geen margin-bottom op .mb-3 */

    /* Verberg het icoon */
    .serverblok .icon-wrapper {
      display: none !important;
    }

    /* Tooltip op serverheader */
    .serverblok .serverheader {
      position: relative !important;
      cursor: default !important;
      width: 98px !important;
      min-width: 98px !important;
      max-width: 98px !important;
    }
    .serverblok .serverheader[data-tooltip]:hover::after {
      content: attr(data-tooltip) !important;
      position: absolute !important;
      left: 0 !important;
      top: 100% !important;
      z-index: 9999 !important;
      background: #333 !important;
      color: #fff !important;
      font-size: 11px !important;
      padding: 3px 7px !important;
      border-radius: 4px !important;
      white-space: nowrap !important;
      pointer-events: none !important;
    }

    /* Serverlegenda niet mee in de grid */
    #serverlegenda {
      flex: 0 0 auto !important;
      max-width: none !important;
      width: auto !important;
    }

    /* Verberg app-header volledig in smal venster */
    .app-header {
      display: none !important;
    }
    .mainpage {
      margin-top: 0 !important;
      padding-top: 0 !important;
    }

    } /* end @media (max-width: 900px) */

    @media (max-width: 900px) {

    /* === BIGMETERS: compact, verticaal gestapeld === */

    /* Rij van meter-cards verticaal */
    #bigmeters {
      flex-direction: column !important;
    }
    #bigmeters .col {
      flex: 0 0 auto !important;
      width: 100% !important;
      padding: 2px 4px !important;
    }
    #bigmeters .card-meter {
      margin-bottom: 2px !important;
    }
    #bigmeters .card-header {
      padding: 3px 6px !important;
      font-size: 10px !important;
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      flex-wrap: wrap !important;
      gap: 4px !important;
    }
    #bigmeters .card-header span:first-child {
      font-weight: bold !important;
      font-size: 11px !important;
    }

    /* Verberg de Highcharts gauge visueel maar laat hem renderen */
    #bigmeters [id^="meter"] {
      visibility: hidden !important;
      height: 0 !important;
      overflow: hidden !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    /* Inline progress bar */
    .ym-meter-inline {
      padding: 2px 6px 4px !important;
    }
    .ym-bar-wrap {
      position: relative !important;
      height: 18px !important;
      background: #e0e0e0 !important;
      border-radius: 4px !important;
      overflow: hidden !important;
    }
    .ym-bar-fill {
      height: 100% !important;
      background: linear-gradient(90deg, #27ae60, #f39c12, #e74c3c) !important;
      background-size: 1000px 100% !important;
      background-position-x: 0 !important;
      border-radius: 4px !important;
      transition: width 0.6s ease !important;
    }
    .ym-bar-label {
      position: absolute !important;
      top: 0 !important;
      left: 6px !important;
      right: 0 !important;
      font-size: 11px !important;
      font-weight: bold !important;
      line-height: 18px !important;
      color: #222 !important;
      white-space: nowrap !important;
    }
    .ym-bar-rps {
      font-size: 9px !important;
      color: #888 !important;
      padding-left: 6px !important;
    }

    } /* end @media bigmeters */
  `
  document.head.appendChild(style)
}

function removeMb3Classes() {
  document.querySelectorAll('.mb-3').forEach(el => el.classList.remove('mb-3'))
}

document.addEventListener('DOMContentLoaded', applyGridLayout)

// Meter IDs en hun bijbehorende inline element
const METER_IDS = ['meter1', 'meter2', 'meter3', 'meter4', 'meter5', 'meter6', 'meter7']

function getMeterText(meterEl) {
  const ms = meterEl.dataset.ymMs || '—'
  const rps = meterEl.dataset.ymRps || ''
  const max = parseInt(meterEl.dataset.ymMax, 10) || 1000
  return { ms, rps, max }
}

function getServerStatus(serverblok) {
  const icon = serverblok.querySelector('[id^="icon"]')
  if (!icon) return ''
  if (icon.classList.contains('bg-success')) return 'OK'
  if (icon.classList.contains('bg-warning')) return 'Waarschuwing'
  if (icon.classList.contains('bg-danger')) return 'Kritiek'
  return ''
}

function updateServerTooltips() {
  document.querySelectorAll('.serverblok').forEach(blok => {
    const header = blok.querySelector('.serverheader')
    if (!header) return
    const status = getServerStatus(blok)
    if (status) header.dataset.tooltip = status
  })
}

function initServerTooltips() {
  updateServerTooltips()
  // Herbereken bij kleurwisselingen
  const obs = new MutationObserver(updateServerTooltips)
  document.querySelectorAll('.serverblok [id^="icon"]').forEach(el => {
    obs.observe(el, { attributes: true, attributeFilter: ['class'] })
  })
}


function updateInlineMeter(meterEl) {
  const id = meterEl.id
  let inlineEl = document.getElementById('ym-inline-' + id)
  if (!inlineEl) {
    inlineEl = document.createElement('div')
    inlineEl.id = 'ym-inline-' + id
    inlineEl.className = 'ym-meter-inline'
    meterEl.parentNode.insertBefore(inlineEl, meterEl.nextSibling)
  }
  const { ms, rps, max } = getMeterText(meterEl)
  const msNum = parseInt(ms, 10)
  const pct = isNaN(msNum) ? 0 : Math.min(100, Math.round(msNum / max * 100))
  const label = isNaN(msNum) ? '— ms' : `${msNum} ms`
  inlineEl.innerHTML = `
    <div class="ym-bar-wrap">
      <div class="ym-bar-fill" style="width:${pct}%"></div>
      <div class="ym-bar-label">${label}<span class="ym-bar-rps">${rps}</span></div>
    </div>
  `
}

function initMeterObservers() {
  METER_IDS.forEach(id => {
    const el = document.getElementById(id)
    if (!el) return
    updateInlineMeter(el)
    new MutationObserver(() => updateInlineMeter(el))
      .observe(el, { childList: true, subtree: true, characterData: true })
  })
  // Polling als fallback voor Highcharts live updates
  setInterval(() => {
    METER_IDS.forEach(id => {
      const el = document.getElementById(id)
      if (el) updateInlineMeter(el)
    })
  }, 3000)
}

const observer = new MutationObserver(() => {
  if (document.querySelector('.serverblok') && !document.getElementById('yoobi-monitor-grid')) {
    applyGridLayout()
  }
  removeMb3Classes()
  // Init server tooltips zodra blokken er zijn
  if (document.querySelector('.serverblok') && !document.querySelector('.serverblok .serverheader[data-tooltip]')) {
    initServerTooltips()
  }
  if (document.getElementById('meter1') && !document.getElementById('ym-inline-meter1')) {
    initMeterObservers()
  }
})
observer.observe(document.documentElement, { childList: true, subtree: true })
