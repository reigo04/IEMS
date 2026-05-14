from flask import Blueprint, request, jsonify, current_app, send_file
from flask_login import login_required, current_user
from models import db, Equipment, RepairFile, EquipmentTransfer, normalize_equipment_type
from datetime import datetime, date
import openpyxl
import csv
import io
import os
import uuid

equipment_bp = Blueprint('equipment', __name__)

# Re-export for use by routes.reports
normalize_type = normalize_equipment_type

BOOL_FIELDS = [
    # Core / Desktop PC
    'with_warranty', 'clear_monitor', 'active_cmos_battery', 'charging_ups',
    'working_io_ports', 'updated_patched_os', 'weekly_scan_antivirus', 'working_keyboard_mouse',
    # Laptop / Tablet
    'working_speakers',
    # Printer
    'ink_level_ok', 'printing_black', 'printing_cyan', 'printing_magenta', 'printing_yellow',
    'working_pickup_roller', 'ink_wastepad_ok',
    # Document Scanner
    'working_adf', 'working_buttons', 'working_separation_roller',
    # LCD Projector
    'laser_source', 'bulb_source', 'clear_projection',
    # Other ICT Supplies / Monitor
    'good_physical_condition', 'functional_for_use',
]

TEXT_FIELDS = [
    'indicator', 'procurement_title', 'supplier', 'location', 'type_of_equipment',
    'brand', 'model', 'property_number', 'serial_number', 'description',
    'person_accountable', 'person_accountable_position', 'used_by', 'used_by_position',
    'remarks_recommendation', 'status'
]

DATE_FIELDS = ['acquisition_date', 'inventory_date']

ALLOWED_REPAIR_EXTENSIONS = {'pdf', 'jpg', 'jpeg', 'png'}


def parse_date(val):
    if not val:
        return None
    if isinstance(val, date):
        return val
    if isinstance(val, datetime):
        return val.date()
    try:
        return datetime.strptime(str(val).strip(), '%Y-%m-%d').date()
    except (ValueError, TypeError):
        try:
            return datetime.strptime(str(val).strip(), '%m/%d/%Y').date()
        except (ValueError, TypeError):
            return None


def parse_bool(val):
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return bool(val)
    if isinstance(val, str):
        return val.strip().lower() in ('yes', 'true', '1', 'y')
    return False


def populate_equipment(eq, data):
    for field in TEXT_FIELDS:
        if field in data:
            setattr(eq, field, str(data[field]).strip() if data[field] else '')

    for field in BOOL_FIELDS:
        if field in data:
            setattr(eq, field, parse_bool(data[field]))

    for field in DATE_FIELDS:
        if field in data:
            setattr(eq, field, parse_date(data[field]))

    if 'cost' in data:
        try:
            eq.cost = float(data['cost']) if data['cost'] else 0.0
        except (ValueError, TypeError):
            eq.cost = 0.0


def allowed_repair_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_REPAIR_EXTENSIONS


@equipment_bp.route('/api/equipment', methods=['GET'])
@login_required
def list_equipment():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 25, type=int)
    search = request.args.get('search', '').strip()
    
    # Basic filters
    filter_type = request.args.get('type', '').strip()
    filter_location = request.args.get('location', '').strip()
    filter_status = request.args.get('status', '').strip()

    # Advanced filters
    f_indicator = request.args.get('indicator', '').strip()
    f_procurement_title = request.args.get('procurement_title', '').strip()
    f_supplier = request.args.get('supplier', '').strip()
    f_brand = request.args.get('brand', '').strip()
    f_model = request.args.get('model', '').strip()
    f_property_number = request.args.get('property_number', '').strip()
    f_serial_number = request.args.get('serial_number', '').strip()
    f_person_accountable = request.args.get('person_accountable', '').strip()
    f_used_by = request.args.get('used_by', '').strip()
    f_position = request.args.get('position', '').strip()
    f_acquisition_date = request.args.get('acquisition_date', '').strip()
    f_inventory_date = request.args.get('inventory_date', '').strip()
    f_cost = request.args.get('cost', '').strip()
    f_description = request.args.get('description', '').strip()

    query = Equipment.query

    # Search (multi-field partial match)
    if search:
        search_term = f'%{search}%'
        query = query.filter(
            db.or_(
                Equipment.procurement_title.ilike(search_term),
                Equipment.brand.ilike(search_term),
                Equipment.model.ilike(search_term),
                Equipment.serial_number.ilike(search_term),
                Equipment.property_number.ilike(search_term),
                Equipment.person_accountable.ilike(search_term),
                Equipment.used_by.ilike(search_term),
                Equipment.location.ilike(search_term),
                Equipment.supplier.ilike(search_term),
            )
        )

    # Core filters
    if filter_type:
        if filter_type.strip().lower() == 'other ict supplies':
            query = query.filter(Equipment.type_of_equipment.ilike('OIS%'))
        else:
            query = query.filter(Equipment.type_of_equipment.ilike(f'%{filter_type}%'))
    if filter_location:
        query = query.filter(Equipment.location.ilike(f'%{filter_location}%'))
    if filter_status:
        query = query.filter(Equipment.status.ilike(f'%{filter_status}%'))

    # Advanced filters (partial matching for all searchable fields)
    if f_indicator:
        query = query.filter(Equipment.indicator.ilike(f'%{f_indicator}%'))
    if f_procurement_title:
        query = query.filter(Equipment.procurement_title.ilike(f'%{f_procurement_title}%'))
    if f_supplier:
        query = query.filter(Equipment.supplier.ilike(f'%{f_supplier}%'))
    if f_brand:
        query = query.filter(Equipment.brand.ilike(f'%{f_brand}%'))
    if f_model:
        query = query.filter(Equipment.model.ilike(f'%{f_model}%'))
    if f_property_number:
        query = query.filter(Equipment.property_number.ilike(f'%{f_property_number}%'))
    if f_serial_number:
        query = query.filter(Equipment.serial_number.ilike(f'%{f_serial_number}%'))
    if f_person_accountable:
        query = query.filter(Equipment.person_accountable.ilike(f'%{f_person_accountable}%'))
    if f_used_by:
        query = query.filter(Equipment.used_by.ilike(f'%{f_used_by}%'))
    
    if f_position:
        query = query.filter(db.or_(
            Equipment.person_accountable_position.ilike(f'%{f_position}%'),
            Equipment.used_by_position.ilike(f'%{f_position}%')
        ))

    if f_acquisition_date:
        p_date = parse_date(f_acquisition_date)
        if p_date:
            query = query.filter(Equipment.acquisition_date == p_date)
    
    if f_inventory_date:
        p_date = parse_date(f_inventory_date)
        if p_date:
            query = query.filter(Equipment.inventory_date == p_date)

    if f_cost:
        try:
            # Strip commas in case user inputs '50,000'
            clean_cost = f_cost.replace(',', '')
            cost_val = float(clean_cost)
            cost_mode = request.args.get('cost_mode', 'min').strip().lower()

            if cost_mode == 'max':
                query = query.filter(Equipment.cost <= cost_val)
            elif cost_mode == 'exact':
                query = query.filter(Equipment.cost == cost_val)
            else: # default to min (>=)
                query = query.filter(Equipment.cost >= cost_val)
        except ValueError:
            pass

    if f_description:
        query = query.filter(Equipment.description.ilike(f'%{f_description}%'))

    # Boolean filters
    f_warranty = request.args.get('warranty', '').strip().lower()
    f_ups = request.args.get('ups', '').strip().lower()
    f_antivirus = request.args.get('antivirus', '').strip().lower()

    if f_warranty == 'yes':
        query = query.filter(Equipment.with_warranty == True)
    elif f_warranty == 'no':
        query = query.filter(Equipment.with_warranty == False)

    if f_ups == 'yes':
        query = query.filter(Equipment.charging_ups == True)
    elif f_ups == 'no':
        query = query.filter(Equipment.charging_ups == False)

    if f_antivirus == 'yes':
        query = query.filter(Equipment.weekly_scan_antivirus == True)
    elif f_antivirus == 'no':
        query = query.filter(Equipment.weekly_scan_antivirus == False)

    query = query.order_by(Equipment.id.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'items': [item.to_dict() for item in pagination.items],
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages,
        'per_page': per_page
    })


@equipment_bp.route('/api/equipment', methods=['POST'])
@login_required
def create_equipment():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    eq = Equipment()
    populate_equipment(eq, data)
    db.session.add(eq)
    db.session.commit()
    return jsonify(eq.to_dict()), 201


@equipment_bp.route('/api/equipment/<int:eq_id>', methods=['GET'])
@login_required
def get_equipment(eq_id):
    eq = Equipment.query.get_or_404(eq_id)
    return jsonify(eq.to_dict())


@equipment_bp.route('/api/equipment/<int:eq_id>', methods=['PUT'])
@login_required
def update_equipment(eq_id):
    eq = Equipment.query.get_or_404(eq_id)
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    populate_equipment(eq, data)
    eq.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(eq.to_dict())


@equipment_bp.route('/api/equipment/<int:eq_id>', methods=['DELETE'])
@login_required
def delete_equipment(eq_id):
    eq = Equipment.query.get_or_404(eq_id)
    # Delete associated repair files from disk
    upload_dir = current_app.config['UPLOAD_FOLDER']
    for rf in eq.repair_files:
        file_path = os.path.join(upload_dir, str(eq_id), rf.filename)
        if os.path.exists(file_path):
            os.remove(file_path)
    # Remove equipment directory if empty
    eq_dir = os.path.join(upload_dir, str(eq_id))
    if os.path.isdir(eq_dir):
        try:
            os.rmdir(eq_dir)
        except OSError:
            pass
    db.session.delete(eq)
    db.session.commit()
    return jsonify({'message': 'Equipment deleted successfully'})


@equipment_bp.route('/api/equipment/all-ids', methods=['GET'])
@login_required
def get_all_ids():
    """Return all equipment IDs matching current filters (no pagination)."""
    search = request.args.get('search', '').strip()
    filter_type = request.args.get('type', '').strip()
    filter_location = request.args.get('location', '').strip()
    filter_status = request.args.get('status', '').strip()
    f_indicator = request.args.get('indicator', '').strip()
    f_procurement_title = request.args.get('procurement_title', '').strip()
    f_supplier = request.args.get('supplier', '').strip()
    f_brand = request.args.get('brand', '').strip()
    f_model = request.args.get('model', '').strip()
    f_property_number = request.args.get('property_number', '').strip()
    f_serial_number = request.args.get('serial_number', '').strip()
    f_person_accountable = request.args.get('person_accountable', '').strip()
    f_used_by = request.args.get('used_by', '').strip()
    f_position = request.args.get('position', '').strip()
    f_acquisition_date = request.args.get('acquisition_date', '').strip()
    f_inventory_date = request.args.get('inventory_date', '').strip()
    f_cost = request.args.get('cost', '').strip()
    f_description = request.args.get('description', '').strip()

    query = db.session.query(Equipment.id)

    if search:
        search_term = f'%{search}%'
        query = query.filter(
            db.or_(
                Equipment.procurement_title.ilike(search_term),
                Equipment.brand.ilike(search_term),
                Equipment.model.ilike(search_term),
                Equipment.serial_number.ilike(search_term),
                Equipment.property_number.ilike(search_term),
                Equipment.person_accountable.ilike(search_term),
                Equipment.used_by.ilike(search_term),
                Equipment.location.ilike(search_term),
                Equipment.supplier.ilike(search_term),
            )
        )

    if filter_type:
        if filter_type.strip().lower() == 'other ict supplies':
            query = query.filter(Equipment.type_of_equipment.ilike('OIS%'))
        else:
            query = query.filter(Equipment.type_of_equipment.ilike(f'%{filter_type}%'))
    if filter_location:
        query = query.filter(Equipment.location.ilike(f'%{filter_location}%'))
    if filter_status:
        query = query.filter(Equipment.status.ilike(f'%{filter_status}%'))
    if f_indicator:
        query = query.filter(Equipment.indicator.ilike(f'%{f_indicator}%'))
    if f_procurement_title:
        query = query.filter(Equipment.procurement_title.ilike(f'%{f_procurement_title}%'))
    if f_supplier:
        query = query.filter(Equipment.supplier.ilike(f'%{f_supplier}%'))
    if f_brand:
        query = query.filter(Equipment.brand.ilike(f'%{f_brand}%'))
    if f_model:
        query = query.filter(Equipment.model.ilike(f'%{f_model}%'))
    if f_property_number:
        query = query.filter(Equipment.property_number.ilike(f'%{f_property_number}%'))
    if f_serial_number:
        query = query.filter(Equipment.serial_number.ilike(f'%{f_serial_number}%'))
    if f_person_accountable:
        query = query.filter(Equipment.person_accountable.ilike(f'%{f_person_accountable}%'))
    if f_used_by:
        query = query.filter(Equipment.used_by.ilike(f'%{f_used_by}%'))
    if f_position:
        query = query.filter(db.or_(
            Equipment.person_accountable_position.ilike(f'%{f_position}%'),
            Equipment.used_by_position.ilike(f'%{f_position}%')
        ))
    if f_acquisition_date:
        p_date = parse_date(f_acquisition_date)
        if p_date:
            query = query.filter(Equipment.acquisition_date == p_date)
    if f_inventory_date:
        p_date = parse_date(f_inventory_date)
        if p_date:
            query = query.filter(Equipment.inventory_date == p_date)
    if f_cost:
        try:
            clean_cost = f_cost.replace(',', '')
            cost_val = float(clean_cost)
            cost_mode = request.args.get('cost_mode', 'min').strip().lower()

            if cost_mode == 'max':
                query = query.filter(Equipment.cost <= cost_val)
            elif cost_mode == 'exact':
                query = query.filter(Equipment.cost == cost_val)
            else:
                query = query.filter(Equipment.cost >= cost_val)
        except ValueError:
            pass
    if f_description:
        query = query.filter(Equipment.description.ilike(f'%{f_description}%'))

    # Boolean filters
    f_warranty = request.args.get('warranty', '').strip().lower()
    f_ups = request.args.get('ups', '').strip().lower()
    f_antivirus = request.args.get('antivirus', '').strip().lower()

    if f_warranty == 'yes':
        query = query.filter(Equipment.with_warranty == True)
    elif f_warranty == 'no':
        query = query.filter(Equipment.with_warranty == False)

    if f_ups == 'yes':
        query = query.filter(Equipment.charging_ups == True)
    elif f_ups == 'no':
        query = query.filter(Equipment.charging_ups == False)

    if f_antivirus == 'yes':
        query = query.filter(Equipment.weekly_scan_antivirus == True)
    elif f_antivirus == 'no':
        query = query.filter(Equipment.weekly_scan_antivirus == False)

    ids = [row[0] for row in query.all()]
    return jsonify({'ids': ids, 'total': len(ids)})


@equipment_bp.route('/api/equipment/bulk-delete', methods=['POST'])
@login_required
def bulk_delete():
    data = request.get_json()
    ids = data.get('ids', [])
    if not ids:
        return jsonify({'error': 'No IDs provided'}), 400

    # Delete associated repair files from disk
    upload_dir = current_app.config['UPLOAD_FOLDER']
    equipments = Equipment.query.filter(Equipment.id.in_(ids)).all()
    for eq in equipments:
        for rf in eq.repair_files:
            file_path = os.path.join(upload_dir, str(eq.id), rf.filename)
            if os.path.exists(file_path):
                os.remove(file_path)
        eq_dir = os.path.join(upload_dir, str(eq.id))
        if os.path.isdir(eq_dir):
            try:
                os.rmdir(eq_dir)
            except OSError:
                pass

    Equipment.query.filter(Equipment.id.in_(ids)).delete(synchronize_session=False)
    db.session.commit()
    return jsonify({'message': f'{len(ids)} equipment(s) deleted successfully'})


# ── Transfer Routes ──

@equipment_bp.route('/api/equipment/<int:eq_id>/transfer', methods=['POST'])
@login_required
def transfer_equipment(eq_id):
    eq = Equipment.query.get_or_404(eq_id)
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    to_pa = data.get('to_person_accountable', '').strip()
    transfer_date_raw = data.get('transfer_date', '').strip()
    reason = data.get('reason', '').strip()

    if not to_pa:
        return jsonify({'error': 'New person accountable is required'}), 400
    if not transfer_date_raw:
        return jsonify({'error': 'Transfer date is required'}), 400
    if not reason:
        return jsonify({'error': 'Reason is required'}), 400

    transfer_date = parse_date(transfer_date_raw)

    # Record snapshot of current state
    t = EquipmentTransfer(
        equipment_id=eq_id,
        from_person_accountable=eq.person_accountable or '',
        from_person_accountable_position=eq.person_accountable_position or '',
        from_used_by=eq.used_by or '',
        from_used_by_position=eq.used_by_position or '',
        from_location=eq.location or '',
        to_person_accountable=to_pa,
        to_person_accountable_position=data.get('to_person_accountable_position', '').strip(),
        to_used_by=data.get('to_used_by', '').strip(),
        to_used_by_position=data.get('to_used_by_position', '').strip(),
        to_location=data.get('to_location', '').strip() or eq.location or '',
        transfer_date=transfer_date,
        reason=reason,
        notes=data.get('notes', '').strip(),
        transferred_by=current_user.username,
    )
    db.session.add(t)

    # Update equipment fields
    eq.person_accountable = to_pa
    eq.person_accountable_position = data.get('to_person_accountable_position', '').strip()
    eq.used_by = data.get('to_used_by', '').strip()
    eq.used_by_position = data.get('to_used_by_position', '').strip()
    if data.get('to_location', '').strip():
        eq.location = data.get('to_location', '').strip()
    eq.updated_at = datetime.utcnow()

    db.session.commit()
    return jsonify({'message': 'Transfer recorded successfully', 'transfer': t.to_dict()})


@equipment_bp.route('/api/equipment/<int:eq_id>/transfers', methods=['GET'])
@login_required
def get_transfers(eq_id):
    Equipment.query.get_or_404(eq_id)
    transfers = EquipmentTransfer.query.filter_by(equipment_id=eq_id)\
        .order_by(EquipmentTransfer.transfer_date.desc(), EquipmentTransfer.created_at.desc()).all()
    return jsonify([t.to_dict() for t in transfers])


@equipment_bp.route('/api/equipment/bulk-transfer', methods=['POST'])
@login_required
def bulk_transfer():
    data = request.get_json()
    ids = data.get('ids', [])
    to_pa = data.get('to_person_accountable', '').strip()
    transfer_date_raw = data.get('transfer_date', '').strip()
    reason = data.get('reason', '').strip()

    if not ids:
        return jsonify({'error': 'No IDs provided'}), 400
    if not to_pa:
        return jsonify({'error': 'New person accountable is required'}), 400
    if not transfer_date_raw:
        return jsonify({'error': 'Transfer date is required'}), 400
    if not reason:
        return jsonify({'error': 'Reason is required'}), 400

    transfer_date = parse_date(transfer_date_raw)
    to_pa_pos = data.get('to_person_accountable_position', '').strip()
    to_ub = data.get('to_used_by', '').strip()
    to_ub_pos = data.get('to_used_by_position', '').strip()
    to_loc = data.get('to_location', '').strip()
    notes = data.get('notes', '').strip()

    equipments = Equipment.query.filter(Equipment.id.in_(ids)).all()
    for eq in equipments:
        t = EquipmentTransfer(
            equipment_id=eq.id,
            from_person_accountable=eq.person_accountable or '',
            from_person_accountable_position=eq.person_accountable_position or '',
            from_used_by=eq.used_by or '',
            from_used_by_position=eq.used_by_position or '',
            from_location=eq.location or '',
            to_person_accountable=to_pa,
            to_person_accountable_position=to_pa_pos,
            to_used_by=to_ub,
            to_used_by_position=to_ub_pos,
            to_location=to_loc or eq.location or '',
            transfer_date=transfer_date,
            reason=reason,
            notes=notes,
            transferred_by=current_user.username,
        )
        db.session.add(t)
        eq.person_accountable = to_pa
        eq.person_accountable_position = to_pa_pos
        eq.used_by = to_ub
        eq.used_by_position = to_ub_pos
        if to_loc:
            eq.location = to_loc
        eq.updated_at = datetime.utcnow()

    db.session.commit()
    return jsonify({'message': f'{len(equipments)} equipment(s) transferred successfully'})


# ── Repair File Upload/Download/Delete ──

@equipment_bp.route('/api/equipment/<int:eq_id>/repair-files', methods=['POST'])
@login_required
def upload_repair_files(eq_id):
    eq = Equipment.query.get_or_404(eq_id)

    if 'files' not in request.files:
        return jsonify({'error': 'No files provided'}), 400

    files = request.files.getlist('files')
    if not files:
        return jsonify({'error': 'No files provided'}), 400

    upload_dir = current_app.config['UPLOAD_FOLDER']
    eq_dir = os.path.join(upload_dir, str(eq_id))
    os.makedirs(eq_dir, exist_ok=True)

    uploaded = []
    for file in files:
        if file.filename and allowed_repair_file(file.filename):
            ext = file.filename.rsplit('.', 1)[1].lower()
            stored_name = f"{uuid.uuid4().hex}.{ext}"
            file_path = os.path.join(eq_dir, stored_name)
            file.save(file_path)
            file_size = os.path.getsize(file_path)

            rf = RepairFile(
                equipment_id=eq_id,
                filename=stored_name,
                original_filename=file.filename,
                file_type=ext,
                file_size=file_size,
            )
            db.session.add(rf)
            uploaded.append(rf)
        else:
            continue  # skip invalid files

    if not uploaded:
        return jsonify({'error': 'No valid files uploaded. Allowed types: PDF, JPG, PNG.'}), 400

    db.session.commit()
    return jsonify({
        'message': f'{len(uploaded)} file(s) uploaded successfully',
        'files': [rf.to_dict() for rf in uploaded]
    }), 201


@equipment_bp.route('/api/equipment/<int:eq_id>/repair-files', methods=['GET'])
@login_required
def list_repair_files(eq_id):
    Equipment.query.get_or_404(eq_id)
    files = RepairFile.query.filter_by(equipment_id=eq_id).order_by(RepairFile.uploaded_at.desc()).all()
    return jsonify([f.to_dict() for f in files])


@equipment_bp.route('/api/repair-files/<int:file_id>/download', methods=['GET'])
@login_required
def download_repair_file(file_id):
    rf = RepairFile.query.get_or_404(file_id)
    upload_dir = current_app.config['UPLOAD_FOLDER']
    file_path = os.path.join(upload_dir, str(rf.equipment_id), rf.filename)

    if not os.path.exists(file_path):
        return jsonify({'error': 'File not found on disk'}), 404

    return send_file(file_path, download_name=rf.original_filename, as_attachment=True)


@equipment_bp.route('/api/repair-files/<int:file_id>/preview', methods=['GET'])
@login_required
def preview_repair_file(file_id):
    rf = RepairFile.query.get_or_404(file_id)
    upload_dir = current_app.config['UPLOAD_FOLDER']
    file_path = os.path.join(upload_dir, str(rf.equipment_id), rf.filename)

    if not os.path.exists(file_path):
        return jsonify({'error': 'File not found on disk'}), 404

    mime_map = {
        'pdf': 'application/pdf',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
    }
    mimetype = mime_map.get(rf.file_type, 'application/octet-stream')
    return send_file(file_path, mimetype=mimetype)


@equipment_bp.route('/api/repair-files/<int:file_id>', methods=['DELETE'])
@login_required
def delete_repair_file(file_id):
    rf = RepairFile.query.get_or_404(file_id)
    upload_dir = current_app.config['UPLOAD_FOLDER']
    file_path = os.path.join(upload_dir, str(rf.equipment_id), rf.filename)

    if os.path.exists(file_path):
        os.remove(file_path)

    db.session.delete(rf)
    db.session.commit()
    return jsonify({'message': 'File deleted successfully'})


# ── Import Excel ──

@equipment_bp.route('/api/equipment/import', methods=['POST'])
@login_required
def import_excel():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']
    filename = file.filename.lower()
    
    if not filename.endswith(('.xlsx', '.xls', '.csv')):
        return jsonify({'error': 'Invalid file type. Please upload an Excel (.xlsx) or CSV (.csv) file'}), 400

    try:
        rows = []
        if filename.endswith('.csv'):
            stream = io.StringIO(file.read().decode('utf-8'), newline='')
            reader = csv.reader(stream)
            rows = list(reader)
        else:
            wb = openpyxl.load_workbook(io.BytesIO(file.read()), data_only=True)
            ws = wb.active
            rows = [list(row) for row in ws.iter_rows(values_only=True)]

        if not rows:
            return jsonify({'error': 'The uploaded file is empty'}), 400

        # Map header row to column indices
        headers = {}
        header_map = {
            'NO.': 'no',
            'NO': 'no',
            'INDICATOR': 'indicator',
            'PROCUREMENT TITLE': 'procurement_title',
            'SUPPLIER': 'supplier',
            'LOCATION': 'location',
            'TYPE OF EQUIPMENT': 'type_of_equipment',
            'BRAND': 'brand',
            'MODEL': 'model',
            'PROPERTY NUMBER': 'property_number',
            'SERIAL NUMBER': 'serial_number',
            'ACQUISITION DATE': 'acquisition_date',
            'COST': 'cost',
            'DESCRIPTION': 'description',
            'PERSON ACCOUNTABLE': 'person_accountable',
            'POSITION': 'person_accountable_position',
            'USED BY': 'used_by',
            'WITH WARRANTY': 'with_warranty',
            'CLEAR MONITOR': 'clear_monitor',
            'ACTIVE CMOS BATTERY': 'active_cmos_battery',
            'CHARGING UPS': 'charging_ups',
            'WORKING I/O PORTS AND CONNECTIONS': 'working_io_ports',
            'WORKING I/O PORTS': 'working_io_ports',
            'UPDATED/PATCHED OS': 'updated_patched_os',
            'WEEKLY SCAN ANTIVIRUS': 'weekly_scan_antivirus',
            'WORKING KEYBOARD AND MOUSE': 'working_keyboard_mouse',
            'REMARKS/RECOMMENDATION': 'remarks_recommendation',
            'REMARKS': 'remarks_recommendation',
            'INVENTORY DATE': 'inventory_date',
            'REPAIR HISTORY': 'repair_history',
            'STATUS': 'status',
        }

        first_row = rows[0]
        position_count = 0
        for col_idx, cell_val in enumerate(first_row):
            if cell_val:
                header_upper = str(cell_val).strip().upper()
                if header_upper == 'POSITION':
                    position_count += 1
                    if position_count == 1:
                        headers[col_idx] = 'person_accountable_position'
                    else:
                        headers[col_idx] = 'used_by_position'
                elif header_upper in header_map:
                    headers[col_idx] = header_map[header_upper]

        imported = 0
        updated = 0
        new_items = []
        
        for row in rows[1:]:
            if all(v is None or str(v).strip() == '' for v in row):
                continue

            data = {}
            for col_idx, cell_val in enumerate(row):
                if col_idx in headers:
                    field = headers[col_idx]
                    if field != 'no':
                        data[field] = cell_val

            # Match logic: Property Number first, then Serial Number
            prop_no = str(data.get('property_number', '')).strip() if data.get('property_number') else ''
            serial_no = str(data.get('serial_number', '')).strip() if data.get('serial_number') else ''
            
            existing_eq = None
            if prop_no and prop_no != '-':
                existing_eq = Equipment.query.filter(Equipment.property_number == prop_no).first()
            
            if not existing_eq and serial_no and serial_no != '-':
                existing_eq = Equipment.query.filter(Equipment.serial_number == serial_no).first()

            if existing_eq:
                # Handle automatic transfer history if person_accountable changed
                new_pa = str(data.get('person_accountable', '')).strip() if data.get('person_accountable') else ''
                old_pa = existing_eq.person_accountable or ''
                
                if new_pa and new_pa.lower() != old_pa.lower():
                    transfer = EquipmentTransfer(
                        equipment_id=existing_eq.id,
                        from_person_accountable=old_pa,
                        from_person_accountable_position=existing_eq.person_accountable_position or '',
                        from_used_by=existing_eq.used_by or '',
                        from_used_by_position=existing_eq.used_by_position or '',
                        from_location=existing_eq.location or '',
                        to_person_accountable=new_pa,
                        to_person_accountable_position=str(data.get('person_accountable_position', '')).strip(),
                        to_used_by=str(data.get('used_by', '')).strip(),
                        to_used_by_position=str(data.get('used_by_position', '')).strip(),
                        to_location=str(data.get('location', '')).strip() or existing_eq.location or '',
                        transfer_date=datetime.utcnow().date(),
                        reason='Imported via Annual Inventory',
                        transferred_by=current_user.username,
                    )
                    db.session.add(transfer)

                populate_equipment(existing_eq, data)
                existing_eq.updated_at = datetime.utcnow()
                new_items.append(existing_eq)
                updated += 1
            else:
                eq = Equipment()
                populate_equipment(eq, data)
                db.session.add(eq)
                new_items.append(eq)
                imported += 1

        db.session.commit()
        
        msg = []
        if imported > 0: msg.append(f"{imported} new")
        if updated > 0: msg.append(f"{updated} updated")
        
        return jsonify({
            'message': f'Successfully processed: {", ".join(msg)}' if msg else 'No items processed',
            'count': imported + updated,
            'new_count': imported,
            'updated_count': updated,
            'items': [eq.to_dict() for eq in new_items]
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Import failed: {str(e)}'}), 500


@equipment_bp.route('/api/filters')
@login_required
def get_filters():
    def get_distinct(column):
        vals = db.session.query(column).distinct().all()
        return sorted([v[0] for v in vals if v[0]])

    # Normalize equipment types: merge OIS-* → "Other ICT Supplies", dedup case variants
    raw_types = db.session.query(Equipment.type_of_equipment).distinct().all()
    normalized_types = sorted(set(
        normalize_type(t[0]) for t in raw_types if t[0]
    ))

    # Positions from both fields
    p_positions = db.session.query(Equipment.person_accountable_position).distinct().all()
    u_positions = db.session.query(Equipment.used_by_position).distinct().all()
    all_positions = sorted(list(set(
        [p[0] for p in p_positions if p[0]] + [u[0] for u in u_positions if u[0]]
    )))

    return jsonify({
        'types': normalized_types,
        'locations': get_distinct(Equipment.location),
        'indicators': get_distinct(Equipment.indicator),
        'procurement_titles': get_distinct(Equipment.procurement_title),
        'suppliers': get_distinct(Equipment.supplier),
        'brands': get_distinct(Equipment.brand),
        'models': get_distinct(Equipment.model),
        'property_numbers': get_distinct(Equipment.property_number),
        'serial_numbers': get_distinct(Equipment.serial_number),
        'person_accountables': get_distinct(Equipment.person_accountable),
        'used_bys': get_distinct(Equipment.used_by),
        'positions': all_positions
    })

