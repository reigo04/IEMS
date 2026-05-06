from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime, date

db = SQLAlchemy()

# ── Type Normalization (shared with routes.equipment) ──
_TYPE_DISPLAY_MAP = {
    'DESKTOP PC': 'Desktop PC',
    'DOCUMENT SCANNER': 'Document Scanner',
    'LAPTOP': 'Laptop',
    'LCD PROJECTOR': 'LCD Projector',
    'MONITOR': 'Monitor',
    'PRINTER': 'Printer',
    'TABLET': 'Tablet',
}


def normalize_equipment_type(raw_type):
    """Return a canonical display name for an equipment type."""
    if not raw_type:
        return ''
    stripped = raw_type.strip()
    if stripped.upper().startswith('OIS'):
        return 'Other ICT Supplies'
    canonical = _TYPE_DISPLAY_MAP.get(stripped.upper())
    if canonical:
        return canonical
    return stripped.title()


class User(UserMixin, db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='admin')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<User {self.username}>'


class Equipment(db.Model):
    __tablename__ = 'equipment'

    id = db.Column(db.Integer, primary_key=True)
    indicator = db.Column(db.String(100), default='')
    procurement_title = db.Column(db.String(255), default='')
    supplier = db.Column(db.String(255), default='')
    location = db.Column(db.String(255), default='')
    type_of_equipment = db.Column(db.String(100), default='')
    brand = db.Column(db.String(100), default='')
    model = db.Column(db.String(100), default='')
    property_number = db.Column(db.String(100), default='')
    serial_number = db.Column(db.String(100), default='')
    acquisition_date = db.Column(db.Date, nullable=True)
    cost = db.Column(db.Float, default=0.0)
    description = db.Column(db.Text, default='')
    person_accountable = db.Column(db.String(255), default='')
    person_accountable_position = db.Column(db.String(255), default='')
    used_by = db.Column(db.String(255), default='')
    used_by_position = db.Column(db.String(255), default='')

    with_warranty = db.Column(db.Boolean, default=False)
    clear_monitor = db.Column(db.Boolean, default=False)
    active_cmos_battery = db.Column(db.Boolean, default=False)
    charging_ups = db.Column(db.Boolean, default=False)
    working_io_ports = db.Column(db.Boolean, default=False)
    updated_patched_os = db.Column(db.Boolean, default=False)
    weekly_scan_antivirus = db.Column(db.Boolean, default=False)
    working_keyboard_mouse = db.Column(db.Boolean, default=False)

    # Laptop / Tablet
    working_speakers = db.Column(db.Boolean, default=False)

    # Printer
    ink_level_ok = db.Column(db.Boolean, default=False)
    printing_black = db.Column(db.Boolean, default=False)
    printing_cyan = db.Column(db.Boolean, default=False)
    printing_magenta = db.Column(db.Boolean, default=False)
    printing_yellow = db.Column(db.Boolean, default=False)
    working_pickup_roller = db.Column(db.Boolean, default=False)
    ink_wastepad_ok = db.Column(db.Boolean, default=False)

    # Document Scanner
    working_adf = db.Column(db.Boolean, default=False)
    working_buttons = db.Column(db.Boolean, default=False)
    working_separation_roller = db.Column(db.Boolean, default=False)

    # LCD Projector
    laser_source = db.Column(db.Boolean, default=False)
    bulb_source = db.Column(db.Boolean, default=False)
    clear_projection = db.Column(db.Boolean, default=False)

    # Other ICT Supplies
    good_physical_condition = db.Column(db.Boolean, default=False)
    functional_for_use = db.Column(db.Boolean, default=False)

    remarks_recommendation = db.Column(db.Text, default='')
    inventory_date = db.Column(db.Date, nullable=True)
    repair_history = db.Column(db.Text, default='')
    status = db.Column(db.String(20), default='serviceable')

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    repair_files = db.relationship('RepairFile', backref='equipment', lazy=True,
                                   cascade='all, delete-orphan')
    transfers = db.relationship('EquipmentTransfer', backref='equipment', lazy=True,
                                cascade='all, delete-orphan',
                                order_by='EquipmentTransfer.transfer_date.desc()')

    def to_dict(self):
        return {
            'id': self.id,
            'indicator': self.indicator or '',
            'procurement_title': self.procurement_title or '',
            'supplier': self.supplier or '',
            'location': self.location or '',
            'type_of_equipment': normalize_equipment_type(self.type_of_equipment),
            'brand': self.brand or '',
            'model': self.model or '',
            'property_number': self.property_number or '',
            'serial_number': self.serial_number or '',
            'acquisition_date': self.acquisition_date.isoformat() if self.acquisition_date else '',
            'cost': self.cost or 0.0,
            'description': self.description or '',
            'person_accountable': self.person_accountable or '',
            'person_accountable_position': self.person_accountable_position or '',
            'used_by': self.used_by or '',
            'used_by_position': self.used_by_position or '',
            'with_warranty': self.with_warranty,
            'clear_monitor': self.clear_monitor,
            'active_cmos_battery': self.active_cmos_battery,
            'charging_ups': self.charging_ups,
            'working_io_ports': self.working_io_ports,
            'updated_patched_os': self.updated_patched_os,
            'weekly_scan_antivirus': self.weekly_scan_antivirus,
            'working_keyboard_mouse': self.working_keyboard_mouse,
            'working_speakers': self.working_speakers,
            'ink_level_ok': self.ink_level_ok,
            'printing_black': self.printing_black,
            'printing_cyan': self.printing_cyan,
            'printing_magenta': self.printing_magenta,
            'printing_yellow': self.printing_yellow,
            'working_pickup_roller': self.working_pickup_roller,
            'ink_wastepad_ok': self.ink_wastepad_ok,
            'working_adf': self.working_adf,
            'working_buttons': self.working_buttons,
            'working_separation_roller': self.working_separation_roller,
            'laser_source': self.laser_source,
            'bulb_source': self.bulb_source,
            'clear_projection': self.clear_projection,
            'good_physical_condition': self.good_physical_condition,
            'functional_for_use': self.functional_for_use,
            'remarks_recommendation': self.remarks_recommendation or '',
            'inventory_date': self.inventory_date.isoformat() if self.inventory_date else '',
            'repair_history': self.repair_history or '',
            'status': self.status or 'serviceable',
            'created_at': self.created_at.isoformat() if self.created_at else '',
            'updated_at': self.updated_at.isoformat() if self.updated_at else '',
            'repair_files': [rf.to_dict() for rf in self.repair_files],
            'transfers': [t.to_dict() for t in self.transfers],
        }

    def __repr__(self):
        return f'<Equipment {self.id} - {self.procurement_title}>'


class RepairFile(db.Model):
    __tablename__ = 'repair_files'

    id = db.Column(db.Integer, primary_key=True)
    equipment_id = db.Column(db.Integer, db.ForeignKey('equipment.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(50), default='')
    file_size = db.Column(db.Integer, default=0)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'equipment_id': self.equipment_id,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'file_type': self.file_type or '',
            'file_size': self.file_size or 0,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else '',
        }

    def __repr__(self):
        return f'<RepairFile {self.id} - {self.original_filename}>'


class EquipmentTransfer(db.Model):
    __tablename__ = 'equipment_transfers'

    id = db.Column(db.Integer, primary_key=True)
    equipment_id = db.Column(db.Integer, db.ForeignKey('equipment.id'), nullable=False)

    # Previous accountability snapshot
    from_person_accountable = db.Column(db.String(255), default='')
    from_person_accountable_position = db.Column(db.String(255), default='')
    from_used_by = db.Column(db.String(255), default='')
    from_used_by_position = db.Column(db.String(255), default='')
    from_location = db.Column(db.String(255), default='')

    # New accountability
    to_person_accountable = db.Column(db.String(255), default='')
    to_person_accountable_position = db.Column(db.String(255), default='')
    to_used_by = db.Column(db.String(255), default='')
    to_used_by_position = db.Column(db.String(255), default='')
    to_location = db.Column(db.String(255), default='')

    # Transfer metadata
    transfer_date = db.Column(db.Date, nullable=True)
    reason = db.Column(db.Text, default='')
    notes = db.Column(db.Text, default='')
    transferred_by = db.Column(db.String(100), default='')

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'equipment_id': self.equipment_id,
            'from_person_accountable': self.from_person_accountable or '',
            'from_person_accountable_position': self.from_person_accountable_position or '',
            'from_used_by': self.from_used_by or '',
            'from_used_by_position': self.from_used_by_position or '',
            'from_location': self.from_location or '',
            'to_person_accountable': self.to_person_accountable or '',
            'to_person_accountable_position': self.to_person_accountable_position or '',
            'to_used_by': self.to_used_by or '',
            'to_used_by_position': self.to_used_by_position or '',
            'to_location': self.to_location or '',
            'transfer_date': self.transfer_date.isoformat() if self.transfer_date else '',
            'reason': self.reason or '',
            'notes': self.notes or '',
            'transferred_by': self.transferred_by or '',
            'created_at': self.created_at.isoformat() if self.created_at else '',
        }

    def __repr__(self):
        return f'<EquipmentTransfer {self.id} eq={self.equipment_id}>'
