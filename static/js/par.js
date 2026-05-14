/* ============================================
   IEMS — PAR (Property Acknowledgement Receipt)
   Appendix 71 — Property Acknowledgment Receipt
   ============================================ */

const PAR_THRESHOLD = 50000;
const PAR_ISSUED_BY_NAME = 'RUSSEL MARC A. AGULAY';
const PAR_ISSUED_BY_POSITION = 'INFORMATION SYSTEMS ANALYST II';

// ── Helpers ──

function parBuildDescription(item) {
    const type = (item.type_of_equipment || '').trim();
    const desc = (item.description || '').trim();
    if (type && desc) return `${type} ${desc}`;
    return type || desc || '—';
}

function parFormatCurrency(amount) {
    if (!amount && amount !== 0) return '—';
    return parseFloat(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parFormatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
}

function parQualifies(item) {
    return (parseFloat(item.cost) || 0) >= PAR_THRESHOLD;
}

// ── HTML Print Window ──

function parBuildPageHTML(item) {
    const blankRows = Array(29).fill(
        '<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>'
    ).join('');

    return `
        <div class="par-page">
            <div class="par-appendix">Appendix 71</div>
            <h1 class="par-title">PROPERTY ACKNOWLEDGMENT RECEIPT</h1>

            <div class="par-header-fields">
                <div class="par-field-row">
                    <span class="par-label">Entity Name :</span>
                    <span class="par-underline"></span>
                </div>
                <div class="par-field-row two-col">
                    <div class="par-field-group">
                        <span class="par-label">Fund Cluster:</span>
                        <span class="par-underline"></span>
                    </div>
                    <div class="par-field-group">
                        <span class="par-label">PAR No.:</span>
                        <span class="par-underline"></span>
                    </div>
                </div>
            </div>

            <table class="par-table">
                <thead>
                    <tr>
                        <th>Quantity</th>
                        <th>Unit</th>
                        <th>Description</th>
                        <th>Property Number</th>
                        <th>Date Acquired</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="par-data-row">
                        <td>1</td>
                        <td>piece</td>
                        <td>${parBuildDescription(item)}</td>
                        <td>${item.property_number || '—'}</td>
                        <td>${parFormatDate(item.acquisition_date)}</td>
                        <td class="par-amount">${parFormatCurrency(item.cost)}</td>
                    </tr>
                    ${blankRows}
                </tbody>
            </table>

            <div class="par-signature-section">
                <div class="par-sig-block">
                    <div class="par-sig-label">Received by:</div>
                    <div class="par-sig-name">${(item.person_accountable || '').toUpperCase()}</div>
                    <div class="par-sig-line"></div>
                    <div class="par-sig-desc">Signature over Printed Name of End User</div>
                    <div class="par-sig-line" style="margin-top:18px;"></div>
                    <div class="par-sig-desc">Position/Office</div>
                    <div class="par-sig-value">${item.person_accountable_position || ''}</div>
                    <div class="par-sig-value" style="margin-top:12px;"></div>
                    <div class="par-sig-line"></div>
                    <div class="par-sig-desc">Date</div>
                </div>
                <div class="par-sig-block">
                    <div class="par-sig-label">Issued by:</div>
                    <div class="par-sig-name">${PAR_ISSUED_BY_NAME}</div>
                    <div class="par-sig-line"></div>
                    <div class="par-sig-desc">Signature over Printed Name of Supply and/or<br>Property Custodian</div>
                    <div class="par-sig-line" style="margin-top:18px;"></div>
                    <div class="par-sig-desc">Position/Office</div>
                    <div class="par-sig-value">${PAR_ISSUED_BY_POSITION}</div>
                    <div class="par-sig-value" style="margin-top:12px;"></div>
                    <div class="par-sig-line"></div>
                    <div class="par-sig-desc">Date</div>
                </div>
            </div>
        </div>
    `;
}

function parBuildPrintDocument(items) {
    const qualifying = items.filter(parQualifies);
    if (qualifying.length === 0) return null;
    const pagesHTML = qualifying.map(parBuildPageHTML).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Property Acknowledgment Receipt</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; background:#fff; color:#000; }
.par-page {
    width: 215mm; min-height: 279mm; margin: 0 auto;
    padding: 10mm 12mm 8mm;
    border: 2px solid #000000;
    page-break-after: always; position: relative;
}
.par-page:last-child { page-break-after: auto; }
.par-appendix { text-align:right; font-style:italic; font-size:8.5pt; margin-bottom:4px; }
.par-title { text-align:center; font-weight:bold; font-size:12pt; margin-bottom:8px; letter-spacing:0.5px; }
.par-header-fields { margin-bottom:6px; }
.par-field-row { display:flex; align-items:flex-end; margin-bottom:4px; gap:6px; }
.par-field-row.two-col { justify-content:space-between; gap:20px; }
.par-field-group { display:flex; align-items:flex-end; gap:6px; flex:1; }
.par-label { font-size:9pt; white-space:nowrap; }
.par-underline { flex:1; border-bottom:1px solid #000; min-width:80px; height:14px; }
.par-table { width:100%; border-collapse:collapse; margin-bottom:0; border:2px solid #000000; }
.par-table th, .par-table td { border:1px solid #000000; padding:3px 5px; text-align:center; font-size:8.5pt; }
.par-table th { background:#fff; font-weight:bold; font-size:8.5pt; padding:5px 4px; vertical-align:middle; border:2px solid #000000; }
.par-table td { height:16px; vertical-align:middle; }
.par-table td:nth-child(3) { text-align:left; padding-left:6px; }
.par-table .par-data-row td { font-weight:bold; }
.par-amount { text-align:right !important; padding-right:6px !important; }
.par-table th:nth-child(1),.par-table td:nth-child(1){width:10%}
.par-table th:nth-child(2),.par-table td:nth-child(2){width:9%}
.par-table th:nth-child(3),.par-table td:nth-child(3){width:36%}
.par-table th:nth-child(4),.par-table td:nth-child(4){width:19%}
.par-table th:nth-child(5),.par-table td:nth-child(5){width:14%}
.par-table th:nth-child(6),.par-table td:nth-child(6){width:12%}
.par-signature-section { display:flex; border:2px solid #000000; border-top:none; }
.par-sig-block { flex:1; padding:8px 12px 10px; text-align:center; }
.par-sig-block:first-child { border-right:1px solid #000000; }
.par-sig-label { text-align:left; font-weight:bold; font-size:9pt; margin-bottom:16px; }
.par-sig-name { font-weight:bold; font-size:9pt; min-height:20px; margin-bottom:2px; }
.par-sig-line { border-bottom:1px solid #000; margin:0 10px 2px; }
.par-sig-desc { font-size:7.5pt; color:#333; margin-bottom:2px; line-height:1.3; }
.par-sig-value { font-size:8pt; font-weight:600; margin-top:2px; }
@media print {
    body { margin:0; }
    .par-page { border:2px solid #000000; margin:0 auto; }
}
</style>
</head>
<body>${pagesHTML}</body>
</html>`;
}

function parOpenPrintWindow(items) {
    const qualifying = items.filter(parQualifies);
    const skipped = items.length - qualifying.length;

    if (qualifying.length === 0) {
        showToast('None of the selected items qualify for PAR (cost must be \u2265 \u20b150,000)', 'error');
        return;
    }
    if (skipped > 0) {
        showToast(`Printing ${qualifying.length} PAR(s). ${skipped} item(s) skipped (cost < \u20b150,000).`, 'info');
    }

    const html = parBuildPrintDocument(qualifying);
    const win = window.open('', '_blank');
    if (!win) {
        showToast('Pop-up blocked. Please allow pop-ups to print PAR.', 'error');
        return;
    }
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.print(); };
}

// ── PDF Download ──

function parGenerateAndDownload(items, filename) {
    const qualifying = items.filter(parQualifies);
    const skipped = items.length - qualifying.length;

    if (qualifying.length === 0) {
        showToast('None of the selected items qualify for PAR (cost must be \u2265 \u20b150,000)', 'error');
        return;
    }
    if (skipped > 0) {
        showToast(`Generating ${qualifying.length} PAR(s). ${skipped} item(s) skipped (cost < \u20b150,000).`, 'info');
    }

    if (!window.jspdf) {
        showToast('PDF library not loaded. Please refresh the page and try again.', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [215, 279] });

    qualifying.forEach((item, idx) => {
        if (idx > 0) doc.addPage();
        parRenderPDFPage(doc, item);
    });

    doc.save(filename || `PAR_${Date.now()}.pdf`);
    showToast(`${qualifying.length} PAR(s) downloaded successfully \ud83d\udcc4`, 'success');
}

function parRenderPDFPage(doc, item) {
    const pageW = 215;
    const pageH = 279;
    const marginL = 12;
    const marginR = 12;
    const contentW = pageW - marginL - marginR;

    // Outer border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    doc.rect(marginL - 2, 8, contentW + 4, pageH - 16);

    let y = 13;

    // Appendix 71
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('Appendix 71', pageW - marginR - 2, y, { align: 'right' });
    y += 6;

    // Title
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PROPERTY ACKNOWLEDGMENT RECEIPT', pageW / 2, y, { align: 'center' });
    y += 7;

    // Entity Name
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Entity Name :', marginL, y);
    doc.line(marginL + 27, y + 0.5, marginL + contentW / 2, y + 0.5);
    y += 5;

    // Fund Cluster + PAR No.
    doc.text('Fund Cluster:', marginL, y);
    doc.line(marginL + 25, y + 0.5, marginL + contentW / 2 - 5, y + 0.5);
    doc.text('PAR No.:', marginL + contentW / 2 + 2, y);
    doc.line(marginL + contentW / 2 + 21, y + 0.5, marginL + contentW, y + 0.5);
    y += 6;

    // Table
    const colWidths = [
        contentW * 0.10,
        contentW * 0.09,
        contentW * 0.36,
        contentW * 0.19,
        contentW * 0.14,
        contentW * 0.12,
    ];

    const dataRow = [
        '1', 'piece',
        parBuildDescription(item),
        item.property_number || '\u2014',
        parFormatDate(item.acquisition_date),
        parFormatCurrency(item.cost),
    ];

    const tableRows = [dataRow];
    for (let i = 0; i < 24; i++) tableRows.push(['', '', '', '', '', '']);

    doc.autoTable({
        startY: y,
        head: [['Quantity', 'Unit', 'Description', 'Property Number', 'Date Acquired', 'Amount']],
        body: tableRows,
        theme: 'grid',
        margin: { left: marginL - 2, right: marginR - 2 },
        tableWidth: contentW + 4,
        columnStyles: {
            0: { cellWidth: colWidths[0], halign: 'center' },
            1: { cellWidth: colWidths[1], halign: 'center' },
            2: { cellWidth: colWidths[2], halign: 'left' },
            3: { cellWidth: colWidths[3], halign: 'center' },
            4: { cellWidth: colWidths[4], halign: 'center' },
            5: { cellWidth: colWidths[5], halign: 'right' },
        },
        headStyles: {
            fillColor: [255, 255, 255], textColor: [0, 0, 0],
            fontStyle: 'bold', fontSize: 8,
            lineColor: [0, 0, 0], lineWidth: 0.4,
            halign: 'center', valign: 'middle',
        },
        bodyStyles: {
            fontSize: 7.5, textColor: [0, 0, 0],
            lineColor: [0, 0, 0], lineWidth: 0.3,
            minCellHeight: 5,
        },
        didParseCell: (data) => {
            if (data.section === 'body' && data.row.index === 0) {
                data.cell.styles.fontStyle = 'bold';
            }
        },
    });

    const tableEndY = doc.lastAutoTable.finalY;
    y = tableEndY;

    // Signature section
    const sigH = 54;
    const halfW = (contentW + 4) / 2;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.rect(marginL - 2, y, contentW + 4, sigH);
    doc.line(marginL - 2 + halfW, y, marginL - 2 + halfW, y + sigH);

    // Left — Received by
    const lx = marginL;
    let sy = y + 4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.text('Received by:', lx, sy); sy += 8;

    const rcvrName = (item.person_accountable || '').toUpperCase();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text(rcvrName, lx + halfW / 2 - 4, sy, { align: 'center', maxWidth: halfW - 10 }); sy += 1;
    doc.setLineWidth(0.3); doc.line(lx, sy, lx + halfW - 8, sy); sy += 3;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.text('Signature over Printed Name of End User', lx + halfW / 2 - 4, sy, { align: 'center' }); sy += 8;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text(item.person_accountable_position || '', lx + halfW / 2 - 4, sy, { align: 'center', maxWidth: halfW - 10 }); sy += 1;
    doc.setLineWidth(0.3); doc.line(lx, sy, lx + halfW - 8, sy); sy += 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.text('Position/Office', lx + halfW / 2 - 4, sy, { align: 'center' }); sy += 4;

    sy += 1; // Blank space for manual date
    doc.line(lx, sy, lx + halfW - 8, sy); sy += 3;
    doc.text('Date', lx + halfW / 2 - 4, sy, { align: 'center' });

    // Right — Issued by
    const rx = marginL + halfW;
    sy = y + 4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.text('Issued by:', rx, sy); sy += 8;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text(PAR_ISSUED_BY_NAME, rx + halfW / 2 - 4, sy, { align: 'center', maxWidth: halfW - 10 }); sy += 1;
    doc.setLineWidth(0.3); doc.line(rx, sy, rx + halfW - 8, sy); sy += 3;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.text('Signature over Printed Name of Supply and/or', rx + halfW / 2 - 4, sy, { align: 'center' }); sy += 3;
    doc.text('Property Custodian', rx + halfW / 2 - 4, sy, { align: 'center' }); sy += 5;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text(PAR_ISSUED_BY_POSITION, rx + halfW / 2 - 4, sy, { align: 'center', maxWidth: halfW - 10 }); sy += 1;
    doc.setLineWidth(0.3); doc.line(rx, sy, rx + halfW - 8, sy); sy += 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.text('Position/Office', rx + halfW / 2 - 4, sy, { align: 'center' }); sy += 4;

    sy += 1; // Blank space for manual date
    doc.line(rx, sy, rx + halfW - 8, sy); sy += 3;
    doc.text('Date', rx + halfW / 2 - 4, sy, { align: 'center' });
}

// ── Single PAR ──

async function printSinglePAR(id) {
    try {
        const res = await api(`/api/equipment/${id}`);
        const item = await res.json();
        if (!parQualifies(item)) {
            showToast(`This item does not qualify for PAR. Cost must be \u2265 \u20b150,000 (current: \u20b1${parFormatCurrency(item.cost)})`, 'error');
            return;
        }
        parOpenPrintWindow([item]);
    } catch (err) {
        showToast('Failed to load equipment data for PAR', 'error');
    }
}

async function downloadSinglePAR(id) {
    try {
        const res = await api(`/api/equipment/${id}`);
        const item = await res.json();
        if (!parQualifies(item)) {
            showToast(`This item does not qualify for PAR. Cost must be \u2265 \u20b150,000 (current: \u20b1${parFormatCurrency(item.cost)})`, 'error');
            return;
        }
        const safeProp = (item.property_number || String(item.id)).replace(/[^a-zA-Z0-9]/g, '_');
        parGenerateAndDownload([item], `PAR_${safeProp}.pdf`);
    } catch (err) {
        showToast('Failed to load equipment data for PAR', 'error');
    }
}

// ── Bulk PAR ──

async function printBulkPAR() {
    if (selectedIds.size === 0) { showToast('No items selected', 'error'); return; }
    try {
        const ids = Array.from(selectedIds);
        const results = await Promise.all(ids.map(id => api(`/api/equipment/${id}`).then(r => r.json())));
        parOpenPrintWindow(results);
    } catch (err) {
        showToast('Failed to load equipment data for bulk PAR print', 'error');
    }
}

async function downloadBulkPAR() {
    if (selectedIds.size === 0) { showToast('No items selected', 'error'); return; }
    try {
        const ids = Array.from(selectedIds);
        const results = await Promise.all(ids.map(id => api(`/api/equipment/${id}`).then(r => r.json())));
        parGenerateAndDownload(results, `PAR_Bulk_${Date.now()}.pdf`);
    } catch (err) {
        showToast('Failed to load equipment data for bulk PAR download', 'error');
    }
}

// ── Auto-PAR Toast (shown after save/import for qualifying items) ──

function parShowAutoNotification(items) {
    const qualifying = (items || []).filter(parQualifies);
    if (qualifying.length === 0) return;

    const msg = qualifying.length === 1
        ? `1 new item qualifies for PAR (\u2265 \u20b150,000).`
        : `${qualifying.length} new items qualify for PAR (\u2265 \u20b150,000).`;

    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast toast-info';
    toast.style.cssText = 'flex-direction:column; align-items:flex-start; gap:8px; max-width:360px;';
    toast.innerHTML = `
        <div style="font-weight:600;">\ud83d\udcc4 ${msg}</div>
        <div style="display:flex;gap:8px;">
            <button id="par-auto-print"
                style="background:rgba(245,158,11,0.2);color:#f59e0b;border:1px solid rgba(245,158,11,0.4);
                       padding:5px 12px;border-radius:6px;cursor:pointer;font-size:0.78rem;font-weight:600;font-family:inherit;">
                \ud83d\udda8\ufe0f Print PAR
            </button>
            <button id="par-auto-download"
                style="background:rgba(99,102,241,0.2);color:#818cf8;border:1px solid rgba(99,102,241,0.4);
                       padding:5px 12px;border-radius:6px;cursor:pointer;font-size:0.78rem;font-weight:600;font-family:inherit;">
                \ud83d\udcc4 Download PAR
            </button>
        </div>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    const dismiss = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    };

    toast.querySelector('#par-auto-print').addEventListener('click', () => {
        parOpenPrintWindow(qualifying); dismiss();
    });
    toast.querySelector('#par-auto-download').addEventListener('click', () => {
        parGenerateAndDownload(qualifying, `PAR_New_${Date.now()}.pdf`); dismiss();
    });

    setTimeout(dismiss, 15000);
}

// ── Wire up PAR buttons once DOM is ready ──

document.addEventListener('DOMContentLoaded', () => {
    // Bulk bar buttons
    document.getElementById('btn-bulk-print-par')?.addEventListener('click', printBulkPAR);
    document.getElementById('btn-bulk-download-par')?.addEventListener('click', downloadBulkPAR);

    // View modal PAR buttons (wired here; visibility toggled in renderViewModal)
    document.getElementById('view-modal-print-par-btn')?.addEventListener('click', () => {
        if (currentViewId) printSinglePAR(currentViewId);
    });
    document.getElementById('view-modal-download-par-btn')?.addEventListener('click', () => {
        if (currentViewId) downloadSinglePAR(currentViewId);
    });
});
