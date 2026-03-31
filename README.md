# IEMS — ICT Equipment Inventory Management System

A web-based inventory management system for ICT equipment built with Python Flask and SQLite.

## Requirements

- **Python 3.11+** (check with `python3 --version`)
- pip (comes with Python)

## Quick Setup (Local Deployment)

```bash
# 1. Navigate to the project folder
cd IEMS

# 2. Create a virtual environment
python3 -m venv venv

# 3. Activate the virtual environment
source venv/bin/activate        # macOS / Linux
# venv\Scripts\activate          # Windows CMD
# venv\Scripts\Activate.ps1      # Windows PowerShell

# 4. Install dependencies
pip install -r requirements.txt

# 5. (Optional) Seed sample data for testing
python seed.py

# 6. Run the application
python app.py
```

Open your browser and go to: **http://127.0.0.1:5001**

### Default Login Credentials
| Username | Password | Role |
|----------|----------|------|
| admin    | admin123 | Admin |

> ⚠️ Change the default password after first login for security.

## Features

- **Admin Dashboard** with login authentication
- **Overview Tab**: Stats cards, equipment-by-type chart, equipment-by-location chart (clickable), recently added
- **Equipment Tab**: Full CRUD, search, filters, pagination, bulk delete, Excel import (.xlsx)
- **View Equipment**: Detailed view modal showing all fields, condition checklist, status, and repair history files
- **Add/Edit Equipment Modal**: All fields from the PPT template including Yes/No condition checklist and Serviceable/Unserviceable status
- **Repair History**: Upload scanned Maintenance Request Forms (PDF, JPG, PNG) as repair history documentation
- **Reports Tab**: Generate CSV or PDF reports with type/location/status filters and column-level selection
- **Responsive UI**: Works on mobile, tablet, desktop, and ultrawide/horizontal monitors

## Data Fields Captured

| Category | Fields |
|----------|--------|
| Basic Info | No., Indicator, Procurement Title, Supplier, Location, Type of Equipment, Brand, Model, Property Number, Serial Number, Acquisition Date, Cost, Description |
| Accountability | Person Accountable, Position, Used By, Position |
| Condition Checklist | With Warranty, Clear Monitor, Active CMOS Battery, Charging UPS, Working I/O Ports, Updated/Patched OS, Weekly Scan Antivirus, Working Keyboard & Mouse |
| Additional | Remarks/Recommendation, Inventory Date, Repair History (file uploads), Status (Serviceable/Unserviceable) |

## Project Structure

```
IEMS/
├── app.py                 # Main application (run this)
├── models.py              # Database models (Equipment + RepairFile)
├── seed.py                # Sample data seeder
├── requirements.txt       # Python dependencies
├── .gitignore             # Git exclusions (db, uploads, venv)
├── vercel.json            # Vercel deployment config
├── api/
│   └── index.py           # Vercel serverless entry point
├── routes/
│   ├── auth.py            # Login/logout
│   ├── dashboard.py       # Overview stats & charts
│   ├── equipment.py       # Equipment CRUD, import, repair files
│   └── reports.py         # Report generation
├── static/
│   ├── css/style.css      # Dark theme stylesheet
│   └── js/                # Frontend JavaScript
├── templates/
│   ├── login.html         # Login page
│   └── dashboard.html     # Main dashboard
├── uploads/
│   └── repair_history/    # Scanned Maintenance Request Forms (auto-created)
└── instance/
    └── iems.db            # SQLite database (auto-created on first run)
```

## GitHub & Transferring to Another Machine

The `.gitignore` file excludes the database (`instance/`), uploaded files (`uploads/`), virtual environment (`venv/`), and cache files. When you clone/pull the repo on another machine:

1. Clone the repository
2. Follow the **Quick Setup** steps above
3. The database is **auto-created** on first run with an admin account
4. Uploaded repair history files are **not included** in the repo (they need to be backed up separately if needed)

### Quick Copy Command (macOS/Linux)
```bash
zip -r IEMS.zip IEMS -x "IEMS/venv/*" "IEMS/instance/*" "IEMS/uploads/*" "IEMS/__pycache__/*" "IEMS/routes/__pycache__/*"
```

## Repair History (Maintenance Request Forms)

Instead of typing repair history as text, the system now uses **file uploads**:

1. **Add** equipment first, then **edit** it to upload repair files
2. Upload scanned copies of **Maintenance Request Forms** (PDF, JPG, PNG)
3. Files are stored in `uploads/repair_history/<equipment_id>/`
4. **View** any equipment to see its repair history files with download/preview options
5. Maximum file size: **32MB** per upload

## Deploying to Vercel

1. Push this project to a GitHub repository
2. Connect the repo to [Vercel](https://vercel.com)
3. Vercel auto-detects the Python app via `vercel.json`
4. Set the `SECRET_KEY` environment variable in Vercel dashboard

> **Note**: For production use on Vercel, switch to a managed PostgreSQL database (e.g., Supabase or Neon free tier). Update the `DATABASE_URL` environment variable — the SQLAlchemy ORM makes this a one-line config change in `app.py`.

## Changing the Port

The app runs on port **5001** by default. To change it, edit the last line of `app.py`:

```python
app.run(debug=True, host='0.0.0.0', port=YOUR_PORT)
```

Set `host='0.0.0.0'` to make it accessible from other devices on the network.
