## Test delle partite tra amici: serve il server della versione web acceso sul PC.
##   PORT=3999 node server.js
##   godot --headless --path godot -s res://tests/only.gd -- test_online --server=ws://localhost:3999
## Il tavolo (giocatore A) gioca contro un secondo collegamento (giocatore B) che risponde da solo.
extends "res://tests/test_base.gd"

const Table := preload("res://scripts/ui/table.gd")
const Net := preload("res://scripts/net/net.gd")

var t: Table
var a_net: Node
var b_net: Node
var b_state := {}
var b_reacts: Array = []


func tests() -> Array:
	return [
		["stanza, partita intera, reazioni e rivincita con un amico", t_online],
		["tra giocatori ci si arrende", t_surrender],
	]


func _tree() -> SceneTree:
	return Engine.get_main_loop()


func _wait(cond: Callable, secs: float) -> bool:
	var end := Time.get_ticks_msec() + secs * 1000
	while Time.get_ticks_msec() < end:
		if cond.call():
			return true
		await _tree().process_frame
	return false


## B gioca da solo: la prima carta che può, altrimenti passa; lascia sempre risolvere.
func _b_move(m: Dictionary) -> void:
	if m.get("t") == "react":
		b_reacts.append(m)
		return
	if m.get("t") != "state" or not m.get("game") is Dictionary:
		return
	b_state = m
	var v: Dictionary = m.game
	if v.phase != "playing":
		return
	var me: int = m.seat
	var a = null
	if v.step == "main" and v.active == me:
		a = {"type": "pass"}
		for c in v.get("playable", {}):
			var tg: Array = v.playable[c] if v.playable[c] != null else []
			if tg.is_empty() and c in ["R", "G", "W"]:
				continue
			a = {"type": "play", "card": c}
			if not tg.is_empty():
				a.target = tg[0]
			break
	elif v.step == "response" and v.pending.responder == me:
		a = {"type": "allow"}
	elif v.step == "choice" and v.choice.player == me:
		a = {"type": "choose", "choice": v.choice.options[0]}
	if a != null:
		b_net.send({"t": "action", "a": a})


## A (il tavolo) gioca allo stesso modo, usando le funzioni del tavolo.
func _a_step() -> void:
	if t.busy or t._awaiting:
		return
	var task := t._task()
	if task == "main":
		var a := {"type": "pass"}
		for c in t.V.get("playable", {}):
			var tg: Array = t.V.playable[c] if t.V.playable[c] != null else []
			if tg.is_empty() and c in ["R", "G", "W"]:
				continue
			a = {"type": "play", "card": c}
			if not tg.is_empty():
				a.target = tg[0]
			break
		t.act(a)
	elif task == "response":
		t.act({"type": "allow"})
	elif task == "choice":
		t.act({"type": "choose", "choice": t.V.choice.options[0]})


func _setup() -> bool:
	preload("res://scripts/app/profile.gd").remove("Anna")
	a_net = Net.new()
	b_net = Net.new()
	_tree().root.add_child(a_net)
	_tree().root.add_child(b_net)
	b_net.message.connect(_b_move)
	var a_msgs: Array = []
	a_net.message.connect(func(m): a_msgs.append(m))
	a_net.send({"t": "create", "name": "Anna", "turnTime": 0})
	if not await _wait(func(): return a_msgs.any(func(m): return m.t == "state"), 10):
		check(false, "il server non risponde (è acceso?)")
		return false
	var code: String = a_msgs.filter(func(m): return m.t == "state")[0].code
	check(code.length() == 4, "codice della stanza")
	b_net.send({"t": "join", "code": code, "name": "Bruno"})
	if not await _wait(func(): return a_msgs.any(func(m): return m.t == "state" and m.game is Dictionary), 10):
		check(false, "l'amico non è entrato")
		return false
	a_net.paused = true
	var first: Dictionary = a_msgs.filter(func(m): return m.t == "state" and m.game is Dictionary)[0]
	t = Table.new()
	_tree().root.add_child(t)
	t.size = Vector2(390, 844)
	t.save_enabled = false
	t.deal_anim = false
	await _tree().process_frame
	t.start_online(a_net, first, "Anna")
	return true


func _teardown() -> void:
	if t != null and is_instance_valid(t):
		t.leave_online()
		t.queue_free()
	if is_instance_valid(b_net):
		b_net.shut()
	await _tree().create_timer(0.5).timeout
	preload("res://scripts/app/profile.gd").remove("Anna")


func _play_to_end(secs: float) -> bool:
	return await _wait(func():
		_a_step()
		return t.g.phase != "playing" and not t.busy, secs)


func t_online():
	if not await _setup():
		return true
	eq(t.me, 0, "chi crea la stanza ha il posto 0")
	eq(t.V.opp.name, "Bruno", "nome dell'avversario")
	check(t.bot == null, "niente computer con un amico")
	# reazione: arriva all'altro giocatore
	t._react(t.me, 1)
	check(await _wait(func(): return not b_reacts.is_empty(), 5), "la reazione arriva all'amico")
	var done: bool = await _play_to_end(240)
	if not done:
		print("DEBUG turn=%s step=%s actor=%s busy=%s await=%s task=%s me=%s Vstep=%s Vactive=%s playable=%s pending=%s" % [t.g.turn, t.g.step, t.g.actor(), t.busy, t._awaiting, t._task(), t.me, t.V.step, t.V.active, t.V.get("playable"), t.V.pending])
	check(done, "la partita arriva alla fine")
	eq(t.g.phase, "over", "partita finita")
	eq(b_state.game.phase, "over", "finita anche per l'amico")
	check(await _wait(func(): return t.overlay_layer.has_node("Over"), 3), "finestra di fine partita")
	# rivincita: la chiedono tutti e due
	t._net.send({"t": "rematch"})
	b_net.send({"t": "rematch"})
	check(await _wait(func(): return t.g.phase == "playing" and t.g.turn <= 2, 10), "la rivincita fa partire una nuova partita")
	check(not t.overlay_layer.has_node("Over"), "la finestra di fine partita si chiude")
	await _teardown()
	return true


func t_surrender():
	if not await _setup():
		return true
	await _wait(func(): return not t.busy, 10)
	t.act({"type": "surrender"})
	check(await _wait(func(): return t.g.phase == "over" and not t.busy, 10), "la resa chiude la partita")
	eq(t.g.winner, 1, "vince l'amico")
	eq(t.g.end_reason, "surrender", "motivo: resa")
	await _teardown()
	return true
