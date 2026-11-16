## Simulazione veloce per il computer difficile.
## Stesse regole di game.gd e stesse scelte del computer normale di bot.gd, ma con soli numeri
## (terre 0–4, mani come conteggi, niente registro, eventi o dizionari): così il difficile
## riesce a giocare molte più partite immaginarie nello stesso tempo.
## La partita vera resta in game.gd; i test controllano che le due diano sempre gli stessi risultati.
extends RefCounted

const W := 0
const U := 1
const B := 2
const R := 3
const G := 4
const LETTERS := ["W", "U", "B", "R", "G"]
const IDX := {"W": 0, "U": 1, "B": 2, "R": 3, "G": 4}
const STEP := [0, 3, 9, 20, 45, 1000]

enum { MAIN, RESPONSE, CHOICE, OVER, RESOLVING }
enum { DISCARD, DESTROY, REGROW }

var rng: RandomNumberGenerator
var noise := 1.5  # variazione casuale del computer normale (0 nei test di confronto)
var d0 := PackedInt32Array()  # mazzo del giocatore 0 (l'ultima è la prima pescata)
var d1 := PackedInt32Array()
var hand := PackedInt32Array()  # conteggi: indice giocatore*5 + terra
var hsize := PackedInt32Array([0, 0])
var bf := PackedInt32Array()
var gy := PackedInt32Array()
var only_five := [false, false]
var limit_turn := -1
var limit_loser := 0
var turn := 0
var active := 0
var step := MAIN
var land_played := false
var pass_streak := 0
var last_land := -1
var winner := -1  # -1: parità (o partita in corso)
# terra in attesa di risposta
var p_owner := 0
var p_land := 0
var p_target := -1
var p_counters := 0
var p_responder := 0
# terra che sta risolvendo l'effetto
var r_active := false
var r_owner := 0
var r_land := 0
# scelta in corso
var c_player := 0
var c_kind := DISCARD
var c_opts := PackedInt32Array()

# risultati di best_destroy / best_regrow
var _bt := -1
var _bv := 0.0
# migliore mossa trovata da _consider
var _mc := -1
var _mt := -1
var _mv := -INF


static func _idx(x) -> int:
	return -1 if x == null else IDX[x]


## Copia lo stato della partita vera (AtlasGame) e restituisce se stessa.
func load_game(g) -> RefCounted:
	var s = self
	s.rng = RandomNumberGenerator.new()
	s.rng.randomize()
	s.d0 = PackedInt32Array()
	s.d1 = PackedInt32Array()
	s.hand.resize(10)
	s.bf.resize(10)
	s.gy.resize(10)
	for p in 2:
		var pl = g.players[p]
		var d := PackedInt32Array()
		for c in pl.deck:
			d.append(IDX[c])
		if p == 0:
			s.d0 = d
		else:
			s.d1 = d
		for c in pl.hand:
			s.hand[p * 5 + IDX[c]] += 1
		s.hsize[p] = pl.hand.size()
		for t in 5:
			s.bf[p * 5 + t] = pl.bf[LETTERS[t]]
			s.gy[p * 5 + t] = pl.gy[LETTERS[t]]
		s.only_five[p] = bool(g.only_five[p])
	if g.turn_limit != null:
		s.limit_turn = g.turn_limit.turn
		s.limit_loser = g.turn_limit.loser
	s.turn = g.turn
	s.active = g.active if g.active != null else 0
	s.land_played = g.land_played
	s.pass_streak = g.pass_streak
	s.last_land = g.last_land_player if g.last_land_player != null else -1
	s.winner = g.winner if g.winner != null else -1
	match g.step:
		"main":
			s.step = MAIN
		"response":
			s.step = RESPONSE
		"choice":
			s.step = CHOICE
		"resolving":
			s.step = RESOLVING
		_:
			s.step = OVER
	if g.phase != "playing":
		s.step = OVER
	if g.pending != null:
		s.p_owner = g.pending.owner
		s.p_land = IDX[g.pending.land]
		s.p_target = _idx(g.pending.target)
		s.p_counters = g.pending.counters
		s.p_responder = g.pending.responder if g.pending.responder != null else 0
	if g.resolving != null:
		s.r_active = true
		s.r_owner = g.resolving.owner
		s.r_land = IDX[g.resolving.land]
	if g.choice != null:
		s.c_player = g.choice.player
		s.c_kind = {"discard": DISCARD, "destroy": DESTROY, "regrow": REGROW}[g.choice.kind]
		for c in g.choice.options:
			s.c_opts.append(IDX[c])
	return s


## Copia indipendente (stesso generatore di numeri casuali).
func copy() -> RefCounted:
	var s = get_script().new()
	s.rng = rng
	s.noise = noise
	s.d0 = d0.duplicate()
	s.d1 = d1.duplicate()
	s.hand = hand.duplicate()
	s.hsize = hsize.duplicate()
	s.bf = bf.duplicate()
	s.gy = gy.duplicate()
	s.only_five = only_five
	s.limit_turn = limit_turn
	s.limit_loser = limit_loser
	s.turn = turn
	s.active = active
	s.step = step
	s.land_played = land_played
	s.pass_streak = pass_streak
	s.last_land = last_land
	s.winner = winner
	s.p_owner = p_owner
	s.p_land = p_land
	s.p_target = p_target
	s.p_counters = p_counters
	s.p_responder = p_responder
	s.r_active = r_active
	s.r_owner = r_owner
	s.r_land = r_land
	s.c_player = c_player
	s.c_kind = c_kind
	s.c_opts = c_opts.duplicate()
	return s


func _shuffle(a: PackedInt32Array) -> PackedInt32Array:
	for i in range(a.size() - 1, 0, -1):
		var j := rng.randi_range(0, i)
		var tmp := a[i]
		a[i] = a[j]
		a[j] = tmp
	return a


## Una versione possibile delle carte nascoste per chi siede in `p` (vedi bot.gd).
## `known`: la Palude ha appena rivelato la mano avversaria, che resta com'è.
func determinize(p: int, known: bool) -> void:
	var o := (1 - p) * 5
	if p == 0:
		d0 = _shuffle(d0)
	else:
		d1 = _shuffle(d1)
	if known:
		if p == 0:
			d1 = _shuffle(d1)
		else:
			d0 = _shuffle(d0)
		return
	var pool: PackedInt32Array = d1.duplicate() if p == 0 else d0.duplicate()
	for t in 5:
		for k in hand[o + t]:
			pool.append(t)
	pool = _shuffle(pool)
	var h := hsize[1 - p]
	for t in 5:
		hand[o + t] = 0
	for i in h:
		hand[o + pool[i]] += 1
	var rest := pool.slice(h)
	if p == 0:
		d1 = rest
	else:
		d0 = rest


func actor() -> int:
	match step:
		MAIN:
			return active
		RESPONSE:
			return p_responder
		CHOICE:
			return c_player
	return -1


# ---------------- Regole (come game.gd) ----------------

func _draw(p: int) -> void:
	var card: int
	if p == 0:
		if d0.is_empty():
			return
		card = d0[d0.size() - 1]
		d0.resize(d0.size() - 1)
	else:
		if d1.is_empty():
			return
		card = d1[d1.size() - 1]
		d1.resize(d1.size() - 1)
	hand[p * 5 + card] += 1
	hsize[p] += 1


func _begin_turn(p: int) -> void:
	if limit_turn >= 0 and turn >= limit_turn:
		_end(1 - limit_loser)
		return
	active = p
	turn += 1
	land_played = false
	step = MAIN
	if turn != 1:
		_draw(p)
	if _check_out():
		return
	if hsize[p] == 0:
		_count_pass()
		if _check_out():
			return
		_begin_turn(1 - p)


func _check_out() -> bool:
	if not d0.is_empty() or not d1.is_empty():
		return false
	if not (hsize[0] == 0 and hsize[1] == 0) and pass_streak < 2:
		return false
	var da := _distinct(0)
	var db := _distinct(5)
	if da != db:
		_end(0 if da > db else 1)
	else:
		_end(last_land)
	return true


func _count_pass() -> void:
	pass_streak = pass_streak + 1 if d0.is_empty() and d1.is_empty() else 0


func _distinct(o: int) -> int:
	var n := 0
	for t in 5:
		if bf[o + t] > 0:
			n += 1
	return n


func _has_won(p: int) -> bool:
	var o := p * 5
	var d := 0
	for t in 5:
		var x := bf[o + t]
		if x >= 5:
			return true
		if x > 0:
			d += 1
	return d == 5 and not only_five[p]


func _end(w: int) -> void:
	step = OVER
	winner = w


## Il bersaglio `t` è valido per la terra `land` giocata da `p`?
func _valid_target(p: int, land: int, t: int) -> bool:
	match land:
		R:
			return bf[(1 - p) * 5 + t] > 0
		G:
			return gy[p * 5 + t] > 0
		W:
			return t != W and bf[p * 5 + t] > 0
	return false


func _any_target(p: int, land: int) -> bool:
	for t in 5:
		if _valid_target(p, land, t):
			return true
	return false


## Azione nel formato del motore vero ({type, card, target, ...}). Ritorna false se non è valida.
func act(p: int, a: Dictionary) -> bool:
	if step == OVER:
		return false
	match a.type:
		"play":
			if step != MAIN or active != p or land_played:
				return false
			var card: int = IDX[a.card]
			if hand[p * 5 + card] == 0:
				return false
			var tgt := -1
			if (card == R or card == G or card == W) and _any_target(p, card):
				tgt = _idx(a.get("target"))
				if tgt < 0 or not _valid_target(p, card, tgt):
					return false
			_play(p, card, tgt)
		"pass":
			if step != MAIN or active != p or land_played:
				return false
			_pass(p)
		"allow":
			if step != RESPONSE or p_responder != p:
				return false
			_resolve_pending()
		"counter":
			if step != RESPONSE or p_responder != p:
				return false
			var other: int = IDX[a.other]
			var u := hand[p * 5 + U]
			if u < (2 if other == U else 1) or hand[p * 5 + other] == 0:
				return false
			_counter(p, other)
		"choose":
			if step != CHOICE or c_player != p:
				return false
			var c: int = IDX[a.choice]
			if not c_opts.has(c):
				return false
			_choose(p, c)
		_:
			return false
	return true


func _play(p: int, card: int, tgt: int) -> void:
	hand[p * 5 + card] -= 1
	hsize[p] -= 1
	land_played = true
	pass_streak = 0
	p_owner = p
	p_land = card
	p_target = tgt
	p_counters = 0
	_open_response(1 - p)


func _pass(p: int) -> void:
	_count_pass()
	if _check_out():
		return
	_begin_turn(1 - p)


func _open_response(r: int) -> void:
	if hsize[r] >= 2:
		step = RESPONSE
		p_responder = r
	else:
		_resolve_pending()


func _counter(p: int, other: int) -> void:
	var o := p * 5
	hand[o + U] -= 1
	hand[o + other] -= 1
	hsize[p] -= 2
	gy[o + U] += 1
	gy[o + other] += 1
	p_counters += 1
	_open_response(1 - p)


func _resolve_pending() -> void:
	var owner := p_owner
	var land := p_land
	step = RESOLVING
	if p_counters % 2 == 1:
		gy[owner * 5 + land] += 1
		_end_turn()
		return
	bf[owner * 5 + land] += 1
	var wins := _has_won(owner)
	bf[owner * 5 + land] -= 1
	r_active = true
	r_owner = owner
	r_land = land
	if wins:
		_finish_resolve()
		return
	_apply_effect(owner, land, p_target, false)


func _finish_resolve() -> void:
	if r_active:
		r_active = false
		bf[r_owner * 5 + r_land] += 1
		last_land = r_owner
		if _has_won(r_owner):
			_end(r_owner)
			return
	_end_turn()


func _open_choice(p: int, kind: int, src: PackedInt32Array, o: int) -> bool:
	c_opts = PackedInt32Array()
	for t in 5:
		if src[o + t] > 0:
			c_opts.append(t)
	if c_opts.is_empty():
		return false
	step = CHOICE
	c_player = p
	c_kind = kind
	return true


func _apply_effect(p: int, land: int, target: int, via_plains: bool) -> void:
	var o := (1 - p) * 5
	match land:
		U:
			_draw(p)
		B:
			if _open_choice(p, DISCARD, hand, o):
				return
		R:
			if via_plains:
				if _open_choice(p, DESTROY, bf, o):
					return
			elif target >= 0 and bf[o + target] > 0:
				bf[o + target] -= 1
				gy[o + target] += 1
		G:
			if via_plains:
				if _open_choice(p, REGROW, gy, p * 5):
					return
			elif target >= 0 and gy[p * 5 + target] > 0:
				gy[p * 5 + target] -= 1
				hand[p * 5 + target] += 1
				hsize[p] += 1
		W:
			if target >= 0 and bf[p * 5 + target] > 0:
				_apply_effect(p, target, -1, true)
				return
	_finish_resolve()


func _choose(p: int, c: int) -> void:
	var o := (1 - p) * 5
	match c_kind:
		DISCARD:
			hand[o + c] -= 1
			hsize[1 - p] -= 1
			gy[o + c] += 1
		DESTROY:
			bf[o + c] -= 1
			gy[o + c] += 1
		REGROW:
			gy[p * 5 + c] -= 1
			hand[p * 5 + c] += 1
			hsize[p] += 1
	_finish_resolve()


func _end_turn() -> void:
	if step == OVER:
		return
	_begin_turn(1 - active)


# ---------------- Computer normale (come bot.gd) ----------------

## Punteggio del campo di chi ha indice `o` (0 o 5), con `n` terre `t` in più (t = -1: nessuna).
func _score(o: int, t: int, n: int) -> int:
	var d := 0
	var m := 0
	for i in 5:
		var x := bf[o + i]
		if i == t:
			x += n
		if x > 0:
			d += 1
			if x > m:
				m = x
	if d == 5 or m >= 5:
		return 1000
	return STEP[d] + STEP[mini(m, 4)]


func _need(o: int, t: int, n: int) -> int:
	var d := 0
	var m := 0
	for i in 5:
		var x := bf[o + i]
		if i == t:
			x += n
		if x > 0:
			d += 1
			if x > m:
				m = x
	return mini(5 - d, 5 - m)


func _card_value(o: int, t: int) -> float:
	var v := 2.0
	var after := _score(o, t, 1)
	if after == 1000:
		v += 40
	v += (after - _score(o, -1, 0)) * 0.5
	if t == U:
		v += 3
	return v


func _destroy_value(o: int, t: int) -> float:
	if bf[o + t] == 0:
		return 0.0
	return _score(o, -1, 0) - _score(o, t, -1)


func _best_destroy(o: int) -> void:
	_bt = -1
	var v := -1.0
	for t in 5:
		if bf[o + t] > 0:
			var x := _destroy_value(o, t) + (0.5 if bf[o + t] == 1 else 0.0)
			if x > v:
				v = x
				_bt = t
	_bv = maxf(0.0, v)


func _best_regrow(o: int) -> void:
	_bt = -1
	var v := -1.0
	for t in 5:
		if gy[o + t] > 0:
			var x := _card_value(o, t)
			if x > v:
				v = x
				_bt = t
	_bv = maxf(0.0, v)


func _effect_value(owner: int, land: int, target: int) -> float:
	var mine := owner * 5
	var other := (1 - owner) * 5
	match land:
		U:
			return 4.0
		B:
			if hsize[1 - owner] == 0:
				return 0.0
			return 4.0 + (4.0 if _need(other, -1, 0) <= 1 else 0.0)
		R:
			return _destroy_value(other, target) * 1.2 if target >= 0 else 0.0
		G:
			return 1.0 + _card_value(mine, target) if target >= 0 else 0.0
		W:
			if target < 0:
				return 0.0
			if target == R:
				_best_destroy(other)
				return _bv * 1.2
			if target == G:
				_best_regrow(mine)
				return 1.0 + _bv
			return _effect_value(owner, target, -1)
	return 0.0


func _play_value(owner: int, card: int, target: int) -> float:
	var o := owner * 5
	var after := _score(o, card, 1)
	if after == 1000:
		return 10000.0
	return (after - _score(o, -1, 0)) + _effect_value(owner, card, target)


## Valore di una giocata per il computer normale, prima della piccola variazione casuale.
func main_value(p: int, card: int, target: int) -> float:
	var v := _play_value(p, card, target)
	var islands := hand[p * 5 + U]
	var op_need := _need((1 - p) * 5, -1, 0)
	if card == U and islands == 1 and op_need <= 2 and v < 1000:
		v -= 6
	if card != U and islands >= 1 and hsize[p] == 2 and op_need <= 1 and v < 1000:
		v -= 4
	return v


func _consider(p: int, card: int, target: int) -> void:
	var v := main_value(p, card, target) + rng.randf() * noise
	if v > _mv:
		_mv = v
		_mc = card
		_mt = target


func _bot_main(p: int) -> void:
	_mc = -1
	_mt = -1
	_mv = -INF
	for card in 5:
		if hand[p * 5 + card] == 0:
			continue
		var any := false
		if card == R or card == G or card == W:
			for t in 5:
				if _valid_target(p, card, t):
					any = true
					_consider(p, card, t)
		if not any:
			_consider(p, card, -1)
	if _mc < 0:
		_pass(p)
	else:
		_play(p, _mc, _mt)


func _keep_value(p: int, t: int) -> float:
	return _card_value(p * 5, t) - (hand[p * 5 + t] - 1) * 2


func _bot_response(p: int) -> void:
	var o := p * 5
	var u := hand[o + U]
	if u == 0:
		_resolve_pending()
		return
	var resolves := p_counters % 2 == 0
	var want := false
	if p_owner != p and resolves:
		var harm := _play_value(p_owner, p_land, p_target)
		var threat := _need((1 - p) * 5, p_land, 1) <= 1
		want = harm >= 1000 or harm >= 16 or (threat and harm >= 10)
	elif p_owner == p and not resolves:
		var gain := _play_value(p, p_land, p_target)
		want = gain >= 1000 or gain >= 18
	var best := -1
	if want:
		var bk := INF
		for t in 5:
			var ok := u >= 2 if t == U else hand[o + t] > 0
			if ok:
				var k := _keep_value(p, t)
				if k < bk:
					bk = k
					best = t
	if best < 0:
		_resolve_pending()
	else:
		_counter(p, best)


func _bot_choice(p: int) -> void:
	var best := c_opts[0]
	var mine := p * 5
	var other := (1 - p) * 5
	match c_kind:
		DISCARD:
			var bv := -INF
			var dist := _distinct(mine)
			for t in c_opts:
				var v := _card_value(other, t)
				if t == U:
					v += 4
				if t == R and dist >= 3:
					v += 3
				if v > bv:
					bv = v
					best = t
		DESTROY:
			_best_destroy(other)
			if _bt >= 0:
				best = _bt
		REGROW:
			_best_regrow(mine)
			if _bt >= 0:
				best = _bt
	_choose(p, best)


## Un passo del computer normale per chi deve agire.
func bot_step() -> void:
	match step:
		MAIN:
			_bot_main(active)
		RESPONSE:
			_bot_response(p_responder)
		CHOICE:
			_bot_choice(c_player)


## Gioca fino in fondo con il computer normale da entrambe le parti; 1 se `seat` vince, 0 se perde.
func playout(seat: int) -> float:
	var guard := 0
	while step != OVER and guard < 400:
		guard += 1
		bot_step()
	if step != OVER or winner < 0:
		return 0.5
	return 1.0 if winner == seat else 0.0
