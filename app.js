/**
 * Project: NSW Leave Tracker (Phase 2)
 * Core Logic Engine & Resignation Module
 */

// Configuration Constants
const ANNUAL_LEAVE_WEEKS = 4;
const WEEKLY_HOURS = 38;
const SUPER_RATE = 0.115; // 11.5%
const WEEKLY_ACCRUAL = (ANNUAL_LEAVE_WEEKS * 5) / 52.1429; // ~0.3835 days per week

// Fallback NSW Holidays (If API fails)
const publicHolidays = [
    { date: "2026-01-01", name: "New Year's Day" },
    { date: "2026-01-26", name: "Australia Day" },
    { date: "2026-04-03", name: "Good Friday" },
    { date: "2026-04-06", name: "Easter Monday" },
    { date: "2026-04-25", name: "Anzac Day" },
    { date: "2026-06-08", name: "King's Birthday" },
    { date: "2026-10-05", name: "Labour Day" },
    { date: "2026-12-25", name: "Christmas Day" },
    { date: "2026-12-26", name: "Boxing Day" }
];

/**
 * Main Simulator Function
 */
function calculateResignationScenario(currentBalanceDays, hourlyRate) {
    let simulatedBalance = parseFloat(currentBalanceDays);
    let currentDate = getSelectedResignationDate();
    let totalWorkDaysPaid = 0;
    let holidaysHit = 0;

    // Daily Accrual Rate (Leave earned per day on books)
    const dailyAccrual = WEEKLY_ACCRUAL / 5;

    // Simulation Loop: Day-by-day depletion
    while (simulatedBalance > 0.001) {
        currentDate.setDate(currentDate.getDate() + 1);

        // 1. Accrue new leave while technically on leave
        simulatedBalance += dailyAccrual;

        // 2. Check for Weekdays (Mon-Fri)
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            
            // 3. Public Holiday Check
            const dateStr = currentDate.toISOString().split('T')[0];
            const isHoliday = publicHolidays.some(h => h.date === dateStr);

            if (isHoliday) {
                holidaysHit++;
                // Paid holiday: No deduction from balance
            } else {
                simulatedBalance -= 1;
            }
            totalWorkDaysPaid++;
        }
    }

    // Financial Outcomes
    const hoursPaid = totalWorkDaysPaid * (WEEKLY_HOURS / 5);
    const grossTotal = hoursPaid * hourlyRate;
    const superGained = grossTotal * SUPER_RATE;

    return {
        finalTerminationDate: formatDate(currentDate),
        totalDaysPaid: totalWorkDaysPaid.toFixed(2),
        publicHolidaysGained: holidaysHit,
        extraSuper: superGained.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' }),
        lumpSumDays: currentBalanceDays
    };
}

/**
 * UI Trigger Logic
 */
window.runResignationSim = function() {
    const al = parseFloat(document.getElementById('currentAL').value) || 0;
    const rate = parseFloat(document.getElementById('hourlyRate').value) || 0;
    
    if (al <= 0) {
        alert("Please enter a valid Leave Balance.");
        return;
    }

    const results = calculateResignationScenario(al, rate);

    // Update the UI
    document.getElementById('resignationResults').style.display = 'block';
    document.getElementById('runDate').textContent = results.finalTerminationDate;
    document.getElementById('runSuper').textContent = results.extraSuper;
    document.getElementById('lumpDays').textContent = `${results.lumpSumDays} Days`;
    document.getElementById('runDays').textContent = `${results.totalDaysPaid} Days`;
    document.getElementById('runHolidays').textContent = `${results.publicHolidaysGained} Day(s)`;
};

/**
 * Helper: Parse UI Dropdowns
 */
function getSelectedResignationDate() {
    const d = document.getElementById('resigDay').value;
    const m = document.getElementById('resigMonth').value;
    const y = document.getElementById('resigYear').value;
    const monthIndex = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(m);
    return new Date(y, monthIndex, d);
}

/**
 * Helper: Pretty Date
 */
function formatDate(date) {
    return date.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}
