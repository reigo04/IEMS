/* ============================================
   IEMS — App Core (Navigation, Toast, Utils)
   ============================================ */

// Toast notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    toast.innerHTML = `<span>${icons[type] || icons.info}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// API helper
async function api(url, options = {}) {
    const defaults = {
        headers: { 'Content-Type': 'application/json' },
    };
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
        options.body = JSON.stringify(options.body);
    }
    if (options.body instanceof FormData) {
        delete defaults.headers['Content-Type'];
    }
    const res = await fetch(url, { ...defaults, ...options });
    return res;
}

// Tab navigation
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-tab]');
    const tabContents = document.querySelectorAll('.tab-content');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.dataset.tab;

            // Update nav active state
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            // Show correct tab
            tabContents.forEach(tc => tc.classList.remove('active'));
            const target = document.getElementById(`tab-${tab}`);
            if (target) {
                target.classList.add('active');
            }

            // Close mobile sidebar
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebar-overlay').classList.remove('active');

            // Trigger tab-specific load
            if (tab === 'overview') loadOverview();
            if (tab === 'equipment') loadEquipment();
            if (tab === 'reports') loadReportFilters();
        });
    });
}

// Mobile menu
function initMobileMenu() {
    const btn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (btn) {
        btn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });
    }
}

// Format date for display
function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
        return dateStr;
    }
}

// Format currency
function formatCurrency(val) {
    if (!val && val !== 0) return '—';
    return '₱' + Number(val).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Status badge HTML
function statusBadge(status) {
    const cls = status === 'serviceable' ? 'badge-serviceable' : 'badge-unserviceable';
    const icon = status === 'serviceable' ? '✅' : '⚠️';
    return `<span class="badge ${cls}">${icon} ${status}</span>`;
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initMobileMenu();
    loadOverview();
});
