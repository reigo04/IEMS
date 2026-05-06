"""
run_migration.py — Run once to add new equipment condition columns to the existing DB.
Safe to run multiple times (checks if columns exist before adding).
"""
import sqlite3
import os

DB_PATH = os.path.join('instance', 'iems.db')

NEW_COLUMNS = [
    # Laptop / Tablet
    ('working_speakers',         'BOOLEAN DEFAULT 0'),
    # Printer
    ('ink_level_ok',             'BOOLEAN DEFAULT 0'),
    ('printing_black',           'BOOLEAN DEFAULT 0'),
    ('printing_cyan',            'BOOLEAN DEFAULT 0'),
    ('printing_magenta',         'BOOLEAN DEFAULT 0'),
    ('printing_yellow',          'BOOLEAN DEFAULT 0'),
    ('working_pickup_roller',    'BOOLEAN DEFAULT 0'),
    ('ink_wastepad_ok',          'BOOLEAN DEFAULT 0'),
    # Document Scanner
    ('working_adf',              'BOOLEAN DEFAULT 0'),
    ('working_buttons',          'BOOLEAN DEFAULT 0'),
    ('working_separation_roller','BOOLEAN DEFAULT 0'),
    # LCD Projector
    ('laser_source',             'BOOLEAN DEFAULT 0'),
    ('bulb_source',              'BOOLEAN DEFAULT 0'),
    ('clear_projection',         'BOOLEAN DEFAULT 0'),
    # Other ICT Supplies / Monitor
    ('good_physical_condition',  'BOOLEAN DEFAULT 0'),
    ('functional_for_use',       'BOOLEAN DEFAULT 0'),
]

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"[ERROR] Database not found at: {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Get existing columns
    cur.execute("PRAGMA table_info(equipment)")
    existing = {row[1] for row in cur.fetchall()}

    added = []
    for col_name, col_def in NEW_COLUMNS:
        if col_name not in existing:
            cur.execute(f"ALTER TABLE equipment ADD COLUMN {col_name} {col_def}")
            added.append(col_name)
            print(f"  [+] Added column: {col_name}")
        else:
            print(f"  [=] Already exists: {col_name}")

    conn.commit()
    conn.close()

    if added:
        print(f"\nMigration complete. Added {len(added)} new column(s).")
    else:
        print("\nNo changes needed — all columns already present.")

if __name__ == '__main__':
    print(f"Migrating database: {DB_PATH}\n")
    migrate()
