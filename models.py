from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime, date

db = SQLAlchemy()


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
    # Core fields from PPT template
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

    # Yes/No boolean fields
    with_warranty = db.Column(db.Boolean, default=False)
    clear_monitor = db.Column(db.Boolean, default=False)
    active_cmos_battery = db.Column(db.Boolean, default=False)
    charging_ups = db.Column(db.Boolean, default=False)
    working_io_ports = db.Column(db.Boolean, default=False)
    updated_patched_os = db.Column(db.Boolean, default=False)
    weekly_scan_antivirus = db.Column(db.Boolean, default=False)
    working_keyboard_mouse = db.Column(db.Boolean, default=False)

    # Additional fields
    remarks_recommendation = db.Column(db.Text, default='')
    inventory_date = db.Column(db.Date, nullable=True)
    repair_history = db.Column(db.Text, default='')  # Legacy text field (kept for old data)
    status = db.Column(db.String(20), default='serviceable')  # serviceable or unserviceable

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to repair files
    repair_files = db.relationship('RepairFile', backref='equipment', lazy=True,
                                   cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'indicator': self.indicator or '',
            'procurement_title': self.procurement_title or '',
            'supplier': self.supplier or '',
            'location': self.location or '',
            'type_of_equipment': self.type_of_equipment or '',
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
            'remarks_recommendation': self.remarks_recommendation or '',
            'inventory_date': self.inventory_date.isoformat() if self.inventory_date else '',
            'repair_history': self.repair_history or '',
            'status': self.status or 'serviceable',
            'created_at': self.created_at.isoformat() if self.created_at else '',
            'updated_at': self.updated_at.isoformat() if self.updated_at else '',
            'repair_files': [rf.to_dict() for rf in self.repair_files],
        }

    def __repr__(self):
        return f'<Equipment {self.id} - {self.procurement_title}>'


class RepairFile(db.Model):
    __tablename__ = 'repair_files'

    id = db.Column(db.Integer, primary_key=True)
    equipment_id = db.Column(db.Integer, db.ForeignKey('equipment.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)        # Stored filename (UUID-based)
    original_filename = db.Column(db.String(255), nullable=False)  # User's original filename
    file_type = db.Column(db.String(50), default='')            # e.g. 'pdf', 'jpg', 'png'
    file_size = db.Column(db.Integer, default=0)                # Size in bytes
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
