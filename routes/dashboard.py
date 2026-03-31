from flask import Blueprint, jsonify, render_template
from flask_login import login_required
from models import db, Equipment
from sqlalchemy import func

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/')
@login_required
def index():
    return render_template('dashboard.html')


@dashboard_bp.route('/api/stats')
@login_required
def stats():
    total = Equipment.query.count()
    serviceable = Equipment.query.filter_by(status='serviceable').count()
    unserviceable = Equipment.query.filter_by(status='unserviceable').count()
    return jsonify({
        'total': total,
        'serviceable': serviceable,
        'unserviceable': unserviceable
    })


@dashboard_bp.route('/api/chart/by-type')
@login_required
def chart_by_type():
    results = db.session.query(
        Equipment.type_of_equipment,
        func.count(Equipment.id)
    ).group_by(Equipment.type_of_equipment).all()

    labels = [r[0] if r[0] else 'Unspecified' for r in results]
    values = [r[1] for r in results]
    return jsonify({'labels': labels, 'values': values})


@dashboard_bp.route('/api/chart/by-location')
@login_required
def chart_by_location():
    results = db.session.query(
        Equipment.location,
        func.count(Equipment.id)
    ).group_by(Equipment.location).all()

    labels = [r[0] if r[0] else 'Unspecified' for r in results]
    values = [r[1] for r in results]
    return jsonify({'labels': labels, 'values': values})


@dashboard_bp.route('/api/equipment/by-location/<path:location>')
@login_required
def equipment_by_location(location):
    items = Equipment.query.filter_by(location=location).all()
    return jsonify([item.to_dict() for item in items])


@dashboard_bp.route('/api/recent')
@login_required
def recent():
    items = Equipment.query.order_by(Equipment.created_at.desc()).limit(10).all()
    return jsonify([item.to_dict() for item in items])
