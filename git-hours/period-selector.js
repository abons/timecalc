/**
 * Period Selector Module - Periode selectie en datum berekeningen
 */

export const PeriodSelector = {
  /**
   * Helper: week nummer berekenen (ISO 8601)
   */
  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  },

  /**
   * Helper: begin van week (maandag)
   */
  getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  /**
   * Helper: format date as YYYY-MM-DD
   */
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Genereer dynamische periode opties
   */
  populatePeriodOptions(selectElement) {
    selectElement.innerHTML = ''; // Clear existing options
    
    const now = new Date();
    
    // Deze maand
    const currentMonth = now.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
    const currentMonthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    selectElement.add(new Option(`📅 ${currentMonth}`, `month:${currentMonthValue}`));
    
    // Vorige maand
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthName = lastMonth.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
    const lastMonthValue = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
    selectElement.add(new Option(`📅 ${lastMonthName}`, `month:${lastMonthValue}`));
    
    // Deze week
    const thisWeekStart = this.getMonday(now);
    const thisWeekEnd = new Date(thisWeekStart);
    thisWeekEnd.setDate(thisWeekEnd.getDate() + 6);
    const thisWeekNum = this.getWeekNumber(now);
    const thisWeekLabel = `📆 Week ${thisWeekNum} (${thisWeekStart.getDate()} ${thisWeekStart.toLocaleDateString('nl-NL', {month: 'short'})} - ${thisWeekEnd.getDate()} ${thisWeekEnd.toLocaleDateString('nl-NL', {month: 'short'})})`;
    selectElement.add(new Option(thisWeekLabel, `week:${this.formatDate(thisWeekStart)}`));
    
    // Vorige week
    const lastWeekDate = new Date(now);
    lastWeekDate.setDate(lastWeekDate.getDate() - 7);
    const lastWeekStart = this.getMonday(lastWeekDate);
    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);
    const lastWeekNum = this.getWeekNumber(lastWeekDate);
    const lastWeekLabel = `📆 Week ${lastWeekNum} (${lastWeekStart.getDate()} ${lastWeekStart.toLocaleDateString('nl-NL', {month: 'short'})} - ${lastWeekEnd.getDate()} ${lastWeekEnd.toLocaleDateString('nl-NL', {month: 'short'})})`;
    selectElement.add(new Option(lastWeekLabel, `week:${this.formatDate(lastWeekStart)}`));
    
    // Week daarvoor
    const twoWeeksAgoDate = new Date(now);
    twoWeeksAgoDate.setDate(twoWeeksAgoDate.getDate() - 14);
    const twoWeeksAgoStart = this.getMonday(twoWeeksAgoDate);
    const twoWeeksAgoEnd = new Date(twoWeeksAgoStart);
    twoWeeksAgoEnd.setDate(twoWeeksAgoEnd.getDate() + 6);
    const twoWeeksAgoNum = this.getWeekNumber(twoWeeksAgoDate);
    const twoWeeksAgoLabel = `📆 Week ${twoWeeksAgoNum} (${twoWeeksAgoStart.getDate()} ${twoWeeksAgoStart.toLocaleDateString('nl-NL', {month: 'short'})} - ${twoWeeksAgoEnd.getDate()} ${twoWeeksAgoEnd.toLocaleDateString('nl-NL', {month: 'short'})})`;
    selectElement.add(new Option(twoWeeksAgoLabel, `week:${this.formatDate(twoWeeksAgoStart)}`));
    
    // Custom optie
    selectElement.add(new Option('🔧 Custom...', 'custom'));
  },

  /**
   * Bepaal periode van een selectie
   */
  getPeriod(periodValue, dateFromValue, dateToValue) {
    let since, until;

    if (periodValue.startsWith('month:')) {
      // Maand periode (YYYY-MM)
      const [year, month] = periodValue.substring(6).split('-').map(Number);
      since = `${year}-${String(month).padStart(2, '0')}-01T00:00:00Z`;
      
      // Bereken laatste dag van de maand
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      until = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00Z`;
      
    } else if (periodValue.startsWith('week:')) {
      // Week periode (start datum YYYY-MM-DD)
      const dateParts = periodValue.substring(5).split('-').map(Number);
      const startDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 0, 0, 0);
      since = startDate.toISOString();
      
      // Week = 7 dagen vanaf maandag, tot einde van zondag
      const endDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 23, 59, 59);
      endDate.setDate(endDate.getDate() + 6);
      until = endDate.toISOString();
      
    } else if (periodValue === 'custom') {
      since = new Date(dateFromValue).toISOString();
      until = new Date(dateToValue).toISOString();
    }

    console.log('Period:', periodValue, 'Since:', since, 'Until:', until);
    return { since, until };
  }
};
