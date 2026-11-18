## Test del tavolo: si gioca davvero con il mouse simulato (premere, trascinare, toccare),
## come farebbe una persona, e si controlla che la partita vada come deve.
extends "res://tests/test_base.gd"

const Table := preload("res://scripts/ui/table.gd")

var t: Table


func tests() -> Array:
	return [
		["trascinare una carta al centro la gioca", t_drag],
		["toccare una carta e poi il centro la gioca", t_tap],
		["la Montagna aspetta il bersaglio, poi distrugge", t_target],
		["lasciata fuori dal centro la carta torna in mano", t_drag_back],
		["contrasto guidato: Isola + seconda carta scelta in mano", t_counter],
		["Palude: la mano avversaria a schermo e si sceglie la carta", t_swamp],
		["Foresta: il cimitero si apre e si sceglie la terra", t_forest],
		["partita intera contro il computer usando solo il tavolo", t_full_game],
		["nessuna sovrapposizione e niente fuori schermo, in ogni formato", t_layouts],
		["tutorial completo seguendo il Maestro, fino alla vittoria", t_tutorial],
		["partita salvata e ripresa dopo la chiusura", t_resume],
		["tempo scaduto: il turno passa da solo", t_timer],
		["freccia verso il bersaglio della terra avversaria", t_arrow],
	]


func _tree() -> SceneTree:
	return Engine.get_main_loop()


## Nuovo tavolo con una partita in cui inizio io, con mani e campo decisi.
## Il profilo di prova «Anna» viene cancellato ogni volta: i test non lasciano statistiche.
func _new_table(o := {}, sz := Vector2(1280, 720)):
	preload("res://scripts/app/profile.gd").remove("Anna")
	if t != null and is_instance_valid(t):
		t.queue_free()
	t = Table.new()
	_tree().root.add_child(t)
	t.size = sz
	await _tree().process_frame
	t.size = sz
	t.save_enabled = false
	t.deal_anim = false
	t.start("normal", "Anna", {"firstPlayer": 0})
	var g = t.g
	for i in 2:
		var pl = g.players[i]
		if o.has("h%d" % i):
			pl["hand"] = o["h%d" % i].duplicate()
		if o.has("bf%d" % i):
			pl["bf"] = count(o["bf%d" % i])
		if o.has("gy%d" % i):
			pl["gy"] = count(o["gy%d" % i])
	t.V = g.view(0)
	t._layout()
	t._refresh()
	await _idle()


## Aspetta che animazioni e mosse del computer finiscano e tocchi a me (o che la partita finisca).
func _idle(max_s := 20.0) -> void:
	var t0 := Time.get_ticks_msec()
	while Time.get_ticks_msec() - t0 < max_s * 1000:
		await _tree().process_frame
		if t.busy or t._bot_thinking:
			continue
		if t.g.phase != "playing" or t._task() != "":
			return


func _mouse(pos: Vector2, pressed: bool) -> void:
	var e := InputEventMouseButton.new()
	e.button_index = MOUSE_BUTTON_LEFT
	e.pressed = pressed
	e.position = pos
	t._gui_input(e)


func _move(pos: Vector2) -> void:
	var e := InputEventMouseMotion.new()
	e.position = pos
	t._gui_input(e)


func _card_center(card: String) -> Vector2:
	for c in t.hand_cards:
		if c.kind == card and c.visible:
			return c.get_global_transform() * (c.size / 2)
	failures.append("non trovo %s in mano" % card)
	return Vector2.ZERO


func _drag_to(from: Vector2, to: Vector2) -> void:
	_mouse(from, true)
	for k in range(1, 9):
		_move(from.lerp(to, k / 8.0))
		await _tree().process_frame
	_mouse(to, false)
	await _tree().process_frame


func _tap(p: Vector2) -> void:
	_mouse(p, true)
	_mouse(p, false)
	await _tree().process_frame


func t_drag():
	await _new_table({"h0": ["G", "U"], "h1": ["W"]})
	await _drag_to(_card_center("G"), t.stack_rect.get_center())
	# subito (Bruno ha una carta sola, quindi risolve all'istante): dopo, il computer potrebbe distruggerla
	eq(t.g.players[0].bf.G, 1, "Foresta in gioco")
	await _idle()
	return true


func t_tap():
	await _new_table({"h0": ["G", "U"], "h1": ["W"]})
	await _tap(_card_center("U"))
	check(t.sel != null and t.sel.card == "U", "carta scelta")
	await _tap(t.stack_rect.get_center())
	eq(t.g.players[0].bf.U, 1, "Isola in gioco")
	await _idle()
	return true


func t_target():
	await _new_table({"h0": ["R", "U"], "h1": ["W"], "bf1": {"G": 1, "B": 1}})
	await _drag_to(_card_center("R"), t.stack_rect.get_center())
	check(t.staged != null, "la Montagna resta al centro in attesa")
	eq(t.g.players[0].bf.R, 0, "non ancora giocata")
	await _tap(t.zones.opp.slots["B"].get_global_rect().get_center())
	# subito (Bruno ha una carta sola, quindi risolve all'istante): dopo, il computer potrebbe
	# distruggere la mia Montagna
	eq(t.g.players[1].bf.B, 0, "Palude distrutta")
	eq(t.g.players[1].bf.G, 1, "Foresta intatta")
	eq(t.g.players[0].bf.R, 1, "Montagna in gioco")
	await _idle()
	return true


func t_drag_back():
	await _new_table({"h0": ["G", "U"], "h1": ["W"]})
	await _drag_to(_card_center("G"), Vector2(40, 700))
	await _tree().create_timer(0.3).timeout
	eq(t.g.players[0].hand.size(), 2, "nessuna carta giocata")
	eq(t.g.step, "main")
	return true


func t_counter():
	await _new_table({"h0": ["U", "B", "G"], "h1": ["R", "W", "W"], "bf0": {"W": 1}})
	# passo il turno; il computer pesca una Pianura e gioca la Montagna sulla mia Pianura
	t.g.players[1]["deck"] = ["W", "W", "W"]
	t.act({"type": "pass"})
	var t0 := Time.get_ticks_msec()
	while t._task() != "response" and Time.get_ticks_msec() - t0 < 15000:
		await _tree().process_frame
	if t._task() != "response":
		failures.append("il computer non ha giocato (passo %s)" % str(t.g.step))
		return true
	eq(t.g.pending.land, "R", "il computer gioca la Montagna")
	t._counter_start()
	check(t.counter_mode, "modalità contrasto")
	await _tap(_card_center("G"))
	check(t.pick != null and t.pick.card == "G", "seconda carta scelta")
	var ok_btn: Button = null
	for row in t.actions.get_children():
		for b in row.get_children():
			if b is Button and b.text == "Conferma":
				ok_btn = b
	check(ok_btn != null, "pulsante Conferma")
	if ok_btn != null:
		ok_btn.pressed.emit()
	await _idle()
	eq(t.g.players[0].gy.U, 1, "Isola scartata")
	eq(t.g.players[0].gy.G, 1, "Foresta scartata")
	eq(t.g.players[0].bf.W, 1, "la mia Pianura è salva")
	return true


func t_swamp():
	await _new_table({"h0": ["B", "U"], "h1": ["G", "R"]})
	await _drag_to(_card_center("B"), t.stack_rect.get_center())
	var t0 := Time.get_ticks_msec()
	while not t.overlay_layer.has_node("Reveal") and Time.get_ticks_msec() - t0 < 8000:
		await _tree().process_frame
	var rv = t.overlay_layer.get_node_or_null("Reveal")
	check(rv != null, "la mano avversaria è a schermo")
	if rv == null:
		return true
	var picked := false
	for b in rv.get_children():
		if b is Button and b.get_child(0).kind == "R":
			b.pressed.emit()
			picked = true
	check(picked, "c'è la Montagna da scegliere")
	# subito: dopo, il computer potrebbe riprendersela con una Foresta
	eq(t.g.players[1].gy.R, 1, "Montagna scartata")
	await _idle()
	return true


func t_forest():
	await _new_table({"h0": ["G", "U"], "h1": ["W"], "gy0": {"B": 1, "R": 2}})
	await _drag_to(_card_center("G"), t.stack_rect.get_center())
	var pop = t.overlay_layer.get_node_or_null("GyPop")
	check(pop != null, "il cimitero si apre da solo")
	if pop == null:
		return true
	var done := false
	for b in pop.get_child(0).get_children():
		if b is Button and b.text.begins_with("Montagna"):
			b.pressed.emit()
			done = true
	check(done, "Montagna tra i bersagli")
	await _idle()
	eq(t.g.players[0].gy.R, 1, "una Montagna ripresa")
	check(t.g.players[0].hand.has("R"), "Montagna in mano")
	return true


## Gioca una partita intera toccando il tavolo: la prima carta giocabile, con il primo bersaglio.
func t_full_game():
	await _new_table()
	var guard := 0
	while t.g.phase == "playing" and guard < 200:
		guard += 1
		await _idle(30)
		if t.g.phase != "playing":
			break
		var task := t._task()
		if task == "main":
			var cards: Array = t.V.playable.keys()
			if cards.is_empty():
				t.act({"type": "pass"})
				continue
			var c: String = cards[0]
			await _drag_to(_card_center(c), t.stack_rect.get_center())
			if t.staged != null:
				var tg: Dictionary = t._board_targets()
				if not tg.gy.is_empty():
					t._gy_target(tg.gy[0])
				elif not tg.opp.is_empty():
					await _tap(t.zones.opp.slots[tg.opp[0]].get_global_rect().get_center())
				else:
					await _tap(t.zones.me.slots[tg.me[0]].get_global_rect().get_center())
		elif task == "response":
			t.act({"type": "allow"})
		elif task == "choice":
			t.act({"type": "choose", "choice": t.V.choice.options[0]})
	await _idle(30)
	await _tree().create_timer(1.0).timeout
	eq(t.g.phase, "over", "la partita finisce")
	check(t.overlay_layer.has_node("Over"), "schermata di fine partita")
	return true


## Nessun elemento del tavolo esce dallo schermo o si sovrappone a un altro.
func t_layouts():
	for sz in [Vector2(354, 792), Vector2(792, 354), Vector2(390, 844), Vector2(360, 640), Vector2(844, 390), Vector2(667, 375), Vector2(1024, 768),
			Vector2(768, 1024), Vector2(1280, 720), Vector2(1920, 1080), Vector2(2560, 1080)]:
		await _new_table({"h0": ["W", "U", "B", "R", "G", "G", "U", "W"]}, sz)
		var boxes := {}
		for w in ["opp", "me"]:
			var z = t.zones[w]
			boxes[w + " nome"] = z.name.get_global_rect()
			boxes[w + " mazzo"] = z.deck.get_global_rect()
			boxes[w + " cimitero"] = z.gy.get_global_rect()
			if w == "opp":
				boxes[w + " dorsi"] = z.backs.get_global_rect()
			boxes[w + " campo"] = z.slots["W"].get_global_rect().merge(z.slots["G"].get_global_rect())
		boxes["carta al centro"] = t.stack_rect
		boxes["menu"] = t.menu_btn.get_global_rect()
		boxes["reazioni"] = t.react_btn.get_global_rect()
		if sz.x < sz.y:
			# telefono in verticale: anche la striscia del tempo e le azioni (scritte e pulsanti)
			t.turn_time = 30
			boxes["tempo"] = t.timer_bar.get_global_rect()
			var ar: Rect2 = t.actions.get_global_rect()
			ar.size *= t.actions.scale
			boxes["azioni"] = Rect2(ar.position, Vector2(ar.size.x, t.actions.get_combined_minimum_size().y * t.actions.scale.y))
		var hand := Rect2()
		for c in t.hand_cards:
			var hr := Rect2(c.position, c.size)
			hand = hr if hand.size == Vector2.ZERO else hand.merge(hr)
		boxes["mano"] = hand.grow(-4)
		# i nomi non devono ridursi a poche lettere
		for w in ["opp", "me"]:
			var z = t.zones[w]
			var full: float = z.name.get_theme_font("font").get_string_size(z.name.text, HORIZONTAL_ALIGNMENT_LEFT, -1, int(t._fs.name)).x
			if z.name.size.x < minf(full, 60.0):
				failures.append("%s: il nome di %s è tagliato troppo (%d punti)" % [sz, w, int(z.name.size.x)])
		var screen := Rect2(Vector2.ZERO, sz)
		var keys := boxes.keys()
		for i in keys.size():
			var a: Rect2 = boxes[keys[i]]
			if not screen.grow(1).encloses(a):
				failures.append("%s: %s esce dallo schermo %s" % [sz, keys[i], a])
			for j in range(i + 1, keys.size()):
				var b: Rect2 = boxes[keys[j]]
				if a.grow(-1).intersects(b.grow(-1)):
					failures.append("%s: %s si sovrappone a %s" % [sz, keys[i], keys[j]])
	t.queue_free()
	return true


func _press_button(text: String) -> bool:
	for b in _all_buttons(t):
		if b is Button and b.text == text and b.is_visible_in_tree():
			b.pressed.emit()
			return true
	return false


func _all_buttons(n: Node) -> Array:
	var out := []
	for c in n.get_children():
		if c is Button:
			out.append(c)
		out.append_array(_all_buttons(c))
	return out


## Segue il tutorial come un giocatore nuovo: legge, preme «Avanti», fa la mossa indicata.
func t_tutorial():
	const Profile := preload("res://scripts/app/profile.gd")
	Profile.remove("zz tutorial")
	if t != null and is_instance_valid(t):
		t.queue_free()
	t = Table.new()
	_tree().root.add_child(t)
	t.size = Vector2(390, 844)
	await _tree().process_frame
	t.save_enabled = false
	t.deal_anim = false
	t.start("normal", "zz tutorial", {}, {"kind": "tutorial"})
	var t0 := Time.get_ticks_msec()
	var tried_counter := false
	var tried_card := false
	while t.g.phase == "playing" and Time.get_ticks_msec() - t0 < 180000:
		await _tree().process_frame
		if t.busy or t.coach == null:
			continue
		var P = t.coach.shown()
		if P == null:
			continue
		if P.get("info", false) or P.get("go", false) or P.get("review", false):
			t.coach.next()
			await _tree().process_frame
			continue
		var hl: String = P.get("hl", "")
		var task: String = t._task()
		# fuori programma: «Contrasta» quando il Maestro chiede di lasciar risolvere
		if hl == "btn:Lascia risolvere" and not tried_counter and t.actions.find_children("*", "Button", true, false).any(func(x): return x.text == "Contrasta"):
			tried_counter = true
			t.caption = ""
			_press_button("Contrasta")
			check(not t.counter_mode, "nel tutorial «Contrasta» fuori programma non parte")
			check(t.caption != "", "avviso per il gesto fuori programma")
			t.caption = ""
		# fuori programma: trascinare una carta diversa da quella indicata
		if hl.begins_with("hand:") and task == "main" and not tried_card:
			var other := ""
			for c in t.V.hand:
				if c != hl.substr(5) and t.V.playable.has(c):
					other = c
			if other != "":
				tried_card = true
				await _drag_to(_card_center(other), t.stack_rect.get_center())
				check(t.staged == null and t.g.turn == t.V.turn and t._task() == "main", "nel tutorial non si gioca una carta diversa")
				t.caption = ""
				await _idle()
		if hl.begins_with("hand:") and task == "main":
			await _drag_to(_card_center(hl.substr(5)), t.stack_rect.get_center())
		elif t.staged != null:
			var c: String = t.staged.card
			if c == "G":
				t._gy_target("U")
			elif c == "W":
				await _tap(t.zones.me.slots["R"].get_global_rect().get_center())
			else:
				var tg: Dictionary = t._board_targets()
				await _tap(t.zones.opp.slots[tg.opp[0]].get_global_rect().get_center())
		elif hl.begins_with("btn:"):
			check(_press_button(hl.substr(4)), "manca il pulsante %s" % hl)
		elif task == "response" and t.counter_mode and t.pick == null:
			var plan = t._counter_plan()
			for i in plan.eligible.size():
				if plan.eligible[i]:
					await _tap(t.hand_cards[i].get_global_transform() * (t.hand_cards[i].size / 2))
					break
		elif task == "choice" and t.V.choice.kind == "destroy":
			await _tap(t.zones.opp.slots[t.V.choice.options[0]].get_global_rect().get_center())
		for k in 3:
			await _tree().process_frame
	await _idle(10)
	eq(t.g.phase, "over", "il tutorial finisce")
	eq(t.g.winner, 0, "e lo vinci tu")
	eq(t.g.turn, 13, "al turno 13 come nella versione web")
	check(tried_counter and tried_card, "provati i gesti fuori programma")
	check(Profile.load_profile("zz tutorial").tutorial, "tutorial segnato come completato")
	Profile.remove("zz tutorial")
	t.queue_free()
	return true


func t_resume():
	await _new_table({"h0": ["G", "U", "R"], "h1": ["W", "B"]})
	t.save_enabled = true
	await _drag_to(_card_center("G"), t.stack_rect.get_center())
	await _idle()
	var saved := Table.saved_game()
	check(not saved.is_empty(), "partita salvata")
	var before: Dictionary = t.g.to_dict()
	t.queue_free()
	t = Table.new()
	_tree().root.add_child(t)
	t.size = Vector2(1280, 720)
	await _tree().process_frame
	t.resume(saved)
	await _idle()
	eq(t.g.players[0].bf, before.players[0].bf, "stesso campo")
	eq(t.g.players[0].hand, before.players[0].hand, "stessa mano")
	eq(t.g.turn, before.turn, "stesso turno")
	var log_before: int = t.g.log_lines.size()
	t.act(simple_action(t.g))
	await _idle()
	check(t.g.log_lines.size() > log_before, "si continua a giocare")
	Table.forget_save()
	t.queue_free()
	return true


func t_timer():
	await _new_table({"h0": ["G", "U"], "h1": ["W"]})
	t.turn_time = 2
	var t0 := Time.get_ticks_msec()
	while t.g.turn == 1 and Time.get_ticks_msec() - t0 < 6000:
		await _tree().process_frame
	check(t.g.turn >= 2, "il turno è passato allo scadere del tempo")
	check(t.g.log_lines.any(func(l): return l.begins_with("⏱")), "nel registro c'è il tempo scaduto")
	t.queue_free()
	return true


func t_arrow():
	await _new_table({"h0": ["G", "U", "B"], "h1": ["R", "W", "W"], "bf0": {"W": 1}})
	t.g.players[1]["deck"] = ["W", "W", "W"]
	t.act({"type": "pass"})
	var t0 := Time.get_ticks_msec()
	while t._task() != "response" and Time.get_ticks_msec() - t0 < 15000:
		await _tree().process_frame
	var a = t._arrow_target()
	check(a != null, "c'è una freccia")
	if a != null:
		eq(a.rect, t._slot_rect("me", "W"), "punta alla mia Pianura")
	t.queue_free()
	preload("res://scripts/app/profile.gd").remove("Anna")
	return true
