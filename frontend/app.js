// Initialize Scripts
console.log('app.js loading...');
try {
    lucide.createIcons();
    if (typeof TextPlugin !== 'undefined') {
        gsap.registerPlugin(TextPlugin);
    }
} catch (e) {
    console.warn('Script initialization warning:', e);
}

// --- 1. CONFIG & STATE ---
const API_URL = (window.location.protocol === 'file:' || ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '5000')) ? 'http://localhost:5000/api' : '/api';
const appState = {
    user: { name: 'Loading...', balance: 0 },
    banks: [],
    notifications: [],
    transactions: [],
    charts: { month: [], lastMonth: [], year: [] },
    authToken: sessionStorage.getItem('nexbank_token') || null
};

let expenseChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - App Initializing');

    const appContainer = document.getElementById('appContainer');
    const loginScreen = document.getElementById('loginScreen');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('passwordInput');

    // --- AUTH LOGIC ---

    const checkAuth = async () => {
        // Check token expiry locally before hitting the server
        if (appState.authToken) {
            try {
                const payload = JSON.parse(atob(appState.authToken.split('.')[1]));
                if (payload.exp * 1000 < Date.now()) {
                    console.log('Token expired locally — forcing logout');
                    logout();
                    return;
                }
            } catch (e) { /* ignore decode errors, server will reject */ }
        }

        if (!appState.authToken) {
            showLogin();
            return;
        }

        try {
            const response = await fetch(`${API_URL}/auth/me`, {
                headers: { 'Authorization': `Bearer ${appState.authToken}` }
            });

            if (response.ok) {
                const userData = await response.json();
                appState.user = userData;
                showDashboard();
            } else {
                logout();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            showLogin();
        }
    };

    const showLogin = () => {
        console.log('--- ACTION: showLogin ---');
        loginScreen.classList.remove('hidden-permanent');
        appContainer.classList.add('hidden-permanent');
        document.getElementById('preloader').classList.add('hidden-permanent');

        // Reset login card animation state
        gsap.set('.login-card', { opacity: 1, y: 0 });
    };

    const showDashboard = () => {
        console.log('--- ACTION: showDashboard ---');
        loginScreen.classList.add('hidden-permanent');
        appContainer.classList.remove('hidden-permanent');
        appContainer.style.display = 'flex';
        appContainer.style.visibility = 'visible';

        initData();
        runEntryAnimations();
    };

    const login = async (username, password) => {
        console.log('--- ACTION: login attempt ---');
        const loginBtn = document.getElementById('loginBtn');
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="lucide-loader animate-spin"></i> Authenticating...';
        loginError.style.display = 'none';

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const data = await response.json();
                sessionStorage.setItem('nexbank_token', data.token);
                appState.authToken = data.token;
                appState.user = data.user;

                // Cinematic transition
                gsap.to('.login-card', {
                    opacity: 0,
                    y: -40,
                    duration: 0.6,
                    ease: 'power4.in',
                    onComplete: showDashboard
                });
            } else {
                const errorData = await response.json().catch(() => ({}));
                document.getElementById('loginErrorMsg').innerText = errorData.message || 'Invalid credentials or server error. Please try again.';
                loginError.style.display = 'flex';
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<span>Secure Access</span>';
                gsap.fromTo('.login-card', { x: -10 }, { x: 10, duration: 0.1, repeat: 5, yoyo: true });
            }
        } catch (error) {
            console.error('Login failed:', error);
            document.getElementById('loginErrorMsg').innerText = 'Connection error. Please make sure the backend server (port 5000) is running.';
            loginError.style.display = 'flex';
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<span>Secure Access</span>';
        }
    };

    const logout = () => {
        console.log('--- ACTION: logout ---');
        sessionStorage.removeItem('nexbank_token');
        appState.authToken = null;
        window.location.reload();
    };

    const initData = async () => {
        try {
            console.log('Fetching data from backend...');
            const [banks, txs, notifs, charts] = await Promise.all([
                apiFetch(`${API_URL}/banks`),
                apiFetch(`${API_URL}/transactions`),
                apiFetch(`${API_URL}/notifications`),
                apiFetch(`${API_URL}/charts`)
            ]);

            appState.banks = banks;
            appState.transactions = txs;
            appState.notifications = notifs;
            appState.charts = charts;

            renderUI();
            console.log('Data initialization complete');
        } catch (error) {
            console.error('Failed to fetch data:', error);
        }
    };

    // Central fetch wrapper — auto-logout on 401
    const apiFetch = async (url, options = {}) => {
        const headers = { ...(options.headers || {}), 'Authorization': `Bearer ${appState.authToken}` };
        if (options.body) headers['Content-Type'] = 'application/json';
        const res = await fetch(url, { ...options, headers });
        if (res.status === 401) {
            showSessionExpired();
            return null;
        }
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    };

    const showSessionExpired = () => {
        const toast = document.getElementById('sessionToast');
        if (toast) {
            toast.classList.remove('hidden-permanent');
            setTimeout(() => {
                toast.classList.add('hidden-permanent');
                logout();
            }, 2500);
        } else {
            logout();
        }
    };

    const renderUI = () => {
        document.getElementById('sidebarUserName').innerText = appState.user.name;
        document.getElementById('totalBalance').setAttribute('data-val', appState.user.balance);
        document.getElementById('vCardName').innerText = appState.user.name;
        const setDisp = document.getElementById('settingsDisplayName');
        if (setDisp) setDisp.innerText = appState.user.name;

        // Apply card & limit initial states
        if (appState.user.virtualCardLimit !== undefined) {
            const limitSlider = document.getElementById('limitSlider');
            const limitDisplayVal = document.getElementById('limitDisplayVal');
            if (limitSlider) limitSlider.value = appState.user.virtualCardLimit;
            if (limitDisplayVal) limitDisplayVal.innerText = `₺${Number(appState.user.virtualCardLimit).toLocaleString('tr-TR')}`;
            const limitTextContainers = document.querySelectorAll('.card-limits strong');
            if (limitTextContainers.length >= 2) limitTextContainers[1].innerText = `₺${Number(appState.user.virtualCardLimit).toLocaleString('tr-TR')}`;
        }
        
        const myCard = document.getElementById('myCard');
        const freezeToggle = document.getElementById('freezeToggle');
        const btnPhysFreeze = document.getElementById('btnPhysFreeze');
        if (appState.user.isPhysicalCardFrozen) {
            if (myCard) myCard.classList.add('frozen');
            if (freezeToggle) freezeToggle.checked = true;
            if (btnPhysFreeze) {
                btnPhysFreeze.innerHTML = '<i data-lucide="unlock"></i> Unfreeze';
                btnPhysFreeze.style.color = 'var(--warning)';
            }
        }

        renderBanks();
        renderTransactions();
        renderNotifications();
        initChart();
    };

    // --- 2. PREMIUM EFFECTS ---

    // Safety Timeout for Preloader
    setTimeout(() => {
        const preloader = document.getElementById('preloader');
        if (preloader && preloader.style.display !== 'none') {
            console.warn('Safety Timeout: Forcing preloader hide');
            preloader.style.display = 'none';
            // Only show appContainer if authenticated
            if (appState.authToken) {
                appContainer.style.display = 'flex';
                appContainer.style.visibility = 'visible';
                appContainer.style.opacity = '1';
            }
        }
    }, 4000);

    // Mouse Glow
    const cursorGlow = document.getElementById('cursorGlow');
    window.addEventListener('mousemove', (e) => {
        requestAnimationFrame(() => {
            if (cursorGlow) {
                cursorGlow.style.left = `${e.clientX}px`;
                cursorGlow.style.top = `${e.clientY}px`;
            }
        });
    });

    // 3D Hover Tilt Effect
    const tiltElements = document.querySelectorAll('.tiltable');
    tiltElements.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = ((y - centerY) / centerY) * -5; // Max 5deg tilt
            const rotateY = ((x - centerX) / centerX) * 5;

            gsap.to(card, {
                rotateX: rotateX,
                rotateY: rotateY,
                duration: 0.5,
                ease: 'power2.out',
                transformPerspective: 1000
            });
        });

        card.addEventListener('mouseleave', () => {
            gsap.to(card, {
                rotateX: 0,
                rotateY: 0,
                duration: 0.8,
                ease: 'elastic.out(1, 0.5)'
            });
        });
    });

    // Number Counter Animation
    const animateValue = (id, end, duration) => {
        const obj = document.getElementById(id);
        if (!obj) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * end).toLocaleString('tr-TR');
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                obj.innerHTML = end.toLocaleString('tr-TR'); // Ensure exact finally
            }
        };
        window.requestAnimationFrame(step);
    }

    // Cinematic Preloader Setup
    const tlPreloader = gsap.timeline();
    // NOTE: appContainer already declared on line 28 — do not re-declare here

    tlPreloader
        .to('#loaderBar', { width: '100%', duration: 1.5, ease: 'power3.inOut' })
        .call(() => { document.querySelector('.p-subtitle').innerText = "System Ready"; })
        .to('.preloader-content', { scale: 0.95, opacity: 0, duration: 0.4, delay: 0.2, ease: 'power2.in' })
        .to('#preloader', { yPercent: -100, duration: 0.8, ease: 'power4.inOut' })
        .call(() => {
            console.log('Preloader finished - running checkAuth()');
            const preloader = document.getElementById('preloader');
            if (preloader) preloader.classList.add('hidden-permanent');
            // Delegate entirely to checkAuth which will call showLogin or showDashboard
            checkAuth();
        });

    const runEntryAnimations = () => {
        console.log('Firing Entry Animations');
        // Prevent re-running if already visible
        if (appContainer.getAttribute('data-animated') === 'true') return;
        appContainer.setAttribute('data-animated', 'true');

        appContainer.classList.remove('hidden-permanent');
        appContainer.style.display = 'flex';
        appContainer.style.visibility = 'visible';
        appContainer.style.opacity = '1';

        const tlEntry = gsap.timeline();
        tlEntry
            .fromTo('.app-container', { opacity: 0, scale: 0.98 }, { opacity: 1, scale: 1, duration: 0.8, ease: 'power3.out' })
            .fromTo('.sidebar', { x: -30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }, '-=0.4')
            .fromTo(['.header-greeting h1', '.header-greeting p', '.header-actions'],
                { y: -20, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: 'power2.out' }, '-=0.4')
            .fromTo('#view-dashboard .glass-card',
                { y: 40, opacity: 0, rotateX: 10 },
                { y: 0, opacity: 1, rotateX: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out' }, '-=0.4')
            .call(() => {
                const balanceSpan = document.getElementById('totalBalance');
                if (balanceSpan) animateValue('totalBalance', parseInt(balanceSpan.getAttribute('data-val')), 2000);
            });

        gsap.to('.orb-1', { y: 30, x: 20, duration: 4, repeat: -1, yoyo: true, ease: 'sine.inOut' });
        gsap.to('.orb-2', { y: -40, x: -30, duration: 5, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 1 });
        gsap.to('.orb-3', { scale: 1.2, duration: 6, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    };


    // --- 3. RENDER FUNCTIONS ---
    function renderBanks() {
        const list = document.getElementById('dashboardBankList');
        list.innerHTML = '';
        appState.banks.forEach((bank, index) => {
            list.innerHTML += `
                <div class="bank-item" style="opacity:0; transform:translateX(-10px);">
                    <div class="bank-icon ${bank.iconClass}"><i data-lucide="${bank.iconName}"></i></div>
                    <div class="bank-details">
                        <span class="bank-name">${bank.name}</span>
                        <span class="bank-type">${bank.type}</span>
                    </div>
                    <span class="bank-balance">₺${bank.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                </div>
            `;
        });
        lucide.createIcons();
        gsap.to('.bank-item', { opacity: 1, x: 0, stagger: 0.1, duration: 0.5, delay: 2.5, ease: 'power2.out' }); // delayed for initial load
    };

    function renderTransactions(filter = 'all') {
        const list = document.getElementById('mainTxList');
        list.innerHTML = '';

        const filtered = appState.transactions.filter(tx => {
            if (filter === 'all') return true;
            return tx.type === filter;
        });

        filtered.forEach(tx => {
            const amountPrefix = tx.type === 'income' ? '+' : '-';
            const iconWrapperClass = tx.type === 'income' ? 'income' : 'expense';
            const flaggedStyle = tx.isFlagged ? 'border: 1px solid rgba(239, 68, 68, 0.4); box-shadow: 0 0 10px rgba(239, 68, 68, 0.1);' : '';

            list.innerHTML += `
                <div class="tx-item" style="${flaggedStyle}">
                    <div class="tx-icon ${iconWrapperClass}"><i data-lucide="${tx.icon}"></i></div>
                    <div class="bank-details">
                        <span class="bank-name">${tx.title}</span>
                        <div class="tx-category">
                            <span>${tx.category}</span> • ${tx.date}
                        </div>
                    </div>
                    <span class="tx-amount ${tx.type}">${amountPrefix}₺${tx.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                </div>
            `;
        });
        lucide.createIcons();
    };

    function renderNotifications() {
        const badge = document.getElementById('notifBadge');
        const list = document.getElementById('notifList');
        badge.innerText = appState.notifications.length;
        if (appState.notifications.length === 0) badge.style.display = 'none';
        else badge.style.display = 'flex';

        list.innerHTML = '';
        appState.notifications.forEach(n => {
            const icon = n.type === 'alert' ? 'alert-circle' : 'info';
            const color = n.type === 'alert' ? 'var(--error)' : 'var(--primary)';
            const actionAttr = n.action ? `data-action="${n.action}"` : '';
            list.innerHTML += `
                <li class="notif-item action-trigger" ${actionAttr}>
                    <div class="n-icon" style="color: ${color}"><i data-lucide="${icon}"></i></div>
                    <div class="n-text">
                        <span>${n.text}</span>
                        <span class="n-time">${n.time}</span>
                    </div>
                </li>
            `;
        });
        lucide.createIcons();
    };


    // --- 4. CHART SETUP ---
    function initChart() {
        const ctx = document.getElementById('expenseChart').getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.5)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

        expenseChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                datasets: [{
                    label: 'Expenses',
                    data: appState.charts.month,
                    borderColor: '#8b5cf6',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#6366f1',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(5, 5, 5, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, titleFont: { family: 'Outfit', size: 14 }, bodyFont: { family: 'Outfit', size: 14 }, padding: 12, cornerRadius: 8, displayColors: false, callbacks: { label: function (c) { return '₺' + c.parsed.y; } } } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.03)', drawBorder: false }, ticks: { color: '#888', font: { family: 'Space Grotesk' }, callback: function (v) { return '₺' + v; } } },
                    x: { grid: { display: false, drawBorder: false }, ticks: { color: '#888', font: { family: 'Outfit' } } }
                }
            }
        });

        // Initialize Analytics Doughnut Chart
        const doughnutCtx = document.getElementById('analyticsDoughnut');
        if (doughnutCtx) {
            const categories = {};
            let total = 0;
            appState.transactions.forEach(t => {
                if (t.type === 'expense') {
                    categories[t.category] = (categories[t.category] || 0) + t.amount;
                    total += t.amount;
                }
            });
            const topCats = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 4);
            const labels = topCats.map(c => c[0]);
            const dataVals = total > 0 ? topCats.map(c => Math.round((c[1] / total) * 100)) : [100];
            const safeLabels = labels.length ? labels : ['No Data'];

            // update the DOM progress bars underneath the doughnut chart
            const analyticsProgressList = document.querySelector('.analytics-progress-list');
            if (analyticsProgressList) {
                analyticsProgressList.innerHTML = '';
                const colors = ['var(--primary)', 'var(--secondary)', 'var(--success)', 'var(--warning)'];
                const glowColors = ['var(--primary-glow)', 'var(--secondary-glow)', 'var(--success-glow)', 'var(--warning-glow)'];
                topCats.forEach((cat, idx) => {
                    const perc = dataVals[idx];
                    const color = colors[idx % colors.length];
                    const gColor = glowColors[idx % glowColors.length];
                    analyticsProgressList.innerHTML += `
                        <div class="progress-item">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <span style="font-weight: 500;">${cat[0]}</span>
                                <span style="font-family: var(--font-mono); font-weight: 600;">%${perc}</span>
                            </div>
                            <div style="width: 100%; background: rgba(255,255,255,0.05); height: 8px; border-radius: 4px; overflow: hidden;">
                                <div style="width: ${perc}%; background: ${color}; height: 100%; border-radius: 4px; box-shadow: 0 0 10px ${gColor};"></div>
                            </div>
                        </div>
                    `;
                });
            }

            new Chart(doughnutCtx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: safeLabels,
                    datasets: [{
                        data: dataVals.length ? dataVals : [100],
                        backgroundColor: ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b'],
                        borderWidth: 0,
                        hoverOffset: 10
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '75%',
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(5, 5, 5, 0.9)',
                            titleFont: { family: 'Outfit', size: 14 },
                            bodyFont: { family: 'Outfit', size: 14 },
                            padding: 12,
                            callbacks: { label: function (c) { return ' ' + c.label + ': %' + c.parsed; } }
                        }
                    }
                }
            });
        }
    };

    // initChart is called within initData to ensure data is present


    // --- 5. INTERACTION LISTENERS ---

    // Notifications Dropdown
    const bellBtn = document.getElementById('bellBtn');
    const notifMenu = document.getElementById('notifMenu');
    bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notifMenu.classList.toggle('active');
    });
    document.addEventListener('click', () => {
        notifMenu.classList.remove('active');
    });

    document.getElementById('notifList').addEventListener('click', (e) => {
        const item = e.target.closest('.action-trigger');
        if (item && item.getAttribute('data-action') === 'reviewTxModal') {
            openModal('reviewTxModal');
            notifMenu.classList.remove('active');
        }
    });

    // Chart Filter
    const chartFilter = document.getElementById('chartFilter');
    chartFilter.addEventListener('change', (e) => {
        const val = e.target.value;
        const newData = appState.charts[val];
        expenseChartInstance.data.datasets[0].data = newData;
        if (val === 'year') {
            expenseChartInstance.data.labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        } else {
            expenseChartInstance.data.labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
        }
        expenseChartInstance.update();
    });

    // SPA Routing / View Switching
    const navLinks = document.querySelectorAll('.nav-links a');
    const pageTitle = document.getElementById('pageTitle');
    const pageSub = document.getElementById('pageSubtitle');

    const viewTitles = {
        'dashboard': { t: 'Overview', s: 'Here is your AI-powered financial overview.' },
        'transactions': { t: 'Transactions', s: 'Your categorized income and expenses.' },
        'analytics': { t: 'Analytics', s: 'Deep dive into your financial habits.' },
        'cards': { t: 'Cards', s: 'Manage your virtual and physical cards.' },
        'settings': { t: 'Settings', s: 'Account preferences and security.' }
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetViewId = link.getAttribute('data-view');

            document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
            link.parentElement.classList.add('active');

            // Header titles anim
            gsap.to(['#pageTitle', '#pageSubtitle'], {
                opacity: 0, y: -5, duration: 0.2, onComplete: () => {
                    pageTitle.innerText = viewTitles[targetViewId].t;
                    pageSub.innerText = viewTitles[targetViewId].s;
                    gsap.to(['#pageTitle', '#pageSubtitle'], { opacity: 1, y: 0, duration: 0.3, stagger: 0.05 });
                }
            });

            const currentActive = document.querySelector('.app-view.active');
            const newActive = document.getElementById(`view-${targetViewId}`);

            if (currentActive !== newActive) {
                gsap.to(currentActive, {
                    opacity: 0, y: -20, duration: 0.3, ease: 'power2.in',
                    onComplete: () => {
                        currentActive.classList.remove('active');
                        newActive.classList.add('active');
                        gsap.fromTo(newActive, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
                    }
                });
            }
        });
    });

    // Filtering Transactions in Tx View
    const txFilterBtns = document.querySelectorAll('.tx-filters .filter-btn');
    txFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            txFilterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderTransactions(btn.getAttribute('data-filter'));
            gsap.fromTo('#mainTxList .tx-item', { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.3, stagger: 0.05 });
        });
    });

    // Security Card Freeze Toggle
    const freezeToggle = document.getElementById('freezeToggle');
    const myCard = document.getElementById('myCard');

    if (freezeToggle && myCard) {
        freezeToggle.addEventListener('change', async (e) => {
            const isFrozen = e.target.checked;
            try {
                await apiFetch(`${API_URL}/user/freeze`, { method: 'PUT', body: JSON.stringify({ freeze: isFrozen }) });
                if (isFrozen) {
                    myCard.classList.add('frozen');
                    gsap.fromTo(myCard,
                        { rotationZ: -2 },
                        { rotationZ: 2, duration: 0.08, yoyo: true, repeat: 3, onComplete: () => gsap.set(myCard, { rotationZ: 0 }) }
                    );
                } else {
                    myCard.classList.remove('frozen');
                }
            } catch (err) {
                console.error("Failed to update freeze status", err);
            }
        });
    }

    // --- 6. MODAL LOGIC ---
    const modalOverlay = document.getElementById('modalOverlay');
    const modals = document.querySelectorAll('.modal-content');
    const closeBtns = document.querySelectorAll('.close-modal');

    const openModal = (id) => {
        modals.forEach(m => m.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        modalOverlay.classList.add('active');
    };

    const closeModal = () => {
        modalOverlay.classList.remove('active');
        setTimeout(() => modals.forEach(m => m.classList.remove('active')), 300);
    };

    closeBtns.forEach(btn => btn.addEventListener('click', closeModal));
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

    // Trigger: Add Account
    const btnAddAccount = document.getElementById('addAccountBtn');
    if (btnAddAccount) btnAddAccount.addEventListener('click', () => openModal('addAccountModal'));

    // Trigger: Card Details & Limits
    const btnPhysDetails = document.getElementById('btnPhysDetails');
    const btnVirtDetails = document.getElementById('btnVirtDetails');
    const btnVirtLimits = document.getElementById('btnVirtLimits');
    const btnPhysFreeze = document.getElementById('btnPhysFreeze');
    const btnCreateCard = document.getElementById('btnCreateCard');

    if (btnPhysDetails) btnPhysDetails.addEventListener('click', () => openModal('cardDetailsModal'));
    if (btnVirtDetails) btnVirtDetails.addEventListener('click', () => openModal('cardDetailsModal'));
    if (btnVirtLimits) btnVirtLimits.addEventListener('click', () => openModal('cardLimitsModal'));

    // Limits logic
    const limitSlider = document.getElementById('limitSlider');
    const limitDisplayVal = document.getElementById('limitDisplayVal');
    const saveLimitBtn = document.getElementById('saveLimitBtn');

    if (limitSlider && limitDisplayVal) {
        limitSlider.addEventListener('input', (e) => {
            limitDisplayVal.innerText = `₺${Number(e.target.value).toLocaleString('tr-TR')}`;
        });
    }

    if (saveLimitBtn) {
        saveLimitBtn.addEventListener('click', async () => {
            saveLimitBtn.innerHTML = '<i class="lucide-loader animate-spin" style="margin-right:8px;"></i> Saving...';
            try {
                const response = await apiFetch(`${API_URL}/user/limits`, {
                    method: 'PUT',
                    body: JSON.stringify({ virtualCardLimit: Number(limitSlider.value) })
                });
                saveLimitBtn.innerHTML = '<i class="lucide-check"></i> Saved';
                saveLimitBtn.style.background = 'var(--success)';
                const limitTextContainers = document.querySelectorAll('.card-limits strong');
                if (limitTextContainers.length >= 2) {
                    limitTextContainers[1].innerText = `₺${Number(response.virtualCardLimit).toLocaleString('tr-TR')}`;
                }
                setTimeout(() => {
                    closeModal();
                    saveLimitBtn.innerHTML = 'Save Limit';
                    saveLimitBtn.style.background = '';
                }, 1000);
            } catch (error) {
                saveLimitBtn.innerHTML = 'Error!';
                saveLimitBtn.style.background = 'var(--error)';
            }
        });
    }

    // Create Virtual Card Flow
    if (btnCreateCard) {
        btnCreateCard.addEventListener('click', () => openModal('createCardModal'));
    }

    const confirmCreateCardBtn = document.getElementById('confirmCreateCardBtn');
    if (confirmCreateCardBtn) {
        confirmCreateCardBtn.addEventListener('click', async () => {
            confirmCreateCardBtn.innerHTML = '<i class="lucide-loader animate-spin" style="margin-right:8px;"></i> Generating Map...';
            try {
                const response = await apiFetch(`${API_URL}/user/virtual-cards`, { method: 'POST' });
                confirmCreateCardBtn.innerHTML = '<i class="lucide-check"></i> Card Generated';
                confirmCreateCardBtn.style.background = 'var(--success)';
                setTimeout(() => {
                    closeModal();
                    alert(`Virtual Card Data Generated Successfully! Backend connection established. Card: ${response.card.cardNumber}`);
                    confirmCreateCardBtn.innerHTML = 'Generate Secure Card';
                    confirmCreateCardBtn.style.background = '';
                }, 1000);
            } catch (error) {
                confirmCreateCardBtn.innerHTML = 'Error Creating Card';
                confirmCreateCardBtn.style.background = 'var(--error)';
            }
        });
    }

    // Local Freeze physical card button
    if (btnPhysFreeze) {
        btnPhysFreeze.addEventListener('click', async () => {
            const isCurrentlyFrozen = myCard.classList.contains('frozen');
            try {
                await apiFetch(`${API_URL}/user/freeze`, { method: 'PUT', body: JSON.stringify({ freeze: !isCurrentlyFrozen }) });
                if (isCurrentlyFrozen) {
                    myCard.classList.remove('frozen');
                    btnPhysFreeze.innerHTML = '<i data-lucide="lock"></i> Freeze';
                    btnPhysFreeze.style.color = '';
                } else {
                    myCard.classList.add('frozen');
                    btnPhysFreeze.innerHTML = '<i data-lucide="unlock"></i> Unfreeze';
                    btnPhysFreeze.style.color = 'var(--warning)';
                    gsap.fromTo(myCard, { rotationZ: -2 }, { rotationZ: 2, duration: 0.08, yoyo: true, repeat: 3, onComplete: () => gsap.set(myCard, { rotationZ: 0 }) });
                }
                lucide.createIcons();
            } catch (error) {
                console.error("Failed to freeze", error);
            }
        });
    }

    // Select Bank
    let selectedBankToLink = null;
    const bankItems = document.querySelectorAll('.bank-select-item');
    const confirmAddBtn = document.getElementById('confirmAddAccount');

    bankItems.forEach(item => {
        item.addEventListener('click', () => {
            bankItems.forEach(b => b.classList.remove('selected'));
            item.classList.add('selected');
            selectedBankToLink = item.getAttribute('data-bank');
            confirmAddBtn.disabled = false;
        });
    });

    confirmAddBtn.addEventListener('click', async () => {
        if (!selectedBankToLink) return;
        confirmAddBtn.innerHTML = `<i class="lucide-loader animate-spin" style="margin-right: 8px;"></i> Connecting...`;

        const iconMappings = {
            'Chase': { name: 'Chase Bank (New)', c: 'b-chase', i: 'building-2' },
            'Citi': { name: 'Citi Secondary', c: 'b-citi', i: 'building' },
            'BoA': { name: 'Bank of America', c: 'b-boa', i: 'landmark' },
            'WellsFargo': { name: 'Wells Fargo', c: 'b-wf', i: 'castle' }
        };
        const m = iconMappings[selectedBankToLink];
        const newBankData = {
            name: m.name,
            type: 'Checking ••• ' + Math.floor(1000 + Math.random() * 9000),
            balance: Math.floor(Math.random() * 10000),
            iconClass: m.c,
            iconName: m.i
        };

        try {
            const response = await fetch(`${API_URL}/banks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newBankData)
            });
            const savedBank = await response.json();

            appState.banks.push(savedBank);
            renderBanks();
            gsap.to('.bank-item:last-child', { opacity: 1, x: 0, duration: 0.5 });

            appState.notifications.unshift({ id: Date.now(), type: 'info', text: `${m.name} connected.`, time: 'Just now' });
            renderNotifications();

            closeModal();
            confirmAddBtn.innerHTML = 'Continue';
            confirmAddBtn.disabled = true;
            bankItems.forEach(b => b.classList.remove('selected'));
            selectedBankToLink = null;
        } catch (error) {
            console.error('Failed to add bank account:', error);
            confirmAddBtn.innerHTML = 'Error! Try again';
        }
    });

    // Trigger: Review Suspicious Tx
    const reviewBtn = document.getElementById('reviewTxBtn');
    if (reviewBtn) reviewBtn.addEventListener('click', () => openModal('reviewTxModal'));

    document.getElementById('approveTxBtn').addEventListener('click', async () => {
        const flaggedTx = appState.transactions.find(t => t.isFlagged);
        if (flaggedTx && flaggedTx._id) {
            try {
                await apiFetch(`${API_URL}/transactions/${flaggedTx._id}/approve`, { method: 'PUT' });
            } catch (err) {
                console.error('Failed to approve on backend:', err);
            }
        }
        appState.transactions = appState.transactions.filter(t => !t.isFlagged);
        renderTransactions();
        appState.notifications = appState.notifications.filter(n => n.type !== 'alert');
        renderNotifications();
        document.getElementById('suspiciousText').innerText = "All clear";
        document.getElementById('suspiciousText').className = "text-secondary";
        document.getElementById('reviewTxBtn').style.display = 'none';
        closeModal();
    });

    document.getElementById('rejectTxBtn').addEventListener('click', () => {
        document.getElementById('freezeToggle').checked = true;
        document.getElementById('freezeToggle').dispatchEvent(new Event('change'));
        closeModal();
        gsap.to(modalOverlay, { opacity: 0, duration: 0.2 });
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });

    // Login Logic via Button Click to be safer
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const username = document.getElementById('usernameInput').value;
            const password = document.getElementById('passwordInput').value;
            if (username && password) {
                login(username, password);
            }
        });
    }

    // Also handle Enter key in form
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('usernameInput').value;
        const password = document.getElementById('passwordInput').value;
        login(username, password);
    });

    // Toggle Password Visibility
    togglePassword.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePassword.querySelector('i').setAttribute('data-lucide', type === 'password' ? 'eye' : 'eye-off');
        lucide.createIcons();
    });

    // Profile Settings Logic
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async () => {
            const newName = document.getElementById('profileNameInput').value.trim();
            if (newName) {
                try {
                    await apiFetch(`${API_URL}/user/profile`, { method: 'PUT', body: JSON.stringify({ name: newName }) });
                } catch (e) { console.error('Save profile err:', e); }

                appState.user.name = newName;
                document.getElementById('sidebarUserName').innerText = newName;
                document.getElementById('vCardName').innerText = newName;
                const setDisp = document.getElementById('settingsDisplayName');
                if (setDisp) setDisp.innerText = newName;

                // GSAP Cinematic Button Animation
                const btnText = saveProfileBtn.querySelector('span');
                const btnIcon = saveProfileBtn.querySelector('.success-icon');

                gsap.to(saveProfileBtn, {
                    width: 50,
                    borderRadius: 25,
                    duration: 0.3,
                    ease: "power2.inOut",
                    onStart: () => { btnText.style.display = 'none'; },
                    onComplete: () => {
                        saveProfileBtn.style.background = "var(--success)";
                        saveProfileBtn.style.boxShadow = "0 5px 15px var(--success-glow)";
                        btnIcon.style.display = 'block';
                        gsap.fromTo(btnIcon, { scale: 0 }, { scale: 1, duration: 0.3, ease: "back.out(2)" });

                        setTimeout(() => {
                            gsap.to(saveProfileBtn, {
                                width: '100%',
                                borderRadius: 12,
                                duration: 0.4,
                                ease: "power2.inOut",
                                onStart: () => {
                                    btnIcon.style.display = 'none';
                                    saveProfileBtn.style.background = "var(--primary)";
                                    saveProfileBtn.style.boxShadow = "0 5px 15px var(--primary-glow)";
                                },
                                onComplete: () => {
                                    btnText.style.display = 'block';
                                    btnText.innerText = "Saved Successfully";
                                    setTimeout(() => btnText.innerText = "Save Changes", 2000);
                                }
                            });
                        }, 1200);
                    }
                });
            }
        });
    }

    // === REGISTER FORM ===
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
        registerBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const name = document.getElementById('regNameInput').value.trim();
            const username = document.getElementById('regUsernameInput').value.trim();
            const password = document.getElementById('regPasswordInput').value;
            const confirm = document.getElementById('regConfirmInput').value;
            const errEl = document.getElementById('loginError');
            const errMsg = document.getElementById('loginErrorMsg');

            if (!name || !username || !password) {
                errMsg.textContent = 'Please fill in all fields.';
                errEl.style.display = 'flex'; return;
            }
            if (password !== confirm) {
                errMsg.textContent = 'Passwords do not match.';
                errEl.style.display = 'flex'; return;
            }
            if (password.length < 6) {
                errMsg.textContent = 'Password must be at least 6 characters.';
                errEl.style.display = 'flex'; return;
            }

            registerBtn.disabled = true;
            registerBtn.querySelector('span').textContent = 'Creating account...';
            errEl.style.display = 'none';

            try {
                const res = await fetch(`${API_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, username, password })
                });
                
                if (res.ok) {
                    const data = await res.json();
                    sessionStorage.setItem('nexbank_token', data.token);
                    appState.authToken = data.token;
                    appState.user = data.user;
                    gsap.to('.login-card', { opacity: 0, y: -40, duration: 0.6, ease: 'power4.in', onComplete: showDashboard });
                } else {
                    const data = await res.json().catch(() => ({}));
                    errMsg.textContent = data.message || 'Registration failed.';
                    errEl.style.display = 'flex';
                    registerBtn.disabled = false;
                    registerBtn.querySelector('span').textContent = 'Create Account';
                }
            } catch (err) {
                errMsg.textContent = 'Connection error. Is the backend server running on port 5000?';
                errEl.style.display = 'flex';
                registerBtn.disabled = false;
                registerBtn.querySelector('span').textContent = 'Create Account';
            }
        });
    }

    // === GLOBAL ENTER TO NEXT INPUT OR SUBMIT ===
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const target = e.target;
            if (target.tagName === 'INPUT' && target.id !== 'aiChatInput') {
                e.preventDefault();
                const wrapper = target.closest('.auth-panel, .settings-form, .modal-content, .app-view');
                if (wrapper) {
                    const inputs = Array.from(wrapper.querySelectorAll('input:not([type="hidden"])'));
                    const idx = inputs.indexOf(target);
                    if (idx > -1 && idx < inputs.length - 1) {
                        inputs[idx + 1].focus();
                    } else {
                        const submitBtns = wrapper.querySelectorAll('.btn-primary, [type="submit"]');
                        if (submitBtns.length > 0) {
                            submitBtns[submitBtns.length - 1].click();
                        }
                    }
                }
            }
        }
    });

    // === LOGIN / REGISTER TOGGLE ===
    const switchToRegister = (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden-permanent');
        document.getElementById('registerForm').classList.remove('hidden-permanent');
        document.getElementById('authSubtitle').textContent = 'Create your free NexBank account';
        document.getElementById('loginError').style.display = 'none';
        gsap.fromTo('#registerForm', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35 });
    };
    const switchToLogin = (e) => {
        e.preventDefault();
        document.getElementById('registerForm').classList.add('hidden-permanent');
        loginForm.classList.remove('hidden-permanent');
        document.getElementById('authSubtitle').textContent = 'Enter credentials to access your AI wallet';
        document.getElementById('loginError').style.display = 'none';
        gsap.fromTo('#loginForm', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35 });
    };
    document.getElementById('goToRegister')?.addEventListener('click', switchToRegister);
    document.getElementById('goToLogin')?.addEventListener('click', switchToLogin);

    // === CHANGE PASSWORD ===
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const msgEl = document.getElementById('passwordChangeMsg');
            const current = document.getElementById('currentPasswordInput').value;
            const newPass = document.getElementById('newPasswordInput').value;
            const confirm = document.getElementById('confirmPasswordInput').value;

            const showMsg = (text, ok) => {
                msgEl.textContent = text;
                msgEl.style.display = 'block';
                msgEl.style.background = ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)';
                msgEl.style.color = ok ? '#86efac' : '#fca5a5';
                msgEl.style.border = ok ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(239,68,68,0.2)';
            };

            if (!current || !newPass || !confirm) { showMsg('Please fill in all fields.', false); return; }
            if (newPass !== confirm) { showMsg('New passwords do not match.', false); return; }
            if (newPass.length < 6) { showMsg('Password must be at least 6 characters.', false); return; }

            changePasswordBtn.disabled = true;
            changePasswordBtn.querySelector('span').textContent = 'Updating...';

            try {
                const res = await apiFetch(`${API_URL}/auth/password`, {
                    method: 'PUT',
                    body: JSON.stringify({ currentPassword: current, newPassword: newPass })
                });
                if (res) {
                    showMsg('✓ Password updated successfully!', true);
                    document.getElementById('currentPasswordInput').value = '';
                    document.getElementById('newPasswordInput').value = '';
                    document.getElementById('confirmPasswordInput').value = '';
                }
            } catch (err) {
                showMsg(err.message || 'Failed to update password.', false);
            } finally {
                changePasswordBtn.disabled = false;
                changePasswordBtn.querySelector('span').textContent = 'Update Password';
            }
        });
    }

    // === MOBILE HAMBURGER SIDEBAR ===
    // Inject backdrop element
    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    backdrop.id = 'sidebarBackdrop';
    document.body.appendChild(backdrop);

    const sidebar = document.getElementById('sidebar');
    const openSidebar = () => { sidebar?.classList.add('open'); backdrop.classList.add('active'); };
    const closeSidebar = () => { sidebar?.classList.remove('open'); backdrop.classList.remove('active'); };

    document.getElementById('hamburgerBtn')?.addEventListener('click', openSidebar);
    document.getElementById('sidebarClose')?.addEventListener('click', closeSidebar);
    backdrop.addEventListener('click', closeSidebar);

    // Close sidebar on nav link click (mobile)
    document.querySelectorAll('.nav-links a').forEach(a => {
        a.addEventListener('click', () => { if (window.innerWidth <= 768) closeSidebar(); });
    });

    // === THEME SELECTION ===
    const themeSelector = document.getElementById('themeSelector');
    if (themeSelector) {
        // Load saved theme
        const savedTheme = localStorage.getItem('nexbank_theme') || 'dark';
        themeSelector.value = savedTheme;
        document.documentElement.setAttribute('data-theme', savedTheme);

        themeSelector.addEventListener('change', (e) => {
            const selected = e.target.value;
            document.documentElement.setAttribute('data-theme', selected);
            localStorage.setItem('nexbank_theme', selected);
        });
    }

    // === ADVANCED UI INTERACTIONS ===
    const openTransferModalBtn = document.getElementById('openTransferModalBtn');
    if (openTransferModalBtn) {
        openTransferModalBtn.addEventListener('click', () => {
            openModal('transferModal');
        });
    }

    const confirmTransferBtn = document.getElementById('confirmTransferBtn');
    let lastSelectedContact = "Contact";
    document.querySelectorAll('.contact-avatar').forEach(c => c.addEventListener('click', () => { lastSelectedContact = c.innerText.trim(); }));

    if (confirmTransferBtn) {
        confirmTransferBtn.addEventListener('click', async () => {
            const amt = document.getElementById('transferAmount').value;
            if (!amt) return;
            confirmTransferBtn.disabled = true;
            confirmTransferBtn.innerHTML = '<i class="lucide-loader animate-spin" style="margin-right:8px;"></i> Processing...';
            try {
                const res = await apiFetch(`${API_URL}/transfer`, { method: 'POST', body: JSON.stringify({ amount: amt, contactName: lastSelectedContact }) });
                if (res) {
                    appState.user.balance = res.newBalance;
                    const balanceSpan = document.getElementById('totalBalance');
                    if (balanceSpan) animateValue('totalBalance', res.newBalance, 1000);
                    appState.transactions.unshift(res.transaction);
                    renderTransactions();

                    confirmTransferBtn.innerHTML = '<i class="lucide-check"></i> Sent Successfully!';
                    confirmTransferBtn.style.background = 'var(--success)';
                    setTimeout(() => {
                        closeModal();
                        confirmTransferBtn.disabled = false;
                        confirmTransferBtn.innerHTML = 'Review Transfer';
                        confirmTransferBtn.style.background = '';
                        document.getElementById('transferAmount').value = '';
                    }, 1500);
                }
            } catch (e) {
                confirmTransferBtn.disabled = false;
                confirmTransferBtn.innerHTML = 'Review Transfer';
                alert(e.message);
            }
        });
    }

    const aiFabBtn = document.getElementById('openAiChatBtn');
    const aiChatPanel = document.getElementById('aiChatPanel');
    const closeAiChatBtn = document.getElementById('closeAiChatBtn');

    if (aiFabBtn && aiChatPanel) {
        let moved = false;
        let startX, startY, initialX, initialY;

        aiFabBtn.addEventListener('touchstart', (e) => {
            if (window.innerWidth > 768) return;
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            
            const rect = aiFabBtn.getBoundingClientRect();
            aiFabBtn.style.right = 'auto';
            aiFabBtn.style.bottom = 'auto';
            aiFabBtn.style.left = `${rect.left}px`;
            aiFabBtn.style.top = `${rect.top}px`;
            
            initialX = rect.left;
            initialY = rect.top;
            
            aiFabBtn.style.transition = 'none';
            moved = false;
        }, { passive: true });

        aiFabBtn.addEventListener('touchmove', (e) => {
            if (window.innerWidth > 768) return;
            const touch = e.touches[0];
            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;

            if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                moved = true;
                
                let newX = initialX + dx;
                let newY = initialY + dy;
                
                const maxX = window.innerWidth - aiFabBtn.offsetWidth;
                const maxY = window.innerHeight - aiFabBtn.offsetHeight - 85; 
                newX = Math.max(0, Math.min(newX, maxX));
                newY = Math.max(0, Math.min(newY, maxY));
                
                aiFabBtn.style.left = `${newX}px`;
                aiFabBtn.style.top = `${newY}px`;
                
                if(e.cancelable) e.preventDefault();
            }
        }, { passive: false });

        aiFabBtn.addEventListener('touchend', () => {
            if (window.innerWidth > 768) return;
            aiFabBtn.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        });

        aiFabBtn.addEventListener('click', (e) => {
            if (moved) {
                e.preventDefault();
                moved = false;
                return;
            }
            aiChatPanel.classList.toggle('active');
        });
        
        closeAiChatBtn.addEventListener('click', () => {
            aiChatPanel.classList.remove('active');
        });
    }

    const aiChatInput = document.getElementById('aiChatInput');
    const sendAiChatBtn = document.getElementById('sendAiChatBtn');
    const aiChatBody = document.getElementById('aiChatBody');

    const handleAiMessage = () => {
        let val = aiChatInput.value.trim();
        if (!val) return;

        // Kullanıcının otomatik klavye düzeltmesinin bozduğu kelimeyi zorla geri düzeltiyoruz
        val = val.replace(/nereyedim/ig, 'nereye harcadım');

        // Add User Message
        const userDiv = document.createElement('div');
        userDiv.className = 'chat-msg user-msg';
        userDiv.innerHTML = `${val} <span class="msg-time">Just now</span>`;
        aiChatBody.appendChild(userDiv);
        aiChatInput.value = '';
        aiChatBody.scrollTop = aiChatBody.scrollHeight;

        // Add loading state
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'chat-msg ai-msg loading-msg';
        loadingDiv.innerHTML = `<span class="pulse-ring" style="position:relative;display:inline-block;width:10px;height:10px;margin-right:8px;background:var(--primary);border-radius:50%;"></span> Düşünüyor... <span class="msg-time">Just now</span>`;
        aiChatBody.appendChild(loadingDiv);
        aiChatBody.scrollTop = aiChatBody.scrollHeight;

        // Fetch Response from Backend
        apiFetch(`${API_URL}/ai/chat`, {
            method: 'POST',
            body: JSON.stringify({ message: val, transactions: appState.transactions, balance: appState.user.balance })
        }).then(data => {
            loadingDiv.remove();
            if (data && data.reply) {
                const aiDiv = document.createElement('div');
                aiDiv.className = 'chat-msg ai-msg';
                aiDiv.innerHTML = `${data.reply} <span class="msg-time">Just now</span>`;
                aiChatBody.appendChild(aiDiv);
                aiChatBody.scrollTop = aiChatBody.scrollHeight;
            }
        }).catch(err => {
            loadingDiv.remove();
            console.error('AI Chat Error:', err);
        });
    };

    if (sendAiChatBtn) sendAiChatBtn.addEventListener('click', handleAiMessage);
    if (aiChatInput) aiChatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAiMessage();
    });

    try {
        lucide.createIcons();
    } catch (e) { }
    // NOTE: checkAuth() is triggered by the preloader's completion callback above
});
