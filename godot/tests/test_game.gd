## Test delle regole: traduzione di test/game.test.js (stessi casi, stessi controlli).
## Manca solo "sfida del giorno", che riguarda hub.js (stanze e sfide): arriverà con quel pezzo.
extends "res://tests/test_base.gd"


func tests() -> Array:
	return [
		["setup: 5 carte in mano, 45 nel mazzo, chi inizia non pesca", t_setup],
		["mazzo composto da 10 terre per tipo", t_mazzo],
		["una sola terra per turno e solo nel proprio turno", t_una_terra],
		["Isola giocata: pesca una carta", t_isola_pesca],
		["Montagna distrugge la terra avversaria", t_montagna],
		["Montagna senza bersagli si gioca comunque", t_montagna_vuoto],
		["Foresta recupera dal cimitero", t_foresta],
		["Palude: guarda la mano e scarta una terra", t_palude],
		["Pianura riattiva Montagna (bersaglio scelto alla risoluzione)", t_pianura_montagna],
		["Pianura non può bersagliare Pianure", t_pianura_pianure],
		["Pianura riattiva Isola: pesca", t_pianura_isola],
		["Contrasto: Isola + altra terra annullano la terra e il suo effetto", t_contrasto],
		["Contrasto al contrasto: la terra originale risolve", t_contrasto_doppio],
		["Lasciar risolvere", t_lascia],
		["Contrasto con due Isole", t_due_isole],
		["Finestra di risposta anche senza Isola (non rivela la mano)", t_finestra_senza_isola],
		["Vittoria con dominio", t_dominio],
		["Vittoria con 5 dello stesso tipo, prima che l'effetto si risolva", t_cinque],
		["Terra contrastata non fa vincere", t_contrastata_non_vince],
		["Mazzo vuoto: non si pesca e si continua", t_mazzo_vuoto],
		["Carte finite: vince chi ha più tipi distinti", t_carte_finite],
		["Carte finite: due passaggi consecutivi a mazzi vuoti chiudono la partita", t_due_passaggi],
		["Passaggi a mazzo pieno non chiudono la partita quando i mazzi finiscono", t_passaggi_pieno],
		["Partite casuali complete senza errori e con 100 carte conservate", t_casuali],
		["Eventi: giocata, contrasto e annullamento in ordine", t_eventi_ordine],
		["Eventi: ogni passo porta le viste di entrambi i giocatori", t_eventi_viste],
		["Tempo scaduto: passa il turno / lascia risolvere / sceglie a caso", t_tempo],
		["Prima l'effetto, poi la terra entra in gioco", t_prima_effetto],
		["Durante la scelta della Palude la terra non è ancora in gioco", t_palude_attesa],
		["resa: vince l'altro, anche fuori dal proprio turno", t_resa],
		["sfida \"cinque uguali\": le cinque diverse non fanno vincere", t_sfida_cinque],
		["sfida: terre già in gioco, tipi tolti dal mazzo e mano corta", t_sfida_setup],
		["sfida \"corsa\": chi non vince entro il turno limite perde", t_sfida_corsa],
		["stesso seme, stessa partita (servirà alla sfida del giorno)", t_seme],
		["la copia per le simulazioni non tocca la partita vera", t_clone],
	]


func t_setup():
	var g = Game.new(["A", "B"], {"firstPlayer": 1})
	eq(g.players[1].hand.size(), 5)
	eq(g.players[0].hand.size(), 5)
	eq(g.players[0].deck.size(), 45)
	eq(g.active, 1)
	is_ok(g.act(1, {"type": "pass"}))
	eq(g.players[0].hand.size(), 6, "il secondo pesca")
	return true


func t_mazzo():
	var g = Game.new(["A", "B"])
	var all = g.players[0].deck + g.players[0].hand
	for t in TYPES:
		eq(all.count(t), 10, t)
	return true


func t_una_terra():
	var g = setup({"h0": ["G", "G"], "h1": ["R"]})
	refused(g.act(1, {"type": "play", "card": "R"}))
	is_ok(g.act(0, {"type": "play", "card": "G"}))  # Bruno ha 1 carta: niente risposta, risolve
	eq(g.active, 1)
	eq(g.players[0].bf.G, 1)
	return true


func t_isola_pesca():
	var g = setup({"h0": ["U"], "deck0": ["R", "B"]})
	is_ok(g.act(0, {"type": "play", "card": "U"}))
	eq(g.players[0].hand, ["B"])
	return true


func t_montagna():
	var g = setup({"h0": ["R"], "bf1": {"G": 2}})
	refused(g.act(0, {"type": "play", "card": "R"}))  # serve bersaglio
	is_ok(g.act(0, {"type": "play", "card": "R", "target": "G"}))
	eq(g.players[1].bf.G, 1)
	eq(g.players[1].gy.G, 1)
	return true


func t_montagna_vuoto():
	var g = setup({"h0": ["R"]})
	is_ok(g.act(0, {"type": "play", "card": "R"}))
	eq(g.players[0].bf.R, 1)
	return true


func t_foresta():
	var g = setup({"h0": ["G"], "gy0": {"B": 1}})
	is_ok(g.act(0, {"type": "play", "card": "G", "target": "B"}))
	eq(g.players[0].gy.B, 0)
	check(g.players[0].hand.has("B"), "la Palude doveva tornare in mano")
	return true


func t_palude():
	var g = setup({"h0": ["B"], "h1": ["U"]})
	is_ok(g.act(0, {"type": "play", "card": "B"}))
	eq(g.step, "choice")
	eq(g.view(0).choice.revealed, ["U"])
	check(not g.view(1).choice.has("revealed"), "l'avversario non deve vedere la propria mano rivelata")
	is_ok(g.act(0, {"type": "choose", "choice": "U"}))
	eq(g.players[1].gy.U, 1)
	eq(g.active, 1)
	return true


func t_pianura_montagna():
	var g = setup({"h0": ["W"], "bf0": {"R": 1}, "bf1": {"U": 1, "B": 1}})
	is_ok(g.act(0, {"type": "play", "card": "W", "target": "R"}))
	eq(g.step, "choice")
	eq(g.choice.options, ["U", "B"])
	is_ok(g.act(0, {"type": "choose", "choice": "B"}))
	eq(g.players[1].bf.B, 0)
	return true


func t_pianura_pianure():
	var g = setup({"h0": ["W"], "bf0": {"W": 2}})
	eq(g.targets_for(0, "W"), [])
	is_ok(g.act(0, {"type": "play", "card": "W"}))
	return true


func t_pianura_isola():
	var g = setup({"h0": ["W"], "bf0": {"U": 1}, "deck0": ["G"]})
	is_ok(g.act(0, {"type": "play", "card": "W", "target": "U"}))
	eq(g.players[0].hand, ["G"])
	return true


func t_contrasto():
	var g = setup({"h0": ["R"], "h1": ["U", "G", "B"], "bf1": {"W": 1}})
	is_ok(g.act(0, {"type": "play", "card": "R", "target": "W"}))
	eq(g.step, "response")
	eq(g.view(1).counterOthers, ["B", "G"])
	is_ok(g.act(1, {"type": "counter", "other": "G"}))
	# Anna ha 0 carte: non può controbattere → risolve
	eq(g.players[0].bf.R, 0)
	eq(g.players[0].gy.R, 1)
	eq(g.players[1].bf.W, 1)
	eq(g.players[1].gy, {"W": 0, "U": 1, "B": 0, "R": 0, "G": 1})
	eq(g.active, 1)
	return true


func t_contrasto_doppio():
	var g = setup({"h0": ["R", "U", "W"], "h1": ["U", "G"], "bf1": {"W": 1}})
	is_ok(g.act(0, {"type": "play", "card": "R", "target": "W"}))
	is_ok(g.act(1, {"type": "counter", "other": "G"}))
	eq(g.pending.responder, 0)
	is_ok(g.act(0, {"type": "counter", "other": "W"}))
	eq(g.players[0].bf.R, 1)
	eq(g.players[1].bf.W, 0)
	return true


func t_lascia():
	var g = setup({"h0": ["G"], "h1": ["U", "U"]})
	is_ok(g.act(0, {"type": "play", "card": "G"}))
	is_ok(g.act(1, {"type": "allow"}))
	eq(g.players[0].bf.G, 1)
	return true


func t_due_isole():
	var g = setup({"h0": ["G"], "h1": ["U", "U"]})
	is_ok(g.act(0, {"type": "play", "card": "G"}))
	is_ok(g.act(1, {"type": "counter", "other": "U"}))
	eq(g.players[1].gy.U, 2)
	return true


func t_finestra_senza_isola():
	var g = setup({"h0": ["G"], "h1": ["R", "B"]})
	is_ok(g.act(0, {"type": "play", "card": "G"}))
	eq(g.step, "response")
	eq(g.view(1).counterOthers, [])
	refused(g.act(1, {"type": "counter", "other": "R"}))
	return true


func t_dominio():
	var g = setup({"h0": ["G"], "bf0": {"W": 1, "U": 1, "B": 1, "R": 1}})
	is_ok(g.act(0, {"type": "play", "card": "G"}))
	eq(g.phase, "over")
	eq(g.winner, 0)
	return true


func t_cinque():
	var g = setup({"h0": ["R"], "bf0": {"R": 4}, "bf1": {"G": 1}})
	is_ok(g.act(0, {"type": "play", "card": "R", "target": "G"}))
	eq(g.winner, 0)
	eq(g.players[1].bf.G, 1)
	return true


func t_contrastata_non_vince():
	var g = setup({"h0": ["G"], "h1": ["U", "B"], "bf0": {"W": 1, "U": 1, "B": 1, "R": 1}})
	is_ok(g.act(0, {"type": "play", "card": "G"}))
	is_ok(g.act(1, {"type": "counter", "other": "B"}))
	eq(g.phase, "playing")
	return true


func t_mazzo_vuoto():
	var g = setup({"h0": ["G"], "h1": ["R"], "deck0": [], "deck1": ["W"]})
	is_ok(g.act(0, {"type": "pass"}))
	eq(g.players[1].hand.size(), 2)
	is_ok(g.act(1, {"type": "pass"}))
	eq(g.phase, "playing")
	eq(g.active, 0)
	return true


func t_carte_finite():
	var g = setup({"h0": ["G"], "h1": [], "deck0": [], "deck1": [], "bf0": {"W": 1}, "bf1": {"W": 1, "U": 1}})
	is_ok(g.act(0, {"type": "play", "card": "G"}))
	# Bruno: mano vuota, mazzo vuoto → passa da solo; poi Anna: mani entrambe vuote → fine
	eq(g.phase, "over")
	eq(g.end_reason, "cards")
	# 2 tipi a 2: parità, vince chi ha giocato l'ultima terra (Anna)
	eq(g.winner, 0)
	return true


func t_due_passaggi():
	var g = setup({"h0": ["U"], "h1": ["U"], "deck0": [], "deck1": [], "bf0": {"W": 1, "R": 1, "G": 1}, "bf1": {"B": 1}})
	is_ok(g.act(0, {"type": "pass"}))
	is_ok(g.act(1, {"type": "pass"}))
	eq(g.phase, "over")
	eq(g.winner, 0)
	return true


func t_passaggi_pieno():
	var g = setup({"h0": ["B", "B"], "h1": ["B", "B"], "deck0": [], "deck1": ["G"]})
	is_ok(g.act(0, {"type": "pass"}))
	is_ok(g.act(1, {"type": "pass"}))  # Bruno ha pescato l'ultima carta
	eq(g.phase, "playing")
	return true


func t_casuali():
	for n in 2000:
		var g = Game.new(["A", "B"])
		var guard := 0
		while g.phase == "playing" and guard < 2000:
			guard += 1
			var p: int = g.actor()
			var v = g.view(p)
			var a: Dictionary
			if g.step == "main":
				var cards = v.playable.keys()
				if cards.is_empty() or randf() < 0.1:
					a = {"type": "pass"}
				else:
					var c = cards[randi() % cards.size()]
					var t = v.playable[c]
					a = {"type": "play", "card": c}
					if t != null and not t.is_empty():
						a.target = t[randi() % t.size()]
			elif g.step == "response":
				if not v.counterOthers.is_empty() and randf() < 0.5:
					a = {"type": "counter", "other": v.counterOthers[0]}
				else:
					a = {"type": "allow"}
			else:
				a = {"type": "choose", "choice": v.choice.options[0]}
			var r = g.act(p, a)
			if r != null:
				failures.append("partita %d: azione rifiutata %s → %s" % [n, str(a), r])
				return true
			var total := 0
			for pl in g.players:
				total += pl.deck.size() + pl.hand.size()
				for ty in TYPES:
					total += pl.bf[ty] + pl.gy[ty]
			if g.pending != null and g.phase == "playing" and g.step == "response":
				total += 1
			if g.resolving != null:
				total += 1  # terra che sta risolvendo l'effetto
			if total != 100:
				failures.append("partita %d: %d carte invece di 100" % [n, total])
				return true
		if g.phase != "over":
			failures.append("partita %d non terminata" % n)
			return true
	return true


func _event_types(g) -> Array:
	return g.take_events().map(func(e): return e.ev.type)


func t_eventi_ordine():
	var g = setup({"h0": ["R"], "h1": ["U", "G"], "bf1": {"W": 1}})
	g.take_events()
	is_ok(g.act(0, {"type": "play", "card": "R", "target": "W"}))
	is_ok(g.act(1, {"type": "counter", "other": "G"}))
	var types := _event_types(g)
	eq(types.slice(0, 3), ["play", "counter", "countered"])
	check(types.has("turn") and types.has("draw"), "mancano turno o pescata: %s" % str(types))
	return true


func t_eventi_viste():
	var g = setup({"h0": ["U"], "deck0": ["B"]})
	g.take_events()
	is_ok(g.act(0, {"type": "play", "card": "U"}))
	var draw = null
	for e in g.take_events():
		if e.ev.type == "draw" and e.ev.player == 0:
			draw = e
			break
	check(draw != null, "manca la pescata")
	if draw == null:
		return true
	eq(draw.ev.card, "B")
	eq(draw.views[0].hand, ["B"])
	eq(draw.views[1].opp.handCount, 1)
	return true


func t_tempo():
	var g = setup({"h0": ["B", "R"], "h1": ["U", "G"]})
	g.auto_act()  # P0 in main → passa
	eq(g.active, 1)
	is_ok(g.act(1, {"type": "play", "card": "G"}))
	eq(g.step, "response")
	g.auto_act()  # P0 deve rispondere → lascia risolvere
	eq(g.players[1].bf.G, 1)
	is_ok(g.act(0, {"type": "play", "card": "B"}))
	if g.step == "response":
		g.auto_act()
	eq(g.step, "choice")
	g.auto_act()
	eq(g.active, 1)
	return true


func t_prima_effetto():
	var g = setup({"h0": ["R"], "bf1": {"G": 1}})
	g.take_events()
	is_ok(g.act(0, {"type": "play", "card": "R", "target": "G"}))
	var types := _event_types(g)
	check(types.find("destroy") != -1 and types.find("destroy") < types.find("enter"), ",".join(types))
	return true


func t_palude_attesa():
	var g = setup({"h0": ["B"], "h1": ["G"]})
	is_ok(g.act(0, {"type": "play", "card": "B"}))
	eq(g.step, "choice")
	eq(g.players[0].bf.B, 0)
	eq(g.view(0).resolving, {"owner": 0, "land": "B", "target": null})
	is_ok(g.act(0, {"type": "choose", "choice": "G"}))
	eq(g.players[0].bf.B, 1)
	return true


func t_resa():
	var g = Game.new(["Anna", "Bruno"], {"firstPlayer": 0})
	is_ok(g.act(1, {"type": "surrender"}))
	eq(g.phase, "over")
	eq(g.winner, 0)
	eq(g.end_reason, "surrender")
	return true


func t_sfida_cinque():
	var g = Game.new(["Anna", "Bruno"], {"firstPlayer": 0, "onlyFive": [true, false]})
	g.players[0]["hand"] = ["G", "W"]
	g.players[0]["bf"] = count({"W": 1, "U": 1, "B": 1, "R": 1})
	is_ok(g.act(0, {"type": "play", "card": "G"}))
	if g.step == "response":
		is_ok(g.act(1, {"type": "allow"}))
	eq(g.phase, "playing")
	g.players[0]["bf"] = count({"G": 4})
	eq(g.has_won(0), false)
	g.players[0].bf.G = 5
	eq(g.has_won(0), true)
	return true


func t_sfida_setup():
	var g = Game.new(["Anna", "Bruno"], {"firstPlayer": 0, "setup": [{"without": ["U"], "hand": 3}, {"bf": {"W": 1, "U": 1}}]})
	var a = g.players[0]
	var b = g.players[1]
	eq(a.hand.size(), 3)
	check(not (a.hand + a.deck).has("U"), "non dovevano esserci Isole")
	eq(a.hand.size() + a.deck.size(), 40)
	eq([b.bf.W, b.bf.U], [1, 1])
	eq(b.hand.size() + b.deck.size(), 48)
	return true


func t_sfida_corsa():
	var g = Game.new(["Anna", "Bruno"], {"firstPlayer": 0, "turnLimit": {"turn": 4, "loser": 0}})
	var guard := 0
	while g.phase == "playing" and guard < 20:
		guard += 1
		is_ok(g.act(g.actor(), simple_action(g)))
	eq(g.phase, "over")
	eq(g.winner, 1)
	eq(g.end_reason, "limit")
	eq(g.turn, 4)
	return true


func t_seme():
	var a = Game.new(["A", "B"], {"seed": 20261116})
	var b = Game.new(["A", "B"], {"seed": 20261116})
	eq(a.players[0].hand + a.players[0].deck, b.players[0].hand + b.players[0].deck)
	eq(a.players[1].hand + a.players[1].deck, b.players[1].hand + b.players[1].deck)
	eq(a.first_player, b.first_player)
	return true


func t_clone():
	var g = setup({"h0": ["B", "G"], "h1": ["U", "R"], "bf1": {"W": 1}})
	var c = g.clone()
	is_ok(c.act(0, {"type": "play", "card": "B"}))
	eq(g.players[0].hand, ["B", "G"])
	eq(g.step, "main")
	eq(c.log_lines, [])
	eq(c.events, [])
	return true
