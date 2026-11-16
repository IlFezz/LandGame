## Test del computer: traduzione di test/bot.test.js (scelte sensate in situazioni chiave
## e partite complete). La parte "partita attraverso il server" arriverà con il gioco in rete.
extends "res://tests/test_base.gd"


func tests() -> Array:
	return [
		["gioca la terra che fa vincere", t_vittoria],
		["contrasta sempre una terra che fa vincere l'avversario", t_contrasta_vittoria],
		["non spreca il contrasto su un'Isola innocua a inizio partita", t_non_spreca],
		["la Montagna distrugge la terra che spezza il dominio avversario", t_montagna],
		["con la Palude fa scartare la terra che darebbe la vittoria", t_palude],
		["per contrastare scarta la carta meno utile", t_scarto],
		["non gioca la Montagna a vuoto se ha di meglio", t_montagna_vuoto],
		["il difficile gioca solo mosse valide e trova la vittoria", t_difficile],
		["batte quasi sempre un giocatore casuale", t_contro_casuale],
		["il livello normale batte spesso il facile", t_normale_facile],
		["tempo di pensiero del difficile", t_tempo_difficile],
		["il difficile pensa su un thread e risponde con un segnale", t_async],
	]


func bot_setup(o := {}):
	return setup(o, ["Umano", "Bot"])


func bot_turn(g) -> void:
	g.active = 1
	g.step = "main"
	g.land_played = false


func t_vittoria():
	var g = bot_setup({"h1": ["R", "G", "U"], "bf1": {"W": 1, "U": 1, "B": 1, "R": 1}, "bf0": {"G": 1}})
	bot_turn(g)
	eq(Bot.new(g, 1).decide(), {"type": "play", "card": "G"})
	return true


func t_contrasta_vittoria():
	var g = bot_setup({"h0": ["G"], "h1": ["U", "W"], "bf0": {"W": 1, "U": 1, "B": 1, "R": 1}})
	is_ok(g.act(0, {"type": "play", "card": "G"}))
	eq(Bot.new(g, 1).decide().type, "counter")
	return true


func t_non_spreca():
	var g = bot_setup({"h0": ["U", "W"], "h1": ["U", "B", "R"]})
	is_ok(g.act(0, {"type": "play", "card": "U"}))
	eq(Bot.new(g, 1).decide(), {"type": "allow"})
	return true


func t_montagna():
	var g = bot_setup({"h1": ["R"], "bf0": {"W": 1, "U": 1, "B": 1, "G": 3}})
	bot_turn(g)
	var a = Bot.new(g, 1).decide()
	eq(a.card, "R")
	check(["W", "U", "B"].has(a.get("target")), "bersaglio " + str(a.get("target")))
	return true


func t_palude():
	var g = bot_setup({"h0": ["G", "W"], "h1": ["B"], "bf0": {"W": 1, "U": 1, "B": 1, "R": 1}})
	bot_turn(g)
	is_ok(g.act(1, {"type": "play", "card": "B"}))
	if g.step == "response":
		is_ok(g.act(0, {"type": "allow"}))
	eq(g.step, "choice")
	eq(Bot.new(g, 1).decide(), {"type": "choose", "choice": "G"})
	return true


func t_scarto():
	var g = bot_setup({"h0": ["G"], "h1": ["U", "G", "W"], "bf0": {"W": 1, "U": 1, "B": 1, "R": 1}, "bf1": {"W": 1, "U": 1, "B": 1, "R": 1}})
	is_ok(g.act(0, {"type": "play", "card": "G"}))
	var a = Bot.new(g, 1).decide()
	eq(a.type, "counter")
	eq(a.get("other"), "W", "tiene la Foresta che gli darà la vittoria")
	return true


func t_montagna_vuoto():
	var g = bot_setup({"h1": ["R", "G"], "bf1": {"W": 1}, "gy1": {"B": 1}})
	bot_turn(g)
	eq(Bot.new(g, 1).decide().card, "G")
	return true


func _play_out(g, bots: Array) -> void:
	while g.phase == "playing":
		var p: int = g.actor()
		var a = bots[p].decide()
		var r = g.act(p, a)
		if r != null:
			failures.append("mossa non valida %s → %s" % [str(a), r])
			return


func t_difficile():
	var g = bot_setup({"h1": ["R", "G", "U"], "bf1": {"W": 1, "U": 1, "B": 1, "R": 1}, "bf0": {"G": 1}})
	bot_turn(g)
	eq(Bot.new(g, 1, {"level": "hard", "budget": 5, "rounds": 4}).decide().card, "G")
	for i in 6:
		var g2 = Game.new(["D", "N"])
		_play_out(g2, [Bot.new(g2, 0, {"level": "hard", "budget": 3, "rounds": 6}), Bot.new(g2, 1)])
	return true


func t_contro_casuale():
	var w := 0
	for i in 300:
		var g = Game.new(["B", "R"])
		var bot = Bot.new(g, 0)
		while g.phase == "playing":
			var p: int = g.actor()
			var a: Dictionary
			if p == 0:
				a = bot.decide()
			else:
				var v = g.view(1)
				if g.step == "main":
					var cs = v.playable.keys()
					if cs.is_empty():
						a = {"type": "pass"}
					else:
						var c = cs[randi() % cs.size()]
						a = {"type": "play", "card": c}
						if v.playable[c] != null and not v.playable[c].is_empty():
							a.target = v.playable[c][0]
				elif g.step == "response":
					a = {"type": "allow"}
				else:
					a = {"type": "choose", "choice": v.choice.options[0]}
			var r = g.act(p, a)
			if r != null:
				failures.append("mossa non valida %s → %s" % [str(a), r])
				return true
		if g.winner == 0:
			w += 1
	check(w > 250, "vittorie %d/300" % w)
	print("        vittorie contro il casuale: %d/300" % w)
	return true


func t_normale_facile():
	var w := 0
	for i in 300:
		var g = Game.new(["N", "F"])
		_play_out(g, [Bot.new(g, 0), Bot.new(g, 1, {"level": "easy"})])
		if g.winner == 0:
			w += 1
	check(w > 180, "vittorie del normale %d/300" % w)
	print("        vittorie del normale sul facile: %d/300" % w)
	return true


## Non c'è nella versione web: quanto pensa il difficile in GDScript. Con le impostazioni
## normali fa almeno 80 giri di simulazione (come il browser in 120 ms), ma mai oltre un secondo.
func t_tempo_difficile():
	var g = Game.new(["D", "N"], {"firstPlayer": 0})
	var bot = Bot.new(g, 0, {"level": "hard"})
	var worst := 0
	var total := 0
	var rounds := 0
	var n := 0
	for k in 6:
		if g.phase != "playing" or g.actor() != 0:
			break
		bot.last_rounds = 0
		var t0 := Time.get_ticks_msec()
		var a = bot.decide()
		var ms := Time.get_ticks_msec() - t0
		if bot.last_rounds > 0:
			worst = max(worst, ms)
			total += ms
			rounds += bot.last_rounds
			n += 1
		is_ok(g.act(0, a))
		while g.phase == "playing" and g.actor() == 1:
			is_ok(g.act(1, Bot.new(g, 1).decide()))
	if n > 0:
		print("        difficile: %d decisioni pensate, media %d ms e %d giri, peggiore %d ms" % [n, total / n, rounds / n, worst])
	check(worst < 1200, "una decisione ha richiesto %d ms" % worst)
	return true


func t_async():
	var g = bot_setup({"h1": ["R", "G", "U", "B"], "bf1": {"W": 1}, "bf0": {"G": 1, "U": 1}})
	bot_turn(g)
	var bot = Bot.new(g, 1, {"level": "hard", "budget": 20, "rounds": 10})
	var got := []
	bot.decided.connect(func(a): got.append(a))
	bot.decide_async()
	# il segnale arriva sul thread principale, a uno dei fotogrammi successivi
	var t0 := Time.get_ticks_msec()
	while got.is_empty() and Time.get_ticks_msec() - t0 < 5000:
		await Engine.get_main_loop().process_frame
	check(not got.is_empty(), "il segnale non è arrivato")
	if not got.is_empty():
		var c = g.clone()
		is_ok(c.act(1, got[0]))
	return true
