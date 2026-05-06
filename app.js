// ... (fetchHolidays logic remains the same) ...

function calculateLeave() {
    const mode = document.getElementById('calcMode').value;
    const hireDateInput = document.getElementById('hireDate').value;
    const weeklyHours = parseFloat(document.getElementById('weeklyHours').value) || 38;
    const today = new Date();
    
    let annualAccrued = 0;
    let serviceWeeksTotal = 0;

    // 1. Calculate Total Service (Always from Hire Date)
    if (hireDateInput) {
        const hire = new Date(hireDateInput);
        serviceWeeksTotal = (today - hire) / (1000 * 60 * 60 * 24 * 7);
    }

    // 2. Annual Leave Accrual Logic
    if (mode === 'startDate' && hireDateInput) {
        annualAccrued = serviceWeeksTotal * (4 / 52) * weeklyHours;
    } else if (mode === 'knownBalance') {
        const bDateInput = document.getElementById('balanceDate').value;
        if (bDateInput) {
            const bDate = new Date(bDateInput);
            const weeksSinceBalance = (today - bDate) / (1000 * 60 * 60 * 24 * 7);
            annualAccrued = parseFloat(document.getElementById('startBalance').value) + (weeksSinceBalance * (4 / 52) * weeklyHours);
        }
    }

    // 3. Apply Deductions from History
    const taken = Array.from(document.querySelectorAll('.history-item')).reduce((s, el) => s + parseFloat(el.dataset.amount), 0);
    
    // Update UI
    document.getElementById('resAnnual').innerText = Math.max(0, annualAccrued - taken).toFixed(2);
    
    // NSW LSL Calculation: 8.667 weeks per 10 years of service
    const lslAccrual = (serviceWeeksTotal / 52) * (0.8667); 
    document.getElementById('resLSL').innerText = Math.max(0, lslAccrual).toFixed(3);
}

// Ensure you update your saveToDB() and loadFromDB() 
// to include 'hireDate' in the profile object.