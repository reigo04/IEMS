import os
from flask import Flask
from flask_login import LoginManager
from models import db, User, RepairFile, EquipmentTransfer  # noqa: F401 — imported so tables are created

def create_app():
    app = Flask(
        __name__,
        static_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static'),
        template_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'templates')
    )

    # Configuration
    basedir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(basedir, 'instance', 'iems.db')
    os.makedirs(os.path.dirname(db_path), exist_ok=True)

    # Upload directory for repair history scanned files
    upload_dir = os.path.join(basedir, 'uploads', 'repair_history')
    os.makedirs(upload_dir, exist_ok=True)
    app.config['UPLOAD_FOLDER'] = upload_dir

    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'iems-secret-key-change-in-production-2024')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', f'sqlite:///{db_path}')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024  # 32MB max upload (for scanned PDFs)

    # Initialize extensions
    db.init_app(app)
    
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    login_manager.login_message = 'Please log in to access IEMS.'

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    # Register blueprints
    from routes.auth import auth_bp
    from routes.dashboard import dashboard_bp
    from routes.equipment import equipment_bp
    from routes.reports import reports_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(equipment_bp)
    app.register_blueprint(reports_bp)

    # Create tables
    with app.app_context():
        db.create_all()
        # Seed admin user if not exists
        if not User.query.filter_by(username='admin').first():
            import bcrypt
            password_hash = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            admin = User(username='admin', password_hash=password_hash, role='admin')
            db.session.add(admin)
            db.session.commit()

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5001)
