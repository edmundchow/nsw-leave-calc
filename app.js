const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// CRITICAL: This runs as soon as the page loads to fill the empty dropdowns
window.onload = function() {
    const dateGroups = ["hire", "bal", "opt", "resig"];
    
    dateGroups.forEach(prefix => {
        setupDropdowns(prefix);
    });
    
    // Set default starting values
    const today = new Date();
    setDropdownDate("resig", today);
    setDropdownDate("opt", new Date(today.getFullYear(), 11, 31));
};

function setupDropdowns(prefix) {
    const dSel = document.getElementById(prefix + "Day");
    const mSel = document.getElementById(prefix + "Month");
    const ySel = document.getElementById(prefix + "Year");
    
    if (!dSel || !mSel || !ySel) return; // Safety check

    const currentYear = new Date().getFullYear();

    // Fill Days (1-31)
    for (let i = 1; i <= 31; i++) {
        dSel.add(new Option(i, i));
    }

    // Fill Months (Jan-Dec)
    MONTHS.forEach((m, idx) => {
        mSel.add(new Option(m, idx));
    });

    // Fill Years (Current Year + 10 down to 40 years ago)
    for (let i = currentYear + 10; i >= currentYear - 40; i--) {
        ySel.add(new Option(i, i));
    }
}

function setDropdownDate(prefix, date) {
    document.getElementById(prefix + "Day").value = date.getDate();
    document.getElementById(prefix + "Month").value = date.getMonth();
    document.getElementById(prefix + "Year").value = date.getFullYear();
    syncDate(prefix);
}

function syncDate(prefix) {
    const d = parseInt(document.getElementById(prefix + "Day").value);
    const m = parseInt(document.getElementById(prefix + "Month").value);
    const y = parseInt(document.getElementById(prefix + "Year").value);
    
    // Automatic correction for invalid dates (e.g., Feb 30)
    const validDate = new Date(y, m, d);
    if (validDate.getMonth() !== m) {
        const lastDay = new Date(y, m + 1, 0).getDate();
        document.getElementById(prefix + "Day").value = lastDay;
        document.getElementById(prefix + "Date").value = `${y}-${String(m+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    } else {
        document.getElementById(prefix + "Date").value = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }
    
    // Trigger leave calculation whenever a date changes
    if (typeof calculateLeave === "function") {
        calculateLeave();
    }
}
