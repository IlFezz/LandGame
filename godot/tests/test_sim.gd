## Test della simulazione veloce (sim.gd): deve seguire le stesse regole di game.gd
## e fare le stesse scelte del computer normale di bot.gd.
extends "res://tests/test_base.gd"

const Sim := preload("res://scripts/rules/sim.gd")


func tests() -> Array:
	return [
		["stesse regole della partita vera, mossa per mossa (300 partite casuali)", t_regole],
		["stesse scelte del computer normale, in ogni situazione (300 partite)", t_scelte],
		["le carte nascoste si rimescolano, quelle viste no", t_determinize],
		["mosse non valide rifiutate", t_non_valide],
	]


static func game_state(g) -> Dictionary:
	var hand := []
	var bf := []
	var gy := []
	for p in 2:
		for t in TYPES:
			hand.append(g.players[p].hand.count(t))
			bf.append(g.players[p].bf[t])
			gy.append(g.players[p].gy[t])
	var d := [[], []]
	for p in 2:
		for c in g.players[p].deck:
			d[p].append(Sim.IDX[c])
	var a = g.actor()
	return {"hand": hand, "bf": bf, "gy": gy, "d0": d[0], "d1": d[1],
		"over": g.phase != "playing", "actor": a if a != null else -1,
		"winner": g.winner if g.winner != null and g.phase != "playing" else -1,
		"turn": g.turn, "step": g.step if g.phase == "playing" else "over"}


static func sim_state(s) -> Dictionary:
	var steps := {Sim.MAIN: "main", Sim.RESPONSE: "response", Sim.CHOICE: "choice", Sim.OVER: "over"}
	return {"hand": Array(s.hand), "bf": Array(s.bf), "gy": Array(s.gy), "d0": Array(s.d0), "d1": Array(s.d1),
		"over": s.step == Sim.OVER, "actor": s.actor(),
		"winner": s.winner if s.step == Sim.OVER else -1,
		"turn": s.turn, "step": steps.get(s.step, "?")}


func random_action(g) -> Dictionary:
	var p: int = g.actor()
	var v = g.view(p)
	if g.step == "main":
		var cards = v.playable.keys()
		if cards.is_empty() or randf() < 0.1:
			return {"type": "pass"}
		var c = cards[randi() % cards.size()]
		var t = v.playable[c]
		var a := {"type": "play", "card": c}
		if t != null and not t.is_empty():
			a.target = t[randi() % t.size()]
		return a
	if g.step == "response":
		if not v.counterOthers.is_empty() and randf() < 0.5:
			return {"type": "counter", "other": v.counterOthers[randi() % v.counterOthers.size()]}
		return {"type": "allow"}
	return {"type": "choose", "choice": v.choice.options[randi() % v.choice.options.size()]}


func t_regole():
	for n in 300:
		var opts := {}
		if n % 3 == 1:
			opts = {"onlyFive": [true, false]}
		elif n % 3 == 2:
			opts = {"turnLimit": {"turn": 12, "loser": n % 2}}
		var g = Game.new(["A", "B"], opts)
		var s = Sim.new().load_game(g)
		eq(sim_state(s), game_state(g), "all'inizio")
		while g.phase == "playing":
			var p: int = g.actor()
			var a := random_action(g)
			is_ok(g.act(p, a))
			if not s.act(p, a):
				failures.append("la simulazione rifiuta %s" % str(a))
				return true
			var want := game_state(g)
			var got := sim_state(s)
			if not deep_eq(got, want):
				failures.append("partita %d dopo %s:\n  vera %s\n  sim  %s" % [n, str(a), str(want), str(got)])
				return true
	return true


func t_scelte():
	var zero := func(): return 0.0
	var ties := 0
	var checked := 0
	for n in 300:
		var g = Game.new(["A", "B"])
		while g.phase == "playing":
			var p: int = g.actor()
			# scelta del computer normale nella partita vera e nella simulazione, senza variazione casuale
			var g2 = g.clone()
			var a = Bot.new(g2, p, {"rng": zero}).decide()
			is_ok(g2.act(p, a))
			var s = Sim.new().load_game(g)
			s.noise = 0.0
			s.bot_step()
			checked += 1
			if not deep_eq(sim_state(s), game_state(g2)):
				# a parità di valore le due possono scegliere carte diverse: va bene
				var tie := false
				if a.type == "play":
					var s0 = Sim.new().load_game(g)
					var va: float = s0.main_value(p, Sim.IDX[a.card], Sim._idx(a.get("target")))
					tie = absf(va - s._mv) < 1e-9
				if not tie:
					failures.append("partita %d: il normale fa %s, la simulazione no (%s)" % [n, str(a), str(sim_state(s))])
					return true
				ties += 1
			is_ok(g.act(p, random_action(g) if randf() < 0.5 else a))
	print("        %d scelte confrontate, %d pari merito" % [checked, ties])
	return true


func t_determinize():
	var g = setup({"h0": ["W", "U"], "h1": ["B", "B", "R"], "deck0": ["G", "G", "R"], "deck1": ["U", "W"]})
	var s = Sim.new().load_game(g)
	for k in 20:
		var c = s.copy()
		c.determinize(0, false)
		eq(Array(c.hand).slice(0, 5), [1, 1, 0, 0, 0], "la mia mano resta")
		var opp_cards := 0
		for t in 5:
			opp_cards += c.hand[5 + t]
		eq(opp_cards, 3, "carte in mano all'avversario")
		eq(c.d1.size(), 2)
		var all := Array(c.d1)
		for t in 5:
			for i in c.hand[5 + t]:
				all.append(t)
		all.sort()
		eq(all, [0, 1, 2, 2, 3], "le carte dell'avversario sono sempre le stesse")
		var mine := Array(c.d0)
		mine.sort()
		eq(mine, [3, 4, 4])
		var k2 = s.copy()
		k2.determinize(0, true)
		eq(Array(k2.hand), Array(s.hand), "mano rivelata dalla Palude")
	eq(Array(s.d0), [4, 4, 3], "l'originale non cambia")
	return true


func t_non_valide():
	var g = setup({"h0": ["R", "G"], "h1": ["U", "B"], "bf1": {"W": 1}})
	var s = Sim.new().load_game(g)
	check(not s.act(1, {"type": "pass"}), "non è il turno di Bruno")
	check(not s.act(0, {"type": "play", "card": "B"}), "Anna non ha la Palude")
	check(not s.act(0, {"type": "play", "card": "R"}), "serve il bersaglio")
	check(not s.act(0, {"type": "choose", "choice": "W"}), "nessuna scelta in corso")
	check(s.act(0, {"type": "play", "card": "R", "target": "W"}), "giocata valida")
	check(not s.act(1, {"type": "counter", "other": "R"}), "Bruno non ha la Montagna")
	check(s.act(1, {"type": "counter", "other": "B"}), "contrasto valido")
	eq(Array(s.gy).slice(0, 5), [0, 0, 0, 1, 0], "Montagna annullata")
	return true
