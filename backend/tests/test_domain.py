"""Mirrors src/domain/domain.test.ts so the web app and the API agree on every rule."""

from datetime import UTC, date, datetime

from app import domain as d

TODAY = date(2026, 11, 24)  # Tuesday


def D(s: str) -> date:
    return date.fromisoformat(s)


def goal(start: str, target: float = 120, preset: d.SchedulePreset = "daily", unit: str = "minutes") -> d.Goal:
    p, days = d.make_schedule(preset)
    return d.Goal(effective_date=D(start), target_value=target, unit=unit, schedule_preset=p, schedule_days=days)


def habit(start: str, *extra: d.Goal, **kw) -> d.HabitRules:
    return d.HabitRules(start_date=D(start), goals=[goal(start, **kw), *extra])


def logs(entries: dict[str, float]) -> dict[date, float]:
    return {D(k): v for k, v in entries.items()}


# ---------------------------------------------------------------- dates


def test_weekday_matches_javascript():
    assert d.weekday(D("2026-11-22")) == 0  # Sunday
    assert d.weekday(D("2026-11-24")) == 2  # Tuesday
    assert d.weekday(D("2024-02-29")) == 4  # Thursday, leap day


def test_today_follows_the_users_time_zone():
    now = datetime(2026, 11, 25, 3, 30, tzinfo=UTC)  # 22:30 on the 24th in Detroit
    assert d.today_in("America/Detroit", now) == D("2026-11-24")
    assert d.today_in("Asia/Tokyo", now) == D("2026-11-25")
    assert d.today_in("Not/AZone", now) == D("2026-11-25")  # falls back to UTC


# ---------------------------------------------------------------- scheduling


def test_resolves_presets():
    assert d.make_schedule("weekdays")[1] == (1, 2, 3, 4, 5)
    assert d.make_schedule("weekends")[1] == (0, 6)
    assert d.make_schedule("custom", [5, 1, 1, 3])[1] == (1, 3, 5)
    assert d.normalize_schedule([6, 0])[0] == "weekends"


def test_picks_goal_version_effective_on_a_date():
    h = habit("2026-01-01", goal("2026-06-01", 60, "weekdays"))
    assert d.goal_for(h, D("2026-05-31")).target_value == 120
    assert d.goal_for(h, D("2026-06-01")).target_value == 60
    assert d.goal_for(h, D("2025-01-01")).target_value == 120


def test_appends_replaces_and_collapses_goal_versions():
    base = habit("2026-01-01").goals
    changed = d.apply_goal_change(base, goal("2026-03-01", 90))
    assert len(changed) == 2
    again = d.apply_goal_change(changed, goal("2026-03-01", 100))
    assert len(again) == 2 and again[1].target_value == 100
    assert d.apply_goal_change(again, goal("2026-03-05", 100)) is again
    assert len(d.apply_goal_change(again, goal("2026-03-01", 120))) == 1


def test_rebase_moves_first_version_to_new_start():
    goals = [goal("2026-01-01", 120), goal("2026-03-01", 90)]
    later = d.rebase_goals(goals, D("2026-02-01"))
    assert [g.effective_date for g in later] == [D("2026-02-01"), D("2026-03-01")]
    assert later[0].target_value == 120
    past_change = d.rebase_goals(goals, D("2026-04-01"))
    assert len(past_change) == 1 and past_change[0].target_value == 90
    earlier = d.rebase_goals(goals, D("2025-12-01"))
    assert [g.effective_date for g in earlier] == [D("2025-12-01"), D("2026-03-01")]


# ---------------------------------------------------------------- evaluateDay


def test_maps_progress_to_statuses():
    h = habit("2026-11-01")
    l = logs({"2026-11-10": 60, "2026-11-11": 120, "2026-11-12": 150})
    status = lambda s: d.evaluate_day(h, l.get(D(s)), D(s), TODAY).status  # noqa: E731
    assert status("2026-11-09") == "missed"
    assert status("2026-11-10") == "partial"
    assert status("2026-11-11") == "done"
    assert status("2026-11-12") == "exceeded"


def test_never_marks_today_future_or_pre_start_as_missed():
    h = habit("2026-11-01")
    assert d.evaluate_day(h, None, TODAY, TODAY).status == "pending"
    assert d.evaluate_day(h, None, D("2026-11-25"), TODAY).status == "future"
    assert d.evaluate_day(h, None, D("2026-10-31"), TODAY).status == "before-start"


def test_unscheduled_days_are_rest():
    wk = habit("2026-11-01", preset="weekdays")
    day = d.evaluate_day(wk, None, D("2026-11-22"), TODAY)
    assert day.status == "rest" and not day.eligible


def test_float_noise():
    hrs = habit("2026-11-01", target=2, unit="hours")
    assert d.evaluate_day(hrs, 1.1 + 0.9, D("2026-11-20"), TODAY).status == "done"


def test_past_days_use_the_goal_that_applied_then():
    h = habit("2026-11-01", goal("2026-11-15", 60))
    assert d.evaluate_day(h, 90, D("2026-11-10"), TODAY).status == "partial"
    assert d.evaluate_day(h, 90, D("2026-11-20"), TODAY).status == "exceeded"


# ---------------------------------------------------------------- consistency


def test_consistency_ignores_unfinished_today():
    s = d.compute_stats(habit("2026-11-20"), logs({"2026-11-20": 120, "2026-11-21": 60, "2026-11-23": 200}), TODAY)
    assert (s.eligible_days, s.completed_days, s.partial_days, s.missed_days) == (4, 2, 1, 1)
    assert s.consistency == 50


def test_consistency_includes_today_once_complete():
    s = d.compute_stats(habit("2026-11-23"), logs({"2026-11-23": 120, "2026-11-24": 120}), TODAY)
    assert s.eligible_days == 2 and s.consistency == 100


def test_consistency_excludes_unscheduled_days():
    s = d.compute_stats(habit("2026-11-21", preset="weekdays"), logs({"2026-11-23": 120}), TODAY)
    assert s.eligible_days == 1 and s.consistency == 100


def test_consistency_is_none_when_nothing_is_eligible():
    assert d.compute_stats(habit("2026-11-24"), {}, TODAY).consistency is None
    assert d.compute_stats(habit("2026-12-01"), {}, TODAY).consistency is None


def test_goal_increase_keeps_history():
    before = habit("2026-11-20", target=60)
    l = logs({"2026-11-20": 60, "2026-11-21": 60, "2026-11-22": 60, "2026-11-23": 60})
    assert d.compute_stats(before, l, TODAY).consistency == 100
    after = d.HabitRules(before.start_date, d.apply_goal_change(before.goals, goal("2026-11-24", 120)))
    assert d.compute_stats(after, l, TODAY).consistency == 100


# ---------------------------------------------------------------- streaks


def test_unfinished_today_does_not_break_streak():
    h = habit("2026-11-20")
    base = {"2026-11-21": 120, "2026-11-22": 120, "2026-11-23": 120}
    s = d.compute_stats(h, logs(base), TODAY)
    assert (s.current_streak, s.longest_streak) == (3, 3)
    assert d.compute_stats(h, logs({**base, "2026-11-24": 30}), TODAY).current_streak == 3
    assert d.compute_stats(h, logs({**base, "2026-11-24": 120}), TODAY).current_streak == 4


def test_streak_skips_rest_days():
    h = habit("2026-11-19", preset="weekdays")
    s = d.compute_stats(h, logs({"2026-11-19": 120, "2026-11-20": 120, "2026-11-23": 120}), TODAY)
    assert s.current_streak == 3


def test_streak_breaks_on_partial_or_missed():
    h = habit("2026-11-10")
    l = logs(
        {
            "2026-11-10": 120, "2026-11-11": 120, "2026-11-12": 120, "2026-11-13": 120,
            "2026-11-14": 50,
            "2026-11-15": 120, "2026-11-16": 120,
            "2026-11-18": 120, "2026-11-19": 120, "2026-11-20": 120, "2026-11-21": 120,
            "2026-11-22": 130, "2026-11-23": 120,
        }
    )  # fmt: skip
    s = d.compute_stats(h, l, TODAY)
    assert (s.current_streak, s.longest_streak) == (6, 6)
    s = d.compute_stats(h, logs({"2026-11-10": 120, "2026-11-11": 120, "2026-11-12": 120}), TODAY)
    assert (s.current_streak, s.longest_streak) == (0, 3)


def test_everything_in_one_pass():
    s = d.compute_stats(habit("2026-11-22"), logs({"2026-11-22": 120, "2026-11-23": 120, "2026-11-24": 40}), TODAY)
    assert s.current_streak == 2 and s.consistency == 100 and s.today_status == "partial"
