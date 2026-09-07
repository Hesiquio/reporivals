export interface AcademicPeriod {
  id: string; // e.g., '2026-ago-ene' or '2026-feb-jul'
  name: string; // 'Agosto 2026 – Enero 2027' or 'Febrero 2026 – Julio 2026'
  shortName: string; // 'Ago 26 - Ene 27' or 'Feb 26 - Jul 26'
  type: 'ago-ene' | 'feb-jul';
  startYear: number;
  endYear: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isCurrent: boolean;
}

/**
 * Determines the academic period for a given date.
 * - Agosto a Enero: Starts August 1st of year Y, ends January 31st of year Y+1.
 * - Febrero a Julio: Starts February 1st of year Y, ends July 31st of year Y.
 */
export function getPeriodForDate(date: Date = new Date(), refNow: Date = new Date()): AcademicPeriod {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0 = Jan, 1 = Feb, ..., 6 = Jul, 7 = Aug, ..., 11 = Dec

  let id = '';
  let name = '';
  let shortName = '';
  let type: 'ago-ene' | 'feb-jul';
  let startYear = y;
  let endYear = y;
  let startDate = '';
  let endDate = '';

  if (m === 0) {
    // January belongs to the Agosto (Y-1) - Enero (Y) semester
    startYear = y - 1;
    endYear = y;
    type = 'ago-ene';
    id = `${startYear}-ago-ene`;
    name = `Agosto ${startYear} – Enero ${endYear}`;
    shortName = `Ago ${String(startYear).slice(-2)} - Ene ${String(endYear).slice(-2)}`;
    startDate = `${startYear}-08-01`;
    endDate = `${endYear}-01-31`;
  } else if (m >= 1 && m <= 6) {
    // February to July belongs to Febrero (Y) - Julio (Y)
    startYear = y;
    endYear = y;
    type = 'feb-jul';
    id = `${startYear}-feb-jul`;
    name = `Febrero ${startYear} – Julio ${startYear}`;
    shortName = `Feb ${String(startYear).slice(-2)} - Jul ${String(startYear).slice(-2)}`;
    startDate = `${startYear}-02-01`;
    endDate = `${startYear}-07-31`;
  } else {
    // August to December belongs to Agosto (Y) - Enero (Y+1)
    startYear = y;
    endYear = y + 1;
    type = 'ago-ene';
    id = `${startYear}-ago-ene`;
    name = `Agosto ${startYear} – Enero ${endYear}`;
    shortName = `Ago ${String(startYear).slice(-2)} - Ene ${String(endYear).slice(-2)}`;
    startDate = `${startYear}-08-01`;
    endDate = `${endYear}-01-31`;
  }

  const nowPeriod = getCurrentPeriod(refNow);
  const isCurrent = id === nowPeriod.id;

  return {
    id,
    name,
    shortName,
    type,
    startYear,
    endYear,
    startDate,
    endDate,
    isCurrent,
  };
}

/**
 * Returns the currently active academic period based on today's date.
 */
export function getCurrentPeriod(now: Date = new Date()): AcademicPeriod {
  const y = now.getFullYear();
  const m = now.getMonth();

  if (m === 0) {
    const startYear = y - 1;
    const endYear = y;
    return {
      id: `${startYear}-ago-ene`,
      name: `Agosto ${startYear} – Enero ${endYear}`,
      shortName: `Ago ${String(startYear).slice(-2)} - Ene ${String(endYear).slice(-2)}`,
      type: 'ago-ene',
      startYear,
      endYear,
      startDate: `${startYear}-08-01`,
      endDate: `${endYear}-01-31`,
      isCurrent: true,
    };
  } else if (m >= 1 && m <= 6) {
    return {
      id: `${y}-feb-jul`,
      name: `Febrero ${y} – Julio ${y}`,
      shortName: `Feb ${String(y).slice(-2)} - Jul ${String(y).slice(-2)}`,
      type: 'feb-jul',
      startYear: y,
      endYear: y,
      startDate: `${y}-02-01`,
      endDate: `${y}-07-31`,
      isCurrent: true,
    };
  } else {
    const startYear = y;
    const endYear = y + 1;
    return {
      id: `${startYear}-ago-ene`,
      name: `Agosto ${startYear} – Enero ${endYear}`,
      shortName: `Ago ${String(startYear).slice(-2)} - Ene ${String(endYear).slice(-2)}`,
      type: 'ago-ene',
      startYear,
      endYear,
      startDate: `${startYear}-08-01`,
      endDate: `${endYear}-01-31`,
      isCurrent: true,
    };
  }
}

/**
 * Generates a list of available academic periods (current, past, and upcoming)
 * for the teacher to select from.
 */
export function getAvailablePeriods(now: Date = new Date()): AcademicPeriod[] {
  const current = getCurrentPeriod(now);
  const currentYear = now.getFullYear();
  const periods: AcademicPeriod[] = [];

  // Generate periods from currentYear + 1 down to currentYear - 2
  for (let year = currentYear + 1; year >= currentYear - 2; year--) {
    // Agosto - Enero
    const agoEneId = `${year}-ago-ene`;
    periods.push({
      id: agoEneId,
      name: `Agosto ${year} – Enero ${year + 1}`,
      shortName: `Ago ${String(year).slice(-2)} - Ene ${String(year + 1).slice(-2)}`,
      type: 'ago-ene',
      startYear: year,
      endYear: year + 1,
      startDate: `${year}-08-01`,
      endDate: `${year + 1}-01-31`,
      isCurrent: agoEneId === current.id,
    });

    // Febrero - Julio
    const febJulId = `${year}-feb-jul`;
    periods.push({
      id: febJulId,
      name: `Febrero ${year} – Julio ${year}`,
      shortName: `Feb ${String(year).slice(-2)} - Jul ${String(year).slice(-2)}`,
      type: 'feb-jul',
      startYear: year,
      endYear: year,
      startDate: `${year}-02-01`,
      endDate: `${year}-07-31`,
      isCurrent: febJulId === current.id,
    });
  }

  // Filter out far future periods (keep at most 1 future beyond current)
  const currentIndex = periods.findIndex((p) => p.isCurrent);
  const startIndex = Math.max(0, currentIndex - 1); // at most 1 future
  return periods.slice(startIndex, startIndex + 6);
}

/**
 * Retrieves a period by its ID (e.g. "2026-ago-ene"), fallback to current.
 */
export function getPeriodById(id?: string, now: Date = new Date()): AcademicPeriod {
  if (!id) return getCurrentPeriod(now);

  const available = getAvailablePeriods(now);
  const found = available.find((p) => p.id === id);
  if (found) return found;

  // If not in standard list, parse the ID format "YYYY-ago-ene" or "YYYY-feb-jul"
  const parts = id.split('-');
  if (parts.length >= 2) {
    const year = parseInt(parts[0], 10);
    const type = parts.slice(1).join('-');
    if (!isNaN(year)) {
      if (type.includes('ago')) {
        return {
          id,
          name: `Agosto ${year} – Enero ${year + 1}`,
          shortName: `Ago ${String(year).slice(-2)} - Ene ${String(year + 1).slice(-2)}`,
          type: 'ago-ene',
          startYear: year,
          endYear: year + 1,
          startDate: `${year}-08-01`,
          endDate: `${year + 1}-01-31`,
          isCurrent: id === getCurrentPeriod(now).id,
        };
      } else if (type.includes('feb')) {
        return {
          id,
          name: `Febrero ${year} – Julio ${year}`,
          shortName: `Feb ${String(year).slice(-2)} - Jul ${String(year).slice(-2)}`,
          type: 'feb-jul',
          startYear: year,
          endYear: year,
          startDate: `${year}-02-01`,
          endDate: `${year}-07-31`,
          isCurrent: id === getCurrentPeriod(now).id,
        };
      }
    }
  }

  return getCurrentPeriod(now);
}
