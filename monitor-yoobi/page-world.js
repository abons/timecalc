// Draait in MAIN world — heeft toegang tot window.Highcharts
;(function() {
  const METER_IDS = ['meter1','meter2','meter3','meter4','meter5','meter6','meter7']

  function updateMeterData() {
    if (!window.Highcharts) return
    METER_IDS.forEach(id => {
      const el = document.getElementById(id)
      if (!el) return
      try {
        const chart = window.Highcharts.charts.find(c => c && c.renderTo && c.renderTo.id === id)
        if (!chart) return
        const point = chart.series && chart.series[0] && chart.series[0].points && chart.series[0].points[0]
        if (point != null) el.dataset.ymMs = Math.round(point.y)
        const max = chart.yAxis && chart.yAxis[0] ? chart.yAxis[0].max : 1000
        el.dataset.ymMax = max || 1000
        const sub = chart.subtitle && chart.subtitle.textStr ? chart.subtitle.textStr : ''
        el.dataset.ymRps = sub
      } catch(e) {}
    })
  }

  setInterval(updateMeterData, 2000)
  // Wacht tot Highcharts geladen is
  const boot = setInterval(() => {
    if (window.Highcharts) {
      updateMeterData()
      clearInterval(boot)
    }
  }, 500)
})()
