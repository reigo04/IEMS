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

// ── Theme-aware color helper ──
function getChartTheme() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    return {
        isLight,
        // Doughnut border: matches card background — thin hairline separator, not heavy outline
        doughnutBorder: isLight ? 'rgba(248,250,252,0.95)' : 'rgba(10,14,22,0.85)',
        doughnutBorderWidth: 1.5,
        // Tooltip
        tooltipBg:     isLight ? 'rgba(255,255,255,0.97)' : 'rgba(10,14,22,0.95)',
        tooltipTitle:  isLight ? '#0f172a'                : '#e8edf5',
        tooltipBody:   isLight ? '#4a5568'                : '#8896ab',
        tooltipBorder: isLight ? 'rgba(13,148,136,0.15)' : 'rgba(56,189,248,0.1)',
        // Legend / axis tick labels
        labelColor:    isLight ? '#4a5568' : '#8896ab',
        // Bar chart grid lines
        gridColor:     isLight ? 'rgba(0,0,0,0.06)'       : 'rgba(56,189,248,0.04)',
        axisColor:     isLight ? 'rgba(0,0,0,0.08)'       : 'rgba(56,189,248,0.08)',
        // Bar alpha suffixes (hex)
        barBgAlpha:    isLight ? '30' : '40',
        barHoverAlpha: isLight ? '70' : '80',
    };
}

async function loadChartByType() {
    try {
        const res = await api('/api/chart/by-type');
        const data = await res.json();

        const ctx = document.getElementById('chart-by-type');
        if (!ctx) return;

        if (typeChart) typeChart.destroy();

        const t = getChartTheme();

        // Build dataset: chartjs-chart-treemap needs { key, value } objects
        const treeData = data.labels.map((label, i) => ({
            category: label,
            value: data.values[i],
            color: CHART_COLORS[i % CHART_COLORS.length],
        }));

        typeChart = new Chart(ctx, {
            type: 'treemap',
            data: {
                datasets: [{
                    label: 'Equipment by Type',
                    tree: treeData,
                    key: 'value',
                    groups: ['category'],
                    backgroundColor(ctx) {
                        if (ctx.type !== 'data') return 'transparent';
                        const raw = ctx.raw?._data;
                        const idx = treeData.findIndex(d => d.category === raw?.category);
                        const base = CHART_COLORS[idx % CHART_COLORS.length];
                        return base + (t.isLight ? 'cc' : 'dd');  // slight transparency
                    },
                    borderColor(ctx) {
                        if (ctx.type !== 'data') return 'transparent';
                        return t.isLight ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.3)';
                    },
                    borderWidth: 2,
                    borderRadius: 6,
                    spacing: 2,
                    labels: {
                        display: true,
                        align: 'center',
                        position: 'middle',
                        formatter(ctx) {
                            if (ctx.type !== 'data') return '';
                            const raw = ctx.raw?._data;
                            if (!raw) return '';
                            const total = treeData.reduce((s, d) => s + d.value, 0);
                            const pct = ((raw.value / total) * 100).toFixed(1);
                            // Only show label if cell is large enough
                            const w = ctx.raw?.w ?? 0;
                            const h = ctx.raw?.h ?? 0;
                            if (w < 60 || h < 30) return '';
                            if (h < 52) return [raw.value.toString()];
                            return [raw.category, `${raw.value} (${pct}%)`];
                        },
                        color: '#ffffff',
                        font: [
                            { family: 'Inter', size: 11, weight: '600' },
                            { family: 'Inter', size: 10, weight: '400' },
                        ],
                        overflow: 'hidden',
                    },
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: t.tooltipBg,
                        titleColor: t.tooltipTitle,
                        bodyColor: t.tooltipBody,
                        borderColor: t.tooltipBorder,
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12,
                        titleFont: { family: 'Inter', weight: '600' },
                        bodyFont: { family: 'Inter' },
                        callbacks: {
                            title(items) {
                                return items[0]?.raw?._data?.category ?? '';
                            },
                            label(item) {
                                const raw = item.raw?._data;
                                if (!raw) return '';
                                const total = treeData.reduce((s, d) => s + d.value, 0);
                                const pct = ((raw.value / total) * 100).toFixed(1);
                                return ` ${raw.value} equipment (${pct}%)`;
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

        const t = getChartTheme();

        locationChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Equipment Count',
                    data: data.values,
                    backgroundColor: CHART_COLORS.slice(0, data.labels.length).map(c => c + t.barBgAlpha),
                    borderColor: CHART_COLORS.slice(0, data.labels.length),
                    borderWidth: 1.5,
                    borderRadius: 6,
                    hoverBackgroundColor: CHART_COLORS.slice(0, data.labels.length).map(c => c + t.barHoverAlpha),
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
                        backgroundColor: t.tooltipBg,
                        titleColor: t.tooltipTitle,
                        bodyColor: t.tooltipBody,
                        borderColor: t.tooltipBorder,
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
                        ticks: { color: t.labelColor, font: { family: 'Inter', size: 11 } },
                        grid: { display: false },
                        border: { color: t.axisColor }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: t.labelColor,
                            font: { family: 'Inter', size: 11 },
                            stepSize: 1,
                        },
                        grid: { color: t.gridColor },
                        border: { display: false }
                    }
                }
            }
        });
    } catch (err) {
        console.error('Failed to load location chart:', err);
    }
}

// ── Re-render charts automatically when the theme is toggled ──
const _chartThemeObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
        if (m.attributeName === 'data-theme') {
            if (typeChart || locationChart) {
                loadChartByType();
                loadChartByLocation();
            }
            break;
        }
    }
});
_chartThemeObserver.observe(document.documentElement, { attributes: true });

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
                    <td colspan="14">
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
                <td>${item.location || '-'}</td>
                <td>${item.indicator || '-'}</td>
                <td class="truncate" title="${item.procurement_title}">${item.procurement_title}</td>
                <td>${item.supplier || '-'}</td>
                <td>${item.type_of_equipment}</td>
                <td>${item.brand}</td>
                <td>${item.model}</td>
                <td>${item.property_number || '-'}</td>
                <td style="font-family:monospace; font-size:0.8rem;">${item.serial_number}</td>
                <td>${item.acquisition_date || '-'}</td>
                <td>${item.cost ? '₱' + item.cost.toLocaleString() : '-'}</td>
                <td>${item.person_accountable}</td>
                <td>${item.used_by || '-'}</td>
                <td><span class="badge ${item.with_warranty ? 'badge-yes' : 'badge-no'}">${item.with_warranty ? 'Yes' : 'No'}</span></td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Failed to load recent equipment:', err);
    }
}
