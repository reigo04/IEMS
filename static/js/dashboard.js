/* ============================================
   IEMS — Dashboard (Overview Tab)
   ============================================ */

let typeChart = null;
let locationChart = null;

async function loadOverview() {
    loadStats();
    loadChartByType();
    loadChartByLocation();
    loadRecentEquipment();
}

async function loadStats() {
    try {
        const res = await api('/api/stats');
        const data = await res.json();
        animateCounter('stat-total', data.total);
        animateCounter('stat-serviceable', data.serviceable);
        animateCounter('stat-unserviceable', data.unserviceable);
    } catch (err) {
        console.error('Failed to load stats:', err);
    }
}

function animateCounter(elementId, target) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    const duration = 600;
    const startTime = performance.now();

    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(start + (target - start) * eased);
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

const CHART_COLORS = [
    '#14b8a6', '#8b5cf6', '#f59e0b', '#ef4444', '#38bdf8',
    '#ec4899', '#10b981', '#f97316', '#6366f1', '#84cc16',
    '#06b6d4', '#e879f9'
];

async function loadChartByType() {
    try {
        const res = await api('/api/chart/by-type');
        const data = await res.json();

        const ctx = document.getElementById('chart-by-type');
        if (!ctx) return;

        if (typeChart) typeChart.destroy();

        typeChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
                    backgroundColor: CHART_COLORS.slice(0, data.labels.length),
                    borderColor: 'rgba(6, 8, 13, 0.8)',
                    borderWidth: 3,
                    hoverBorderWidth: 0,
                    hoverOffset: 8,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#8896ab',
                            font: { family: 'Inter', size: 12 },
                            padding: 16,
                            usePointStyle: true,
                            pointStyleWidth: 10,
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(10, 14, 22, 0.95)',
                        titleColor: '#e8edf5',
                        bodyColor: '#8896ab',
                        borderColor: 'rgba(56,189,248,0.1)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12,
                        titleFont: { family: 'Inter', weight: '600' },
                        bodyFont: { family: 'Inter' },
                        callbacks: {
                            label: function(ctx) {
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = ((ctx.parsed / total) * 100).toFixed(1);
                                return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    } catch (err) {
        console.error('Failed to load type chart:', err);
    }
}

async function loadChartByLocation() {
    try {
        const res = await api('/api/chart/by-location');
        const data = await res.json();

        const ctx = document.getElementById('chart-by-location');
        if (!ctx) return;

        if (locationChart) locationChart.destroy();

        locationChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Equipment Count',
                    data: data.values,
                    backgroundColor: CHART_COLORS.slice(0, data.labels.length).map(c => c + '40'),
                    borderColor: CHART_COLORS.slice(0, data.labels.length),
                    borderWidth: 1.5,
                    borderRadius: 6,
                    hoverBackgroundColor: CHART_COLORS.slice(0, data.labels.length).map(c => c + '80'),
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const idx = elements[0].index;
                        const location = data.labels[idx];
                        showLocationPopup(location);
                    }
                },
                onHover: (event, elements) => {
                    event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(10, 14, 22, 0.95)',
                        titleColor: '#e8edf5',
                        bodyColor: '#8896ab',
                        borderColor: 'rgba(56,189,248,0.1)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12,
                        titleFont: { family: 'Inter', weight: '600' },
                        bodyFont: { family: 'Inter' },
                        callbacks: {
                            title: (items) => `📍 ${items[0].label}`,
                            label: (ctx) => ` ${ctx.parsed.y} equipment(s) — click to view`
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#8896ab', font: { family: 'Inter', size: 11 } },
                        grid: { display: false },
                        border: { color: 'rgba(56,189,248,0.08)' }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#8896ab',
                            font: { family: 'Inter', size: 11 },
                            stepSize: 1,
                        },
                        grid: { color: 'rgba(56,189,248,0.04)' },
                        border: { display: false }
                    }
                }
            }
        });
    } catch (err) {
        console.error('Failed to load location chart:', err);
    }
}

async function showLocationPopup(location) {
    try {
        const res = await api(`/api/equipment/by-location/${encodeURIComponent(location)}`);
        const items = await res.json();

        document.getElementById('location-popup-title').textContent = `📍 Equipment at: ${location}`;
        const tbody = document.getElementById('location-popup-tbody');
        tbody.innerHTML = '';

        items.forEach(item => {
            tbody.innerHTML += `
                <tr>
                    <td>${item.id}</td>
                    <td>${item.procurement_title}</td>
                    <td>${item.type_of_equipment}</td>
                    <td>${item.brand} ${item.model}</td>
                    <td>${item.serial_number}</td>
                    <td>${item.person_accountable}</td>
                    <td>${statusBadge(item.status)}</td>
                </tr>
            `;
        });

        document.getElementById('location-popup').classList.add('active');
    } catch (err) {
        showToast('Failed to load location data', 'error');
    }
}

// Close location popup
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('location-popup-close');
    const overlay = document.getElementById('location-popup');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => overlay.classList.remove('active'));
    }
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    }
});

async function loadRecentEquipment() {
    try {
        const res = await api('/api/recent');
        const items = await res.json();
        const tbody = document.getElementById('recent-tbody');
        if (!tbody) return;

        if (items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7">
                        <div class="empty-state" style="padding:30px;">
                            <div class="empty-icon">📦</div>
                            <h3>No equipment yet</h3>
                            <p>Add your first equipment to see it here</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = items.map(item => `
            <tr>
                <td>${item.id}</td>
                <td>${item.procurement_title}</td>
                <td>${item.type_of_equipment}</td>
                <td>${item.brand} ${item.model}</td>
                <td>${item.location}</td>
                <td>${statusBadge(item.status)}</td>
                <td>${formatDate(item.created_at)}</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Failed to load recent equipment:', err);
    }
}
