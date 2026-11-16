## Motore di gioco di Atlas (regole del "Basic Land Game") – logica pura, nessun nodo.
## Traduzione fedele di game.js: stesse regole, stessi messaggi del registro, stesse viste.
## Le chiavi dei dizionari che escono dal motore (viste, eventi, azioni, opzioni) sono
## le stesse della versione web, così il client Godot potrà parlare con lo stesso server.
class_name AtlasGame
extends RefCounted

const TYPES := ["W", "U", "B", "R", "G"]
const NAMES := {"W": "Pianura", "U": "Isola", "B": "Palude", "R": "Montagna", "G": "Foresta"}
const ORDER := {"W": 0, "U": 1, "B": 2, "R": 3, "G": 4}


static func empty_count() -> Dictionary:
	return {"W": 0, "U": 0, "B": 0, "R": 0, "G": 0}


## Mescola sul posto (Fisher–Yates, come in game.js). `rng` restituisce un numero in [0, 1).
static func shuffle(arr: Array, rng: Callable) -> Array:
	for i in range(arr.size() - 1, 0, -1):
		var j := int(floor(rng.call() * (i + 1)))
		var tmp = arr[i]
		arr[i] = arr[j]
		arr[j] = tmp
	return arr


static func remove_one(arr: Array, x) -> bool:
	var i := arr.find(x)
	if i == -1:
		return false
	arr.remove_at(i)
	return true


static func sort_types(a: Array) -> Array:
	var c := a.duplicate()
	c.sort_custom(func(x, y): return ORDER[x] < ORDER[y])
	return c


## Elementi distinti, nell'ordine in cui compaiono (come `new Set(arr)` in JS).
static func uniq(a: Array) -> Array:
	var out := []
	for x in a:
		if not out.has(x):
			out.append(x)
	return out


var rng: Callable
var _own_rng := RandomNumberGenerator.new()
var copies := 10
var hand_size := 5
## Ogni giocatore: { name, deck, hand, bf, gy, handSize }. L'ultima carta del mazzo è la prima pescata.
var players: Array = []
var only_five: Array = [false, false]  # sfida: vince solo con cinque terre uguali
var turn_limit = null  # sfida: { turn, loser } chi non vince entro quel turno perde
var phase := "playing"
var turn := 0
var active = null
var step = null  # "main" | "response" | "choice" | "resolving"
var land_played := false
var pending = null  # { owner, land, target, counters, responder }
var resolving = null  # terra che sta risolvendo il suo effetto (non ancora in gioco)
var choice = null  # { player, kind, options }
var pass_streak := 0
var last_land_player = null
var winner = null
var end_reason = null
var end_text := ""
var log_lines: Array = []
var events: Array = []  # eventi animabili: { ev, views: [vista P0, vista P1] }
var first_player := 0
var quiet := false  # partita simulata dal computer difficile: niente eventi né registro


## opts (stesse chiavi di game.js): rng (Callable), seed, copies, handSize, decks, setup,
## onlyFive, turnLimit, firstPlayer.
func _init(names: Array = [], opts: Dictionary = {}) -> void:
	if opts.get("rng") is Callable:
		rng = opts.rng
	else:
		if opts.has("seed"):
			_own_rng.seed = opts.seed
		else:
			_own_rng.randomize()
		rng = _own_rng.randf
	if names.is_empty():
		return  # copia vuota, riempita da clone()
	copies = opts.get("copies", 10)
	hand_size = opts.get("handSize", 5)
	var decks = opts.get("decks")
	var setups = opts.get("setup")
	for i in names.size():
		# decks[i] (tutorial): mazzo già in ordine, l'ultima carta è la prima pescata
		if decks != null and i < decks.size() and decks[i] != null:
			players.append({"name": names[i], "deck": decks[i].duplicate(), "hand": [],
				"bf": empty_count(), "gy": empty_count(), "handSize": hand_size})
			continue
		# setup[i] (sfide): { bf: terre già in gioco, without: tipi tolti dal mazzo, hand: carte iniziali }
		var su = {}
		if setups != null and i < setups.size() and setups[i] != null:
			su = setups[i]
		var bf := empty_count()
		var deck := []
		for t in TYPES:
			if su.has("without") and su.without.has(t):
				continue
			bf[t] = su.bf.get(t, 0) if su.has("bf") else 0
			for k in range(bf[t], copies):
				deck.append(t)
		players.append({"name": names[i], "deck": shuffle(deck, rng), "hand": [], "bf": bf,
			"gy": empty_count(), "handSize": su.get("hand", hand_size)})
	if opts.has("onlyFive"):
		only_five = opts.onlyFive.duplicate()
	turn_limit = opts.get("turnLimit")
	if opts.get("firstPlayer") != null:
		first_player = opts.firstPlayer
	else:
		first_player = 0 if rng.call() < 0.5 else 1

	for p in 2:
		for i in players[p].handSize:
			draw(p, true)
	emit({"type": "deal", "first": first_player})
	add_log("%s inizia la partita (salta la prima pescata)." % players[first_player].name)
	begin_turn(first_player)


## Copia indipendente della partita (per le simulazioni del computer difficile).
func clone():
	var c = get_script().new()
	c.copies = copies
	c.hand_size = hand_size
	c.players = []
	for pl in players:
		c.players.append({"name": pl.name, "deck": pl.deck.duplicate(), "hand": pl.hand.duplicate(),
			"bf": pl.bf.duplicate(), "gy": pl.gy.duplicate(), "handSize": pl.handSize})
	c.only_five = only_five.duplicate()
	c.turn_limit = turn_limit
	c.phase = phase
	c.turn = turn
	c.active = active
	c.step = step
	c.land_played = land_played
	c.pending = pending.duplicate() if pending != null else null
	c.resolving = resolving.duplicate() if resolving != null else null
	c.choice = choice.duplicate(true) if choice != null else null
	c.pass_streak = pass_streak
	c.last_land_player = last_land_player
	c.winner = winner
	c.end_reason = end_reason
	c.end_text = end_text
	c.first_player = first_player
	c.quiet = true
	return c


## Tutto lo stato della partita in un dizionario (per salvarla quando si chiude l'app).
func to_dict() -> Dictionary:
	return {"players": players.duplicate(true), "copies": copies, "hand_size": hand_size,
		"only_five": only_five.duplicate(), "turn_limit": turn_limit, "phase": phase, "turn": turn,
		"active": active, "step": step, "land_played": land_played, "pending": pending, "resolving": resolving,
		"choice": choice, "pass_streak": pass_streak, "last_land_player": last_land_player, "winner": winner,
		"end_reason": end_reason, "end_text": end_text, "log": log_lines.duplicate(), "first_player": first_player}


## Il JSON trasforma tutti i numeri in decimali: qui tornano interi.
static func _ints(v):
	if v is float and v == floor(v):
		return int(v)
	if v is Array:
		return v.map(func(x): return _ints(x))
	if v is Dictionary:
		var o := {}
		for k in v:
			o[k] = _ints(v[k])
		return o
	return v


## Ricrea una partita salvata con to_dict() (anche passata per JSON).
static func from_dict(d: Dictionary):
	d = _ints(d)
	var g = load("res://scripts/rules/game.gd").new()
	g.players = d.players
	g.copies = d.copies
	g.hand_size = d.hand_size
	g.only_five = d.only_five
	g.turn_limit = d.turn_limit
	g.phase = d.phase
	g.turn = d.turn
	g.active = d.active
	g.step = d.step
	g.land_played = d.land_played
	g.pending = d.pending
	g.resolving = d.resolving
	g.choice = d.choice
	g.pass_streak = d.pass_streak
	g.last_land_player = d.last_land_player
	g.winner = d.winner
	g.end_reason = d.end_reason
	g.end_text = d.end_text
	g.log_lines = d.log
	g.first_player = d.first_player
	return g


func opp(p: int) -> int:
	return 1 - p


func name_of(p: int) -> String:
	return players[p].name


func emit(ev: Dictionary) -> void:
	if not quiet:
		events.append({"ev": ev, "views": [view(0), view(1)]})


func take_events() -> Array:
	var e := events
	events = []
	return e


## Chi deve agire adesso (o null).
func actor():
	if phase != "playing":
		return null
	match step:
		"main":
			return active
		"response":
			return pending.responder
		"choice":
			return choice.player
	return null


## Azione automatica quando scade il tempo.
func auto_act() -> void:
	var p = actor()
	if p == null:
		return
	add_log("⏱ Tempo scaduto per %s." % name_of(p))
	emit({"type": "timeout", "player": p, "step": step})
	if step == "main":
		do_pass(p)
	elif step == "response":
		do_allow(p)
	else:
		do_choose(p, choice.options[int(floor(rng.call() * choice.options.size()))])


func add_log(text: String) -> void:
	if quiet:
		return
	log_lines.append(text)
	if log_lines.size() > 200:
		log_lines.pop_front()


func draw(p: int, silent := false) -> bool:
	var pl = players[p]
	if pl.deck.is_empty():
		if not silent:
			add_log("%s non ha più carte nel mazzo e non pesca." % pl.name)
		return false
	var card = pl.deck.pop_back()
	pl.hand.append(card)
	if not silent and not quiet:
		add_log("%s pesca una carta." % pl.name)
		emit({"type": "draw", "player": p, "card": card})
	return true


func begin_turn(p: int) -> void:
	if turn_limit != null and turn >= turn_limit.turn:
		var l: int = turn_limit.loser
		end_game(opp(l), "limit", "%s non ha vinto entro il turno %d." % [name_of(l), turn_limit.turn])
		return
	active = p
	turn += 1
	land_played = false
	pending = null
	choice = null
	step = "main"
	if not quiet:
		emit({"type": "turn", "player": p, "turn": turn})
	var skip_draw := turn == 1  # chi inizia salta la prima pescata
	if not skip_draw:
		draw(p)
	if check_out_of_cards():
		return
	# Nessuna carta in mano: il turno passa da solo
	if players[p].hand.is_empty():
		add_log("%s non ha carte in mano e passa." % name_of(p))
		emit({"type": "pass", "player": p, "auto": true})
		count_pass()
		if check_out_of_cards():
			return
		begin_turn(opp(p))


## Fine per carte esaurite: entrambi i mazzi vuoti e (entrambe le mani vuote
## oppure entrambi i giocatori hanno passato di fila).
func check_out_of_cards() -> bool:
	var a = players[0]
	var b = players[1]
	if not a.deck.is_empty() or not b.deck.is_empty():
		return false
	var hands_empty: bool = a.hand.is_empty() and b.hand.is_empty()
	if not hands_empty and pass_streak < 2:
		return false
	var da := distinct(0)
	var db := distinct(1)
	var w
	if da != db:
		w = 0 if da > db else 1
	else:
		w = last_land_player  # pareggio: vince chi ha giocato l'ultima terra
	var text := "Carte esaurite. Tipi di terra distinti: %s %d, %s %d." % [a.name, da, b.name, db]
	if da == db and w != null:
		text += " Parità: vince chi ha giocato l'ultima terra."
	end_game(w, "cards", text)
	return true


## Contano solo i passaggi fatti quando entrambi i mazzi sono vuoti.
func count_pass() -> void:
	var empty: bool = players[0].deck.is_empty() and players[1].deck.is_empty()
	pass_streak = pass_streak + 1 if empty else 0


func distinct(p: int) -> int:
	var n := 0
	for t in TYPES:
		if players[p].bf[t] > 0:
			n += 1
	return n


func has_won(p: int) -> bool:
	var bf = players[p].bf
	var five := false
	for t in TYPES:
		if bf[t] >= 5:
			five = true
	return (not only_five[p] and distinct(p) == 5) or five


func end_game(w, reason: String, text := "") -> void:
	phase = "over"
	step = null
	winner = w
	end_reason = reason
	pending = null
	choice = null
	if text != "":
		add_log(text)
	add_log("La partita finisce in parità." if w == null else "🏆 %s vince!" % name_of(w))
	end_text = text
	emit({"type": "end", "winner": w, "reason": reason})


## Bersagli validi da dichiarare quando si gioca una terra.
## Restituisce null se la terra non richiede bersaglio, altrimenti l'elenco (può essere vuoto).
func targets_for(p: int, land):
	var me = players[p]
	var op = players[opp(p)]
	var src: Dictionary
	match land:
		"R":
			src = op.bf
		"G":
			src = me.gy
		"W":
			src = me.bf
		_:
			return null
	var out := []
	for t: String in TYPES:
		if src[t] > 0 and not (land == "W" and t == "W"):
			out.append(t)
	return out


func can_respond(p: int) -> bool:
	return players[p].hand.size() >= 2


## Esegue un'azione del giocatore `p`. Ritorna null se va bene, altrimenti il messaggio d'errore.
## Azioni: {type:"play", card, target?} · {type:"pass"} · {type:"counter", other}
## · {type:"allow"} · {type:"choose", choice} · {type:"surrender"}
func act(p: int, a):
	if phase != "playing":
		return "La partita è finita."
	if not (a is Dictionary) or not (a.get("type") is String):
		return "Azione non valida."
	match a.type:
		"play":
			return do_play(p, a.get("card"), a.get("target"))
		"pass":
			return do_pass(p)
		"counter":
			return do_counter(p, a.get("other"))
		"allow":
			return do_allow(p)
		"choose":
			return do_choose(p, a.get("choice"))
		"surrender":
			return do_surrender(p)
	return "Azione sconosciuta."


func do_play(p: int, card, target):
	if step != "main" or active != p:
		return "Non è il tuo momento."
	if land_played:
		return "Hai già giocato una terra in questo turno."
	var me = players[p]
	if not TYPES.has(card) or not me.hand.has(card):
		return "Non hai quella carta."
	var valid = targets_for(p, card)
	var tgt = null
	if valid != null and not valid.is_empty():
		if not valid.has(target):
			return "Scegli un bersaglio valido."
		tgt = target
	remove_one(me.hand, card)
	land_played = true
	pass_streak = 0
	pending = {"owner": p, "land": card, "target": tgt, "counters": 0, "responder": null}
	if not quiet:
		var msg := "%s gioca %s" % [me.name, NAMES[card]]
		if card == "R" and tgt != null:
			msg += " puntando %s di %s" % [NAMES[tgt], name_of(opp(p))]
		if card == "G" and tgt != null:
			msg += " per recuperare %s dal cimitero" % NAMES[tgt]
		if card == "W" and tgt != null:
			msg += " per riattivare %s" % NAMES[tgt]
		if valid != null and valid.is_empty():
			msg += " (nessun bersaglio)"
		add_log(msg + ".")
		emit({"type": "play", "player": p, "card": card, "target": tgt})
	open_response(opp(p))
	return null


func open_response(responder: int) -> void:
	if can_respond(responder):
		step = "response"
		pending.responder = responder
	else:
		resolve_pending()


## Resa (partite tra giocatori): vince l'altro, in qualunque momento della partita.
func do_surrender(p):
	if p != 0 and p != 1:
		return "Azione non valida."
	end_game(opp(p), "surrender", "%s si arrende." % name_of(p))
	return null


func do_pass(p: int):
	if step != "main" or active != p:
		return "Non è il tuo momento."
	if land_played:
		return "Turno già concluso."
	if not quiet:
		add_log("%s passa il turno senza giocare terre." % name_of(p))
		emit({"type": "pass", "player": p})
	count_pass()
	if check_out_of_cards():
		return null
	begin_turn(opp(p))
	return null


func do_counter(p: int, other):
	if step != "response" or pending.responder != p:
		return "Non puoi rispondere ora."
	var hand = players[p].hand
	if not hand.has("U"):
		return "Ti serve un'Isola in mano."
	if not TYPES.has(other):
		return "Scegli la seconda terra da scartare."
	var need := 2 if other == "U" else 1
	if hand.count("U") < need or not hand.has(other):
		return "Non hai quella carta da scartare."
	remove_one(hand, "U")
	remove_one(hand, other)
	players[p].gy.U += 1
	players[p].gy[other] += 1
	pending.counters += 1
	if not quiet:
		var what: String = NAMES[pending.land] if pending.counters == 1 else "il contrasto"
		add_log("%s scarta Isola + %s e contrasta %s!" % [name_of(p), NAMES[other], what])
		emit({"type": "counter", "player": p, "other": other, "n": pending.counters,
			"land": pending.land, "owner": pending.owner})
	open_response(opp(p))
	return null


func do_allow(p: int):
	if step != "response" or pending.responder != p:
		return "Non puoi rispondere ora."
	resolve_pending()
	return null


func resolve_pending() -> void:
	var owner: int = pending.owner
	var land: String = pending.land
	var target = pending.target
	var counters: int = pending.counters
	pending = null
	step = "resolving"
	var me = players[owner]
	if counters % 2 == 1:
		me.gy[land] += 1
		if not quiet:
			add_log("%s di %s viene contrastata e finisce nel cimitero." % [NAMES[land], me.name])
			emit({"type": "countered", "player": owner, "card": land})
		end_turn()
		return
	# Se questa terra fa vincere, entra subito e la partita finisce.
	me.bf[land] += 1
	var wins := has_won(owner)
	me.bf[land] -= 1
	resolving = {"owner": owner, "land": land, "target": target}
	if wins:
		finish_resolve()
		return
	# Altrimenti prima si risolve l'effetto, poi la terra va al suo posto (finish_resolve).
	apply_effect(owner, land, target, false)


## La terra risolta entra in gioco; controlla la vittoria e chiude il turno.
func finish_resolve() -> void:
	var r = resolving
	resolving = null
	if r != null:
		var me = players[r.owner]
		me.bf[r.land] += 1
		last_land_player = r.owner
		if not quiet:
			add_log("%s entra in gioco per %s." % [NAMES[r.land], me.name])
			emit({"type": "enter", "player": r.owner, "card": r.land})
		if has_won(r.owner):
			var five = null
			for t in TYPES:
				if five == null and me.bf[t] >= 5:
					five = t
			if five != null:
				end_game(r.owner, "combo", "%s ha 5 %s in gioco!" % [me.name, NAMES[five]])
			else:
				end_game(r.owner, "combo", "%s ha una terra di ogni tipo in gioco!" % me.name)
			return
	end_turn()


## Applica l'effetto d'ingresso. Ritorna dopo aver chiuso il turno o aperto una scelta.
func apply_effect(p: int, land: String, target, via_plains: bool) -> void:
	var me = players[p]
	var op = players[opp(p)]
	match land:
		"U":
			draw(p)
		"B":
			if not op.hand.is_empty():
				step = "choice"
				choice = {"player": p, "kind": "discard", "options": TYPES.filter(func(t): return op.hand.has(t))}
				if not quiet:
					add_log("%s guarda la mano di %s." % [me.name, op.name])
					emit({"type": "look", "player": p})
				return
			add_log("%s non ha carte in mano: la Palude non ha effetto." % op.name)
		"R":
			if via_plains:
				var opts = TYPES.filter(func(t): return op.bf[t] > 0)
				if not opts.is_empty():
					step = "choice"
					choice = {"player": p, "kind": "destroy", "options": opts}
					return
				add_log("Nessuna terra avversaria da distruggere.")
			elif target != null and op.bf[target] > 0:
				destroy(p, target)
		"G":
			if via_plains:
				var opts = TYPES.filter(func(t): return me.gy[t] > 0)
				if not opts.is_empty():
					step = "choice"
					choice = {"player": p, "kind": "regrow", "options": opts}
					return
				add_log("Nessuna terra nel cimitero da recuperare.")
			elif target != null and me.gy[target] > 0:
				regrow(p, target)
		"W":
			if target != null and me.bf[target] > 0:
				add_log("La Pianura riattiva l'effetto di %s." % NAMES[target])
				emit({"type": "reuse", "player": p, "card": target})
				apply_effect(p, target, null, true)
				return
	finish_resolve()


func destroy(p: int, t: String) -> void:
	var op = players[opp(p)]
	op.bf[t] -= 1
	op.gy[t] += 1
	if not quiet:
		add_log("%s di %s viene distrutta." % [NAMES[t], op.name])
		emit({"type": "destroy", "player": opp(p), "by": p, "card": t})


func regrow(p: int, t: String) -> void:
	var me = players[p]
	me.gy[t] -= 1
	me.hand.append(t)
	if not quiet:
		add_log("%s riprende in mano %s dal cimitero." % [me.name, NAMES[t]])
		emit({"type": "regrow", "player": p, "card": t})


func do_choose(p: int, c):
	if step != "choice" or choice.player != p:
		return "Non devi scegliere ora."
	if not choice.options.has(c):
		return "Scelta non valida."
	var op = players[opp(p)]
	match choice.kind:
		"discard":
			remove_one(op.hand, c)
			op.gy[c] += 1
			if not quiet:
				add_log("%s fa scartare %s a %s." % [name_of(p), NAMES[c], op.name])
				emit({"type": "discard", "player": opp(p), "by": p, "card": c})
		"destroy":
			destroy(p, c)
		"regrow":
			regrow(p, c)
	choice = null
	finish_resolve()
	return null


func end_turn() -> void:
	if phase != "playing":
		return
	pending = null
	choice = null
	begin_turn(opp(active))


## Vista dello stato per un singolo giocatore (nasconde le informazioni segrete).
func view(p: int) -> Dictionary:
	var me = players[p]
	var op = players[opp(p)]
	var v := {
		"phase": phase, "turn": turn, "active": active, "step": step, "you": p,
		"me": _pub(me, p), "opp": _pub(op, opp(p)),
		"hand": sort_types(me.hand),
		"landPlayed": land_played,
		"pending": pending.duplicate() if pending != null else null,
		"resolving": resolving.duplicate() if resolving != null else null,
		"choice": null,
		"winner": winner, "endReason": end_reason, "endText": end_text,
		"firstPlayer": first_player, "onlyFive": bool(only_five[p]),
		"turnLimit": turn_limit.turn if turn_limit != null else null,
		"log": log_lines.slice(max(0, log_lines.size() - 60)),
	}
	if choice != null:
		var vc := {"player": choice.player, "kind": choice.kind}
		if choice.player == p:
			vc.options = choice.options.duplicate()
			if choice.kind == "discard":
				vc.revealed = sort_types(op.hand)
		v.choice = vc
	if phase == "playing" and step == "main" and active == p and not land_played:
		var playable := {}
		for t in uniq(me.hand):
			playable[t] = targets_for(p, t)
		v.playable = playable
	if step == "response" and pending.responder == p:
		var u_count: int = me.hand.count("U")
		v.counterOthers = [] if u_count == 0 else TYPES.filter(
			func(t): return u_count >= 2 if t == "U" else me.hand.has(t))
	return v


func _pub(pl: Dictionary, i: int) -> Dictionary:
	return {"name": pl.name, "seat": i, "handCount": pl.hand.size(), "deckCount": pl.deck.size(),
		"bf": pl.bf.duplicate(), "gy": pl.gy.duplicate()}
