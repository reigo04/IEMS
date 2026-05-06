/* ============================================
   IEMS — Reports Tab (CSV / PDF Generation)
   ============================================ */

async function loadReportFilters() {
    loadFilterOptions();
}

async function generateReport() {
    const format = document.querySelector('input[name="report-format"]:checked')?.value || 'csv';
    const filterType = document.getElementById('report-filter-type')?.value || '';
    const filterLocation = document.getElementById('report-filter-location')?.value || '';
    const filterStatus = document.getElementById('report-filter-status')?.value || '';
    const filterWarranty = document.getElementById('report-filter-warranty')?.value || '';
    const filterUps = document.getElementById('report-filter-ups')?.value || '';
    const filterAntivirus = document.getElementById('report-filter-antivirus')?.value || '';

    if (!filterType) {
        showToast('Please select an equipment type before generating a report', 'error');
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
                filter_warranty: filterWarranty,
                filter_ups: filterUps,
                filter_antivirus: filterAntivirus,
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
});
