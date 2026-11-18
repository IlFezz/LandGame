## Test di sfide, sfida del giorno, tutorial, statistiche e obiettivi.
extends "res://tests/test_base.gd"

const Modes := preload("res://scripts/app/modes.gd")
const Profile := preload("res://scripts/app/profile.gd")
const TEST_NAME := "zz prova automatica"


func tests() -> Array:
	return [
		["numeri con seme identici a hub.js", t_seeded],
		["sfida del giorno: stesse mani della versione web", t_daily],
		["tutorial: mazzi preparati come in hub.js", t_tutorial],
		["sfide: tutte si giocano fino in fondo", t_challenges],
		["statistiche e obiettivi a fine partita", t_stats],
		["le sfide non contano per statistiche e obiettivi", t_challenge_stats],
		["codice di trasferimento: esporta e importa", t_transfer],
	]


func t_seeded():
	var r := Modes.seeded("atlas-2026-11-16")
	var want := [0.7065617411863059, 0.2020993735641241, 0.7206164614763111, 0.9118902301415801, 0.09584029414691031]
	for i in 5:
		var v: float = r.call()
		check(absf(v - want[i]) < 1e-12, "numero %d: %f invece di %f" % [i, v, want[i]])
	return true


func t_daily():
	# stessa partita del sito (valori presi da game.js + hub.js per il 2026-11-16)
	var g = Game.new(["A", "B"], Modes.daily_opts("2026-11-16"))
	eq("".join(g.players[0].hand), "RWRU")
	eq("".join(g.players[1].hand), "RRRG")
	eq(g.players[0].bf, {"W": 0, "U": 1, "B": 1, "R": 0, "G": 0})
	eq(g.players[1].bf, {"W": 1, "U": 0, "B": 1, "R": 0, "G": 0})
	eq("".join(g.players[0].deck.slice(-5)), "WBGGB")
	eq("".join(g.players[1].deck.slice(-5)), "UBBBB")
	# situazione e carte del giorno identiche al sito per 60 giorni (tests/daily_fixture.json, da hub.js)
	var fx: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://tests/daily_fixture.json"))
	var started := 0
	for day in fx.scenari:
		var want: Dictionary = Game._ints(fx.scenari[day])
		var got := Modes.daily_scenario(day)
		eq(got, want, day)
		if got.started:
			started += 1
		var dg = Game.new(["A", "B"], Modes.daily_opts(day))
		eq(dg.players.map(func(p): return "".join(p.hand) + "|" + "".join(p.deck.slice(-5))), fx.mani[day], day + " mani")
	check(started > 20 and started < 60, "ci sono sia giorni da zero sia partite avviate")
	return true


func t_tutorial():
	var g = Game.new(["Tu", "Maestro"], Modes.tutorial_opts())
	eq("".join(g.players[0].hand), "UGRWB")
	eq("".join(g.players[1].hand), "RBRWG")
	eq(g.players[0].deck.size(), 45)
	# il Maestro al turno 2 gioca la Montagna sull'Isola
	is_ok(g.act(0, {"type": "play", "card": "U"}))
	eq(Modes.tutorial_bot_move(g), {"type": "allow"})
	is_ok(g.act(1, {"type": "allow"}))
	var a = Modes.tutorial_bot_move(g)
	eq(a, {"type": "play", "card": "R", "target": "U"})
	return true


func t_challenges():
	for c in Modes.CHALLENGES:
		var g = Game.new(["Tu", "BOT"], c.opts)
		var bots := [Bot.new(g, 0), Bot.new(g, 1, {"level": c.level, "rounds": 4, "budget": 5})]
		var guard := 0
		while g.phase == "playing" and guard < 500:
			guard += 1
			var p: int = g.actor()
			is_ok(g.act(p, bots[p].decide()))
		eq(g.phase, "over", c.id)
	return true


func _play_cur(mode: String) -> Dictionary:
	var cur := Profile.fresh(mode)
	Profile.track(cur, {"type": "play", "player": 0, "card": "G"}, 0)
	Profile.track(cur, {"type": "counter", "player": 0, "n": 2}, 0)
	Profile.track(cur, {"type": "destroy", "by": 0, "player": 1, "card": "W"}, 0)
	return cur


func t_stats():
	Profile.remove(TEST_NAME)
	var got := Profile.finish(_play_cur("hard"), {"name": TEST_NAME, "won": true, "winner_null": false,
		"bf": {"W": 0, "U": 0, "B": 0, "R": 0, "G": 5}, "reason": "combo", "turn": 9})
	for id in ["prima", "cinqueuguali", "cinqueforeste", "controcontrasto", "lampo", "difficile"]:
		check(got.has(id), "obiettivo %s" % id)
	check(not got.has("dominio"), "niente dominio")
	var s := Profile.load_profile(TEST_NAME)
	eq(s.cpu.played, 1)
	eq(s.cpu.won, 1)
	eq(s.cpu.modes.hard.w, 1)
	eq(s.cpu.winBy.five, 1)
	eq(s.cpu.fastest, 9)
	eq(s.cpu.lands.G, 1)
	check(Profile.unlocked(s, "table", "aurora"), "cielo Aurora sbloccato")
	check(not Profile.unlocked(s, "table", "stellata"), "Notte stellata ancora chiusa")
	# una sconfitta azzera la serie
	Profile.finish(Profile.fresh("normal"), {"name": TEST_NAME, "won": false, "winner_null": false,
		"bf": Game.empty_count(), "reason": "combo", "turn": 20})
	s = Profile.load_profile(TEST_NAME)
	eq(s.cpu.streak, 0)
	eq(s.cpu.lost, 1)
	Profile.remove(TEST_NAME)
	return true


func t_challenge_stats():
	Profile.remove(TEST_NAME)
	var cur := Profile.fresh("challenge", "corsa")
	var got := Profile.finish(cur, {"name": TEST_NAME, "won": true, "winner_null": false,
		"bf": {"W": 1, "U": 1, "B": 1, "R": 1, "G": 1}, "reason": "combo", "turn": 12})
	eq(got, [])
	var s := Profile.load_profile(TEST_NAME)
	eq(s.cpu.played, 0, "statistiche pulite")
	eq(s.challenges.corsa, 12, "record della sfida")
	Profile.finish(Profile.fresh("daily", null, "2026-11-16"), {"name": TEST_NAME, "won": true, "winner_null": false,
		"bf": {"W": 1, "U": 1, "B": 1, "R": 1, "G": 1}, "reason": "combo", "turn": 15})
	eq(Profile.load_profile(TEST_NAME).daily["2026-11-16"], 15)
	Profile.remove(TEST_NAME)
	return true


func t_transfer():
	Profile.remove(TEST_NAME)
	Profile.finish(_play_cur("normal"), {"name": TEST_NAME, "won": true, "winner_null": false,
		"bf": {"W": 1, "U": 1, "B": 1, "R": 1, "G": 1}, "reason": "combo", "turn": 14})
	var code := Profile.export_code(TEST_NAME)
	check(code.begins_with("ATLAS1-"), "formato del codice")
	Profile.remove(TEST_NAME)
	eq(Profile.import_code(code), TEST_NAME)
	eq(Profile.load_profile(TEST_NAME).cpu.won, 1)
	eq(Profile.import_code("ciao"), "", "codice non valido")
	Profile.remove(TEST_NAME)
	return true
