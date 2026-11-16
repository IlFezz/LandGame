## Giocatore computer (facile, normale, difficile). Traduzione fedele di bot.js.
## Usa solo informazioni legittime: la propria mano, il campo e i cimiteri (pubblici),
## il numero di carte avversarie e la mano avversaria solo quando una Palude la rivela.
## Il difficile prova ogni mossa in tante partite simulate, immaginando le carte nascoste.
class_name AtlasBot
extends RefCounted

const GameScript := preload("res://scripts/rules/game.gd")
const TYPES := ["W", "U", "B", "R", "G"]
## Valore di una posizione sul campo: premia l'avvicinarsi a dominio o cinque uguali.
const STEP := [0, 3, 9, 20, 45, 1000]


static func distinct(bf: Dictionary) -> int:
	var n := 0
	for t in TYPES:
		if bf[t] > 0:
			n += 1
	return n


static func max_same(bf: Dictionary) -> int:
	var m := 0
	for t in TYPES:
		m = maxi(m, bf[t])
	return m


static func wins(bf: Dictionary) -> bool:
	return distinct(bf) == 5 or max_same(bf) >= 5


## 1000 solo se il campo vince (le altre posizioni valgono al massimo 90).
static func score(bf: Dictionary) -> int:
	var d := 0
	var m := 0
	for t: String in TYPES:
		var x: int = bf[t]
		if x > 0:
			d += 1
			if x > m:
				m = x
	if d == 5 or m >= 5:
		return 1000
	return STEP[d] + STEP[mini(m, 4)]


## Punteggio del campo con `n` terre `t` in più, senza copiarlo (lo modifica e lo rimette com'era).
static func score_plus(bf: Dictionary, t: String, n := 1) -> int:
	bf[t] += n
	var s := score(bf)
	bf[t] -= n
	return s


static func need(bf: Dictionary) -> int:
	var d := 0
	var m := 0
	for t: String in TYPES:
		var x: int = bf[t]
		if x > 0:
			d += 1
			if x > m:
				m = x
	return mini(5 - d, 5 - m)


static func plus(bf: Dictionary, t: String, n := 1) -> Dictionary:
	var c := bf.duplicate()
	c[t] += n
	return c


## Quanto vale distruggere la terra `t` nel campo `bf`.
static func destroy_value(bf: Dictionary, t) -> float:
	if t == null or not bf[t]:
		return 0.0
	return score(bf) - score_plus(bf, t, -1)


static func best_destroy(bf: Dictionary) -> Dictionary:
	var best = null
	var v := -1.0
	for t in TYPES:
		if bf[t]:
			var x := destroy_value(bf, t) + (0.5 if bf[t] == 1 else 0.0)
			if x > v:
				v = x
				best = t
	return {"target": best, "value": maxf(0.0, v)}


## Quanto vale per me avere in mano una carta di tipo `t` (per giocarla in futuro).
static func card_value(my_bf: Dictionary, t: String) -> float:
	var v := 2.0
	var after := score_plus(my_bf, t)
	if after == 1000:
		v += 40
	v += (after - score(my_bf)) * 0.5
	if t == "U":
		v += 3  # permette di contrastare
	return v


static func best_regrow(my_bf: Dictionary, gy: Dictionary) -> Dictionary:
	var best = null
	var v := -1.0
	for t in TYPES:
		if gy[t]:
			var x := card_value(my_bf, t)
			if x > v:
				v = x
				best = t
	return {"target": best, "value": maxf(0.0, v)}


static func _shuffle(a: Array) -> Array:
	for i in range(a.size() - 1, 0, -1):
		var j := randi_range(0, i)
		var tmp = a[i]
		a[i] = a[j]
		a[j] = tmp
	return a


static func _now() -> float:
	return Time.get_ticks_usec() / 1000.0


static func _uniq(a: Array) -> Array:
	var out := []
	for x in a:
		if not out.has(x):
			out.append(x)
	return out


## Azione di gioco, senza la chiave `target` se non c'è bersaglio (come `undefined` in JS).
static func _play(card, target) -> Dictionary:
	var a := {"type": "play", "card": card}
	if target != null:
		a.target = target
	return a


var g: GameScript  # la partita
var p: int  # il posto del computer
var rng: Callable
var easy := false  # facile: sbaglia più spesso e contrasta di rado
var hard := false  # difficile: prova ogni mossa in tante partite simulate
var budget := 120.0  # millisecondi di "pensiero" per decisione

var me: Dictionary:
	get:
		return g.players[p]
var op: Dictionary:
	get:
		return g.players[1 - p]


## opts: level ("easy" | "normal" | "hard"), rng (Callable), budget (ms).
func _init(game, seat: int, opts: Dictionary = {}) -> void:
	g = game
	p = seat
	rng = opts.rng if opts.get("rng") is Callable else func(): return randf()
	easy = opts.get("level") == "easy"
	hard = opts.get("level") == "hard"
	budget = opts.get("budget", 120.0)


## Tutte le azioni possibili adesso (per il livello difficile).
func options() -> Array:
	var hand = me.hand
	var out := []
	if g.step == "main":
		for card in _uniq(hand):
			var t = g.targets_for(p, card)
			if t != null and not t.is_empty():
				for target in t:
					out.append(_play(card, target))
			else:
				out.append(_play(card, null))
		out.append({"type": "pass"})
	elif g.step == "response":
		out.append({"type": "allow"})
		for o in counter_others():
			out.append({"type": "counter", "other": o})
	elif g.step == "choice":
		for c in _uniq(g.choice.options):
			out.append({"type": "choose", "choice": c})
	return out


## Una versione possibile delle carte nascoste: la mano avversaria e i due mazzi vengono rimescolati
## tra le carte che non vedo. Se la Palude ha appena rivelato la mano avversaria, quella resta com'è.
func determinize() -> GameScript:
	var c: GameScript = g.clone()
	var my = c.players[p]
	var o = c.players[1 - p]
	var known: bool = g.step == "choice" and g.choice.kind == "discard" and g.choice.player == p
	_shuffle(my.deck)
	if not known:
		var pool := _shuffle(o.hand + o.deck)
		var h: int = o.hand.size()
		o.hand = pool.slice(0, h)
		o.deck = pool.slice(h)
	else:
		_shuffle(o.deck)
	return c


## Gioca la partita fino in fondo con il computer normale; 1 se vinco, 0 se perdo.
func playout(c: GameScript) -> float:
	var bots := [get_script().new(c, 0), get_script().new(c, 1)]
	var guard := 0
	while c.phase == "playing" and guard < 400:
		guard += 1
		var pp: int = c.actor()
		var a = bots[pp].decide()
		if a == null or c.act(pp, a) != null:
			c.act(pp, {"type": "pass"} if c.step == "main" else {"type": "allow"})
	if c.winner == p:
		return 1.0
	return 0.5 if c.winner == null else 0.0


## Prova ogni azione su tante versioni possibili della partita e sceglie quella che vince più spesso.
func search():
	var opts := options()
	if opts.size() <= 1:
		return opts[0] if opts.size() == 1 else null
	# un'azione che vince subito non ha bisogno di simulazioni
	var base = decide_heuristic()
	if base != null and base.type == "play" and g.step == "main" and wins(plus(me.bf, base.card)):
		return base
	var stats := []
	for a in opts:
		stats.append({"a": a, "w": 0.0, "n": 0, "bad": false})
	# la mossa del computer normale parte con un piccolo vantaggio: a parità di risultati vince lei
	if base != null:
		for s in stats:
			if s.a == base:
				s.w += 0.6
				break
	var t0 := _now()
	var rounds := 0
	while rounds < 400 and (rounds < 24 or _now() - t0 < budget):
		for s in stats:
			if s.bad:
				continue
			var c := determinize()
			if c.act(p, s.a) != null:
				s.bad = true
				continue
			s.w += playout(c)
			s.n += 1
		rounds += 1
	var best = null
	var bv := -1.0
	for s in stats:
		if s.bad or s.n <= 0:
			continue
		var v: float = s.w / s.n
		if v > bv:
			bv = v
			best = s.a
	return best if best != null else base


## Valore dell'effetto di una terra che entra per `owner` (in prospettiva di owner).
func effect_value(owner: int, land: String, target) -> float:
	var own: Dictionary = g.players[owner]
	var other: Dictionary = g.players[1 - owner]
	match land:
		"U":
			return 4.0
		"B":
			if other.hand.is_empty():
				return 0.0
			return 4.0 + (4.0 if need(other.bf) <= 1 else 0.0)
		"R":
			return destroy_value(other.bf, target) * 1.2 if target != null else 0.0
		"G":
			return 1.0 + card_value(own.bf, target) if target != null else 0.0
		"W":
			if target == null:
				return 0.0
			if target == "R":
				return best_destroy(other.bf).value * 1.2
			if target == "G":
				return 1.0 + best_regrow(own.bf, own.gy).value
			return effect_value(owner, target, null)
	return 0.0


## Valore complessivo di giocare `card` con `target` per `owner`.
func play_value(owner: int, card: String, target) -> float:
	var bf: Dictionary = g.players[owner].bf
	var after := score_plus(bf, card)
	if after == 1000:
		return 10000.0
	return (after - score(bf)) + effect_value(owner, card, target)


## La mossa da fare adesso (null se non tocca al computer).
func decide():
	if hard and g.phase == "playing":
		return search()
	return decide_heuristic()


func decide_heuristic():
	match g.step:
		"main":
			return decide_main()
		"response":
			return decide_response()
		"choice":
			return decide_choice()
	return null


func decide_main() -> Dictionary:
	var hand: Array = me.hand
	var best = null
	var bv := -INF
	# Tieni almeno un'Isola (e una carta di accompagnamento) se l'avversario è vicino alla vittoria.
	var islands: int = hand.count("U")
	var op_need := need(op.bf)
	for card in _uniq(hand):
		var targets = g.targets_for(p, card)
		var list = targets if targets != null and not targets.is_empty() else [null]
		for target in list:
			var v := play_value(p, card, target)
			if card == "U" and islands == 1 and op_need <= 2 and v < 1000:
				v -= 6
			if card != "U" and islands >= 1 and hand.size() == 2 and op_need <= 1 and v < 1000:
				v -= 4
			v += rng.call() * (14.0 if easy else 1.5)  # varietà: al facile le priorità sono molto meno precise
			if easy and v >= 1000 and rng.call() < 0.35:
				v = 5  # a volte non vede la vittoria
			if v > bv:  # a parità vince la prima, come l'ordinamento stabile di JS
				bv = v
				best = _play(card, target)
	if best == null:
		return {"type": "pass"}
	return best


## Quanto mi costa scartare la carta `t` (oltre all'Isola).
func keep_value(t: String) -> float:
	var dup: int = me.hand.count(t)
	return card_value(me.bf, t) - (dup - 1) * 2


func decide_response() -> Dictionary:
	var pend = g.pending
	var others := counter_others()
	if others.is_empty():
		return {"type": "allow"}
	var resolves: bool = pend.counters % 2 == 0  # senza un mio contrasto la terra risolve
	var want := false
	if pend.owner != p and resolves:
		# Danno se la terra avversaria risolve
		var harm := play_value(pend.owner, pend.land, pend.target)
		var threat := need(plus(op.bf, pend.land)) <= 1
		want = harm >= 1000 or harm >= 16 or (threat and harm >= 10)
	elif pend.owner == p and not resolves:
		# La mia terra sta per essere annullata: rispondo se vale molto
		var gain := play_value(p, pend.land, pend.target)
		want = gain >= 1000 or gain >= 18
	if easy:
		want = want and (rng.call() < 0.6 if play_value(pend.owner, pend.land, pend.target) >= 1000 else rng.call() < 0.15)
	if not want:
		return {"type": "allow"}
	if easy:
		return {"type": "counter", "other": others[int(floor(rng.call() * others.size()))]}
	var best = others[0]
	var bk := keep_value(best)
	for o in others:
		var k := keep_value(o)
		if k < bk:
			bk = k
			best = o
	return {"type": "counter", "other": best}


func counter_others() -> Array:
	var hand = me.hand
	var u: int = hand.count("U")
	var out := []
	if u == 0:
		return out
	for t: String in TYPES:
		if (u >= 2) if t == "U" else hand.has(t):
			out.append(t)
	return out


func decide_choice() -> Dictionary:
	var c = g.choice
	var best = c.options[0]
	if easy and rng.call() < 0.5:
		return {"type": "choose", "choice": c.options[int(floor(rng.call() * c.options.size()))]}
	match c.kind:
		"discard":
			# Mano rivelata dalla Palude: togli la carta più utile all'avversario
			var bv := -INF
			for t in c.options:
				var v := card_value(op.bf, t)
				if t == "U":
					v += 4
				if t == "R" and distinct(me.bf) >= 3:
					v += 3
				if v > bv:
					bv = v
					best = t
		"destroy":
			var d = best_destroy(op.bf).target
			if d != null:
				best = d
		"regrow":
			var r = best_regrow(me.bf, me.gy).target
			if r != null:
				best = r
	return {"type": "choose", "choice": best}
