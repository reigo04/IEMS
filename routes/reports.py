from flask import Blueprint, request, jsonify, Response
from flask_login import login_required
from models import db, Equipment
import csv
import io
from datetime import datetime

reports_bp = Blueprint('reports', __name__)

ALL_COLUMNS = {
    'id': 'No.',
    'indicator': 'Indicator',
    'procurement_title': 'Procurement Title',
    'supplier': 'Supplier',
    'location': 'Location',
    'type_of_equipment': 'Type of Equipment',
    'brand': 'Brand',
    'model': 'Model',
    'property_number': 'Property Number',
    'serial_number': 'Serial Number',
    'acquisition_date': 'Acquisition Date',
    'cost': 'Cost',
    'description': 'Description',
    'person_accountable': 'Person Accountable',
    'person_accountable_position': 'Position (Accountable)',
    'used_by': 'Used By',
    'used_by_position': 'Position (Used By)',
    'with_warranty': 'With Warranty',
    'clear_monitor': 'Clear Monitor',
    'active_cmos_battery': 'Active CMOS Battery',
    'charging_ups': 'Charging UPS',
    'working_io_ports': 'Working I/O Ports',
    'updated_patched_os': 'Updated/Patched OS',
    'weekly_scan_antivirus': 'Weekly Scan Antivirus',
    'working_keyboard_mouse': 'Working Keyboard & Mouse',
    'remarks_recommendation': 'Remarks/Recommendation',
    'inventory_date': 'Inventory Date',
    'repair_history': 'Repair History',
    'status': 'Status',
}


@reports_bp.route('/api/reports/columns')
@login_required
def get_columns():
    return jsonify(ALL_COLUMNS)


@reports_bp.route('/api/reports/generate', methods=['POST'])
@login_required
def generate_report():
    data = request.get_json()
    format_type = data.get('format', 'csv')
    filter_type = data.get('filter_type', '')
    filter_location = data.get('filter_location', '')
    filter_status = data.get('filter_status', '')
    selected_columns = data.get('columns', list(ALL_COLUMNS.keys()))

    # Build query
    query = Equipment.query
    if filter_type:
        query = query.filter_by(type_of_equipment=filter_type)
    if filter_location:
        query = query.filter_by(location=filter_location)
    if filter_status:
        query = query.filter_by(status=filter_status)

    items = query.order_by(Equipment.id).all()

    if format_type == 'pdf':
        return generate_pdf(items, selected_columns)
    else:
        return generate_csv(items, selected_columns)


def format_value(item, col):
    val = getattr(item, col, '')
    if isinstance(val, bool):
        return 'Yes' if val else 'No'
    if isinstance(val, datetime):
        return val.strftime('%Y-%m-%d')
    if hasattr(val, 'isoformat'):
        return val.isoformat()
    return str(val) if val is not None else ''


def generate_csv(items, columns):
    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    headers = [ALL_COLUMNS.get(col, col) for col in columns]
    writer.writerow(headers)

    # Data rows
    for item in items:
        row = [format_value(item, col) for col in columns]
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


def generate_pdf(items, columns):
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

    # Table data
    headers_row = [Paragraph(ALL_COLUMNS.get(col, col), header_style) for col in columns]
    table_data = [headers_row]

    for item in items:
        row = [Paragraph(format_value(item, col), cell_style) for col in columns]
        table_data.append(row)

    # Calculate column widths
    num_cols = len(columns)
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
