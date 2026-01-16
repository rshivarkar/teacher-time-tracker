document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    // Update V5: Robust Date Handling
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzwSB4qmhfaA5kXGjG2wTSHAvlM2gYoSb3XCSTgZsN-Tvgj5trQs05eUzFzJtZNShIv/exec';

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

        const btnRefresh = document.getElementById('btn-refresh');

        // Initialization
        updateDateTime();
        setInterval(updateDateTime, 1000);
        updateUIState();

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

        function syncTodayFromHistory(historyLog) {
            const now = new Date();
            // Force strict format matching the sheet: "1/16/2026" (M/D/YYYY)
            // Note: getMonth() is 0-indexed
            const todayStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;

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
                    // Safe to clear?
                    // Let's be conservative: only clear if we literally found NO match in recent history
                    // and we are sure the user isn't offline.
                    // But since we are here, fetch worked.
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
            // Load stats from LocalStorage to persist visual state
            const todayKey = new Date().toLocaleDateString('en-US'); // "1/15/2026"
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
        const tbody = document.getElementById('history-body');
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
            tbody.innerHTML = '';
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
                    renderHistoryTable(responseData.history);
                })
                .catch(error => {
                    console.error(error);
                    loadingMsg.innerHTML = '<div class="message-error">Could not load history.</div>';
                });
        }

        function renderHistoryTable(logs) {
            loadingMsg.classList.add('hidden'); // Hide loading

            if (!logs || logs.length === 0) {
                loadingMsg.innerHTML = '<p>No records found for this month.</p>';
                loadingMsg.classList.remove('hidden');
                return;
            }

            // Render Rows
            tbody.innerHTML = logs.map(log => {
                // Parse Day from Date string "1/16/2026"
                let dayNum = log.dateStr.split('/')[1] || log.dateStr;

                return `
                <tr>
                    <td>${dayNum}</td>
                    <td>${log.checkIn || '--'}</td>
                    <td>${log.checkOut || '--'}</td>
                    <td>${formatDecimalDuration(log.duration) || '0'}</td>
                </tr>
                `;
            }).join('');
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

