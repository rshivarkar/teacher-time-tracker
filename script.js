document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    // Update V5: Robust Date Handling
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwwR90qRhF3NUEI6aJktagUVcm0JcV2SiX-6aIfqMR6oRfCGd9R-uFisppXdd9oOqBw/exec';

    // --- PAGE DETECTION ---
    const isHistoryPage = !!document.getElementById('history-list');
    const isIndexPage = !!document.getElementById('btn-checkin');

    // --- SHARED ELEMENTS ---
    const loginOverlay = document.getElementById('login-overlay');
    const passcodeInput = document.getElementById('passcode-input');
    const btnLogin = document.getElementById('btn-login');
    const loginError = document.getElementById('login-error');

    // --- LOGIN LOGIC (Shared) ---
    const CORRECT_PASSCODE = "ds123";

    // Auto-Login Check
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        if (loginOverlay) loginOverlay.classList.add('hidden');
    }

    // CORS Warning for local file:// execution
    if (window.location.protocol === 'file:') {
        setTimeout(() => {
            // Use the message area if available, or alert/console
            const msg = "⚠️ Running locally? API calls will fail due to browser security (CORS). Please use the Live GitHub Link.";
            console.warn(msg);
            if (typeof showMessage === 'function') {
                showMessage('error', msg);
            } else {
                // Fallback if showMessage isn't hoisted or defined yet (it is defined inside blocks, so might not be reachable here globally)
                // Actually showMessage is inside if(isIndexPage).
                // We'll let console handle it or check page type.
                const errDiv = document.createElement('div');
                errDiv.style.background = '#fee2e2';
                errDiv.style.color = '#991b1b';
                errDiv.style.padding = '10px';
                errDiv.style.textAlign = 'center';
                errDiv.style.fontWeight = 'bold';
                errDiv.textContent = msg;
                document.body.prepend(errDiv);
            }
        }, 1000);
    }

    if (btnLogin) {
        btnLogin.addEventListener('click', attemptLogin);
        passcodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') attemptLogin();
        });
    }

    function attemptLogin() {
        if (passcodeInput.value === CORRECT_PASSCODE) {
            sessionStorage.setItem('isLoggedIn', 'true');
            loginOverlay.classList.add('hidden');
            loginError.classList.add('hidden');
        } else {
            loginError.classList.remove('hidden');
            passcodeInput.value = '';
            passcodeInput.focus();
        }
    }

    const HOLIDAYS_2026 = {
        "1/1/2026": "New Year's Day",
        "5/25/2026": "Memorial Day",
        "6/19/2026": "Juneteenth",
        "7/3/2026": "Independence Day",
        "9/7/2026": "Labor Day",
        "11/11/2026": "Veterans Day",
        "11/20/2026": "Diwali",
        "11/26/2026": "Thanksgiving Day",
        "11/27/2026": "Black Friday"
    };

    // ==========================================
    // INDEX PAGE LOGIC
    // ==========================================
    if (isIndexPage) {
        const dateDisplay = {
            day: document.getElementById('current-day'),
            date: document.getElementById('current-date'),
            time: document.getElementById('current-time')
        };
        const statusText = document.getElementById('status-text');
        const statusDot = document.querySelector('.status-indicator');
        const btnCheckin = document.getElementById('btn-checkin');
        const btnCheckout = document.getElementById('btn-checkout');
        const messageArea = document.getElementById('message-area');

        // New Stat Elements
        const dispCheckin = document.getElementById('disp-checkin');
        const dispCheckout = document.getElementById('disp-checkout');
        const dispHours = document.getElementById('disp-hours');

        // State
        let lastAction = localStorage.getItem('lastAction') || null;
        let isHolidayMode = false;

        const btnRefresh = document.getElementById('btn-refresh');

        // Initialization
        updateDateTime();
        // Check Holiday/Weekend immediately
        checkRestrictions();

        setInterval(updateDateTime, 1000);

        // Setup Listeners
        btnCheckin.addEventListener('click', () => handleAction('checkin'));
        btnCheckout.addEventListener('click', () => handleAction('checkout'));
        if (btnRefresh) btnRefresh.addEventListener('click', refreshStatus);

        function refreshStatus() {
            // Show loading state
            const originalText = btnRefresh.textContent;
            btnRefresh.textContent = "↻ Checking...";
            btnRefresh.disabled = true;

            // We use getHistory to find today's row
            const data = { action: 'getHistory' };

            fetch(SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(data)
            })
                .then(res => res.json())
                .then(responseData => {
                    if (responseData.status === 'success' && responseData.history) {
                        syncTodayFromHistory(responseData.history);
                        showMessage('success', 'Status updated from server!');
                    }
                })
                .catch(err => {
                    console.error(err);
                    showMessage('error', 'Could not refresh.');
                })
                .finally(() => {
                    btnRefresh.textContent = originalText;
                    btnRefresh.disabled = false;
                });
        }

        // Helper for consistent date keys (M/D/YYYY) - Solver for Mobile Mismatch
        function getFormattedDate(dateObj) {
            // Note: getMonth() is 0-indexed.
            return `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
        }

        function checkRestrictions() {
            const now = new Date();
            const dayOfWeek = now.getDay(); // 0Sun, 6Sat
            const dateStr = getFormattedDate(now);

            // Look for existing holiday/weekend message
            let msgEl = document.getElementById('holiday-msg');
            if (msgEl) msgEl.remove();

            if (dayOfWeek === 0 || dayOfWeek === 6) {
                isHolidayMode = true;
                disableButtons(true);
                showRestrictionMessage("It's the weekend! Relax. 🏖️");
            } else if (HOLIDAYS_2026[dateStr]) {
                isHolidayMode = true;
                disableButtons(true);
                showRestrictionMessage(`Happy ${HOLIDAYS_2026[dateStr]}! 🎆`);
            } else {
                isHolidayMode = false; // Normal day
                updateUIState(); // Restore state
            }
        }

        function showRestrictionMessage(msg) {
            const container = document.querySelector('.status-card'); // Insert inside status card above buttons
            if (!container) return;

            const div = document.createElement('div');
            div.id = 'holiday-msg';
            div.className = 'holiday-message';
            div.textContent = msg;

            // Insert before the button group
            const btnGroup = document.querySelector('.button-group');
            if (btnGroup) container.insertBefore(div, btnGroup);
        }

        function syncTodayFromHistory(historyLog) {
            const now = new Date();
            // Force strict format matching the sheet: "1/16/2026" (M/D/YYYY)
            // Consistent with getFormattedDate
            const todayStr = getFormattedDate(now);

            // 2. Find row
            const todaysEntry = historyLog.find(log => log.dateStr === todayStr);

            if (todaysEntry) {
                // Found data! Only update if the server actually has something.
                if (todaysEntry.checkIn) localStorage.setItem('checkinTimeDisplay', todaysEntry.checkIn);

                // If server has checkout, save it. 
                if (todaysEntry.checkOut) {
                    localStorage.setItem('checkoutTimeDisplay', todaysEntry.checkOut);
                }

                if (todaysEntry.duration) {
                    const fmt = formatDecimalDuration(todaysEntry.duration);
                    localStorage.setItem('todayHours', fmt);
                }
            } else {
                // No entry found for todayStr. 
                // Only clear if we are sure it's a new day or deleted data.
                if (localStorage.getItem('savedDate') === todayStr) {
                    localStorage.removeItem('checkinTimeDisplay');
                    localStorage.removeItem('checkoutTimeDisplay');
                    localStorage.removeItem('todayHours');
                }
            }

            updateUIState();
        }

        function updateDateTime() {
            const now = new Date();
            const optionsDay = { weekday: 'long' };
            const optionsDate = { month: 'short', day: 'numeric', year: 'numeric' };
            const optionsTime = { hour: 'numeric', minute: '2-digit' };
            dateDisplay.day.textContent = now.toLocaleDateString('en-US', optionsDay);
            dateDisplay.date.textContent = now.toLocaleDateString('en-US', optionsDate);
            dateDisplay.time.innerText = now.toLocaleTimeString('en-US', optionsTime);
        }

        function updateUIState() {
            if (isHolidayMode) return; // Don't run normal logic if blocked

            // Load stats from LocalStorage to persist visual state
            // CRITICAL FIX: Use consistent getFormattedDate() instead toLocaleDateString
            // varying across Desktop/Mobile browsers.
            const todayKey = getFormattedDate(new Date()); // "1/16/2026"
            const savedDate = localStorage.getItem('savedDate');

            // If new day, clear local storage stats
            if (savedDate !== todayKey) {
                // Clear state for new day
                localStorage.setItem('savedDate', todayKey);
                localStorage.removeItem('checkinTimeDisplay');
                localStorage.removeItem('checkoutTimeDisplay');
                localStorage.removeItem('todayHours');
                localStorage.removeItem('lastAction');
                lastAction = null;
            }

            // Restore Values
            const sCheckin = localStorage.getItem('checkinTimeDisplay');
            const sCheckout = localStorage.getItem('checkoutTimeDisplay');
            const sHours = localStorage.getItem('todayHours');

            if (sCheckin) {
                dispCheckin.textContent = sCheckin;
                // If we have checkin, disable checkin button
                btnCheckin.disabled = true;
                btnCheckin.style.opacity = '0.5';
                statusDot.classList.add('status-active');
                statusText.textContent = 'Checked In';
            } else {
                dispCheckin.textContent = '--:--';
                btnCheckin.disabled = false;
                btnCheckin.style.opacity = '1';
                statusDot.classList.remove('status-active');
                statusText.textContent = 'Ready to Log';
            }

            if (sCheckout) {
                dispCheckout.textContent = sCheckout;
                // If we have checkout, disable both
                btnCheckout.disabled = true;
                btnCheckout.style.opacity = '0.5';
                statusText.textContent = 'Day Complete';
                statusDot.classList.remove('status-active');
            } else {
                dispCheckout.textContent = '--:--';
                // Only enable checkout if checkin exists
                if (sCheckin) {
                    btnCheckout.disabled = false;
                    btnCheckout.style.opacity = '1';
                } else {
                    btnCheckout.disabled = true;
                    btnCheckout.style.opacity = '0.5';
                }
            }

            if (sHours) {
                dispHours.textContent = sHours;
            } else {
                dispHours.textContent = '--';
            }
        }

        function handleAction(type) {
            const now = new Date();
            // Use standardized date string YYYY-MM-DD for API to be robust
            // But for display we keep using nice formats. 
            // We'll send standard iso string for safety.

            const data = {
                action: type,
                // Send ISO date components to ensure script can parse correctly
                year: now.getFullYear(),
                month: now.getMonth() + 1,
                day: now.getDate(),
                // Display strings for the sheet to literal write
                dateStr: now.toLocaleDateString('en-US'),
                timeStr: now.toLocaleTimeString('en-US'),
                deviceInfo: navigator.userAgent
            };

            disableButtons(true);
            showMessage('loading', 'Logging your time...');

            fetch(SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(data)
            })
                .then(res => res.json())
                .then(responseData => {
                    // Success
                    lastAction = type;
                    localStorage.setItem('lastAction', lastAction);

                    // Update Local UI State
                    if (type === 'checkin') {
                        localStorage.setItem('checkinTimeDisplay', data.timeStr);
                    } else if (type === 'checkout') {
                        localStorage.setItem('checkoutTimeDisplay', data.timeStr);
                        // Update Hours with the value returned from backend if available
                        if (responseData.duration) {
                            const fmt = formatDecimalDuration(responseData.duration);
                            localStorage.setItem('todayHours', fmt);
                        } else {
                            localStorage.setItem('todayHours', 'Done');
                        }
                    }

                    updateUIState();
                    showMessage('success', `Success! ${type === 'checkin' ? 'Have a good day!' : 'See you tomorrow!'}`);
                })
                .catch(error => {
                    console.error('Error:', error);
                    showMessage('error', 'Network Error. Check internet.');
                })
                .finally(() => {
                    // Re-enable handled by updateUIState
                });
        }

        function disableButtons(disable) {
            if (disable) {
                btnCheckin.disabled = true;
                btnCheckout.disabled = true;
            } else {
                updateUIState();
            }
        }

        function showMessage(type, text) {
            messageArea.className = 'message-area';
            messageArea.classList.remove('hidden');
            messageArea.textContent = text;
            if (type === 'success') setTimeout(() => messageArea.classList.add('hidden'), 5000);
            else if (type === 'error') messageArea.classList.add('message-error');
        }
    }

    // ==========================================
    // HISTORY PAGE LOGIC
    // ==========================================
    // ==========================================
    // HISTORY PAGE LOGIC
    // ==========================================
    if (isHistoryPage) {
        // Elements
        const monthSelect = document.getElementById('month-select');
        const yearSelect = document.getElementById('year-select');
        const btnFilter = document.getElementById('btn-filter');
        const calendarGrid = document.getElementById('calendar-grid');
        const loadingMsg = document.getElementById('loading-msg');

        // Init Dropdowns
        populateDropdowns();

        // Initial Load (Current Month)
        loadHistoryWithFilter();

        // Listeners
        btnFilter.addEventListener('click', loadHistoryWithFilter);

        function populateDropdowns() {
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            // Months
            const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            months.forEach((m, idx) => {
                const opt = document.createElement('option');
                opt.value = idx;
                opt.textContent = m;
                if (idx === currentMonth) opt.selected = true;
                monthSelect.appendChild(opt);
            });

            // Years (Current year and last year)
            [currentYear, currentYear - 1].forEach(y => {
                const opt = document.createElement('option');
                opt.value = y;
                opt.textContent = y;
                yearSelect.appendChild(opt);
            });
        }

        function loadHistoryWithFilter() {
            const m = parseInt(monthSelect.value);
            const y = parseInt(yearSelect.value);

            // UI Loading
            if (calendarGrid) calendarGrid.innerHTML = '';
            loadingMsg.classList.remove('hidden');
            loadingMsg.classList.remove('hidden');
            loadingMsg.innerHTML = '<span class="spinner">⏳</span> Loading...';

            const data = {
                action: 'getHistory',
                month: m,
                year: y
            };

            fetch(SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Correct V9 Header
                body: JSON.stringify(data)
            })
                .then(response => response.json())
                .then(responseData => {
                    renderHistoryCalendarLogic(responseData.history);
                })
                .catch(error => {
                    console.error(error);
                    loadingMsg.innerHTML = '<div class="message-error">Could not load history.</div>';
                });
        }

        function renderHistoryCalendarLogic(logs) {
            // NOTE: Renamed conceptually to renderHistoryCalendar, keeping function name for tool simplicity if preferred, 
            // but the internal logic now builds a calendar grid.
            loadingMsg.classList.add('hidden');

            const m = parseInt(monthSelect.value);
            const y = parseInt(yearSelect.value);
            const grid = document.getElementById('calendar-grid');
            grid.innerHTML = ''; // Clear existing

            // Map data for easy lookup: "16" -> logObj
            const dataMap = {};
            let totalHours = 0;

            if (logs && logs.length > 0) {
                logs.forEach(log => {
                    let dayNum = parseInt(log.dateStr.split('/')[1], 10); // "1/16/2026" -> 16
                    dataMap[dayNum] = log;

                    const h = parseFloat(log.duration);
                    if (!isNaN(h)) totalHours += h;
                });
            }

            // Calendar Math
            const firstDay = new Date(y, m, 1).getDay(); // 0Sun - 6Sat
            const daysInMonth = new Date(y, m + 1, 0).getDate(); // 28, 30, 31

            // 1. Empty cells for previous month
            for (let i = 0; i < firstDay; i++) {
                const div = document.createElement('div');
                div.className = 'cal-day empty';
                grid.appendChild(div);
            }

            // 2. Actual Days
            for (let d = 1; d <= daysInMonth; d++) {
                const div = document.createElement('div');
                div.className = 'cal-day';

                const dayLabel = document.createElement('div');
                dayLabel.className = 'day-num';
                dayLabel.textContent = d;
                div.appendChild(dayLabel);

                if (dataMap[d]) {
                    // We have data
                    div.classList.add('has-data');

                    let hoursVal = "0";
                    if (dataMap[d].duration) {
                        hoursVal = formatDecimalDuration(dataMap[d].duration).split(' ')[0];
                    }

                    if (hoursVal && hoursVal !== "NaN" && parseFloat(hoursVal) > 0) {
                        const hoursBadge = document.createElement('div');
                        hoursBadge.className = 'day-hours';
                        hoursBadge.textContent = hoursVal + 'h';
                        div.appendChild(hoursBadge);
                    }
                }

                grid.appendChild(div);
            }

            // Show Summary
            const summaryDiv = document.getElementById('monthly-summary');
            const totalSpan = document.getElementById('month-total-hours');
            summaryDiv.classList.remove('hidden');
            totalSpan.textContent = totalHours.toFixed(2);
        }
    }

    function formatDecimalDuration(val) {
        const num = parseFloat(val);
        if (isNaN(num)) return val; // Fallback if old string format

        // e.g. 2.5
        const hrs = Math.floor(num);
        const decimalPart = num - hrs;
        const mins = Math.round(decimalPart * 60);

        // "2.5 (2 hrs 30 mins)"
        return `${num} (${hrs} hrs ${mins} mins)`;
    }
});

