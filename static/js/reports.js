/* ============================================
   IEMS — Reports Tab (CSV / PDF Generation)
   ============================================ */

let reportColumnsLoaded = false;

async function loadReportFilters() {
    loadFilterOptions();
    if (!reportColumnsLoaded) {
        await loadReportColumns();
        reportColumnsLoaded = true;
    }
}

async function loadReportColumns() {
    try {
        const res = await api('/api/reports/columns');
        const columns = await res.json();
        const grid = document.getElementById('column-grid');
        if (!grid) return;

        grid.innerHTML = '';
        Object.entries(columns).forEach(([key, label]) => {
            grid.innerHTML += `
                <label class="column-check">
                    <input type="checkbox" value="${key}" checked>
                    <span>${label}</span>
                </label>
            `;
        });
    } catch (err) {
        console.error('Failed to load report columns:', err);
    }
}

function getSelectedColumns() {
    const checkboxes = document.querySelectorAll('#column-grid input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

async function generateReport() {
    const format = document.querySelector('input[name="report-format"]:checked')?.value || 'csv';
    const filterType = document.getElementById('report-filter-type')?.value || '';
    const filterLocation = document.getElementById('report-filter-location')?.value || '';
    const filterStatus = document.getElementById('report-filter-status')?.value || '';
    const columns = getSelectedColumns();

    if (columns.length === 0) {
        showToast('Please select at least one column', 'error');
        return;
    }

    const btn = document.getElementById('btn-generate-report');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Generating...';

    try {
        const res = await fetch('/api/reports/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                format,
                filter_type: filterType,
                filter_location: filterLocation,
                filter_status: filterStatus,
                columns
            })
        });

        if (res.ok) {
            const blob = await res.blob();
            const contentDisposition = res.headers.get('Content-Disposition') || '';
            let filename = `IEMS_Report.${format}`;
            const match = contentDisposition.match(/filename=(.+)/);
            if (match) filename = match[1];

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showToast(`${format.toUpperCase()} report generated successfully!`, 'success');
        } else {
            const err = await res.json();
            showToast(err.error || 'Failed to generate report', 'error');
        }
    } catch (err) {
        showToast('An error occurred while generating the report', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '📥 Generate Report';
    }
}

// ── Event Listeners ──
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-generate-report')?.addEventListener('click', generateReport);

    document.getElementById('btn-select-all-cols')?.addEventListener('click', () => {
        document.querySelectorAll('#column-grid input[type="checkbox"]').forEach(cb => cb.checked = true);
    });

    document.getElementById('btn-deselect-all-cols')?.addEventListener('click', () => {
        document.querySelectorAll('#column-grid input[type="checkbox"]').forEach(cb => cb.checked = false);
    });
});
