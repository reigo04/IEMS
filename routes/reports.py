from flask import Blueprint, request, jsonify, Response
from flask_login import login_required
from models import db, Equipment, normalize_equipment_type as normalize_type
import csv
import io
from datetime import datetime

reports_bp = Blueprint('reports', __name__)

# ── Preset column formats per equipment type ──
# Each preset is an ordered list of (db_field, display_header) tuples.
# '_row_num' is a virtual column that generates sequential row numbers.

_COMMON_BASE = [
    ('_row_num', 'No.'),
    ('brand', 'BRAND'),
    ('model', 'MODEL'),
    ('property_number', 'PROPERTY NUMBER'),
    ('serial_number', 'SERIAL NUMBER'),
    ('acquisition_date', 'ACQUISITION DATE'),
    ('cost', 'COST'),
    ('person_accountable', 'PERSON ACCOUNTABLE'),
    ('person_accountable_position', 'POSITION'),
    ('used_by', 'USED BY'),
    ('used_by_position', 'POSITION'),
]

TYPE_COLUMN_PRESETS = {
    'Desktop PC': _COMMON_BASE + [
        ('with_warranty', 'With Warranty?'),
        ('charging_ups', 'With UPS?'),
        ('weekly_scan_antivirus', 'Antivirus Installed?'),
        ('working_keyboard_mouse', 'Working Mouse and Keyboard?'),
        ('clear_monitor', 'With Clear Monitor?'),
        ('working_io_ports', 'Working I/O Ports?'),
        ('updated_patched_os', 'Updated Operating System?'),
        ('active_cmos_battery', 'Active CMOS Battery?'),
        ('remarks_recommendation', 'REMARKS/RECOMMENDATION'),
    ],
    'Laptop': _COMMON_BASE + [
        ('with_warranty', 'With Warranty?'),
        ('weekly_scan_antivirus', 'Antivirus Installed?'),
        ('working_keyboard_mouse', 'Working Trackpad & Keyboard?'),
        ('clear_monitor', 'With Clear Monitor?'),
        ('working_io_ports', 'Working I/O Ports?'),
        ('updated_patched_os', 'Updated Operating System?'),
        ('working_speakers', 'Working Speakers?'),
        ('remarks_recommendation', 'REMARKS/RECOMMENDATION'),
    ],
    'Printer': _COMMON_BASE + [
        ('with_warranty', 'With Warranty?'),
        ('ink_level_ok', 'Ink Level Above 50% Capacity?'),
        ('printing_black', 'Printing Black Color?'),
        ('printing_cyan', 'Printing Cyan Color?'),
        ('printing_magenta', 'Printing Magenta Color?'),
        ('printing_yellow', 'Printing Yellow Color?'),
        ('working_pickup_roller', 'Working Pick-up Roller?'),
        ('ink_wastepad_ok', 'Ink Wastepad Cleaned/Replaced?'),
        ('remarks_recommendation', 'REMARKS/RECOMMENDATION'),
    ],
    'Document Scanner': _COMMON_BASE + [
        ('with_warranty', 'With Warranty?'),
        ('working_adf', 'Working ADF?'),
        ('working_buttons', 'Working Buttons?'),
        ('working_pickup_roller', 'Working Pick-up Roller?'),
        ('working_separation_roller', 'Working Separation Roller?'),
        ('remarks_recommendation', 'REMARKS/RECOMMENDATION'),
    ],
    'LCD Projector': _COMMON_BASE + [
        ('with_warranty', 'With Warranty?'),
        ('laser_source', 'Laser Source?'),
        ('bulb_source', 'Bulb Source?'),
        ('working_buttons', 'Working Buttons & I/O Ports?'),
        ('clear_projection', 'With Clear Projection/Output?'),
        ('remarks_recommendation', 'REMARKS/RECOMMENDATION'),
    ],
    'Other ICT Supplies': _COMMON_BASE + [
        ('with_warranty', 'With Warranty?'),
        ('working_buttons', 'Working Buttons?'),
        ('working_io_ports', 'I/O Connections?'),
        ('clear_monitor', 'Clear Monitor? (Selected Equipment)'),
        ('good_physical_condition', 'Good Physical Condition?'),
        ('functional_for_use', 'Functional For Use?'),
        ('remarks_recommendation', 'REMARKS/RECOMMENDATION'),
    ],
}

# Monitor uses the same preset as Desktop PC
TYPE_COLUMN_PRESETS['Monitor'] = TYPE_COLUMN_PRESETS['Desktop PC']
# Tablet uses the same preset as Laptop
TYPE_COLUMN_PRESETS['Tablet'] = TYPE_COLUMN_PRESETS['Laptop']

# Default columns when no type filter is applied
DEFAULT_COLUMNS = [
    ('_row_num', 'No.'),
    ('type_of_equipment', 'TYPE OF EQUIPMENT'),
    ('brand', 'BRAND'),
    ('model', 'MODEL'),
    ('property_number', 'PROPERTY NUMBER'),
    ('serial_number', 'SERIAL NUMBER'),
    ('acquisition_date', 'ACQUISITION DATE'),
    ('cost', 'COST'),
    ('person_accountable', 'PERSON ACCOUNTABLE'),
    ('person_accountable_position', 'POSITION'),
    ('used_by', 'USED BY'),
    ('used_by_position', 'POSITION'),
    ('location', 'LOCATION'),
    ('with_warranty', 'With Warranty?'),
    ('status', 'STATUS'),
    ('remarks_recommendation', 'REMARKS/RECOMMENDATION'),
]


def get_preset_for_type(filter_type):
    """Return the column preset for the given equipment type filter."""
    if not filter_type:
        return DEFAULT_COLUMNS
    normalized = filter_type.strip()
    if normalized.lower() == 'other ict supplies':
        normalized = 'Other ICT Supplies'
    return TYPE_COLUMN_PRESETS.get(normalized, DEFAULT_COLUMNS)


@reports_bp.route('/api/reports/generate', methods=['POST'])
@login_required
def generate_report():
    data = request.get_json()
    format_type = data.get('format', 'csv')
    filter_type = data.get('filter_type', '')
    filter_location = data.get('filter_location', '')
    filter_status = data.get('filter_status', '')
    filter_warranty = data.get('filter_warranty', '')
    filter_ups = data.get('filter_ups', '')
    filter_antivirus = data.get('filter_antivirus', '')

    # Determine column preset based on type filter
    preset = get_preset_for_type(filter_type)

    # Build query
    query = Equipment.query
    if filter_type:
        if filter_type.strip().lower() == 'other ict supplies':
            query = query.filter(Equipment.type_of_equipment.ilike('OIS%'))
        else:
            query = query.filter(Equipment.type_of_equipment.ilike(f'%{filter_type}%'))
    if filter_location:
        query = query.filter(Equipment.location.ilike(f'%{filter_location}%'))
    if filter_status:
        query = query.filter(Equipment.status.ilike(f'%{filter_status}%'))
    if filter_warranty in ('yes', 'no'):
        query = query.filter_by(with_warranty=(filter_warranty == 'yes'))
    if filter_ups in ('yes', 'no'):
        query = query.filter_by(charging_ups=(filter_ups == 'yes'))
    if filter_antivirus in ('yes', 'no'):
        query = query.filter_by(weekly_scan_antivirus=(filter_antivirus == 'yes'))

    items = query.order_by(Equipment.id).all()

    if format_type == 'pdf':
        return generate_pdf(items, preset)
    else:
        return generate_csv(items, preset)


def format_value(item, col):
    val = getattr(item, col, '')
    # Normalize type_of_equipment for display
    if col == 'type_of_equipment' and val:
        val = normalize_type(val)
    if isinstance(val, bool):
        return 'Yes' if val else 'No'
    if isinstance(val, datetime):
        return val.strftime('%Y-%m-%d')
    if hasattr(val, 'isoformat'):
        return val.isoformat()
    return str(val) if val is not None else ''


def generate_csv(items, preset):
    output = io.StringIO()
    writer = csv.writer(output)

    # Header row using preset labels
    headers = [label for _, label in preset]
    writer.writerow(headers)

    # Data rows
    for idx, item in enumerate(items, start=1):
        row = []
        for field, _ in preset:
            if field == '_row_num':
                row.append(str(idx))
            else:
                row.append(format_value(item, field))
        writer.writerow(row)

    csv_data = output.getvalue()
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    return Response(
        csv_data,
        mimetype='text/csv',
        headers={
            'Content-Disposition': f'attachment; filename=IEMS_Report_{timestamp}.csv'
        }
    )


def generate_pdf(items, preset):
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import landscape, A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch, mm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.enums import TA_CENTER, TA_LEFT
    except ImportError:
        return jsonify({'error': 'PDF generation library not available'}), 500

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        alignment=TA_CENTER,
        spaceAfter=12,
        textColor=colors.HexColor('#1a1a2e')
    )
    cell_style = ParagraphStyle(
        'CellStyle',
        parent=styles['Normal'],
        fontSize=7,
        leading=9,
        alignment=TA_LEFT,
    )
    header_style = ParagraphStyle(
        'HeaderStyle',
        parent=styles['Normal'],
        fontSize=7,
        leading=9,
        alignment=TA_CENTER,
        textColor=colors.white,
    )

    elements = []
    elements.append(Paragraph('ICT Equipment Inventory Report', title_style))
    elements.append(Paragraph(
        f'Generated: {datetime.now().strftime("%B %d, %Y %I:%M %p")}',
        ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER, spaceAfter=20)
    ))

    # Table data using preset headers
    headers_row = [Paragraph(label, header_style) for _, label in preset]
    table_data = [headers_row]

    for idx, item in enumerate(items, start=1):
        row = []
        for field, _ in preset:
            if field == '_row_num':
                row.append(Paragraph(str(idx), cell_style))
            else:
                row.append(Paragraph(format_value(item, field), cell_style))
        table_data.append(row)

    # Calculate column widths
    num_cols = len(preset)
    available_width = landscape(A4)[0] - 30 * mm
    col_width = available_width / num_cols

    table = Table(table_data, colWidths=[col_width] * num_cols, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0d9488')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('FONTSIZE', (0, 0), (-1, 0), 7),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        ('TOPPADDING', (0, 0), (-1, 0), 6),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0fdfa')]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
        ('FONTSIZE', (0, 1), (-1, -1), 7),
        ('TOPPADDING', (0, 1), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))

    elements.append(table)
    elements.append(Spacer(1, 12))
    elements.append(Paragraph(
        f'Total Equipment: {len(items)}',
        ParagraphStyle('Footer', parent=styles['Normal'], fontSize=9, alignment=TA_LEFT)
    ))

    doc.build(elements)
    pdf_data = buffer.getvalue()
    buffer.close()

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    return Response(
        pdf_data,
        mimetype='application/pdf',
        headers={
            'Content-Disposition': f'attachment; filename=IEMS_Report_{timestamp}.pdf'
        }
    )
