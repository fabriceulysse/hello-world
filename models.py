import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "coaching.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()

    c.executescript("""
        CREATE TABLE IF NOT EXISTS athletes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            grade INTEGER,
            events TEXT,
            milesplit_id TEXT,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT DEFAULT (date('now'))
        );

        CREATE TABLE IF NOT EXISTS practices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            title TEXT NOT NULL,
            warmup TEXT,
            main_workout TEXT,
            cooldown TEXT,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            practice_id INTEGER NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
            athlete_id INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
            status TEXT NOT NULL DEFAULT 'present',
            note TEXT,
            UNIQUE(practice_id, athlete_id)
        );

        CREATE TABLE IF NOT EXISTS results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            athlete_id INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
            event TEXT NOT NULL,
            mark TEXT NOT NULL,
            meet TEXT,
            meet_date TEXT,
            source TEXT DEFAULT 'manual',
            created_at TEXT DEFAULT (datetime('now'))
        );
    """)

    conn.commit()
    conn.close()


# ---------- Athletes ----------

def get_athletes(active_only=True):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM athletes WHERE active = ? OR ? = 0 ORDER BY name",
        (1 if active_only else 0, 1 if active_only else 0)
    ).fetchall()
    conn.close()
    return rows


def get_athlete(athlete_id):
    conn = get_db()
    row = conn.execute("SELECT * FROM athletes WHERE id = ?", (athlete_id,)).fetchone()
    conn.close()
    return row


def add_athlete(name, grade, events, milesplit_id=""):
    conn = get_db()
    conn.execute(
        "INSERT INTO athletes (name, grade, events, milesplit_id) VALUES (?, ?, ?, ?)",
        (name, grade, events, milesplit_id)
    )
    conn.commit()
    conn.close()


def update_athlete(athlete_id, name, grade, events, milesplit_id):
    conn = get_db()
    conn.execute(
        "UPDATE athletes SET name=?, grade=?, events=?, milesplit_id=? WHERE id=?",
        (name, grade, events, milesplit_id, athlete_id)
    )
    conn.commit()
    conn.close()


def deactivate_athlete(athlete_id):
    conn = get_db()
    conn.execute("UPDATE athletes SET active=0 WHERE id=?", (athlete_id,))
    conn.commit()
    conn.close()


# ---------- Practices ----------

def get_practices():
    conn = get_db()
    rows = conn.execute("SELECT * FROM practices ORDER BY date DESC").fetchall()
    conn.close()
    return rows


def get_practice(practice_id):
    conn = get_db()
    row = conn.execute("SELECT * FROM practices WHERE id = ?", (practice_id,)).fetchone()
    conn.close()
    return row


def add_practice(date, title, warmup, main_workout, cooldown, notes):
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO practices (date, title, warmup, main_workout, cooldown, notes) VALUES (?,?,?,?,?,?)",
        (date, title, warmup, main_workout, cooldown, notes)
    )
    practice_id = cur.lastrowid
    # Pre-populate attendance for all active athletes
    athletes = conn.execute("SELECT id FROM athletes WHERE active=1").fetchall()
    for a in athletes:
        conn.execute(
            "INSERT OR IGNORE INTO attendance (practice_id, athlete_id, status) VALUES (?,?,'present')",
            (practice_id, a["id"])
        )
    conn.commit()
    conn.close()
    return practice_id


def update_practice(practice_id, date, title, warmup, main_workout, cooldown, notes):
    conn = get_db()
    conn.execute(
        "UPDATE practices SET date=?,title=?,warmup=?,main_workout=?,cooldown=?,notes=? WHERE id=?",
        (date, title, warmup, main_workout, cooldown, notes, practice_id)
    )
    conn.commit()
    conn.close()


def delete_practice(practice_id):
    conn = get_db()
    conn.execute("DELETE FROM practices WHERE id=?", (practice_id,))
    conn.commit()
    conn.close()


# ---------- Attendance ----------

def get_attendance(practice_id):
    conn = get_db()
    rows = conn.execute("""
        SELECT att.*, a.name AS athlete_name
        FROM attendance att
        JOIN athletes a ON a.id = att.athlete_id
        WHERE att.practice_id = ?
        ORDER BY a.name
    """, (practice_id,)).fetchall()
    conn.close()
    return rows


def save_attendance(practice_id, statuses):
    """statuses: dict of {athlete_id: {'status': ..., 'note': ...}}"""
    conn = get_db()
    for athlete_id, data in statuses.items():
        conn.execute("""
            INSERT INTO attendance (practice_id, athlete_id, status, note)
            VALUES (?,?,?,?)
            ON CONFLICT(practice_id, athlete_id)
            DO UPDATE SET status=excluded.status, note=excluded.note
        """, (practice_id, athlete_id, data.get("status", "present"), data.get("note", "")))
    conn.commit()
    conn.close()


def get_attendance_summary():
    """Returns attendance rate per athlete across all practices."""
    conn = get_db()
    rows = conn.execute("""
        SELECT
            a.id,
            a.name,
            COUNT(att.id) AS total,
            SUM(CASE WHEN att.status='present' THEN 1 ELSE 0 END) AS present_count
        FROM athletes a
        LEFT JOIN attendance att ON att.athlete_id = a.id
        WHERE a.active = 1
        GROUP BY a.id
        ORDER BY a.name
    """).fetchall()
    conn.close()
    return rows


# ---------- Results ----------

def get_results(athlete_id=None):
    conn = get_db()
    if athlete_id:
        rows = conn.execute("""
            SELECT r.*, a.name AS athlete_name
            FROM results r JOIN athletes a ON a.id = r.athlete_id
            WHERE r.athlete_id = ?
            ORDER BY r.meet_date DESC, r.event
        """, (athlete_id,)).fetchall()
    else:
        rows = conn.execute("""
            SELECT r.*, a.name AS athlete_name
            FROM results r JOIN athletes a ON a.id = r.athlete_id
            ORDER BY r.meet_date DESC, a.name, r.event
        """).fetchall()
    conn.close()
    return rows


def add_result(athlete_id, event, mark, meet, meet_date, source="manual"):
    conn = get_db()
    conn.execute(
        "INSERT INTO results (athlete_id, event, mark, meet, meet_date, source) VALUES (?,?,?,?,?,?)",
        (athlete_id, event, mark, meet, meet_date, source)
    )
    conn.commit()
    conn.close()


def delete_result(result_id):
    conn = get_db()
    conn.execute("DELETE FROM results WHERE id=?", (result_id,))
    conn.commit()
    conn.close()


def get_prs(athlete_id):
    """Return the best (lowest) mark per event for an athlete. Works for time-based events."""
    conn = get_db()
    rows = conn.execute("""
        SELECT event, mark, meet, meet_date
        FROM results
        WHERE athlete_id = ?
        ORDER BY event, mark ASC
    """, (athlete_id,)).fetchall()
    conn.close()
    # Deduplicate to one PR per event (first row = best since sorted ASC)
    seen = {}
    prs = []
    for row in rows:
        if row["event"] not in seen:
            seen[row["event"]] = True
            prs.append(row)
    return prs
