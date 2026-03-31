from flask import Blueprint, request, jsonify, current_app, send_file
from flask_login import login_required
from models import db, Equipment, RepairFile
from datetime import datetime, date
import openpyxl
import io
import os
import uuid

equipment_bp = Blueprint('equipment', __name__)

BOOL_FIELDS = [
    'with_warranty', 'clear_monitor', 'active_cmos_battery', 'charging_ups',
    'working_io_ports', 'updated_patched_os', 'weekly_scan_antivirus', 'working_keyboard_mouse'
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
    filter_type = request.args.get('type', '').strip()
    filter_location = request.args.get('location', '').strip()
    filter_status = request.args.get('status', '').strip()

    query = Equipment.query

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
        query = query.filter_by(type_of_equipment=filter_type)
    if filter_location:
        query = query.filter_by(location=filter_location)
    if filter_status:
        query = query.filter_by(status=filter_status)

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
    if not file.filename.endswith(('.xlsx', '.xls')):
        return jsonify({'error': 'Invalid file type. Please upload an Excel file (.xlsx)'}), 400

    try:
        wb = openpyxl.load_workbook(io.BytesIO(file.read()))
        ws = wb.active

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

        first_row = list(ws.iter_rows(min_row=1, max_row=1, values_only=True))[0]
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
        for row in ws.iter_rows(min_row=2, values_only=True):
            if all(v is None for v in row):
                continue

            data = {}
            for col_idx, cell_val in enumerate(row):
                if col_idx in headers:
                    field = headers[col_idx]
                    if field != 'no':
                        data[field] = cell_val

            eq = Equipment()
            populate_equipment(eq, data)
            db.session.add(eq)
            imported += 1

        db.session.commit()
        return jsonify({'message': f'Successfully imported {imported} equipment(s)', 'count': imported})

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Import failed: {str(e)}'}), 500


@equipment_bp.route('/api/filters')
@login_required
def get_filters():
    types = db.session.query(Equipment.type_of_equipment).distinct().all()
    locations = db.session.query(Equipment.location).distinct().all()
    return jsonify({
        'types': sorted([t[0] for t in types if t[0]]),
        'locations': sorted([l[0] for l in locations if l[0]])
    })
