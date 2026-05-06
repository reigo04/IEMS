/* ============================================
   IEMS — Equipment Tab (CRUD, Import, Bulk, Repair Files, View)
   ============================================ */

let currentPage = 1;
let selectedIds = new Set();
let editingId = null;
let deleteTargetIds = [];
let searchTimeout = null;
let currentViewId = null;
let globalSelectActive = false; // tracks if all-in-DB are selected

// ── Equipment Type → Condition Checklist Config ──
const CHECKLIST_CONFIG = {
    'Desktop PC': [
        { key: 'with_warranty',         label: 'With Warranty?' },
        { key: 'charging_ups',          label: 'With UPS?' },
        { key: 'weekly_scan_antivirus', label: 'Antivirus Installed?' },
        { key: 'working_keyboard_mouse',label: 'Working Mouse & Keyboard?' },
        { key: 'clear_monitor',         label: 'With Clear Monitor?' },
        { key: 'working_io_ports',      label: 'Working I/O Ports?' },
        { key: 'updated_patched_os',    label: 'Updated Operating System?' },
        { key: 'active_cmos_battery',   label: 'Active CMOS Battery?' },
    ],
    'Laptop': [
        { key: 'with_warranty',         label: 'With Warranty?' },
        { key: 'weekly_scan_antivirus', label: 'Antivirus Installed?' },
        { key: 'working_keyboard_mouse',label: 'Working Trackpad & Keyboard?' },
        { key: 'clear_monitor',         label: 'With Clear Monitor?' },
        { key: 'working_io_ports',      label: 'Working I/O Ports?' },
        { key: 'updated_patched_os',    label: 'Updated Operating System?' },
        { key: 'working_speakers',      label: 'Working Speakers?' },
    ],
    'Tablet': [
        { key: 'with_warranty',         label: 'With Warranty?' },
        { key: 'weekly_scan_antivirus', label: 'Antivirus Installed?' },
        { key: 'working_keyboard_mouse',label: 'Working Trackpad & Keyboard?' },
        { key: 'clear_monitor',         label: 'With Clear Monitor?' },
        { key: 'working_io_ports',      label: 'Working I/O Ports?' },
        { key: 'updated_patched_os',    label: 'Updated Operating System?' },
        { key: 'working_speakers',      label: 'Working Speakers?' },
    ],
    'Printer': [
        { key: 'with_warranty',         label: 'With Warranty?' },
        { key: 'ink_level_ok',          label: 'Ink Level Above 50% Capacity?' },
        { key: 'printing_black',        label: 'Printing Black Color?' },
        { key: 'printing_cyan',         label: 'Printing Cyan Color?' },
        { key: 'printing_magenta',      label: 'Printing Magenta Color?' },
        { key: 'printing_yellow',       label: 'Printing Yellow Color?' },
        { key: 'working_pickup_roller', label: 'Working Pick-up Roller?' },
        { key: 'ink_wastepad_ok',       label: 'Ink Wastepad Cleaned/Replaced?' },
    ],
    'Document Scanner': [
        { key: 'with_warranty',             label: 'With Warranty?' },
        { key: 'working_adf',               label: 'Working ADF?' },
        { key: 'working_buttons',           label: 'Working Buttons?' },
        { key: 'working_pickup_roller',     label: 'Working Pick-up Roller?' },
        { key: 'working_separation_roller', label: 'Working Separation Roller?' },
    ],
    'LCD Projector': [
        { key: 'with_warranty',    label: 'With Warranty?' },
        { key: 'laser_source',     label: 'Laser Source?' },
        { key: 'bulb_source',      label: 'Bulb Source?' },
        { key: 'working_buttons',  label: 'Working Buttons & I/O Ports?' },
        { key: 'clear_projection', label: 'With Clear Projection/Output?' },
    ],
    'Monitor': [
        { key: 'with_warranty',         label: 'With Warranty?' },
        { key: 'charging_ups',          label: 'With UPS?' },
        { key: 'weekly_scan_antivirus', label: 'Antivirus Installed?' },
        { key: 'working_keyboard_mouse',label: 'Working Mouse & Keyboard?' },
        { key: 'clear_monitor',         label: 'With Clear Monitor?' },
        { key: 'working_io_ports',      label: 'Working I/O Ports?' },
        { key: 'updated_patched_os',    label: 'Updated Operating System?' },
        { key: 'active_cmos_battery',   label: 'Active CMOS Battery?' },
    ],
    'Other ICT Supplies': [
        { key: 'with_warranty',           label: 'With Warranty?' },
        { key: 'working_buttons',         label: 'Working Buttons?' },
        { key: 'working_io_ports',        label: 'I/O Connections?' },
        { key: 'clear_monitor',           label: 'Clear Monitor? (Selected Equipment)' },
        { key: 'good_physical_condition', label: 'Good Physical Condition?' },
        { key: 'functional_for_use',      label: 'Functional For Use?' },
    ],
};

function getChecklistItems(type) {
    return CHECKLIST_CONFIG[type] || CHECKLIST_CONFIG['Desktop PC'];
}

function renderChecklist(type) {
    const container = document.getElementById('checklist-toggles');
    if (!container) return;
    container.innerHTML = getChecklistItems(type).map(item => `
        <div class="toggle-item">
            <span>${item.label}</span>
            <label class="toggle-switch">
                <input type="checkbox" id="eq-${item.key}" data-field="${item.key}">
                <span class="toggle-slider"></span>
            </label>
        </div>
    `).join('');
}

// ── Type Selector Modal ──
function openTypeSelectorModal() {
    document.getElementById('type-selector-modal').classList.add('active');
}

function closeTypeSelectorModal() {
    document.getElementById('type-selector-modal').classList.remove('active');
}

// ── Load Equipment List ──
async function loadEquipment(page = 1) {
    currentPage = page;
    const search = document.getElementById('equipment-search')?.value || '';
    const type = document.getElementById('filter-type')?.value || '';
    const location = document.getElementById('filter-location')?.value || '';
    const status = document.getElementById('filter-status')?.value || '';

    // Advanced filters
    const indicator = document.getElementById('filter-indicator')?.value || '';
    const procurement_title = document.getElementById('filter-procurement-title')?.value || '';
    const supplier = document.getElementById('filter-supplier')?.value || '';
    const brand = document.getElementById('filter-brand')?.value || '';
    const model = document.getElementById('filter-model')?.value || '';
    const property_number = document.getElementById('filter-property-number')?.value || '';
    const serial_number = document.getElementById('filter-serial-number')?.value || '';
    const person_accountable = document.getElementById('filter-person-accountable')?.value || '';
    const used_by = document.getElementById('filter-used-by')?.value || '';
    const position = document.getElementById('filter-position')?.value || '';
    const acquisition_date = document.getElementById('filter-acquisition-date')?.value || '';
    const inventory_date = document.getElementById('filter-inventory-date')?.value || '';
    const cost = document.getElementById('filter-cost')?.value || '';
    const description = document.getElementById('filter-description')?.value || '';
    const warranty = document.getElementById('filter-warranty')?.value || '';
    const ups = document.getElementById('filter-ups')?.value || '';
    const antivirus = document.getElementById('filter-antivirus')?.value || '';

    const params = new URLSearchParams({
        page, per_page: 25, search, type, location, status,
        indicator, procurement_title, supplier, brand, model,
        property_number, serial_number, person_accountable, used_by,
        position, acquisition_date, inventory_date, cost, description,
        warranty, ups, antivirus
    });

    try {
        const res = await api(`/api/equipment?${params}`);
        const data = await res.json();
        renderEquipmentTable(data);
        renderPagination(data);
        updateBulkBar();
        loadFilterOptions();
    } catch (err) {
        console.error('Failed to load equipment:', err);
        showToast('Failed to load equipment list', 'error');
    }
}

function renderEquipmentTable(data) {
    const tbody = document.getElementById('equipment-tbody');
    if (!tbody) return;

    if (data.items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="16">
                    <div class="empty-state">
                        <div class="empty-icon">📦</div>
                        <h3>No equipment found</h3>
                        <p>Try adjusting your search or filters, or add new equipment</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = data.items.map(item => `
        <tr class="${selectedIds.has(item.id) ? 'selected' : ''}" data-id="${item.id}">
            <td>
                <input type="checkbox" class="row-checkbox row-select"
                       data-id="${item.id}" ${selectedIds.has(item.id) ? 'checked' : ''}>
            </td>
            <td>${item.location || '-'}</td>
            <td>${item.indicator || '-'}</td>
            <td class="truncate" style="max-width:180px;" title="${item.procurement_title}">${item.procurement_title}</td>
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
            <td>
                <div class="action-btns">
                    <button onclick="viewEquipment(${item.id})" title="View" class="view-btn">👁️</button>
                    <button onclick="editEquipment(${item.id})" title="Edit">✏️</button>
                    <button class="delete-btn" onclick="confirmDeleteSingle(${item.id})" title="Delete">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');

    // Row checkbox listeners
    tbody.querySelectorAll('.row-select').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = parseInt(e.target.dataset.id);
            if (e.target.checked) {
                selectedIds.add(id);
            } else {
                selectedIds.delete(id);
            }
            e.target.closest('tr').classList.toggle('selected', e.target.checked);
            updateBulkBar();
            updateSelectAll();
        });
    });
}

function renderPagination(data) {
    const info = document.getElementById('pagination-info');
    const controls = document.getElementById('pagination-controls');
    if (!info || !controls) return;

    const start = (data.page - 1) * data.per_page + 1;
    const end = Math.min(data.page * data.per_page, data.total);
    info.textContent = data.total > 0
        ? `Showing ${start}–${end} of ${data.total} equipment`
        : 'No equipment found';

    let html = '';
    html += `<button ${data.page <= 1 ? 'disabled' : ''} onclick="loadEquipment(${data.page - 1})">◀ Prev</button>`;

    const maxVisible = 5;
    let startPage = Math.max(1, data.page - Math.floor(maxVisible / 2));
    let endPage = Math.min(data.pages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        html += `<button onclick="loadEquipment(1)">1</button>`;
        if (startPage > 2) html += `<button disabled>…</button>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="${i === data.page ? 'active' : ''}" onclick="loadEquipment(${i})">${i}</button>`;
    }

    if (endPage < data.pages) {
        if (endPage < data.pages - 1) html += `<button disabled>…</button>`;
        html += `<button onclick="loadEquipment(${data.pages})">${data.pages}</button>`;
    }

    html += `<button ${data.page >= data.pages ? 'disabled' : ''} onclick="loadEquipment(${data.page + 1})">Next ▶</button>`;
    controls.innerHTML = html;
}

function updateBulkBar() {
    const bar = document.getElementById('bulk-bar');
    const count = document.getElementById('bulk-count');
    if (!bar || !count) return;

    if (selectedIds.size > 0) {
        bar.classList.add('active');
        if (globalSelectActive) {
            count.innerHTML = `<span style="color:var(--accent-primary);font-weight:700;">All ${selectedIds.size}</span> equipment selected`;
        } else {
            count.textContent = `${selectedIds.size} selected`;
        }
    } else {
        bar.classList.remove('active');
        globalSelectActive = false;
    }
}

function updateSelectAll() {
    const selectAll = document.getElementById('select-all');
    const checkboxes = document.querySelectorAll('.row-select');
    const globalBar = document.getElementById('global-select-bar');
    const globalMsg = document.getElementById('global-select-msg');
    if (!selectAll || checkboxes.length === 0) return;

    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    const someChecked = Array.from(checkboxes).some(cb => cb.checked);
    selectAll.checked = allChecked;
    selectAll.indeterminate = someChecked && !allChecked;

    // Show global-select banner when all on current page are checked but global isn't active
    if (globalBar && globalMsg) {
        if (allChecked && checkboxes.length > 0 && !globalSelectActive) {
            const total = document.getElementById('pagination-info')?.textContent.match(/(\d+) equipment/);
            const totalCount = total ? total[1] : '';
            globalMsg.textContent = `All ${checkboxes.length} items on this page are selected.`;
            // Update the "select all" button label with the total
            const btnSelectDb = document.getElementById('btn-select-all-db');
            if (btnSelectDb && totalCount) {
                btnSelectDb.textContent = `Select all ${totalCount} equipment in the system`;
            }
            globalBar.classList.add('active');
        } else if (!allChecked || globalSelectActive) {
            if (!globalSelectActive) globalBar.classList.remove('active');
        }
    }
}

// ── Filter Options ──
async function loadFilterOptions() {
    try {
        const res = await api('/api/filters');
        const data = await res.json();

        populateDatalist('list-types', data.types);
        populateDatalist('list-locations', data.locations);
        
        // Advanced filters
        populateDatalist('list-indicators', data.indicators);
        populateDatalist('list-titles', data.procurement_titles);
        populateDatalist('list-suppliers', data.suppliers);
        populateDatalist('list-brands', data.brands);
        populateDatalist('list-models', data.models);
        populateDatalist('list-prop-nos', data.property_numbers);
        populateDatalist('list-serial-nos', data.serial_numbers);
        populateDatalist('list-persons', data.person_accountables);
        populateDatalist('list-users', data.used_bys);
        populateDatalist('list-positions', data.positions);

        populateSelect('report-filter-type', data.types, '— Select Equipment Type —', true);
        populateSelect('report-filter-location', data.locations, 'All Locations');
    } catch (err) {
        console.error('Failed to load filters:', err);
    }
}

function populateSelect(id, options, defaultText, disableDefault = false) {
    const select = document.getElementById(id);
    if (!select) return;
    const currentVal = select.value;
    const disabledAttr = disableDefault ? ' disabled selected' : '';
    select.innerHTML = `<option value=""${disabledAttr}>${defaultText}</option>`;
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        select.appendChild(option);
    });
    select.value = currentVal;
}

function populateDatalist(id, options) {
    const list = document.getElementById(id);
    if (!list) return;
    list.innerHTML = '';
    options.forEach(opt => {
        if (!opt) return;
        const option = document.createElement('option');
        option.value = opt;
        list.appendChild(option);
    });
}

// ── Modal: Add / Edit ──
function openModal(title = 'Add New Equipment') {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('equipment-modal').classList.add('active');
}

function closeModal() {
    document.getElementById('equipment-modal').classList.remove('active');
    resetForm();
}

function resetForm() {
    document.getElementById('equipment-form').reset();
    document.getElementById('eq-id').value = '';
    editingId = null;
    // Reset radio to serviceable
    document.getElementById('eq-status-serviceable').checked = true;
    // Clear dynamic checklist
    const checklistEl = document.getElementById('checklist-toggles');
    if (checklistEl) checklistEl.innerHTML = '';
    // Reset repair file area
    document.getElementById('repair-upload-area').style.display = 'none';
    document.getElementById('repair-save-first-notice').style.display = 'flex';
    document.getElementById('repair-files-list').innerHTML = '';
}

function getFormData() {
    // Collect checklist values dynamically from rendered toggles
    const conditions = {};
    document.querySelectorAll('#checklist-toggles input[type="checkbox"]').forEach(cb => {
        if (cb.dataset.field) conditions[cb.dataset.field] = cb.checked;
    });

    return {
        indicator: document.getElementById('eq-indicator').value,
        procurement_title: document.getElementById('eq-procurement-title').value,
        supplier: document.getElementById('eq-supplier').value,
        location: document.getElementById('eq-location').value,
        type_of_equipment: document.getElementById('eq-type').value,
        brand: document.getElementById('eq-brand').value,
        model: document.getElementById('eq-model').value,
        property_number: document.getElementById('eq-property-number').value,
        serial_number: document.getElementById('eq-serial-number').value,
        acquisition_date: document.getElementById('eq-acquisition-date').value,
        cost: document.getElementById('eq-cost').value,
        description: document.getElementById('eq-description').value,
        person_accountable: document.getElementById('eq-person-accountable').value,
        person_accountable_position: document.getElementById('eq-person-position').value,
        used_by: document.getElementById('eq-used-by').value,
        used_by_position: document.getElementById('eq-used-by-position').value,
        inventory_date: document.getElementById('eq-inventory-date').value,
        remarks_recommendation: document.getElementById('eq-remarks').value,
        status: document.querySelector('input[name="eq-status"]:checked')?.value || 'serviceable',
        ...conditions,
    };
}

function populateForm(item) {
    document.getElementById('eq-id').value = item.id;
    document.getElementById('eq-indicator').value = item.indicator;
    document.getElementById('eq-procurement-title').value = item.procurement_title;
    document.getElementById('eq-supplier').value = item.supplier;
    document.getElementById('eq-location').value = item.location;
    document.getElementById('eq-type').value = item.type_of_equipment;
    document.getElementById('eq-brand').value = item.brand;
    document.getElementById('eq-model').value = item.model;
    document.getElementById('eq-property-number').value = item.property_number;
    document.getElementById('eq-serial-number').value = item.serial_number;
    document.getElementById('eq-acquisition-date').value = item.acquisition_date;
    document.getElementById('eq-cost').value = item.cost;
    document.getElementById('eq-description').value = item.description;
    document.getElementById('eq-person-accountable').value = item.person_accountable;
    document.getElementById('eq-person-position').value = item.person_accountable_position;
    document.getElementById('eq-used-by').value = item.used_by;
    document.getElementById('eq-used-by-position').value = item.used_by_position;
    document.getElementById('eq-inventory-date').value = item.inventory_date;
    document.getElementById('eq-remarks').value = item.remarks_recommendation;

    // Status radio
    if (item.status === 'unserviceable') {
        document.getElementById('eq-status-unserviceable').checked = true;
    } else {
        document.getElementById('eq-status-serviceable').checked = true;
    }

    // Render type-specific checklist then populate values
    renderChecklist(item.type_of_equipment);
    document.querySelectorAll('#checklist-toggles input[type="checkbox"]').forEach(cb => {
        const field = cb.dataset.field;
        if (field && item[field] !== undefined) cb.checked = !!item[field];
    });

    // Show repair file upload area (equipment already saved)
    document.getElementById('repair-upload-area').style.display = 'block';
    document.getElementById('repair-save-first-notice').style.display = 'none';
    loadRepairFiles(item.id);
}

async function editEquipment(id) {
    try {
        const res = await api(`/api/equipment/${id}`);
        const item = await res.json();
        editingId = id;
        populateForm(item);
        openModal('✏️ Edit Equipment');
    } catch (err) {
        showToast('Failed to load equipment details', 'error');
    }
}

async function saveEquipment() {
    const data = getFormData();
    const saveBtn = document.getElementById('modal-save-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Saving...';

    try {
        let res;
        if (editingId) {
            res = await api(`/api/equipment/${editingId}`, { method: 'PUT', body: data });
        } else {
            res = await api('/api/equipment', { method: 'POST', body: data });
        }

        if (res.ok) {
            showToast(editingId ? 'Equipment updated successfully' : 'Equipment added successfully', 'success');
            closeModal();
            loadEquipment(currentPage);
            loadOverview();
        } else {
            const err = await res.json();
            showToast(err.error || 'Failed to save equipment', 'error');
        }
    } catch (err) {
        showToast('An error occurred while saving', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '💾 Save Equipment';
    }
}

// ── Repair File Upload ──

async function loadRepairFiles(equipmentId) {
    const list = document.getElementById('repair-files-list');
    if (!list) return;

    try {
        const res = await api(`/api/equipment/${equipmentId}/repair-files`);
        const files = await res.json();
        renderRepairFilesList(files, list);
    } catch (err) {
        console.error('Failed to load repair files:', err);
        list.innerHTML = '<p style="color:var(--text-muted); font-size:0.8rem;">Failed to load files.</p>';
    }
}

function renderRepairFilesList(files, container) {
    if (!files || files.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); font-size:0.8rem; padding: 8px 0;">No repair history files uploaded yet.</p>';
        return;
    }

    container.innerHTML = files.map(f => `
        <div class="repair-file-item" data-file-id="${f.id}">
            <div class="repair-file-icon">${getFileIcon(f.file_type)}</div>
            <div class="repair-file-info">
                <div class="repair-file-name" title="${f.original_filename}">${f.original_filename}</div>
                <div class="repair-file-meta">${formatFileSize(f.file_size)} • ${formatDate(f.uploaded_at)}</div>
            </div>
            <div class="repair-file-actions">
                <button onclick="previewRepairFile(${f.id}, '${f.file_type}')" class="btn btn-outline btn-sm" title="Preview">👁️</button>
                <button onclick="downloadRepairFile(${f.id})" class="btn btn-outline btn-sm" title="Download">📥</button>
                <button onclick="deleteRepairFile(${f.id})" class="btn btn-outline btn-sm delete-btn" title="Delete">🗑️</button>
            </div>
        </div>
    `).join('');
}

function getFileIcon(type) {
    switch (type) {
        case 'pdf': return '📄';
        case 'jpg': case 'jpeg': return '🖼️';
        case 'png': return '🖼️';
        default: return '📎';
    }
}

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
        size /= 1024;
        i++;
    }
    return `${size.toFixed(1)} ${units[i]}`;
}

async function uploadRepairFiles(files) {
    if (!editingId) return;

    const formData = new FormData();
    for (const file of files) {
        formData.append('files', file);
    }

    try {
        const res = await fetch(`/api/equipment/${editingId}/repair-files`, {
            method: 'POST',
            body: formData,
        });
        const data = await res.json();

        if (res.ok) {
            showToast(data.message, 'success');
            loadRepairFiles(editingId);
        } else {
            showToast(data.error || 'File upload failed', 'error');
        }
    } catch (err) {
        showToast('An error occurred during file upload', 'error');
    }
}

function previewRepairFile(fileId, fileType) {
    const url = `/api/repair-files/${fileId}/preview`;
    window.open(url, '_blank');
}

function downloadRepairFile(fileId) {
    window.open(`/api/repair-files/${fileId}/download`, '_blank');
}

async function deleteRepairFile(fileId) {
    if (!confirm('Delete this repair history file?')) return;

    try {
        const res = await api(`/api/repair-files/${fileId}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('File deleted', 'success');
            if (editingId) loadRepairFiles(editingId);
        } else {
            showToast('Failed to delete file', 'error');
        }
    } catch (err) {
        showToast('Error deleting file', 'error');
    }
}

// ── View Equipment Detail ──

async function viewEquipment(id) {
    try {
        const res = await api(`/api/equipment/${id}`);
        const item = await res.json();
        currentViewId = id;
        renderViewModal(item);
        document.getElementById('view-equipment-modal').classList.add('active');
    } catch (err) {
        showToast('Failed to load equipment details', 'error');
    }
}

function renderViewModal(item) {
    const body = document.getElementById('view-modal-body');
    document.getElementById('view-modal-title').textContent = `📋 ${item.procurement_title || 'Equipment Details'}`;

    const boolBadge = (val) => val
        ? '<span class="badge badge-serviceable">✅ Yes</span>'
        : '<span class="badge badge-unserviceable">❌ No</span>';

    let repairFilesHtml = '';
    if (item.repair_files && item.repair_files.length > 0) {
        repairFilesHtml = item.repair_files.map(f => `
            <div class="repair-file-item">
                <div class="repair-file-icon">${getFileIcon(f.file_type)}</div>
                <div class="repair-file-info">
                    <div class="repair-file-name" title="${f.original_filename}">${f.original_filename}</div>
                    <div class="repair-file-meta">${formatFileSize(f.file_size)} • ${formatDate(f.uploaded_at)}</div>
                </div>
                <div class="repair-file-actions">
                    <button onclick="previewRepairFile(${f.id}, '${f.file_type}')" class="btn btn-outline btn-sm" title="Preview">👁️</button>
                    <button onclick="downloadRepairFile(${f.id})" class="btn btn-outline btn-sm" title="Download">📥</button>
                </div>
            </div>
        `).join('');
    } else if (item.repair_history) {
        // Legacy text-based repair history
        repairFilesHtml = `<p style="color:var(--text-secondary); font-size:0.85rem; padding: 8px 0;">${item.repair_history}</p>`;
    } else {
        repairFilesHtml = '<p style="color:var(--text-muted); font-size:0.8rem; padding: 8px 0;">No repair history records.</p>';
    }

    body.innerHTML = `
        <div class="view-detail-grid">
            <!-- Basic Information -->
            <div class="view-section">
                <div class="view-section-title">📋 Basic Information</div>
                <div class="view-fields">
                    <div class="view-field"><span class="view-label">Indicator</span><span class="view-value">${item.indicator || '—'}</span></div>
                    <div class="view-field"><span class="view-label">Procurement Title</span><span class="view-value">${item.procurement_title || '—'}</span></div>
                    <div class="view-field"><span class="view-label">Supplier</span><span class="view-value">${item.supplier || '—'}</span></div>
                    <div class="view-field"><span class="view-label">Type</span><span class="view-value">${item.type_of_equipment || '—'}</span></div>
                    <div class="view-field"><span class="view-label">Brand</span><span class="view-value">${item.brand || '—'}</span></div>
                    <div class="view-field"><span class="view-label">Model</span><span class="view-value">${item.model || '—'}</span></div>
                    <div class="view-field"><span class="view-label">Location</span><span class="view-value">${item.location || '—'}</span></div>
                    <div class="view-field"><span class="view-label">Property Number</span><span class="view-value">${item.property_number || '—'}</span></div>
                    <div class="view-field"><span class="view-label">Serial Number</span><span class="view-value" style="font-family:monospace;">${item.serial_number || '—'}</span></div>
                    <div class="view-field"><span class="view-label">Acquisition Date</span><span class="view-value">${formatDate(item.acquisition_date)}</span></div>
                    <div class="view-field"><span class="view-label">Cost</span><span class="view-value">${formatCurrency(item.cost)}</span></div>
                    <div class="view-field"><span class="view-label">Inventory Date</span><span class="view-value">${formatDate(item.inventory_date)}</span></div>
                </div>
                ${item.description ? `<div class="view-field-full"><span class="view-label">Description</span><span class="view-value">${item.description}</span></div>` : ''}
            </div>

            <!-- Accountability -->
            <div class="view-section">
                <div class="view-section-title">👤 Accountability</div>
                <div class="view-fields">
                    <div class="view-field"><span class="view-label">Person Accountable</span><span class="view-value">${item.person_accountable || '—'}</span></div>
                    <div class="view-field"><span class="view-label">Position</span><span class="view-value">${item.person_accountable_position || '—'}</span></div>
                    <div class="view-field"><span class="view-label">Used By</span><span class="view-value">${item.used_by || '—'}</span></div>
                    <div class="view-field"><span class="view-label">Position</span><span class="view-value">${item.used_by_position || '—'}</span></div>
                </div>
            </div>

            <!-- Condition Checklist -->
            <div class="view-section">
                <div class="view-section-title">✅ Condition Checklist</div>
                <div class="view-checklist">
                    ${getChecklistItems(item.type_of_equipment).map(c =>
                        `<div class="view-check-item"><span>${c.label}</span>${boolBadge(item[c.key])}</div>`
                    ).join('')}
                </div>
            </div>

            <!-- Status & Remarks -->
            <div class="view-section">
                <div class="view-section-title">🔘 Status & Remarks</div>
                <div class="view-fields">
                    <div class="view-field"><span class="view-label">Status</span><span class="view-value">${statusBadge(item.status)}</span></div>
                </div>
                ${item.remarks_recommendation ? `<div class="view-field-full"><span class="view-label">Remarks / Recommendation</span><span class="view-value">${item.remarks_recommendation}</span></div>` : ''}
            </div>

            <!-- Repair History -->
            <div class="view-section">
                <div class="view-section-title">🔧 Repair History (Maintenance Request Forms)</div>
                <div class="repair-files-list">
                    ${repairFilesHtml}
                </div>
            </div>
        </div>

        <!-- Transfer History Timeline -->
        <div class="transfer-history-section">
            <h4>🔄 Transfer History</h4>
            <div class="transfer-timeline" id="transfer-timeline-container">
                ${renderTransferHistory(item.transfers || [])}
            </div>
        </div>
    `;
}

function closeViewModal() {
    document.getElementById('view-equipment-modal').classList.remove('active');
    currentViewId = null;
}

// ── Transfer History Renderer ──
function renderTransferHistory(transfers) {
    if (!transfers || transfers.length === 0) {
        return '<div class="transfer-empty">🔄 No transfer history yet.</div>';
    }
    return transfers.map(t => {
        const fromUsed = (t.from_used_by || t.from_used_by_position)
            ? `<div class="transfer-party-used">Used by: <strong>${t.from_used_by || '—'}</strong>${t.from_used_by_position ? ` · ${t.from_used_by_position}` : ''}</div>` : '';
        const toUsed = (t.to_used_by || t.to_used_by_position)
            ? `<div class="transfer-party-used">Used by: <strong>${t.to_used_by || '—'}</strong>${t.to_used_by_position ? ` · ${t.to_used_by_position}` : ''}</div>` : '';
        const locTag = (t.from_location !== t.to_location && t.to_location)
            ? `<span class="transfer-location-tag">📍 ${t.from_location || '—'} → ${t.to_location}</span>` : '';
        const notes = t.notes ? `<div class="transfer-notes-text">📝 ${t.notes}</div>` : '';
        return `
        <div class="transfer-entry">
            <div class="transfer-dot">🔄</div>
            <div class="transfer-card">
                <div class="transfer-card-header">
                    <span class="transfer-date-badge">📅 ${t.transfer_date || '—'}</span>
                    <span class="transfer-recorded-by">Recorded by: ${t.transferred_by || '—'}</span>
                </div>
                <div class="transfer-parties">
                    <div class="transfer-party">
                        <div class="transfer-party-label from">From</div>
                        <div class="transfer-party-name">${t.from_person_accountable || '—'}</div>
                        <div class="transfer-party-pos">${t.from_person_accountable_position || ''}</div>
                        ${fromUsed}
                    </div>
                    <div class="transfer-arrow">→</div>
                    <div class="transfer-party">
                        <div class="transfer-party-label to">To</div>
                        <div class="transfer-party-name">${t.to_person_accountable || '—'}</div>
                        <div class="transfer-party-pos">${t.to_person_accountable_position || ''}</div>
                        ${toUsed}
                    </div>
                </div>
                <div class="transfer-meta">
                    <span class="transfer-reason-tag">Reason: ${t.reason}</span>
                    ${locTag}
                </div>
                ${notes}
            </div>
        </div>`;
    }).join('');
}

// ── Single Transfer ──
async function openTransferModal(id) {
    try {
        const res = await api(`/api/equipment/${id}`);
        const item = await res.json();

        document.getElementById('transfer-eq-id').value = id;
        document.getElementById('transfer-from-pa').value = item.person_accountable || '';
        document.getElementById('transfer-from-pa-pos').value = item.person_accountable_position || '';
        document.getElementById('transfer-from-ub').value = item.used_by || '';
        document.getElementById('transfer-from-ub-pos').value = item.used_by_position || '';
        document.getElementById('transfer-from-loc').value = item.location || '';

        // Clear To fields
        ['transfer-to-pa','transfer-to-pa-pos','transfer-to-ub','transfer-to-ub-pos','transfer-to-loc',
         'transfer-reason','transfer-notes'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        // Default date to today
        document.getElementById('transfer-date').value = new Date().toISOString().split('T')[0];

        document.getElementById('transfer-modal').classList.add('active');
    } catch (err) {
        showToast('Failed to load equipment data', 'error');
    }
}

function closeTransferModal() {
    document.getElementById('transfer-modal').classList.remove('active');
}

async function saveTransfer() {
    const id = document.getElementById('transfer-eq-id').value;
    const to_pa = document.getElementById('transfer-to-pa').value.trim();
    const transfer_date = document.getElementById('transfer-date').value;
    const reason = document.getElementById('transfer-reason').value.trim();

    if (!to_pa)   { showToast('New person accountable is required', 'error'); return; }
    if (!transfer_date) { showToast('Transfer date is required', 'error'); return; }
    if (!reason)  { showToast('Reason is required', 'error'); return; }

    const btn = document.getElementById('transfer-save-btn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const res = await api(`/api/equipment/${id}/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to_person_accountable: to_pa,
                to_person_accountable_position: document.getElementById('transfer-to-pa-pos').value.trim(),
                to_used_by: document.getElementById('transfer-to-ub').value.trim(),
                to_used_by_position: document.getElementById('transfer-to-ub-pos').value.trim(),
                to_location: document.getElementById('transfer-to-loc').value.trim(),
                transfer_date,
                reason,
                notes: document.getElementById('transfer-notes').value.trim(),
            })
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Transfer failed', 'error'); return; }

        showToast('Transfer recorded successfully ✅', 'success');
        closeTransferModal();
        loadEquipment(currentPage);
        // Refresh view modal if still open
        if (currentViewId == id) viewEquipment(id);
    } catch (err) {
        showToast('Transfer failed', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '🔄 Confirm Transfer';
    }
}

// ── Bulk Transfer ──
function openBulkTransferModal() {
    if (selectedIds.size === 0) return;
    document.getElementById('bulk-transfer-count').textContent = selectedIds.size;
    ['bulk-transfer-to-pa','bulk-transfer-to-pa-pos','bulk-transfer-to-ub',
     'bulk-transfer-to-ub-pos','bulk-transfer-to-loc','bulk-transfer-reason','bulk-transfer-notes']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('bulk-transfer-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('bulk-transfer-modal').classList.add('active');
}

function closeBulkTransferModal() {
    document.getElementById('bulk-transfer-modal').classList.remove('active');
}

async function saveBulkTransfer() {
    const to_pa = document.getElementById('bulk-transfer-to-pa').value.trim();
    const transfer_date = document.getElementById('bulk-transfer-date').value;
    const reason = document.getElementById('bulk-transfer-reason').value.trim();

    if (!to_pa)         { showToast('New person accountable is required', 'error'); return; }
    if (!transfer_date) { showToast('Transfer date is required', 'error'); return; }
    if (!reason)        { showToast('Reason is required', 'error'); return; }

    const btn = document.getElementById('bulk-transfer-save-btn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const res = await api('/api/equipment/bulk-transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ids: Array.from(selectedIds),
                to_person_accountable: to_pa,
                to_person_accountable_position: document.getElementById('bulk-transfer-to-pa-pos').value.trim(),
                to_used_by: document.getElementById('bulk-transfer-to-ub').value.trim(),
                to_used_by_position: document.getElementById('bulk-transfer-to-ub-pos').value.trim(),
                to_location: document.getElementById('bulk-transfer-to-loc').value.trim(),
                transfer_date,
                reason,
                notes: document.getElementById('bulk-transfer-notes').value.trim(),
            })
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Bulk transfer failed', 'error'); return; }

        showToast(data.message || 'Bulk transfer completed ✅', 'success');
        closeBulkTransferModal();
        clearGlobalSelection();
        loadEquipment(currentPage);
    } catch (err) {
        showToast('Bulk transfer failed', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '🔄 Confirm Bulk Transfer';
    }
}

async function selectAllInDatabase() {
    const search = document.getElementById('equipment-search')?.value || '';
    const type = document.getElementById('filter-type')?.value || '';
    const location = document.getElementById('filter-location')?.value || '';
    const status = document.getElementById('filter-status')?.value || '';
    const indicator = document.getElementById('filter-indicator')?.value || '';
    const procurement_title = document.getElementById('filter-procurement-title')?.value || '';
    const supplier = document.getElementById('filter-supplier')?.value || '';
    const brand = document.getElementById('filter-brand')?.value || '';
    const model = document.getElementById('filter-model')?.value || '';
    const property_number = document.getElementById('filter-property-number')?.value || '';
    const serial_number = document.getElementById('filter-serial-number')?.value || '';
    const person_accountable = document.getElementById('filter-person-accountable')?.value || '';
    const used_by = document.getElementById('filter-used-by')?.value || '';
    const position = document.getElementById('filter-position')?.value || '';
    const acquisition_date = document.getElementById('filter-acquisition-date')?.value || '';
    const inventory_date = document.getElementById('filter-inventory-date')?.value || '';
    const cost = document.getElementById('filter-cost')?.value || '';
    const description = document.getElementById('filter-description')?.value || '';
    const warranty = document.getElementById('filter-warranty')?.value || '';
    const ups = document.getElementById('filter-ups')?.value || '';
    const antivirus = document.getElementById('filter-antivirus')?.value || '';

    const params = new URLSearchParams({
        search, type, location, status, indicator, procurement_title, supplier, brand, model,
        property_number, serial_number, person_accountable, used_by, position,
        acquisition_date, inventory_date, cost, description, warranty, ups, antivirus
    });

    try {
        const res = await api(`/api/equipment/all-ids?${params}`);
        const data = await res.json();
        data.ids.forEach(id => selectedIds.add(id));
        globalSelectActive = true;

        // Update UI
        const globalBar = document.getElementById('global-select-bar');
        const globalMsg = document.getElementById('global-select-msg');
        const btnSelectDb = document.getElementById('btn-select-all-db');
        if (globalMsg) globalMsg.textContent = `All ${data.total} equipment in the system are selected.`;
        if (btnSelectDb) btnSelectDb.style.display = 'none';
        const sep = document.querySelector('.global-select-sep');
        if (sep) sep.style.display = 'none';

        updateBulkBar();
        showToast(`All ${data.total} equipment selected`, 'success');
    } catch (err) {
        showToast('Failed to select all equipment', 'error');
    }
}

function clearGlobalSelection() {
    selectedIds.clear();
    globalSelectActive = false;
    const globalBar = document.getElementById('global-select-bar');
    const btnSelectDb = document.getElementById('btn-select-all-db');
    const sep = document.querySelector('.global-select-sep');
    if (globalBar) globalBar.classList.remove('active');
    if (btnSelectDb) btnSelectDb.style.display = '';
    if (sep) sep.style.display = '';
    // Uncheck all row checkboxes
    document.querySelectorAll('.row-select').forEach(cb => {
        cb.checked = false;
        cb.closest('tr')?.classList.remove('selected');
    });
    const selectAll = document.getElementById('select-all');
    if (selectAll) { selectAll.checked = false; selectAll.indeterminate = false; }
    updateBulkBar();
}

// ── Delete ──
function confirmDeleteSingle(id) {
    deleteTargetIds = [id];
    document.getElementById('delete-confirm-text').textContent = 'Are you sure you want to delete this equipment?';
    document.getElementById('delete-modal').classList.add('active');
}

function confirmBulkDelete() {
    if (selectedIds.size === 0) return;
    deleteTargetIds = Array.from(selectedIds);
    document.getElementById('delete-confirm-text').textContent = `Are you sure you want to delete ${deleteTargetIds.length} equipment(s)?`;
    document.getElementById('delete-modal').classList.add('active');
}

async function executeDelete() {
    const confirmBtn = document.getElementById('delete-confirm-btn');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="spinner"></span> Deleting...';

    try {
        if (deleteTargetIds.length === 1) {
            await api(`/api/equipment/${deleteTargetIds[0]}`, { method: 'DELETE' });
        } else {
            await api('/api/equipment/bulk-delete', { method: 'POST', body: { ids: deleteTargetIds } });
        }

        showToast(`${deleteTargetIds.length} equipment(s) deleted successfully`, 'success');
        selectedIds = new Set([...selectedIds].filter(id => !deleteTargetIds.includes(id)));
        deleteTargetIds = [];
        document.getElementById('delete-modal').classList.remove('active');
        loadEquipment(currentPage);
        loadOverview();
    } catch (err) {
        showToast('Failed to delete equipment', 'error');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '🗑️ Delete';
    }
}

// ── Import ──
let importFile = null;

function openImportModal() {
    document.getElementById('import-modal').classList.add('active');
    importFile = null;
    document.getElementById('import-file-info').style.display = 'none';
    document.getElementById('import-upload-btn').disabled = true;
    document.getElementById('import-file').value = '';
}

function closeImportModal() {
    document.getElementById('import-modal').classList.remove('active');
    importFile = null;
}

function handleImportFile(file) {
    if (!file) return;
    if (!file.name.match(/\.xlsx?$/i)) {
        showToast('Please upload an Excel file (.xlsx)', 'error');
        return;
    }
    importFile = file;
    document.getElementById('import-filename').textContent = file.name;
    document.getElementById('import-file-info').style.display = 'block';
    document.getElementById('import-upload-btn').disabled = false;
}

async function uploadImport() {
    if (!importFile) return;

    const uploadBtn = document.getElementById('import-upload-btn');
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span class="spinner"></span> Importing...';

    const formData = new FormData();
    formData.append('file', importFile);

    try {
        const res = await fetch('/api/equipment/import', { method: 'POST', body: formData });
        const data = await res.json();

        if (res.ok) {
            showToast(data.message, 'success');
            closeImportModal();
            loadEquipment(1);
            loadOverview();
        } else {
            showToast(data.error || 'Import failed', 'error');
        }
    } catch (err) {
        showToast('An error occurred during import', 'error');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '📤 Upload & Import';
    }
}

// ── Event Listeners ──
document.addEventListener('DOMContentLoaded', () => {
    // Add New button → open type selector first
    document.getElementById('btn-add-new')?.addEventListener('click', () => {
        resetForm();
        openTypeSelectorModal();
    });

    // Type selector: card clicks
    document.querySelectorAll('.type-card').forEach(card => {
        card.addEventListener('click', () => {
            const type = card.dataset.type;
            closeTypeSelectorModal();
            document.getElementById('eq-type').value = type;
            renderChecklist(type);
            openModal(`➕ Add New Equipment — ${type}`);
        });
    });

    // Type selector: close button & backdrop
    document.getElementById('type-selector-close')?.addEventListener('click', closeTypeSelectorModal);
    document.getElementById('type-selector-modal')?.addEventListener('click', e => {
        if (e.target.id === 'type-selector-modal') closeTypeSelectorModal();
    });

    // Modal close/cancel
    document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
    document.getElementById('modal-cancel-btn')?.addEventListener('click', closeModal);
    document.getElementById('equipment-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'equipment-modal') closeModal();
    });

    // Save
    document.getElementById('modal-save-btn')?.addEventListener('click', saveEquipment);

    // Select All (current page)
    document.getElementById('select-all')?.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.row-select');
        checkboxes.forEach(cb => {
            const id = parseInt(cb.dataset.id);
            cb.checked = e.target.checked;
            if (e.target.checked) {
                selectedIds.add(id);
            } else {
                selectedIds.delete(id);
            }
            cb.closest('tr').classList.toggle('selected', e.target.checked);
        });
        // If unchecking, also clear global
        if (!e.target.checked) {
            globalSelectActive = false;
            const globalBar = document.getElementById('global-select-bar');
            const btnSelectDb = document.getElementById('btn-select-all-db');
            const sep = document.querySelector('.global-select-sep');
            if (globalBar) globalBar.classList.remove('active');
            if (btnSelectDb) btnSelectDb.style.display = '';
            if (sep) sep.style.display = '';
        }
        updateBulkBar();
        updateSelectAll();
    });

    // Bulk delete
    document.getElementById('btn-bulk-delete')?.addEventListener('click', confirmBulkDelete);
    document.getElementById('btn-clear-selection')?.addEventListener('click', clearGlobalSelection);

    // Global select-all in DB
    document.getElementById('btn-select-all-db')?.addEventListener('click', selectAllInDatabase);
    document.getElementById('btn-cancel-global-select')?.addEventListener('click', clearGlobalSelection);

    // Delete confirm modal
    document.getElementById('delete-confirm-btn')?.addEventListener('click', executeDelete);
    document.getElementById('delete-cancel-btn')?.addEventListener('click', () => {
        document.getElementById('delete-modal').classList.remove('active');
    });
    document.getElementById('delete-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'delete-modal') {
            document.getElementById('delete-modal').classList.remove('active');
        }
    });

    // Import
    document.getElementById('btn-import-excel')?.addEventListener('click', openImportModal);
    document.getElementById('import-close-btn')?.addEventListener('click', closeImportModal);
    document.getElementById('import-cancel-btn')?.addEventListener('click', closeImportModal);
    document.getElementById('import-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'import-modal') closeImportModal();
    });

    // Drop zone (import)
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('import-file');

    dropZone?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => handleImportFile(e.target.files[0]));

    dropZone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleImportFile(e.dataTransfer.files[0]);
    });

    document.getElementById('import-clear-btn')?.addEventListener('click', () => {
        importFile = null;
        document.getElementById('import-file-info').style.display = 'none';
        document.getElementById('import-upload-btn').disabled = true;
        document.getElementById('import-file').value = '';
    });
    document.getElementById('import-upload-btn')?.addEventListener('click', uploadImport);

    // Repair file upload drop zone
    const repairDropZone = document.getElementById('repair-drop-zone');
    const repairFileInput = document.getElementById('repair-file-input');

    repairDropZone?.addEventListener('click', () => repairFileInput?.click());
    repairFileInput?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            uploadRepairFiles(e.target.files);
            e.target.value = ''; // reset
        }
    });

    repairDropZone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        repairDropZone.classList.add('dragover');
    });
    repairDropZone?.addEventListener('dragleave', () => repairDropZone.classList.remove('dragover'));
    repairDropZone?.addEventListener('drop', (e) => {
        e.preventDefault();
        repairDropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            uploadRepairFiles(e.dataTransfer.files);
        }
    });

    // View equipment modal
    document.getElementById('view-modal-close-btn')?.addEventListener('click', closeViewModal);
    document.getElementById('view-modal-close-footer')?.addEventListener('click', closeViewModal);
    document.getElementById('view-equipment-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'view-equipment-modal') closeViewModal();
    });
    document.getElementById('view-modal-edit-btn')?.addEventListener('click', () => {
        const idToEdit = currentViewId;
        closeViewModal();
        if (idToEdit) editEquipment(idToEdit);
    });
    document.getElementById('view-modal-transfer-btn')?.addEventListener('click', () => {
        const idToTransfer = currentViewId;
        closeViewModal();
        if (idToTransfer) openTransferModal(idToTransfer);
    });

    // Transfer modal
    document.getElementById('transfer-modal-close')?.addEventListener('click', closeTransferModal);
    document.getElementById('transfer-cancel-btn')?.addEventListener('click', closeTransferModal);
    document.getElementById('transfer-save-btn')?.addEventListener('click', saveTransfer);
    document.getElementById('transfer-modal')?.addEventListener('click', e => {
        if (e.target.id === 'transfer-modal') closeTransferModal();
    });

    // Bulk Transfer modal
    document.getElementById('btn-bulk-transfer')?.addEventListener('click', openBulkTransferModal);
    document.getElementById('bulk-transfer-modal-close')?.addEventListener('click', closeBulkTransferModal);
    document.getElementById('bulk-transfer-cancel-btn')?.addEventListener('click', closeBulkTransferModal);
    document.getElementById('bulk-transfer-save-btn')?.addEventListener('click', saveBulkTransfer);
    document.getElementById('bulk-transfer-modal')?.addEventListener('click', e => {
        if (e.target.id === 'bulk-transfer-modal') closeBulkTransferModal();
    });

    // Search with debounce
    document.getElementById('equipment-search')?.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => loadEquipment(1), 350);
    });

    // Filters (use 'input' for real-time search with datalists)
    document.getElementById('filter-type')?.addEventListener('input', () => loadEquipment(1));
    document.getElementById('filter-location')?.addEventListener('input', () => loadEquipment(1));
    document.getElementById('filter-status')?.addEventListener('input', () => loadEquipment(1));
    document.getElementById('equipment-search')?.addEventListener('input', () => loadEquipment(1));

    // Advanced Filters Toggle
    const btnToggle = document.getElementById('btn-toggle-filters');
    const panelFilters = document.getElementById('advanced-filters-panel');
    btnToggle?.addEventListener('click', () => {
        panelFilters.classList.toggle('active');
        btnToggle.classList.toggle('active');
    });

    // Apply Advanced Filters
    document.getElementById('btn-apply-filters')?.addEventListener('click', () => {
        loadEquipment(1);
        panelFilters.classList.remove('active');
        btnToggle.classList.remove('active');
    });

    // Reset Filters
    document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
        const inputs = panelFilters.querySelectorAll('select, input');
        inputs.forEach(input => input.value = '');
        loadEquipment(1);
    });
});
