from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
import models
import scraper

app = Flask(__name__)
app.secret_key = "coaching-tool-secret-key"

models.init_db()


# ─────────────────────────── Dashboard ───────────────────────────

@app.route("/")
def index():
    athletes = models.get_athletes()
    practices = models.get_practices()[:5]
    attendance_summary = models.get_attendance_summary()
    recent_results = models.get_results()[:10]
    return render_template(
        "index.html",
        athletes=athletes,
        practices=practices,
        attendance_summary=attendance_summary,
        recent_results=recent_results,
    )


# ─────────────────────────── Athletes ────────────────────────────

@app.route("/athletes")
def athletes():
    roster = models.get_athletes()
    return render_template("athletes.html", athletes=roster)


@app.route("/athletes/add", methods=["GET", "POST"])
def add_athlete():
    if request.method == "POST":
        milesplit_id = request.form.get("milesplit_id", "").strip()
        name = request.form["name"].strip()

        if not milesplit_id:
            flash("A MileSplit athlete must be selected before saving.", "error")
            return render_template("athlete_form.html", athlete=None)

        if not scraper.athlete_exists(milesplit_id):
            flash(f"Could not verify athlete on MileSplit (ID {milesplit_id}). Please search and select again.", "error")
            return render_template("athlete_form.html", athlete=None)

        models.add_athlete(
            name=name,
            grade=request.form.get("grade") or None,
            events=request.form.get("events", "").strip(),
            milesplit_id=milesplit_id,
        )
        flash(f"Athlete '{name}' added.", "success")
        return redirect(url_for("athletes"))
    return render_template("athlete_form.html", athlete=None)


@app.route("/athletes/<int:athlete_id>")
def athlete_detail(athlete_id):
    athlete = models.get_athlete(athlete_id)
    if not athlete:
        flash("Athlete not found.", "error")
        return redirect(url_for("athletes"))
    results = models.get_results(athlete_id)
    prs = models.get_prs(athlete_id)
    return render_template("athlete_detail.html", athlete=athlete, results=results, prs=prs)


@app.route("/athletes/<int:athlete_id>/edit", methods=["GET", "POST"])
def edit_athlete(athlete_id):
    athlete = models.get_athlete(athlete_id)
    if not athlete:
        flash("Athlete not found.", "error")
        return redirect(url_for("athletes"))
    if request.method == "POST":
        models.update_athlete(
            athlete_id,
            name=request.form["name"].strip(),
            grade=request.form.get("grade") or None,
            events=request.form.get("events", "").strip(),
            milesplit_id=request.form.get("milesplit_id", "").strip(),
        )
        flash("Athlete updated.", "success")
        return redirect(url_for("athlete_detail", athlete_id=athlete_id))
    return render_template("athlete_form.html", athlete=athlete)


@app.route("/athletes/<int:athlete_id>/deactivate", methods=["POST"])
def deactivate_athlete(athlete_id):
    models.deactivate_athlete(athlete_id)
    flash("Athlete removed from active roster.", "info")
    return redirect(url_for("athletes"))


# ─────────────────────────── MileSplit scraping ──────────────────

@app.route("/athletes/search-milesplit")
def search_milesplit():
    """AJAX endpoint: search MileSplit for an athlete name."""
    name = request.args.get("q", "").strip()
    if not name:
        return jsonify([])
    try:
        results = scraper.search_athlete(name)
        return jsonify(results[:10])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/athletes/<int:athlete_id>/sync-milesplit", methods=["POST"])
def sync_milesplit(athlete_id):
    """Pull latest results from MileSplit for an athlete and store them."""
    athlete = models.get_athlete(athlete_id)
    if not athlete or not athlete["milesplit_id"]:
        flash("No MileSplit ID linked to this athlete.", "error")
        return redirect(url_for("athlete_detail", athlete_id=athlete_id))

    try:
        performances = scraper.get_athlete_performances(athlete["milesplit_id"])
        added = 0
        for perf in performances:
            if perf["mark"] and perf["event"]:
                models.add_result(
                    athlete_id=athlete_id,
                    event=perf["event"],
                    mark=perf["mark"],
                    meet=perf.get("meet", ""),
                    meet_date=perf.get("meet_date", ""),
                    source="milesplit",
                )
                added += 1
        flash(f"Synced {added} result(s) from MileSplit. Data sourced from MileSplit (milesplit.com).", "success")
    except Exception as e:
        flash(f"MileSplit sync failed: {e}", "error")

    return redirect(url_for("athlete_detail", athlete_id=athlete_id))


# ─────────────────────────── Results ─────────────────────────────

@app.route("/results")
def results():
    all_results = models.get_results()
    athletes = models.get_athletes()
    return render_template("results.html", results=all_results, athletes=athletes)


@app.route("/results/add", methods=["POST"])
def add_result():
    models.add_result(
        athlete_id=int(request.form["athlete_id"]),
        event=request.form["event"].strip(),
        mark=request.form["mark"].strip(),
        meet=request.form.get("meet", "").strip(),
        meet_date=request.form.get("meet_date", "").strip(),
        source="manual",
    )
    flash("Result added.", "success")
    return redirect(url_for("results"))


@app.route("/results/<int:result_id>/delete", methods=["POST"])
def delete_result(result_id):
    models.delete_result(result_id)
    flash("Result deleted.", "info")
    return redirect(url_for("results"))


# ─────────────────────────── Practices ───────────────────────────

@app.route("/practices")
def practices():
    all_practices = models.get_practices()
    return render_template("practices.html", practices=all_practices)


@app.route("/practices/add", methods=["GET", "POST"])
def add_practice():
    if request.method == "POST":
        practice_id = models.add_practice(
            date=request.form["date"],
            title=request.form["title"].strip(),
            warmup=request.form.get("warmup", "").strip(),
            main_workout=request.form.get("main_workout", "").strip(),
            cooldown=request.form.get("cooldown", "").strip(),
            notes=request.form.get("notes", "").strip(),
        )
        flash("Practice created.", "success")
        return redirect(url_for("practice_attendance", practice_id=practice_id))
    return render_template("practice_form.html", practice=None)


@app.route("/practices/<int:practice_id>")
def practice_detail(practice_id):
    practice = models.get_practice(practice_id)
    if not practice:
        flash("Practice not found.", "error")
        return redirect(url_for("practices"))
    attendance = models.get_attendance(practice_id)
    return render_template("practice_detail.html", practice=practice, attendance=attendance)


@app.route("/practices/<int:practice_id>/edit", methods=["GET", "POST"])
def edit_practice(practice_id):
    practice = models.get_practice(practice_id)
    if not practice:
        flash("Practice not found.", "error")
        return redirect(url_for("practices"))
    if request.method == "POST":
        models.update_practice(
            practice_id,
            date=request.form["date"],
            title=request.form["title"].strip(),
            warmup=request.form.get("warmup", "").strip(),
            main_workout=request.form.get("main_workout", "").strip(),
            cooldown=request.form.get("cooldown", "").strip(),
            notes=request.form.get("notes", "").strip(),
        )
        flash("Practice updated.", "success")
        return redirect(url_for("practice_detail", practice_id=practice_id))
    return render_template("practice_form.html", practice=practice)


@app.route("/practices/<int:practice_id>/delete", methods=["POST"])
def delete_practice(practice_id):
    models.delete_practice(practice_id)
    flash("Practice deleted.", "info")
    return redirect(url_for("practices"))


# ─────────────────────────── Attendance ──────────────────────────

@app.route("/practices/<int:practice_id>/attendance", methods=["GET", "POST"])
def practice_attendance(practice_id):
    practice = models.get_practice(practice_id)
    if not practice:
        flash("Practice not found.", "error")
        return redirect(url_for("practices"))

    if request.method == "POST":
        athletes = models.get_athletes()
        statuses = {}
        for athlete in athletes:
            aid = str(athlete["id"])
            status = request.form.get(f"status_{aid}", "absent")
            note = request.form.get(f"note_{aid}", "")
            statuses[aid] = {"status": status, "note": note}
        models.save_attendance(practice_id, statuses)
        flash("Attendance saved.", "success")
        return redirect(url_for("practice_detail", practice_id=practice_id))

    attendance = models.get_attendance(practice_id)
    athletes = models.get_athletes()
    # Build a lookup for quick access in template
    att_map = {row["athlete_id"]: row for row in attendance}
    return render_template(
        "attendance.html",
        practice=practice,
        athletes=athletes,
        att_map=att_map,
    )


if __name__ == "__main__":
    app.run(debug=True, port=5000)
