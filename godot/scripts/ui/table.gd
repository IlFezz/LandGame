## Il tavolo di gioco contro il computer: disposizione per ogni schermo, mano a ventaglio,
## trascinamento e tocco, bersagli, contrasto, Palude, animazioni degli eventi e fine partita.
## Le misure seguono style.css della versione web (telefono verticale, PC/tablet, telefono orizzontale).
extends Control

signal exit_requested
signal fullscreen_requested

const Game := preload("res://scripts/rules/game.gd")
const Bot := preload("res://scripts/rules/bot.gd")
const Art := preload("res://scripts/ui/art.gd")
const W := preload("res://scripts/ui/widgets.gd")
const Card := preload("res://scripts/ui/card_view.gd")
const Modes := preload("res://scripts/app/modes.gd")
const Profile := preload("res://scripts/app/profile.gd")
const Prefs := preload("res://scripts/app/prefs.gd")
const Sound := preload("res://scripts/app/sound.gd")
const Sheets := preload("res://scripts/ui/sheets.gd")
const TYPES := ["W", "U", "B", "R", "G"]
const SAVE := "user://partita.json"  # la partita in corso: riprende se l'app viene chiusa

const FLY := 0.5  # durata di un volo di carta (una sola velocità, lenta)
const SLOP := 6.0  # movimento oltre il quale la pressione diventa trascinamento
const PEEK_S := 0.45  # tenendo premuto così a lungo si apre l'anteprima della carta

# ---------- partita ----------
var g: Game
var bot: Bot
var level := "normal"
var player_name := "Tu"
var mode := {"kind": "bot"}  # kind: "bot" | "challenge" | "daily" | "tutorial"
var cur := {}  # conteggi della partita per statistiche e obiettivi
var new_goals: Array = []
var me := 0
var V := {}  # vista mostrata adesso (durante le animazioni è quella dell'evento in corso)
var busy := false  # animazioni in corso: niente input di gioco
var _pumping := false
var _bot_thinking := false
var _auto_allow_key := ""
var _game_id := 0
var autoplay := false  # solo per le prove: il computer gioca anche al posto mio
var save_enabled := true  # i test lo spengono, per non lasciare partite salvate
var turn_time := 0  # secondi per turno (0: illimitato)
var _timer_key := ""
var _timer_end := 0.0
var _last_tick := -1
var timer_bar: Control
var arrow_layer: Control
var react_btn: Button
var _react_last := 0
var _me_bot: Bot

# ---------- stato dell'interfaccia ----------
var staged = null  # carta posata al centro in attesa del bersaglio: { card, idx }
var sel = null  # carta scelta con un tocco (comandi a tocco): { card, idx }
var counter_mode := false
var pick = null  # seconda carta scelta per il contrasto: { card, idx }
var gy_open := ""  # "me" | "opp" | ""
var caption := ""
var caption_danger := false
var rose_angle := 0.0

# ---------- disposizione ----------
var lay := "portrait"  # "portrait" | "wide" | "side"
var tablet := false
var sw := 60.0  # larghezza delle carte sul campo
var hw := 64.0  # larghezza delle carte in mano
var cw := 90.0  # larghezza della carta al centro
var hand_rect := Rect2()
var center_rect := Rect2()
var stack_rect := Rect2()
var _fs := {}  # misure dei caratteri per la disposizione corrente

# ---------- nodi ----------
var bg: W.Table
var top_mode: Label
var menu_btn: Button
var zones := {}  # "me"/"opp" -> { name, dot, near, backs, deck, gy, slots: {t: Slot} }
var center_frame: Control
var stack_card: Card
var unstage_btn: Button
var ctr_label: Label
var status_label: Label
var actions: VBoxContainer
var hand_layer: Control
var hand_cards: Array = []  # CardView in mano, nello stesso ordine di V.hand
var fly_layer: Control
var overlay_layer: Control
var peek_layer: Control

# ---------- input ----------
var _press = null  # { card(view), idx, pos, t, moved, from }
var _drag = null  # { view, idx, grab }
var _hover_idx := -1
var tut_idx := -1  # carta da giocare indicata dal tutorial: sta sollevata e dritta
var _play_from := Rect2()  # da dove parte il volo della carta giocata (dove è stata lasciata)


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	_build()
	resized.connect(_on_resize)


# =====================================================================
#  Costruzione dei nodi
# =====================================================================

func _build() -> void:
	bg = W.Table.new()
	add_child(bg)
	center_frame = Control.new()
	center_frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	center_frame.draw.connect(_draw_center_frame)
	add_child(center_frame)
	top_mode = W.label("", 12, Art.MUTO)
	add_child(top_mode)
	menu_btn = W.button("☰", "dark", 17)
	menu_btn.pressed.connect(_open_menu)
	for st in ["normal", "hover", "pressed"]:
		var mb: StyleBoxFlat = menu_btn.get_theme_stylebox(st).duplicate()
		mb.border_color = Art.RIGA
		mb.bg_color = Color(0, 0, 0, 0)
		for m in ["left", "right", "top", "bottom"]:
			mb.set("content_margin_" + m, 2)
		menu_btn.add_theme_stylebox_override(st, mb)
	add_child(menu_btn)
	for w in ["opp", "me"]:
		var z := {}
		z.name = W.label("", 15, Art.MUTO, Art.bold())
		z.name.clip_text = true
		z.name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		add_child(z.name)
		z.dot = W.Dot.new()
		add_child(z.dot)
		z.near = W.label("!", 12, Color.WHITE, Art.bold())
		z.near.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		z.near.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		z.near.add_theme_stylebox_override("normal", Art.box(Art.ROSSO, 9))
		add_child(z.near)
		if w == "opp":
			z.backs = W.Backs.new()
			add_child(z.backs)
		z.deck = W.Deck.new()
		add_child(z.deck)
		z.gy = W.GyBadge.new()
		z.gy.pressed.connect(_toggle_gy.bind(w))
		add_child(z.gy)
		z.slots = {}
		for t in TYPES:
			var s := W.Slot.new()
			s.land = t
			add_child(s)
			z.slots[t] = s
		zones[w] = z
	stack_card = Card.new()
	stack_card.visible = false
	add_child(stack_card)
	unstage_btn = W.button("", "ink", 13)
	unstage_btn.icon = Art.line_icon("chiudi", "<path d=\"M7 7l10 10M17 7L7 17\"/>", Art.TESTO, 16)
	unstage_btn.add_theme_constant_override("icon_max_width", 16)
	unstage_btn.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	unstage_btn.visible = false
	unstage_btn.pressed.connect(_unstage)
	var ub := Art.box(Art.FOGLIO, 14, Art.TESTO, 2)
	for m in ["left", "right", "top", "bottom"]:
		ub.set("content_margin_" + m, 0)
	for st in ["normal", "hover", "pressed"]:
		unstage_btn.add_theme_stylebox_override(st, ub)
	add_child(unstage_btn)
	ctr_label = W.label("", 15, Art.TESTO, Art.bold())
	ctr_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(ctr_label)
	status_label = W.label("", 14, Art.TESTO, Art.bold())
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	status_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	add_child(status_label)
	actions = VBoxContainer.new()
	actions.alignment = BoxContainer.ALIGNMENT_CENTER
	actions.add_theme_constant_override("separation", 8)
	actions.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(actions)
	hand_layer = Control.new()
	hand_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(hand_layer)
	fly_layer = Control.new()
	fly_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(fly_layer)
	overlay_layer = Control.new()
	overlay_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(overlay_layer)
	arrow_layer = Control.new()
	arrow_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	arrow_layer.draw.connect(_draw_arrow)
	add_child(arrow_layer)
	move_child(arrow_layer, stack_card.get_index())  # sopra il campo, sotto carta al centro, scritte e pulsanti
	timer_bar = Control.new()
	timer_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	timer_bar.draw.connect(_draw_timer)
	timer_bar.visible = false
	add_child(timer_bar)
	react_btn = Button.new()
	react_btn.focus_mode = Control.FOCUS_NONE
	react_btn.flat = true
	react_btn.icon = Art.line_icon("react", "<path d=\"M4 5.5h16v10H10l-4.5 3.5v-3.5H4z\"/>", Art.TESTO, 22)
	react_btn.add_theme_constant_override("icon_max_width", 22)
	react_btn.pressed.connect(_open_reactions)
	add_child(react_btn)
	peek_layer = Control.new()
	peek_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(peek_layer)


# =====================================================================
#  Partita
# =====================================================================

## Nuova partita contro il computer. lvl: "easy" | "normal" | "hard".
## Nuova partita. opts va al motore (per esempio firstPlayer, seed; serve anche ai test).
## m: { kind: "bot" | "challenge" | "daily" | "tutorial", challenge: id, daily: "2026-11-16" }
func start(lvl: String, name := "Tu", opts := {}, m := {}) -> void:
	_game_id += 1
	mode = m if not m.is_empty() else {"kind": "bot"}
	var kind: String = mode.kind
	if kind == "challenge":
		var ch := Modes.challenge(mode.challenge)
		opts = ch.opts.duplicate(true)
		lvl = ch.level
	elif kind == "daily":
		opts = Modes.daily_opts(mode.daily)
		lvl = "normal"
	elif kind == "tutorial":
		opts = Modes.tutorial_opts()
		lvl = "normal"
	level = lvl
	player_name = name
	g = Game.new([name, "Maestro" if kind == "tutorial" else "BOT"], opts)
	cur = Profile.fresh(lvl if kind == "bot" else kind, mode.get("challenge"), mode.get("daily"), kind == "tutorial")
	new_goals = []
	_begin()


## Riprende una partita salvata alla chiusura dell'app.
func resume(d: Dictionary) -> void:
	_game_id += 1
	mode = d.mode
	level = d.level
	player_name = d.name
	cur = Game._ints(d.cur)
	g = Game.from_dict(d.game)
	new_goals = []
	_begin()


func _begin() -> void:
	bot = Bot.new(g, 1, {"level": level})
	turn_time = 0 if mode.kind == "tutorial" else int(Prefs.get_value("turn_time"))
	_timer_key = ""
	staged = null
	sel = null
	counter_mode = false
	pick = null
	gy_open = ""
	caption = ""
	_close_overlays()
	V = g.view(me)
	tutorial_reset()
	g.take_events()  # la distribuzione iniziale non si anima
	_layout()
	_refresh()
	_pump()


func _task() -> String:
	if V.is_empty() or V.phase != "playing" or busy:
		return ""
	if V.step == "main" and V.active == me and not V.landPlayed:
		return "main"
	if V.step == "response" and V.pending != null and V.pending.responder == me:
		return "response"
	if V.step == "choice" and V.choice != null and V.choice.player == me:
		return "choice"
	return ""


## Azione del giocatore.
func act(a: Dictionary) -> void:
	if busy or g == null:
		return
	if not _allowed(a):
		staged = null
		sel = null
		_refresh()
		return
	var err = g.act(me, a)
	if err != null:
		_toast(err)
		_refresh()
		return
	staged = null
	sel = null
	counter_mode = false
	pick = null
	if gy_open == "me" or gy_open == "opp":
		_close_gy()
	_pump()


## Anima gli eventi in coda, poi lascia giocare il computer se tocca a lui.
func _pump() -> void:
	if _pumping:
		return
	_pumping = true
	var id := _game_id
	while true:
		var evs: Array = g.take_events()
		if evs.is_empty():
			break
		busy = true
		_track(evs)
		var batch := evs
		for e in evs:
			await _animate(e)
			if id != _game_id:
				_pumping = false
				return
		_bot_reacts(batch)
	busy = false
	_pumping = false
	V = g.view(me)
	caption = ""
	_refresh()
	_save()
	if g.phase != "playing":
		await get_tree().create_timer(0.4).timeout
		if id == _game_id:
			_show_over()
		return
	var actor = g.actor()
	if actor == bot.p:
		_bot_move(id)
	elif autoplay:
		await get_tree().create_timer(0.6).timeout
		if id == _game_id and g.phase == "playing" and g.actor() == me:
			if _me_bot == null or _me_bot.g != g:
				_me_bot = Bot.new(g, me)
			g.act(me, _me_bot.decide())
			_pump()
	elif _task() == "response" and V.get("counterOthers", []).is_empty() and mode.kind != "tutorial":
		_auto_allow(id)


func _bot_move(id: int) -> void:
	if _bot_thinking:
		return
	_bot_thinking = true
	if mode.kind == "tutorial" and g.step != "response":
		# il Maestro gioca solo dopo che hai letto e premuto «Avanti»
		await _tutorial_wait()
		if id != _game_id:
			return
	var t0 := Time.get_ticks_msec()
	var a = Modes.tutorial_bot_move(g) if mode.kind == "tutorial" else null
	if a != null:
		pass
	elif bot.hard:
		bot.decide_async()
		a = await bot.decided
	else:
		a = bot.decide()
	var waited := (Time.get_ticks_msec() - t0) / 1000.0
	var pause := 0.7 if g.step == "main" else 0.9
	if waited < pause:
		await get_tree().create_timer(pause - waited).timeout
	_bot_thinking = false
	if id != _game_id or g.phase != "playing" or g.actor() != bot.p:
		return
	if a == null or g.act(bot.p, a) != null:
		a = bot.decide() if not bot.hard else null
		if a == null or g.act(bot.p, a) != null:
			g.act(bot.p, {"type": "pass"} if g.step == "main" else {"type": "allow"})
	_pump()


# ---------- tutorial (scripts/ui/coach.gd) ----------
var coach: Node = null


func tutorial_reset() -> void:
	if coach != null:
		coach.queue_free()
		coach = null
	if mode.kind == "tutorial":
		coach = load("res://scripts/ui/coach.gd").new(self)
		add_child(coach)
		move_child(coach, overlay_layer.get_index())


## Aspetta che il giocatore prema «Avanti» prima della mossa del Maestro.
func _tutorial_wait() -> void:
	if coach != null:
		await coach.wait_go()


## Il tutorial può rifiutare una mossa fuori programma (spiegando perché).
func _allowed(a: Dictionary) -> bool:
	return coach == null or coach.allows(a)


## Statistiche: ogni evento aggiorna i conteggi; a fine partita si salva il profilo.
func _track(evs: Array) -> void:
	for e in evs:
		Profile.track(cur, e.ev, me)
		if e.ev.type == "end":
			new_goals = Profile.finish(cur, {"name": player_name, "won": g.winner == me, "winner_null": g.winner == null,
				"bf": g.players[me].bf, "reason": g.end_reason, "turn": g.turn})


## Salva la partita in corso (o la cancella se è finita).
func _save() -> void:
	if g == null or autoplay or not save_enabled:
		return
	if g.phase != "playing":
		forget_save()
		return
	var f := FileAccess.open(SAVE, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify({"mode": mode, "level": level, "name": player_name, "cur": cur, "game": g.to_dict()}))


static func forget_save() -> void:
	if FileAccess.file_exists(SAVE):
		DirAccess.remove_absolute(SAVE)


## La partita salvata, se c'è ({} altrimenti).
static func saved_game() -> Dictionary:
	if not FileAccess.file_exists(SAVE):
		return {}
	var d = JSON.parse_string(FileAccess.get_file_as_string(SAVE))
	return d if d is Dictionary and d.has("game") else {}


## Se non posso contrastare, la terra avversaria risolve da sola dopo una pausa casuale
## (così l'avversario non capisce se ho un'Isola in mano).
func _auto_allow(id: int) -> void:
	var key := "%d|%d|%s" % [g.turn, g.pending.counters, g.pending.land]
	if key == _auto_allow_key:
		return
	_auto_allow_key = key
	await get_tree().create_timer(0.9 + randf() * 1.3).timeout
	if id == _game_id and _task() == "response" and g.pending != null \
			and "%d|%d|%s" % [g.turn, g.pending.counters, g.pending.land] == key:
		act({"type": "allow"})


# =====================================================================
#  Disposizione (stesse regole di style.css)
# =====================================================================

func _on_resize() -> void:
	_layout()
	_refresh()


func _layout() -> void:
	var S := size
	if S.x < 10 or S.y < 10:
		return
	var vw := S.x / 100.0
	var vh := S.y / 100.0
	var aspect := S.x / S.y
	bg.position = Vector2.ZERO
	bg.size = S
	fly_layer.size = S
	overlay_layer.size = S
	peek_layer.size = S
	if aspect < 1.1:
		lay = "portrait"
		tablet = S.x >= 700 and S.y >= 521
	elif S.y >= 521:
		lay = "wide"
		tablet = true
	else:
		lay = "side"
		tablet = false
	match lay:
		"portrait":
			_layout_portrait(S, vw, vh)
		"wide":
			_layout_wide(S, vw, vh)
		"side":
			_layout_side(S, vw, vh)
	# al centro un cerchio (l'«orizzonte»): la terra giocata vi compare con il suo paesaggio
	var sc := stack_rect.get_center()
	var D := minf(stack_rect.size.y, stack_rect.size.x * 1.3)
	stack_rect = Rect2(sc - Vector2(D, D) / 2, Vector2(D, D))
	bg.rose_center = sc
	bg.rose_size = D + 16
	bg.rose_angle = rose_angle
	bg.queue_redraw()
	center_frame.position = center_rect.position
	center_frame.size = center_rect.size
	arrow_layer.size = S
	# barra del tempo: sotto la barra in alto (telefono verticale) o lungo il bordo superiore
	if lay == "portrait":
		# nella barra in alto, tra la modalità e il menu
		var bx := top_mode.position.x + top_mode.get_theme_font("font").get_string_size(top_mode.text if top_mode.text != "" else "vs BOT (difficile)", HORIZONTAL_ALIGNMENT_LEFT, -1, int(_fs.small)).x + 12
		timer_bar.position = Vector2(bx, menu_btn.position.y + (menu_btn.size.y - 14) / 2)
		timer_bar.size = Vector2(maxf(40, menu_btn.position.x - 10 - bx), 14)
	else:
		timer_bar.position = Vector2(0, 0)
		timer_bar.size = Vector2(S.x, maxf(12, 1.8 * vh))
	_place_react()
	_place_hand(false)


func _fonts(name_fs: float, small: float, status: float, btn: float, gy_h: float) -> void:
	_fs = {"name": name_fs, "small": small, "status": status, "btn": btn, "gy_h": gy_h}
	for w in zones:
		var z = zones[w]
		z.name.add_theme_font_size_override("font_size", int(name_fs))
		z.near.add_theme_font_size_override("font_size", int(small * 0.95))
		z.deck.fs = int(small)
		z.deck.pw = small * 1.15
		z.gy.fs = int(gy_h * 0.42)
		if w == "opp":
			z.backs.fs = int(small * 0.95)
			z.backs.bw = small * 1.05
	status_label.add_theme_font_size_override("font_size", int(status))
	ctr_label.add_theme_font_size_override("font_size", int(status))
	top_mode.add_theme_font_size_override("font_size", int(small))


## Riga del campo: 5 caselle larghe `sw` centrate in [x0, x0+width] alla quota y.
func _place_bf(w: String, x0: float, width: float, y: float, gap: float) -> void:
	var total := sw * 5 + gap * 4
	var x := x0 + (width - total) / 2
	for t in TYPES:
		var s: W.Slot = zones[w].slots[t]
		s.position = Vector2(x, y)
		s.size = Vector2(sw, sw * 1.4)
		x += sw + gap


## Intestazione del giocatore in riga: nome a sinistra, poi dorsi, mazzo, cimitero a destra.
func _place_head_row(w: String, r: Rect2) -> void:
	var z = zones[w]
	var h := r.size.y
	var gyh: float = _fs.gy_h
	var gyw := gyh * 1.9
	var x := r.end.x - gyw
	z.gy.position = Vector2(x, r.position.y + (h - gyh) / 2)
	z.gy.size = Vector2(gyw, gyh)
	var dw: float = z.deck.needed_width()
	x -= dw + 12
	z.deck.position = Vector2(x, r.position.y)
	z.deck.size = Vector2(dw, h)
	if w == "opp":
		# i dorsi vanno subito dopo il nome: _fit_name li sistema secondo quante carte ci sono
		z.backs.position.y = r.position.y
		z.backs.size.y = h
	z.row = true
	_place_name(w, Vector2(r.position.x + 4, r.position.y), x - r.position.x - 16, h)


func _place_name(w: String, pos: Vector2, width: float, h: float) -> void:
	var z = zones[w]
	z.dot.position = pos + Vector2(0, (h - 9) / 2)
	z.dot.size = Vector2(9, 9)
	var nh: float = _fs.name * 1.4
	z.name.position = pos + Vector2(16, (h - nh) / 2)
	var nearw: float = _fs.small * 1.45
	# spazio per il nome: tolti il segnale «!» e (per me) il pulsante delle reazioni
	z.name_max = maxf(10, width - 16 - nearw - 6 - (40.0 if w == "me" and z.get("row", false) else 0.0))
	z.name.size = Vector2(z.name_max, nh)
	z.near.size = Vector2(nearw, nearw)
	z.near.position.y = pos.y + (h - nearw) / 2
	_fit_name(w)


## Il nome prende la sua larghezza (tagliato con «…» se non ci sta); il «!» va subito dopo.
func _fit_name(w: String) -> void:
	var z = zones[w]
	if not z.has("name_max"):
		return
	var room: float = z.name_max
	var backs_w := 0.0
	if w == "opp" and z.get("row", false):
		backs_w = z.backs.needed_width()
		room -= backs_w + 8
	var namew: float = z.name.get_theme_font("font").get_string_size(z.name.text, HORIZONTAL_ALIGNMENT_LEFT, -1, int(_fs.name)).x + 2
	z.name.size.x = minf(namew, maxf(24, room))
	z.near.position.x = z.name.position.x + z.name.size.x + 6
	if backs_w > 0:
		var after: float = z.name.position.x + z.name.size.x + 8
		if z.near.visible:
			after = z.near.position.x + z.near.size.x + 8
		z.backs.position.x = after
		z.backs.size.x = backs_w


## Intestazione in colonna (PC e telefono orizzontale): nome, dorsi, mazzo, cimitero uno sotto l'altro.
func _place_head_col(w: String, r: Rect2) -> void:
	var z = zones[w]
	z.row = false
	# l'avversario ha una riga in più (i dorsi): se a lui non basta lo spazio, entrambi in forma compatta
	var rows: Array = [_fs.name * 1.5, _fs.small * 2.3, _fs.small * 2.0, _fs.gy_h]
	var gap := maxf(4.0, r.size.y * 0.06)
	var total := 0.0
	for h in rows:
		total += h
	total += gap * (rows.size() - 1)
	if total > r.size.y:
		_place_head_compact(w, r)
		return
	if w != "opp":
		rows.remove_at(1)
	var y := r.position.y + maxf(0, (r.size.y - total) / 2)
	_place_name(w, Vector2(r.position.x, y), r.size.x, rows[0])
	y += rows[0] + gap
	var i := 1
	if w == "opp":
		z.backs.position = Vector2(r.position.x, y)
		z.backs.size = Vector2(minf(r.size.x, z.backs.bw * 7.5 + _fs.small * 2.5), rows[i])
		y += rows[i] + gap
		i += 1
	z.deck.position = Vector2(r.position.x + 2, y)
	z.deck.size = Vector2(minf(r.size.x, z.deck.needed_width()), rows[i])
	y += rows[i] + gap
	z.gy.position = Vector2(r.position.x, y)
	z.gy.size = Vector2(_fs.gy_h * 1.9, _fs.gy_h)


## Testa a colonna stretta: nome, dorsi, poi mazzo e cimitero affiancati.
func _place_head_compact(w: String, r: Rect2) -> void:
	var z = zones[w]
	z.row = false
	var gyw: float = _fs.gy_h * 1.9
	var dw: float = z.deck.needed_width()
	# mazzo e cimitero affiancati se c'è posto, altrimenti uno sotto l'altro
	var two_rows := dw + 10 + gyw > r.size.x
	var rows: Array = [_fs.name * 1.5]
	if w == "opp":
		rows.append(_fs.small * 2.2)
	rows.append(_fs.gy_h)
	if two_rows:
		rows.append(_fs.gy_h)
	var gap := 3.0
	var total := gap * (rows.size() - 1)
	for h in rows:
		total += h
	var y := r.position.y + maxf(0, (r.size.y - total) / 2)
	_place_name(w, Vector2(r.position.x, y), r.size.x, rows[0])
	y += rows[0] + gap
	if w == "opp":
		z.backs.position = Vector2(r.position.x, y)
		z.backs.size = Vector2(minf(r.size.x, z.backs.bw * 7.5 + _fs.small * 2.5), rows[1])
		y += rows[1] + gap
	z.deck.position = Vector2(r.position.x + 2, y)
	z.deck.size = Vector2(minf(dw, r.size.x - 2), _fs.gy_h)
	if two_rows:
		y += _fs.gy_h + gap
		z.gy.position = Vector2(r.position.x + 2, y)
	else:
		z.gy.position = Vector2(r.position.x + dw + 10, y)
	z.gy.size = Vector2(gyw, _fs.gy_h)


func _layout_portrait(S: Vector2, vw: float, vh: float) -> void:
	var colw := minf(S.x, 760.0)
	var pad := 20.0 if tablet else 10.0
	var x0 := (S.x - colw) / 2 + pad
	var inner := colw - pad * 2
	var gap := 10.0 if tablet else 6.0
	var top_h := 44.0 if tablet else (28.0 if S.y < 640 else 34.0)
	var zh := 46.0 if tablet else (30.0 if S.y < 640 else 36.0)
	if tablet:
		_fonts(20, 15, 18, 17, 42)
	else:
		_fonts(15, 12.5, 14, 15, 28.0 if S.y < 640 else 32.0)
	var k := 1.0
	var y := 0.0
	# rimpicciolisce carte e campo finché tutto sta nello schermo senza sovrapporsi
	while true:
		sw = (minf(14 * vw, 9.5 * vh) if tablet else minf(17 * vw, 10 * vh)) * k
		hw = minf(17.5 * vw, 12 * vh) * k
		cw = (minf(28 * vw, 17 * vh) if tablet else minf(26 * vw, 13.5 * vh)) * k
		var hand_h := hw * 1.4 + 26
		var fixed := 4 + top_h + gap + zh + 6 + sw * 1.4 + gap + gap + sw * 1.4 + 6 + zh + gap + hand_h + 12
		var need: float = cw * 1.4 + _fs.status * 2 + _fs.btn * 6
		if S.y - fixed >= need or k < 0.55:
			break
		k -= 0.04
	y = 4
	top_mode.position = Vector2(x0, y)
	top_mode.size = Vector2(inner - 60, top_h)
	top_mode.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	top_mode.visible = true
	menu_btn.position = Vector2(x0 + inner - (52.0 if tablet else 40.0), y + 1)
	menu_btn.size = Vector2(52.0 if tablet else 40.0, top_h - 2)
	y += top_h + gap
	_place_head_row("opp", Rect2(x0, y, inner, zh))
	y += zh + 6
	_place_bf("opp", x0, inner, y, 1.8 * vw)
	y += sw * 1.4 + gap
	var hand_h := hw * 1.4 + 26
	var bottom := S.y - (12.0 if OS.has_feature("mobile") else 4.0) - hand_h  # sul telefono: lontano dal bordo curvo
	hand_rect = Rect2(x0, bottom, inner, hand_h)
	var me_head_y := bottom - gap - zh
	_place_head_row("me", Rect2(x0, me_head_y, inner, zh))
	var me_bf_y := me_head_y - 6 - sw * 1.4
	_place_bf("me", x0, inner, me_bf_y, 1.8 * vw)
	center_rect = Rect2(x0, y, inner, me_bf_y - gap - y)
	var st_h: float = _fs.status * 2.3
	var c_top := center_rect.position.y + 4
	stack_rect = Rect2(center_rect.get_center().x - cw / 2, c_top, cw, cw * 1.4)
	# carta, stato e azioni in colonna, centrati nello spazio libero
	var used := cw * 1.4 + 8 + st_h
	var free := center_rect.size.y - 8 - used
	var act_h := maxf(60.0, free)
	var start := c_top + maxf(0, (center_rect.size.y - 8 - used - minf(act_h, _actions_min_h())) / 2)
	stack_rect.position.y = start
	status_label.position = Vector2(x0, start + cw * 1.4 + 10)
	status_label.size = Vector2(inner, st_h)
	actions.position = Vector2(x0, status_label.position.y + st_h + 8)
	actions.size = Vector2(inner, center_rect.end.y - actions.position.y)
	actions.alignment = BoxContainer.ALIGNMENT_BEGIN


func _actions_min_h() -> float:
	return _fs.btn * 3.6 + _fs.status * 2.6


func _layout_wide(S: Vector2, vw: float, vh: float) -> void:
	var top := 3.4 * vh
	var side := 2 * vw
	var gap := 1.2 * vh
	sw = minf(12 * vh, 8.2 * vw)
	hw = minf(15 * vh, 9.5 * vw)
	cw = minf(22 * vh, 12 * vw)
	_fonts(maxf(17, 2.8 * vh), maxf(13, 1.8 * vh), maxf(15, 2.1 * vh), maxf(15, 2 * vh), maxf(34, 4.6 * vh))
	var head_w := maxf(170, 16 * vw)
	var bf_gap := 1.3 * vw
	var bf_w := sw * 5 + bf_gap * 4
	var colgap := 2.4 * vw
	var grid_w := head_w + colgap + bf_w + colgap + head_w
	var gx := (S.x - grid_w) / 2
	var bf_x := gx + head_w + colgap
	var zh := sw * 1.4
	# avversario in alto
	var y := top
	_place_bf("opp", bf_x, bf_w, y, bf_gap)
	_place_head_col("opp", Rect2(gx, y, head_w, zh))
	var hand_h := hw * 1.4 + 6 * vh
	hand_rect = Rect2(side, S.y - hand_h, S.x - side * 2, hand_h)
	var me_y := hand_rect.position.y - gap - zh
	_place_bf("me", bf_x, bf_w, me_y, bf_gap)
	_place_head_col("me", Rect2(gx, me_y, head_w, zh))
	center_rect = Rect2(maxf(side, (S.x - 150 * vh) / 2), y + zh + gap, minf(S.x - side * 2, 150 * vh), me_y - gap - (y + zh + gap))
	var cc := center_rect.get_center()
	# scritta di stato in alto, sotto la carta al centro: mai una sopra l'altra
	var st_h: float = _fs.status * 2.4
	var room := center_rect.size.y - st_h - 10
	cw = minf(cw, room / 1.4)
	var sy := center_rect.position.y + st_h + 6 + maxf(0, (room - cw * 1.4) / 2 - st_h / 2)
	stack_rect = Rect2(cc.x - cw / 2, sy, cw, cw * 1.4)
	status_label.position = Vector2(center_rect.position.x, stack_rect.position.y - st_h - 4)
	status_label.size = Vector2(center_rect.size.x, st_h)
	var ax := cc.x + cw * 0.5 + 3.5 * vw
	var aw := minf(minf(30 * vw, 420.0), S.x - ax - side)
	actions.position = Vector2(ax, center_rect.position.y)
	actions.size = Vector2(aw, center_rect.size.y)
	actions.alignment = BoxContainer.ALIGNMENT_CENTER
	# menu in alto a destra, modalità in basso a sinistra
	var mb := Vector2(maxf(44, 6 * vh), maxf(36, 4.8 * vh))
	menu_btn.position = Vector2(S.x - side - mb.x, 3.2 * vh)
	menu_btn.size = mb
	top_mode.position = Vector2(side, S.y - 1.6 * vh - _fs.small * 1.5)
	top_mode.size = Vector2(hand_rect.size.x * 0.3, _fs.small * 1.5)
	top_mode.visible = true


func _layout_side(S: Vector2, vw: float, vh: float) -> void:
	var top := 3.6 * vh
	var side := 2 * vw
	var right_w := 27 * vw
	var left_w := S.x - side * 2 - right_w - vw
	sw = minf(18.5 * vh, 8.6 * vw)
	hw = minf(17.5 * vh, 8.4 * vw)
	cw = minf(22 * vh, 11 * vw)
	_fonts(13, 11, 12, 13, 26)
	# l'intestazione deve contenere mazzo e cimitero affiancati; se manca spazio il campo si stringe
	var head_w := maxf(15 * vw, zones.me.deck.needed_width() + 10 + _fs.gy_h * 1.9 + 4)
	var bf_gap := 1.2 * vw
	sw = minf(sw, (left_w - head_w - 2 * vw - bf_gap * 4) / 5)
	var bf_w := sw * 5 + bf_gap * 4
	var rowgap := 1.6 * vh
	var zh := sw * 1.4
	var y := top
	# avversario: intestazione a sinistra, campo a destra
	var row_w := head_w + 2 * vw + bf_w
	var rx := side + (left_w - row_w) / 2
	_place_head_col("opp", Rect2(rx, y, head_w, zh))
	_place_bf("opp", rx + head_w + 2 * vw, bf_w, y, bf_gap)
	y += zh + rowgap
	# io: campo a sinistra, intestazione a destra
	_place_bf("me", rx, bf_w, y, bf_gap)
	_place_head_col("me", Rect2(rx + bf_w + 2 * vw, y, head_w, zh))
	y += zh + rowgap
	hand_rect = Rect2(side + 17 * vw, y - 6, left_w - 17 * vw, S.y - y + 6)
	center_rect = Rect2(S.x - side - right_w, top, right_w, S.y - top - 2 * vh)
	var cc := center_rect.get_center()
	var st_h: float = _fs.status * 2.8
	var block := cw * 1.4 + 2 * vh + st_h + 2 * vh + _actions_min_h()
	var sy := center_rect.position.y + maxf(0, (center_rect.size.y - block) / 2)
	stack_rect = Rect2(cc.x - cw / 2, sy, cw, cw * 1.4)
	status_label.position = Vector2(center_rect.position.x, stack_rect.end.y + 2 * vh)
	status_label.size = Vector2(center_rect.size.x, st_h)
	actions.position = Vector2(center_rect.position.x, status_label.position.y + st_h + vh)
	actions.size = Vector2(center_rect.size.x, center_rect.end.y - actions.position.y)
	actions.alignment = BoxContainer.ALIGNMENT_BEGIN
	menu_btn.position = Vector2(S.x - vw - 38, 17)
	menu_btn.size = Vector2(38, 28)
	top_mode.visible = false


# =====================================================================
#  Disegno dello stato
# =====================================================================

func _mode_label() -> String:
	match mode.kind:
		"tutorial":
			return "Tutorial"
		"daily":
			return "Sfida del giorno"
		"challenge":
			return "Sfida: %s" % Modes.challenge(mode.challenge).get("name", "")
	return "vs BOT (%s)" % {"easy": "facile", "hard": "difficile"}.get(level, "normale")


func _close_to_win(bf: Dictionary) -> bool:
	var d := 0
	var m := 0
	for t in TYPES:
		if bf[t] > 0:
			d += 1
		m = maxi(m, bf[t])
	return d >= 4 or m >= 4


func _wins_with(bf: Dictionary, t: String) -> bool:
	var b := bf.duplicate()
	b[t] += 1
	var d := 0
	for x in TYPES:
		if b[x] > 0:
			d += 1
		if b[x] >= 5:
			return true
	return d == 5


func _needs_target(card: String) -> bool:
	var pl = V.get("playable")
	if pl == null or not pl.has(card):
		return false
	var t = pl[card]
	return t != null and not t.is_empty()


## Bersagli da evidenziare: { opp: [...], me: [...], gy: [...] }
func _board_targets() -> Dictionary:
	var out := {"opp": [], "me": [], "gy": []}
	var task := _task()
	if task == "main" and staged != null:
		var c: String = staged.card
		var t: Array = V.playable[c]
		if c == "R":
			out.opp = t
		elif c == "W":
			out.me = t
		elif c == "G":
			out.gy = t
	elif task == "choice":
		if V.choice.kind == "destroy":
			out.opp = V.choice.options
		elif V.choice.kind == "regrow":
			out.gy = V.choice.options
	return out


func _refresh() -> void:
	if V.is_empty():
		return
	react_btn.visible = Prefs.get_value("react") and mode.kind != "tutorial" and V.phase == "playing"
	arrow_layer.queue_redraw()
	var task := _task()
	var tg := _board_targets()
	if task == "choice" and V.choice.kind == "regrow" and gy_open != "me":
		_open_gy("me")
	if task == "main" and staged != null and staged.card == "G" and gy_open != "me":
		_open_gy("me")
	top_mode.text = _mode_label()
	var slot_mode := "mini_named" if lay == "wide" else "mini"
	for w in ["opp", "me"]:
		var z = zones[w]
		var pl: Dictionary = V[w]
		z.name.text = pl.name
		var active: bool = V.phase == "playing" and V.active == pl.seat
		z.name.add_theme_color_override("font_color", Art.TESTO if active else Art.MUTO)
		z.dot.set_active(active)
		z.near.visible = _close_to_win(pl.bf)
		if w == "opp":
			z.backs.set_count(pl.handCount)
		z.deck.set_count(pl.deckCount)
		var tot := 0
		for t in TYPES:
			tot += pl.gy[t]
			var targ: bool = tg[w].has(t)
			z.slots[t].set_state(pl.bf[t], targ, slot_mode, w == "me" and _missing_for_me() == t)
		z.gy.set_state(tot, gy_open == w, w == "me" and not tg.gy.is_empty() and gy_open != "me")
	# il nome può essere cambiato di lunghezza: riposiziona il segnale "vicino alla vittoria"
	if not _fs.is_empty():
		for w in ["opp", "me"]:
			_fit_name(w)
	_refresh_stack()
	_refresh_status(task)
	_refresh_actions(task)
	_sync_hand(task)
	center_frame.queue_redraw()
	if task == "choice" and V.choice.kind == "discard":
		_show_reveal()
	elif overlay_layer.has_node("Reveal"):
		_drop(overlay_layer.get_node("Reveal"))
	if gy_open != "":
		_open_gy(gy_open)
	if coach != null:
		coach.update()
	_place_react()


func _stack_mode() -> String:
	return "full" if (size.x >= 700 and size.y > 520 and cw >= 110) else "compact"


func _refresh_stack() -> void:
	var p = V.pending
	stack_card.position = stack_rect.position
	stack_card.size = stack_rect.size
	stack_card.mode = "disc"
	stack_card.ring = Color(0, 0, 0, 0)
	unstage_btn.visible = false
	ctr_label.text = ""
	if staged != null:
		stack_card.visible = true
		stack_card.kind = staged.card
		stack_card.ring = Art.SEGNALE
		unstage_btn.visible = true
		unstage_btn.size = Vector2(28, 28)
		unstage_btn.position = stack_rect.position + Vector2(stack_rect.size.x * 0.854 - 14, stack_rect.size.y * 0.146 - 14)
	elif p == null and V.resolving != null:
		stack_card.visible = true
		stack_card.kind = V.resolving.land
	elif p != null:
		stack_card.visible = true
		stack_card.kind = p.land
		if p.owner != me:
			stack_card.ring = Art.ROSSO
		if p.counters > 0:
			var neg: bool = p.counters % 2 == 1
			ctr_label.text = ("Annullata" if neg else "Torna in gioco") + " · %d contrast%s" % [p.counters, "o" if p.counters == 1 else "i"]
			ctr_label.add_theme_color_override("font_color", Art.ROSSO if neg else Art.SEGNALE)
	else:
		stack_card.visible = false
	ctr_label.position = Vector2(stack_rect.position.x - 60, stack_rect.position.y - _fs.get("status", 14) * 1.5)
	ctr_label.size = Vector2(stack_rect.size.x + 120, _fs.get("status", 14) * 1.4)


func _draw_center_frame() -> void:
	# il centro si illumina quando una carta ci può essere posata
	var drop: bool = _task() == "main" and staged == null and (sel != null or _drag != null)
	if drop:
		# il cerchio si accende: qui si posa la carta
		var over := _drag != null and _over_center(get_local_mouse_position())
		var c := stack_rect.get_center() - center_frame.position
		var rr := stack_rect.size.x / 2 + 8
		if over:
			center_frame.draw_circle(c, rr, Color(Art.SEGNALE, 0.14))
		center_frame.draw_arc(c, rr, 0, TAU, 96, Color(Art.SEGNALE, 0.9 if over else 0.6), 2.5, true)


func _status() -> Dictionary:
	var me_seat := me
	var opp: String = V.opp.name
	if caption != "":
		return {"text": caption, "cls": "danger" if caption_danger else "cap"}
	if V.phase != "playing":
		return {"text": "", "cls": ""}
	var p = V.pending
	if V.step == "response" and p != null and p.responder == me_seat and p.owner != me_seat and _wins_with(V.opp.bf, p.land):
		return {"text": "Se entra, %s vince!" % opp, "cls": "danger"}
	if not Prefs.get_value("info") or mode.kind == "tutorial":
		return {"text": "", "cls": ""}
	if V.step == "main":
		return {"text": "Tocca a te", "cls": "mine"} if V.active == me_seat else {"text": "Turno di %s" % opp, "cls": ""}
	if V.step == "response" and p != null:
		if p.responder != me_seat:
			return {"text": "%s può contrastare…" % opp, "cls": ""}
		if p.owner != me_seat and p.counters == 0:
			return {"text": "%s gioca %s" % [opp, Art.NAMES[p.land]], "cls": "mine"}
		if p.owner == me_seat:
			return {"text": "%s contrasta la tua %s!" % [opp, Art.NAMES[p.land]], "cls": "mine"}
		return {"text": "%s ha annullato il tuo contrasto!" % opp, "cls": "mine"}
	if V.step == "choice" and V.choice != null and V.choice.player != me_seat:
		return {"text": "%s sta scegliendo…" % opp, "cls": ""}
	return {"text": "", "cls": ""}


func _refresh_status(_task_now: String) -> void:
	var st := _status()
	status_label.text = st.text
	var sb: StyleBox = StyleBoxEmpty.new()
	var col := Art.TESTO if st.cls != "" else Art.MUTO
	# «Tocca a te», «Turno di BOT»: grandi e in grassetto; le didascalie restano in una pillola
	var big: bool = st.cls == "mine" or st.cls == ""
	status_label.add_theme_font_size_override("font_size", int(_fs.get("status", 14) * (1.55 if big else 1.0)))
	status_label.add_theme_font_override("font", Art.bold() if big else Art.semi())
	var pill_r := minf(status_label.size.y, _fs.get("status", 14) * 1.9) / 2
	if st.cls == "danger":
		sb = Art.box(Art.CARTA, pill_r)
		col = Art.ROSSO
	elif st.cls == "cap":
		sb = Art.box(Art.TAVOLO2, pill_r, Art.RIGA, 1.5)
	if sb is StyleBoxFlat:
		sb.content_margin_left = 14
		sb.content_margin_right = 14
	status_label.add_theme_stylebox_override("normal", sb)
	status_label.add_theme_color_override("font_color", col)
	# la pillola di sfondo abbraccia solo il testo
	if st.cls == "danger" or st.cls == "cap":
		var f := status_label.get_theme_font("font")
		var tw := f.get_string_size(st.text, HORIZONTAL_ALIGNMENT_LEFT, -1, int(_fs.status)).x + 32
		var cx := center_rect.get_center().x
		var w := minf(tw, center_rect.size.x)
		status_label.position.x = cx - w / 2
		status_label.size.x = w
	else:
		status_label.position.x = center_rect.position.x
		status_label.size.x = center_rect.size.x


func _consequence(p: Dictionary) -> String:
	var opp: String = V.opp.name
	if p.owner == me:
		return "Se non rispondi, la tua %s viene annullata." % Art.NAMES[p.land]
	var t = p.target
	var reuse := {"U": "pescherà una carta", "B": "guarderà la tua mano e ti farà scartare una terra",
		"R": "distruggerà una tua terra", "G": "riprenderà una terra dal suo cimitero"}
	match p.land:
		"U":
			return "Se risolve, %s pescherà una carta." % opp
		"B":
			return "Se risolve, %s guarderà la tua mano e ti farà scartare una terra." % opp
		"R":
			return "Se risolve, la tua %s verrà distrutta." % Art.NAMES[t] if t != null else "Entrerà senza effetto."
		"G":
			return "Se risolve, %s riprenderà %s dal suo cimitero." % [opp, Art.NAMES[t]] if t != null else "Entrerà senza effetto."
		"W":
			return "Se risolve, %s riattiverà la sua %s e %s." % [opp, Art.NAMES[t], reuse.get(t, "")] if t != null else "Entrerà senza effetto."
	return ""


## Indici in mano: l'Isola che verrebbe scartata col contrasto e le carte scartabili insieme.
func _counter_plan():
	var hand: Array = V.hand
	var others: Array = V.get("counterOthers", [])
	if others.is_empty():
		return null
	var pick_idx: int = pick.idx if pick != null else -1
	var island := -1
	for i in hand.size():
		if hand[i] == "U" and i != pick_idx:
			island = i
			break
	var eligible := []
	for i in hand.size():
		eligible.append(i != island and others.has(hand[i]))
	return {"island": island, "eligible": eligible}


func _hint(text: String) -> Label:
	var l := W.label(text, int(_fs.status), Art.MUTO, Art.serif())
	l.visible = Prefs.get_value("info") or mode.kind == "tutorial"
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT if lay == "wide" else HORIZONTAL_ALIGNMENT_CENTER
	l.custom_minimum_size.x = 10
	return l


## Fila di pulsanti: se non stanno affiancati vanno a capo (colonna stretta del telefono in orizzontale).
func _row(buttons: Array) -> HFlowContainer:
	var h := HFlowContainer.new()
	h.alignment = FlowContainer.ALIGNMENT_BEGIN if lay == "wide" else FlowContainer.ALIGNMENT_CENTER
	h.add_theme_constant_override("h_separation", 10)
	h.add_theme_constant_override("v_separation", 8)
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for b in buttons:
		h.add_child(b)
	return h


func _btn(text: String, kind: String, cb: Callable) -> Button:
	var b := W.button(text, kind, int(_fs.btn))
	b.pressed.connect(cb)
	return b


func _refresh_actions(task: String) -> void:
	for c in actions.get_children():
		actions.remove_child(c)
		c.queue_free()
	if V.phase != "playing":
		return
	if task == "":
		if not busy and V.active != me and V.step == "main":
			actions.add_child(_hint("Il computer sta pensando…"))
		return
	if task == "main":
		if staged != null:
			var c: String = staged.card
			actions.add_child(_hint("Tocca la terra avversaria da distruggere." if c == "R" else
				"Tocca nel tuo cimitero la terra da recuperare." if c == "G" else "Tocca la tua terra da riattivare."))
			return
		if mode.kind == "tutorial":
			# nel tutorial si fa sempre la mossa indicata: «Passa» compare solo quando serve
			if coach != null and coach.wants_pass():
				actions.add_child(_row([_btn("Passa il turno", "pass", func(): act({"type": "pass"}))]))
			return
		actions.add_child(_hint(_win_hint() if _win_hint() != "" else "Trascina una carta al centro per giocarla, oppure toccala e poi tocca il centro."))
		actions.add_child(_row([_btn("Passa il turno", "pass", func(): act({"type": "pass"}))]))
		return
	if task == "response":
		var p: Dictionary = V.pending
		var plan = _counter_plan()
		var allow_label := "Accetta" if p.owner == me else "Lascia risolvere"
		if plan == null:
			if mode.kind == "tutorial":
				actions.add_child(_row([_btn(allow_label, "primary", func(): act({"type": "allow"}))]))
				return
			actions.add_child(_hint(_consequence(p)))
			return
		if not counter_mode:
			actions.add_child(_hint(_consequence(p)))
			actions.add_child(_row([_btn("Contrasta", "counter", _counter_start), _btn(allow_label, "primary", func(): act({"type": "allow"}))]))
			actions.add_child(_hint("Contrastare costa un'Isola e un'altra terra dalla tua mano."))
			return
		actions.add_child(_formula(p))
		if pick == null:
			actions.add_child(_hint("Tocca in mano la seconda terra da scartare."))
		var bs := []
		if pick != null:
			bs.append(_btn("Conferma", "counter", func(): act({"type": "counter", "other": pick.card})))
		bs.append(_btn("Annulla", "ghost", _counter_cancel))
		actions.add_child(_row(bs))
		return
	if task == "choice":
		var kind: String = V.choice.kind
		if kind == "destroy":
			actions.add_child(_hint("Tocca la terra avversaria da distruggere."))
		elif kind == "regrow":
			actions.add_child(_hint("Tocca nel tuo cimitero la terra da recuperare."))


## "Isola + ? → Montagna ✕": cosa succede contrastando.
func _formula(p: Dictionary) -> Control:
	var h := HBoxContainer.new()
	h.alignment = BoxContainer.ALIGNMENT_BEGIN if lay == "wide" else BoxContainer.ALIGNMENT_CENTER
	h.add_theme_constant_override("separation", 8)
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var d: float = clampf(_fs.btn * 2.6, 32, 60)
	h.add_child(_fcard("U", d))
	h.add_child(W.label("+", int(_fs.btn * 1.2), Art.MUTO, Art.bold()))
	h.add_child(_fcard(pick.card if pick != null else "?", d))
	h.add_child(W.label("→", int(_fs.btn * 1.2), Art.MUTO, Art.bold()))
	h.add_child(_fcard(p.land, d))
	h.add_child(W.label("✓" if p.owner == me else "✕", int(_fs.btn * 1.2), Art.SEGNALE if p.owner == me else Art.ROSSO, Art.bold()))
	for c in h.get_children():
		if c is Label:
			c.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
			c.custom_minimum_size.y = d
	return h


func _fcard(t: String, d: float) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(d, d)
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.draw.connect(func():
		var ctr := Vector2(d, d) / 2
		if t == "?":
			c.draw_arc(ctr, d / 2 - 1, 0, TAU, 32, Art.SEGNALE, 1.5, true)
			var f := Art.bold()
			var fs := int(d * 0.45)
			var tw := f.get_string_size("?", HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
			c.draw_string(f, ctr + Vector2(-tw / 2, f.get_ascent(fs) * 0.36), "?", HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Art.SEGNALE)
		else:
			c.draw_circle(ctr + Vector2(0, 2), d / 2, Art.CARTA2)
			c.draw_circle(ctr, d / 2, Art.CARTA)
			var s := d * 0.77
			Art.draw_contain(c, Art.tex("ico-" + t, s), Rect2(ctr - Vector2(s, s) / 2, Vector2(s, s))))
	return c


func _counter_start() -> void:
	counter_mode = true
	pick = null
	_refresh()


func _counter_cancel() -> void:
	counter_mode = false
	pick = null
	_refresh()


# =====================================================================
#  Mano a ventaglio
# =====================================================================

func _hand_mode() -> String:
	return "full" if size.x >= 700 and size.y > 520 and hw >= 100 else "compact"


## Allinea i nodi delle carte in mano a V.hand (ricrea solo se cambia la mano).
func _sync_hand(task: String) -> void:
	var hand: Array = V.hand
	var same := hand_cards.size() == hand.size()
	if same:
		for i in hand.size():
			if hand_cards[i].kind != hand[i]:
				same = false
				break
	if not same:
		for c in hand_cards:
			c.queue_free()
		hand_cards = []
		for t in hand:
			var c := Card.new()
			c.kind = t
			hand_layer.add_child(c)
			hand_cards.append(c)
		_hover_idx = -1
	var plan = _counter_plan() if task == "response" and counter_mode else null
	for i in hand_cards.size():
		var c: Card = hand_cards[i]
		c.mode = _hand_mode()
		c.ring = Color(0, 0, 0, 0)
		c.badge = ""
		c.dim = 0.0
		c.modulate.a = 1.0
		var playable: bool = task == "main" and V.get("playable") != null and V.playable.has(hand[i])
		if task == "main" and not playable:
			c.dim = 0.55
		elif task == "" and V.phase == "playing":
			c.dim = 0.3
		if task == "main" and sel != null and sel.idx == i:
			c.ring = Art.SEGNALE
		if plan != null:
			if i == plan.island or (pick != null and pick.idx == i):
				c.ring = Art.ROSSO
				c.badge = "✕"
			elif plan.eligible[i] and pick == null:
				c.ring = Art.SEGNALE
			else:
				c.modulate.a = 0.4
		c.visible = not (staged != null and staged.idx == i)
	_place_hand(true)


## Posizioni del ventaglio (come layoutHand in app.js). `animate`: le carte scivolano al loro posto.
func _fan_positions(n: int) -> Array:
	var out := []
	if n == 0:
		return out
	var cwid := hw
	var Wd := hand_rect.size.x
	var pad := 10 + cwid * 0.14
	var step := minf(cwid + 6, (Wd - cwid - pad * 2) / (n - 1)) if n > 1 else 0.0
	var total := cwid + step * (n - 1)
	var start := maxf(pad, (Wd - total) / 2)
	var mid := (n - 1) / 2.0
	var ang := minf(3.0, 15.0 / (n - 1)) if n > 1 else 0.0
	var bottom := hand_rect.end.y - (8.0 if lay == "portrait" else 2.6 * size.y / 100.0)
	if lay == "side":
		bottom = hand_rect.position.y + 14 + cwid * 1.4
	for i in n:
		var off := i - mid
		var dy := minf(10.0, off * off * ang * 0.25)
		out.append({"pos": Vector2(hand_rect.position.x + start + i * step, bottom - cwid * 1.4 + dy), "rot": off * ang})
	return out


func _place_hand(animate: bool) -> void:
	var visible_cards := []
	for i in hand_cards.size():
		if hand_cards[i].visible:
			visible_cards.append(i)
	var pos := _fan_positions(visible_cards.size())
	for k in visible_cards.size():
		var i: int = visible_cards[k]
		var c: Card = hand_cards[i]
		if _drag != null and _drag.view == c:
			continue
		c.size = Vector2(hw, hw * 1.4)
		c.pivot_offset = Vector2(hw / 2, hw * 1.4)
		var p: Vector2 = pos[k].pos
		var rot: float = pos[k].rot
		var lift := 0.0
		var scl := 1.0
		if (sel != null and sel.idx == i) or (counter_mode and c.ring == Art.ROSSO) or i == tut_idx:
			lift = 18.0
			scl = 1.06
			if i == tut_idx:
				rot = 0.0
		elif i == _hover_idx:
			lift = 14.0
			scl = 1.08
			rot = 0.0
		c.z_index = 40 if lift > 0 else i
		# la carta sollevata non deve salire sopra il campo (telefono in orizzontale)
		lift = minf(lift, maxf(0.0, p.y - hand_rect.position.y - hw * 0.14))
		var target_pos := p - Vector2(0, lift)
		# dove finirà la carta (posizione, rotazione, scala): serve a chi la deve cerchiare
		c.set_meta("fan", {"pos": target_pos, "rot": rot, "scale": scl})
		if animate and c.position != Vector2.ZERO:
			var tw := c.create_tween().set_parallel().set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
			tw.tween_property(c, "position", target_pos, 0.2)
			tw.tween_property(c, "rotation_degrees", rot, 0.2)
			tw.tween_property(c, "scale", Vector2(scl, scl), 0.2)
		else:
			c.position = target_pos
			c.rotation_degrees = rot
			c.scale = Vector2(scl, scl)


# =====================================================================
#  Input: trascinare, toccare, bersagli, anteprima
# =====================================================================

func _hand_index_at(p: Vector2) -> int:
	# dalla carta più in alto alla più in basso
	var order := range(hand_cards.size())
	order.sort_custom(func(a, b): return hand_cards[a].z_index > hand_cards[b].z_index or (hand_cards[a].z_index == hand_cards[b].z_index and a > b))
	for i in order:
		var c: Card = hand_cards[i]
		if not c.visible:
			continue
		var local: Vector2 = c.get_global_transform().affine_inverse() * (p + global_position)
		if Rect2(Vector2.ZERO, c.size).has_point(local):
			return i
	return -1


func _over_center(p: Vector2) -> bool:
	return center_rect.grow(6).has_point(p) or stack_rect.grow(20).has_point(p)


func _gui_input(e: InputEvent) -> void:
	if e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT:
		if e.pressed:
			_on_press(e.position)
		else:
			_on_release(e.position)
		accept_event()
	elif e is InputEventMouseMotion:
		_on_motion(e.position)


func _on_press(p: Vector2) -> void:
	_close_peek()
	var i := _hand_index_at(p)
	_press = {"idx": i, "pos": p, "t": Time.get_ticks_msec(), "moved": false, "peeked": false, "what": _peek_target(p, i)}
	var id := _game_id
	var press_ref = _press
	await get_tree().create_timer(PEEK_S).timeout
	if id == _game_id and _press == press_ref and not _press.moved and _drag == null and _press.what != "":
		_press.peeked = true
		_show_peek(_press.what)


func _on_motion(p: Vector2) -> void:
	if _press == null:
		# passaggio del mouse sulle carte giocabili (PC)
		var h := _hand_index_at(p) if _task() == "main" and staged == null else -1
		if h >= 0 and not V.playable.has(V.hand[h]):
			h = -1
		if h != _hover_idx:
			_hover_idx = h
			_place_hand(true)
		return
	if _press.peeked:
		return
	if not _press.moved and p.distance_to(_press.pos) > SLOP:
		_press.moved = true
		var i: int = _press.idx
		if i >= 0 and _task() == "main" and staged == null and V.playable.has(V.hand[i]):
			var c: Card = hand_cards[i]
			_drag = {"view": c, "idx": i, "grab": c.size / 2}
			sel = null
			c.z_index = 100
			Sound.play("grab")
			c.rotation_degrees = 0
			c.scale = Vector2(1.12, 1.12)
			c.pivot_offset = c.size / 2
			center_frame.queue_redraw()
	if _drag != null:
		_drag.view.position = p - _drag.grab
		center_frame.queue_redraw()


func _on_release(p: Vector2) -> void:
	var pr = _press
	_press = null
	if pr != null and pr.peeked:
		_close_peek()
		return
	if _drag != null:
		var d = _drag
		_drag = null
		if _over_center(p) and _task() == "main":
			_play_card(d.idx, Rect2(d.view.position, d.view.size))
		else:
			d.view.pivot_offset = Vector2(hw / 2, hw * 1.4)
			_place_hand(true)
		center_frame.queue_redraw()
		return
	if pr == null or pr.moved:
		return
	_on_tap(p, pr.idx)


func _on_tap(p: Vector2, idx: int) -> void:
	var task := _task()
	# fuori dal cimitero aperto: lo chiude
	if gy_open != "" and not (task == "choice" and V.choice.kind == "regrow") and not (staged != null and staged.card == "G"):
		var pop := overlay_layer.get_node_or_null("GyPop")
		if pop == null or not _lr(pop).has_point(p):
			_close_gy()
	if task == "main":
		if staged != null:
			var tg := _board_targets()
			for w in ["opp", "me"]:
				for t in tg[w]:
					if _lr(zones[w].slots[t]).grow(4).has_point(p):
						act({"type": "play", "card": staged.card, "target": t})
						return
			return
		if idx >= 0 and V.playable.has(V.hand[idx]):
			sel = null if sel != null and sel.idx == idx else {"card": V.hand[idx], "idx": idx}
			_refresh()
			return
		if sel != null and _over_center(p):
			_play_card(sel.idx)
			return
		if sel != null:
			sel = null
			_refresh()
		return
	if task == "response" and counter_mode and idx >= 0:
		var plan = _counter_plan()
		if plan != null and pick == null and plan.eligible[idx]:
			pick = {"card": V.hand[idx], "idx": idx}
			_refresh()
		elif pick != null and pick.idx == idx:
			pick = null
			_refresh()
		return
	if task == "choice" and V.choice.kind == "destroy":
		for t in V.choice.options:
			if _lr(zones.opp.slots[t]).grow(4).has_point(p):
				act({"type": "choose", "choice": t})
				return


## Posa la carta al centro: se ha un bersaglio aspetta che lo si tocchi, altrimenti la gioca.
func _play_card(idx: int, from := Rect2()) -> void:
	var card: String = V.hand[idx]
	sel = null
	if _needs_target(card):
		staged = {"card": card, "idx": idx}
		_refresh()
	else:
		_play_from = from if from.has_area() else Rect2(hand_cards[idx].position, hand_cards[idx].size)
		act({"type": "play", "card": card})


func _unstage() -> void:
	staged = null
	if gy_open == "me":
		_close_gy()
	_refresh()


func _unhandled_key_input(e: InputEvent) -> void:
	if not (e is InputEventKey) or not e.pressed or e.echo:
		return
	match e.keycode:
		KEY_P:
			if _task() == "main" and staged == null:
				act({"type": "pass"})
		KEY_ESCAPE:
			if staged != null:
				_unstage()
			elif counter_mode:
				_counter_cancel()
			elif overlay_layer.has_node("Menu"):
				_close_overlays()
			elif sel != null:
				sel = null
				_refresh()
		KEY_M:
			_open_menu()


# =====================================================================
#  Anteprima della carta (tenendo premuto)
# =====================================================================

func _peek_target(p: Vector2, idx: int) -> String:
	if idx >= 0:
		return V.hand[idx]
	if stack_card.visible and stack_rect.has_point(p):
		return stack_card.kind
	for w in ["opp", "me"]:
		for t in TYPES:
			var s: W.Slot = zones[w].slots[t]
			if s.count > 0 and _lr(s).has_point(p):
				return t
	return ""


func _show_peek(t: String) -> void:
	_close_peek()
	var veil := ColorRect.new()
	veil.name = "Peek"
	veil.color = Color(Art.TAVOLO2, 0.75)
	veil.size = size
	veil.mouse_filter = Control.MOUSE_FILTER_IGNORE
	peek_layer.add_child(veil)
	var w := minf(size.x * 0.6, size.y * 0.42)
	var c := Card.new()
	c.kind = t
	c.mode = "full"
	c.size = Vector2(w, w * 1.4)
	c.position = Vector2((size.x - w) / 2, (size.y - w * 1.4) / 2 - 30)
	veil.add_child(c)
	var l := W.label(Art.LONG_FX[t], int(maxf(16, w * 0.075)), Art.TESTO, Art.serif())
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.position = Vector2(20, c.position.y + w * 1.4 + 18)
	l.size = Vector2(size.x - 40, 60)
	veil.add_child(l)
	veil.modulate.a = 0
	veil.create_tween().tween_property(veil, "modulate:a", 1.0, 0.15)


func _close_peek() -> void:
	for c in peek_layer.get_children():
		c.queue_free()


# =====================================================================
#  Cimitero, Palude, menu, fine partita
# =====================================================================

func _toggle_gy(w: String) -> void:
	if gy_open == w:
		_close_gy()
	else:
		_open_gy(w)


func _close_gy() -> void:
	gy_open = ""
	_drop(overlay_layer.get_node_or_null("GyPop"))
	_refresh()


func _open_gy(w: String) -> void:
	gy_open = w
	_drop(overlay_layer.get_node_or_null("GyPop"))
	var tg := _board_targets()
	var pl: Dictionary = V[w]
	var panel := PanelContainer.new()
	panel.name = "GyPop"
	var sb := Art.box(Art.FOGLIO, 14, Art.FOGLIO_BORDO, 1)
	sb.content_margin_left = 12
	sb.content_margin_right = 12
	sb.content_margin_top = 10
	sb.content_margin_bottom = 10
	sb.shadow_color = Art.OMBRA
	sb.shadow_size = 18
	sb.shadow_offset = Vector2(0, 6)
	panel.add_theme_stylebox_override("panel", sb)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 2)
	panel.add_child(v)
	var fs := int(clampf(_fs.status, 13, 17))
	v.add_child(W.label("Cimitero" if w == "me" else "Cimitero di %s" % pl.name, fs, Art.TESTO, Art.bold()))
	var any := false
	for t in TYPES:
		if pl.gy[t] == 0:
			continue
		any = true
		var is_t: bool = w == "me" and tg.gy.has(t)
		var b := Button.new()
		b.focus_mode = Control.FOCUS_NONE
		b.text = "%s   ×%d" % [Art.NAMES[t], pl.gy[t]]
		b.icon = Art.tex("ico-" + t, 24)
		b.expand_icon = false
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.add_theme_constant_override("icon_max_width", 24)
		b.add_theme_font_override("font", Art.sans())
		b.add_theme_font_size_override("font_size", fs)
		for c in ["font_color", "font_hover_color", "font_pressed_color"]:
			b.add_theme_color_override(c, Art.TESTO)
		var bs := Art.box(Color("#fffaf0") if is_t else Color(0, 0, 0, 0), 8, Art.SEGNALE if is_t else Color(0, 0, 0, 0), 2.5 if is_t else 0.0)
		bs.content_margin_left = 6
		bs.content_margin_right = 10
		bs.content_margin_top = 6
		bs.content_margin_bottom = 6
		for st in ["normal", "hover", "pressed"]:
			b.add_theme_stylebox_override(st, bs)
		if is_t:
			b.pressed.connect(_gy_target.bind(t))
		else:
			b.mouse_filter = Control.MOUSE_FILTER_IGNORE
		v.add_child(b)
	if not any:
		v.add_child(W.label("Vuoto", fs, Color(Art.TESTO, 0.6), Art.serif()))
	overlay_layer.add_child(panel)
	panel.reset_size()
	var badge: Control = zones[w].gy
	var r := _lr(badge)
	var ps := panel.get_combined_minimum_size()
	ps.x = maxf(ps.x, 210)
	panel.size = ps
	var pos := Vector2(r.end.x - ps.x, r.end.y + 8) if w == "opp" else Vector2(r.end.x - ps.x, r.position.y - 8 - ps.y)
	if lay != "portrait":
		pos = Vector2(r.end.x + 12, r.get_center().y - ps.y / 2)
	pos.x = clampf(pos.x, 6, size.x - ps.x - 6)
	pos.y = clampf(pos.y, 6, size.y - ps.y - 6)
	panel.position = pos
	zones[w].gy.set_state(zones[w].gy.total, true, false)


func _gy_target(t: String) -> void:
	if _task() == "main" and staged != null and staged.card == "G":
		act({"type": "play", "card": "G", "target": t})
	elif _task() == "choice" and V.choice.kind == "regrow":
		act({"type": "choose", "choice": t})


## Palude: la mano avversaria a tutto schermo, si tocca la carta da far scartare.
func _show_reveal() -> void:
	if overlay_layer.has_node("Reveal"):
		return
	var veil := ColorRect.new()
	veil.name = "Reveal"
	veil.color = Color(Art.TAVOLO2, 0.92)
	veil.size = size
	overlay_layer.add_child(veil)
	var cards: Array = V.choice.revealed
	var title := W.label("Mano di %s" % V.opp.name, 20, Art.TESTO, Art.bold())
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	# su più righe se così le carte vengono più grandi (sul telefono con tante carte)
	var n: int = cards.size()
	var rows := 1
	var per := maxi(n, 1)
	var w := 0.0
	for r in [1, 2, 3]:
		var c := int(ceil(float(n) / r))
		var wr := minf((size.x - 40 - (maxi(c, 3) - 1) * 10) / maxi(c, 3), minf(size.y * 0.3, (size.y - 170 - (r - 1) * 12) / r / 1.4))
		if wr > w + 4:
			w = wr
			rows = r
			per = c
	var block := rows * w * 1.4 + (rows - 1) * 12
	var y := (size.y - block) / 2
	title.position = Vector2(0, y - 54)
	title.size = Vector2(size.x, 30)
	veil.add_child(title)
	var sub := W.label("Tocca la terra da far scartare", 15, Art.MUTO, Art.serif())
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.position = Vector2(0, y + block + 18)
	sub.size = Vector2(size.x, 24)
	veil.add_child(sub)
	for i in cards.size():
		var b := Button.new()
		b.flat = true
		b.focus_mode = Control.FOCUS_NONE
		var row := i / per
		var in_row := mini(per, n - row * per)
		var total := in_row * w + (in_row - 1) * 10
		b.position = Vector2((size.x - total) / 2 + (i % per) * (w + 10), y + row * (w * 1.4 + 12))
		b.size = Vector2(w, w * 1.4)
		var c := Card.new()
		c.kind = cards[i]
		c.mode = "full" if w >= 110 else "compact"
		c.size = b.size
		c.ring = Art.SEGNALE
		b.add_child(c)
		var choice: String = cards[i]
		b.pressed.connect(func(): act({"type": "choose", "choice": choice}))
		veil.add_child(b)
		c.modulate.a = 0
		c.create_tween().tween_property(c, "modulate:a", 1.0, 0.25).set_delay(i * 0.06)


func _sheet(name: String) -> VBoxContainer:
	var veil := ColorRect.new()
	veil.name = name
	veil.color = Color(Art.TAVOLO2, 0.8)
	veil.size = size
	overlay_layer.add_child(veil)
	var panel := PanelContainer.new()
	var sb := Art.box(Art.FOGLIO, 22, Art.FOGLIO_BORDO, 1)
	for m in ["left", "right", "top", "bottom"]:
		sb.set("content_margin_" + m, 22)
	sb.shadow_color = Art.OMBRA
	sb.shadow_size = 30
	panel.add_theme_stylebox_override("panel", sb)
	veil.add_child(panel)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	panel.add_child(v)
	panel.set_meta("veil", veil)
	v.set_meta("panel", panel)
	return v


func _fit_sheet(v: VBoxContainer) -> void:
	Sheets.fit_panel(v.get_meta("panel"), 400.0)


func _open_menu(confirm_exit := false) -> void:
	if overlay_layer.has_node("Menu") and not confirm_exit:
		_close_overlays()
		return
	_close_overlays()
	Sound.play("click")
	var v := _sheet("Menu")
	var t := W.label("Menu", 22, Art.TESTO, Art.bold())
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	if confirm_exit:
		v.add_child(t)
		var msg := "Vuoi davvero uscire? " + ("Potrai rifare il tutorial quando vuoi dalla home." if mode.kind == "tutorial" else "La partita verrà chiusa e non conterà nelle statistiche.")
		v.add_child(Sheets.para(msg, 15))
		v.add_child(_btn("Esci dalla partita", "exit", func():
			forget_save()
			exit_requested.emit()))
		v.add_child(_btn("Annulla", "ghost_ink", func():
			_close_overlays()
			_open_menu()))
		_fit_sheet(v)
		return
	var full := _btn("Schermo intero", "full", func(): fullscreen_requested.emit())
	full.text = "Esci da schermo intero" if DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN else "Schermo intero"
	v.add_child(full)
	v.add_child(t)
	v.add_child(_switch("Info nella plancia", "info"))
	v.add_child(_switch("Musica", "music"))
	v.add_child(_switch("Effetti sonori", "sound"))
	v.add_child(_switch("Vibrazione", "vibrate"))
	if mode.kind != "tutorial":
		v.add_child(_switch("Reazioni rapide", "react"))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	for x in [["Registro", _open_log], ["Regole", func(): Sheets.rules(overlay_layer)], ["Statistiche", _open_stats]]:
		var b := _btn(x[0], "ghost_ink", x[1])
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(b)
	v.add_child(row)
	v.add_child(_btn("Chiudi", "ink", _close_overlays))
	v.add_child(_btn("Esci dalla partita", "exit", func(): _open_menu(true)))
	_fit_sheet(v)


## Riga con interruttore per una preferenza.
func _switch(label: String, key: String) -> Button:
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.flat = true
	b.text = label
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	b.custom_minimum_size.y = 40
	b.add_theme_font_override("font", Art.sans())
	b.add_theme_font_size_override("font_size", 15)
	for c in ["font_color", "font_hover_color", "font_pressed_color"]:
		b.add_theme_color_override(c, Art.TESTO)
	b.draw.connect(func():
		var on: bool = Prefs.get_value(key)
		var r := Rect2(b.size.x - 46, (b.size.y - 24) / 2, 44, 24)
		b.draw_style_box(Art.box(Art.SEGNALE if on else Color(1, 1, 1, 0.16), 12), r)
		b.draw_circle(Vector2(r.end.x - 12 if on else r.position.x + 12, r.get_center().y), 9, Art.CARTA))
	b.pressed.connect(func():
		var on: bool = not Prefs.get_value(key)
		if key == "music":
			Sound.set_music(on)
		else:
			Prefs.set_value(key, on)
		Sound.play("click")
		b.queue_redraw()
		_refresh())
	return b


func _open_stats() -> void:
	_close_overlays()
	var v := _sheet("Menu")
	var side := ["cpu"]
	var holder := VBoxContainer.new()
	v.add_child(holder)
	var build := func(rebuild: Callable):
		for c in holder.get_children():
			c.queue_free()
		holder.add_child(Sheets.profile_panel(side[0], func(sd):
			side[0] = sd
			rebuild.call(rebuild), func(): Sheets.transfer(overlay_layer, func(): pass)))
		_fit_sheet.call_deferred(v)
	build.call(build)
	v.add_child(_btn("Chiudi", "ink", _close_overlays))
	_fit_sheet(v)


func _open_log() -> void:
	_close_overlays()
	var v := _sheet("Menu")
	var t := W.label("Registro", 22, Art.TESTO, Art.bold())
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(t)
	var lines: Array = g.log_lines.duplicate()
	lines.reverse()  # le più recenti in alto
	var max_lines := int(clampf((size.y - 200) / 20.0, 4, 30))
	var l := W.label("
".join(lines.slice(0, max_lines)), 13, Art.TESTO, Art.sans())
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size.x = minf(400.0, size.x - 28) - 44
	v.add_child(l)
	v.add_child(_btn("Chiudi", "ink", _close_overlays))
	_fit_sheet(v)


func _close_overlays() -> void:
	for c in overlay_layer.get_children():
		_drop(c)
	gy_open = ""


## Toglie subito un nodo dallo schermo e lo libera appena possibile (anche se è il pulsante appena premuto).
func _drop(n: Node) -> void:
	if n == null:
		return
	if n.get_parent():
		n.get_parent().remove_child(n)
	n.queue_free()


func _show_over() -> void:
	_close_overlays()
	var v := _sheet("Over")
	var won: bool = g.winner == me
	if won:
		# vittoria: raggi dorati che girano piano dietro il foglio
		var veil: ColorRect = v.get_meta("panel").get_parent()
		veil.color = Color(Art.TAVOLO2, 0.6)
		var rays := W.Rays.new()
		rays.position = Vector2(size.x / 2, size.y * 0.42)
		rays.radius = maxf(size.x, size.y) * 0.7
		veil.add_child(rays)
		veil.move_child(rays, 0)
		rays.create_tween().tween_property(rays, "strength", 1.0, 1.2)
	if mode.kind == "tutorial":
		v.add_child(Sheets.title("Tutorial completato", 28))
		v.add_child(Sheets.para("Hai visto all'opera tutte e cinque le terre e anche il contrasto. Ora prova una partita vera.", 16))
		v.add_child(_btn("Gioca contro il computer", "ink", func(): start("normal", player_name)))
		v.add_child(_btn("Torna alla home", "ghost_ink", func(): exit_requested.emit()))
		_fit_sheet(v)
		return
	var title := "Pareggio" if g.winner == null else "Hai vinto!" if won else "Ha vinto %s" % g.name_of(g.winner)
	v.add_child(Sheets.title(title, 28))
	v.add_child(Sheets.para(g.end_text, 15))
	if won and (mode.kind == "daily" or mode.kind == "challenge"):
		var a := Profile.load_profile(player_name)
		var rec = a.get("daily", {}).get(mode.get("daily", ""), null) if mode.kind == "daily" else a.get("challenges", {}).get(mode.get("challenge", ""), null)
		var what := "Sfida del giorno" if mode.kind == "daily" else "Sfida"
		var line := "%s vinta al turno %d" % [what, g.turn]
		if rec != null:
			line += " · record: turno %d" % rec if rec < g.turn else " · nuovo record"
		var l := W.label(line, 15, Art.TESTO, Art.bold())
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		v.add_child(l)
	for id in new_goals:
		var gl := Profile.goal(id)
		var box := PanelContainer.new()
		var sb := Art.box(Color(1, 1, 1, 0.08), 14, Art.SEGNALE, 1.5)
		for m in ["left", "right", "top", "bottom"]:
			sb.set("content_margin_" + m, 10)
		box.add_theme_stylebox_override("panel", sb)
		var gl_l := W.label("Obiettivo: %s
%s" % [gl.name, ("Sbloccato: " + gl.reward.name) if gl.has("reward") else gl.desc], 13, Art.TESTO)
		gl_l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		gl_l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		box.add_child(gl_l)
		v.add_child(box)
	var again := "Riprova" if mode.kind == "daily" or mode.kind == "challenge" else "Rivincita"
	v.add_child(_btn(again, "ink", func(): start(level, player_name, {}, mode)))
	v.add_child(_btn("Torna alla home", "ghost_ink", func(): exit_requested.emit()))
	_fit_sheet(v)
	Sound.play("win" if won else "lose")
	Sound.vibrate(60 if won else 30)


func _toast(msg: String) -> void:
	caption = msg
	caption_danger = true
	_refresh()
	var id := _game_id
	await get_tree().create_timer(1.6).timeout
	if id == _game_id and caption == msg:
		caption = ""
		caption_danger = false
		_refresh()


# =====================================================================
#  Animazioni degli eventi
# =====================================================================

## Rettangolo di un nodo nelle coordinate del tavolo (sul telefono il tavolo è spostato
## per lasciare spazio alla fotocamera, quindi le coordinate globali non vanno bene).
func _lr(c: Control) -> Rect2:
	var gt := c.get_global_transform()
	return Rect2(gt.origin - global_position, c.size * gt.get_scale())


func _who(p: int) -> String:
	return "me" if p == me else "opp"


func _hand_rect_of(w: String, card := "") -> Rect2:
	if w == "opp":
		return zones.opp.backs.fan_rect()
	for i in hand_cards.size():
		if hand_cards[i].kind == card and hand_cards[i].visible:
			return Rect2(hand_cards[i].position, hand_cards[i].size)
	return Rect2(hand_rect.get_center() - Vector2(hw, hw * 1.4) / 2, Vector2(hw, hw * 1.4))


func _gy_rect(w: String) -> Rect2:
	return _lr(zones[w].gy)


func _slot_rect(w: String, t: String) -> Rect2:
	var s: W.Slot = zones[w].slots[t]
	var r := _lr(s)
	var tr := s.tile_rect()
	return Rect2(r.position + tr.position, tr.size)


## Una carta (in proporzione) dentro il cerchio centrale: da qui partono e qui arrivano i voli.
func _stack_card_rect() -> Rect2:
	var d := stack_rect.size.x
	var cw2 := d * 0.6
	return Rect2(stack_rect.get_center() - Vector2(cw2, cw2 * 1.4) / 2, Vector2(cw2, cw2 * 1.4))


func _deck_rect(w: String) -> Rect2:
	return zones[w].deck.pile_rect()


## Una carta che vola da `from` a `to` (rettangoli sullo schermo). face: tipo o "back".
func _fly(face: String, from: Rect2, to: Rect2, dur := FLY, end_face := "") -> void:
	var c := Card.new()
	c.kind = face
	c.mode = "compact" if to.size.x >= 70 else "mini"
	c.position = from.position
	c.size = from.size
	c.pivot_offset = from.size / 2
	fly_layer.add_child(c)
	var tw := c.create_tween().set_parallel().set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
	tw.tween_property(c, "position", to.position, dur)
	tw.tween_property(c, "size", to.size, dur)
	if end_face != "":
		get_tree().create_timer(dur / 2).timeout.connect(func(): if is_instance_valid(c): c.kind = end_face)
	await tw.finished
	c.queue_free()


func _set_caption(text: String) -> void:
	caption = text
	caption_danger = false
	_refresh_status(_task())


func _apply(e: Dictionary) -> void:
	V = e.views[me]
	_refresh()


func _card_rect_from(w: String, r: Rect2) -> Rect2:
	# un rettangolo con le proporzioni della carta, centrato in r
	var cwid := minf(r.size.x, r.size.y / 1.4)
	if w == "opp":
		cwid = maxf(cwid, sw * 0.6)
	return Rect2(r.get_center() - Vector2(cwid, cwid * 1.4) / 2, Vector2(cwid, cwid * 1.4))


const EVENT_SOUND := {"draw": "draw", "play": "play", "counter": "counter", "countered": "fizzle", "enter": "land",
	"destroy": "destroy", "regrow": "regrow", "discard": "discard", "reuse": "reuse", "look": "look", "timeout": "timeout"}


func _animate(e: Dictionary) -> void:
	var ev: Dictionary = e.ev
	var t: String = ev.get("type", "")
	var tree := get_tree()
	if EVENT_SOUND.has(t) and not (t == "draw" and ev.player != me):
		Sound.play(EVENT_SOUND[t])
	if t == "turn" and ev.player == me:
		Sound.play("turn")
	if t == "destroy" or t == "countered":
		Sound.vibrate(40)
	elif t == "counter" or (t == "turn" and ev.player == me):
		Sound.vibrate(20)
	match t:
		"turn":
			_apply(e)
			_sky_turn(ev.player == me)
			_set_caption("Tocca a te" if ev.player == me else "Turno di %s" % V.opp.name)
			await tree.create_timer(0.55).timeout
		"draw":
			var w := _who(ev.player)
			var from := _card_rect_from(w, _deck_rect(w))
			if w == "me":
				var fan := _fan_positions(hand_cards.size() + 1)
				var to := Rect2(fan[-1].pos, Vector2(hw, hw * 1.4)) if fan.size() > 0 else _hand_rect_of("me")
				await _fly("back", from, to, FLY * 0.8, ev.card)
			else:
				await _fly("back", from, _card_rect_from("opp", zones.opp.backs.fan_rect()), FLY * 0.7)
			_apply(e)
		"play":
			var w := _who(ev.player)
			_set_caption(("Giochi %s" if w == "me" else "%s gioca %%s" % V.opp.name) % Art.NAMES[ev.card])
			if w == "me":
				var from := _hand_rect_of("me", ev.card)
				if staged != null:
					from = _stack_card_rect()  # era già posata al centro in attesa del bersaglio
				elif _play_from.has_area():
					from = _play_from
				_play_from = Rect2()
				for i in hand_cards.size():
					var c: Card = hand_cards[i]
					if (staged != null and i == staged.idx) or (staged == null and c.kind == ev.card and c.visible):
						c.visible = false
						break
				stack_card.visible = false
				if from != _stack_card_rect():
					await _fly(ev.card, from, _stack_card_rect())
			else:
				await _fly("back", _card_rect_from("opp", zones.opp.backs.fan_rect()), _stack_card_rect(), FLY, ev.card)
			staged = null
			_apply(e)
			_disc_in()
			await tree.create_timer(0.4).timeout
		"counter":
			var w := _who(ev.player)
			_set_caption("Contrasti!" if w == "me" else "%s contrasta!" % V.opp.name)
			var a := _hand_rect_of(w, "U")
			var b := _hand_rect_of(w, ev.other)
			var g1 := _card_rect_from(w, _gy_rect(w))
			_ripple(stack_rect.get_center(), Art.LAND.U.lightened(0.3), stack_rect.size.x * 0.55)
			_fly("U", _card_rect_from(w, a) if w == "opp" else a, g1)
			await _fly(ev.other, _card_rect_from(w, b) if w == "opp" else b, g1)
			_apply(e)
			await tree.create_timer(0.3).timeout
		"countered":
			var w := _who(ev.player)
			_set_caption("%s annullata" % Art.NAMES[ev.card])
			# il paesaggio si spegne e il cerchio si richiude, poi la carta va nel cimitero
			var tw2 := stack_card.create_tween().set_parallel()
			tw2.tween_property(stack_card, "dim", 0.75, 0.3)
			tw2.tween_property(stack_card, "scale", Vector2(0.85, 0.85), 0.3)
			await tw2.finished
			stack_card.visible = false
			stack_card.scale = Vector2.ONE
			stack_card.dim = 0.0
			await _fly(ev.card, _stack_card_rect(), _card_rect_from(w, _gy_rect(w)))
			_apply(e)
		"enter":
			var w := _who(ev.player)
			_set_caption("%s entra in gioco" % Art.NAMES[ev.card])
			stack_card.visible = false
			await _fly(ev.card, _stack_card_rect(), _slot_rect(w, ev.card))
			_apply(e)
			_slot_pop(w, ev.card)
			await tree.create_timer(0.15).timeout
		"destroy":
			var w := _who(ev.player)
			_set_caption("%s distrutta" % Art.NAMES[ev.card])
			# sulla terra colpita scende la notte, poi la carta va nel cimitero
			var sl: W.Slot = zones[w].slots[ev.card]
			var tw3 := sl.create_tween()
			tw3.tween_property(sl, "night", 1.0, 0.35)
			await tw3.finished
			await _fly(ev.card, _slot_rect(w, ev.card), _card_rect_from(w, _gy_rect(w)))
			sl.night = 0.0
			_apply(e)
		"regrow":
			var w := _who(ev.player)
			_set_caption(("Riprendi %s" if w == "me" else "%s riprende %%s" % V.opp.name) % Art.NAMES[ev.card])
			var to := _hand_rect_of("me") if w == "me" else _card_rect_from("opp", zones.opp.backs.fan_rect())
			await _fly(ev.card, _card_rect_from(w, _gy_rect(w)), to)
			_apply(e)
		"discard":
			var w := _who(ev.player)
			_set_caption(("Scarti %s" if w == "me" else "%s scarta %%s" % V.opp.name) % Art.NAMES[ev.card])
			var from := _hand_rect_of("me", ev.card) if w == "me" else _card_rect_from("opp", zones.opp.backs.fan_rect())
			await _fly(ev.card, from, _card_rect_from(w, _gy_rect(w)))
			_apply(e)
		"reuse":
			_apply(e)
			_set_caption("La Pianura riattiva %s" % Art.NAMES[ev.card])
			await tree.create_timer(0.8).timeout
		"look":
			_apply(e)
			_set_caption("Guardi la mano di %s" % V.opp.name if ev.player == me else "%s guarda la tua mano" % V.opp.name)
			await tree.create_timer(0.6).timeout
		"pass":
			_apply(e)
			_set_caption("Passi il turno" if ev.player == me else "%s passa" % V.opp.name)
			await tree.create_timer(0.6).timeout
		_:
			_apply(e)
	caption = ""


# =====================================================================
#  Tempo per turno
# =====================================================================

func _process(_delta: float) -> void:
	if g == null or turn_time <= 0 or g.phase != "playing":
		if timer_bar.visible:
			timer_bar.visible = false
		return
	var actor = g.actor()
	# il tempo vale solo per me (contro il computer) e parte quando le animazioni sono finite
	if actor != me or busy:
		timer_bar.visible = false
		_timer_key = ""
		return
	var key := "%d|%s|%s" % [g.turn, g.step, str(g.pending.counters) if g.pending != null else ""]
	var now := Time.get_ticks_msec() / 1000.0
	if key != _timer_key:
		_timer_key = key
		_timer_end = now + turn_time
		_last_tick = -1
	timer_bar.visible = true
	timer_bar.queue_redraw()
	var left := _timer_end - now
	var sec := int(ceil(left))
	if sec <= 5 and sec != _last_tick and sec > 0:
		_last_tick = sec
		Sound.play("tick")
	if left <= 0:
		_timer_key = "scaduto"
		staged = null
		sel = null
		counter_mode = false
		pick = null
		_close_overlays()
		g.auto_act()
		_pump()


func _draw_timer() -> void:
	var left := maxf(0.0, _timer_end - Time.get_ticks_msec() / 1000.0)
	var k := clampf(left / maxf(1, turn_time), 0, 1)
	var r := Rect2(Vector2.ZERO, timer_bar.size)
	var rad := r.size.y / 2 if lay == "portrait" else 0.0
	timer_bar.draw_style_box(Art.box(Color(Art.TAVOLO2, 0.6), rad, Art.RIGA, 1.5), r)
	var col := Art.ROSSO if left <= 5 else Art.SEGNALE
	if k > 0:
		timer_bar.draw_style_box(Art.box(col, rad), Rect2(r.position, Vector2(r.size.x * k, r.size.y)))
	var f := Art.bold()
	var fs := int(r.size.y * 0.8)
	var txt := "%d s" % int(ceil(left))
	var tw := f.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
	timer_bar.draw_string(f, Vector2((r.size.x - tw) / 2, r.size.y / 2 + f.get_ascent(fs) * 0.36), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Art.INK)


# =====================================================================
#  Freccia: chi colpisce cosa
# =====================================================================

const ARROW_COLOR := {"R": Color("#d9482f"), "W": Color("#e0a92e"), "G": Color("#2f9e6a"), "B": Color("#8a6cc0"), "U": Color("#1f8fb8")}


## Il bersaglio della terra in attesa: { rect, color } oppure null.
func _arrow_target():
	var p = V.get("pending")
	if p == null or p.target == null or busy:
		return null
	var owner := _who(p.owner)
	var other := "opp" if owner == "me" else "me"
	match p.land:
		"R":
			return {"rect": _slot_rect(other, p.target), "color": ARROW_COLOR.R}
		"W":
			return {"rect": _slot_rect(owner, p.target), "color": ARROW_COLOR.W}
		"G":
			return {"rect": _gy_rect(owner), "color": ARROW_COLOR.G}
	return null


func _draw_arrow() -> void:
	var a = _arrow_target()
	if a == null or not stack_card.visible:
		return
	var c := stack_rect.get_center()
	var to: Vector2 = a.rect.get_center()
	var dir := (to - c).normalized()
	# parte dal bordo della carta e si ferma un po' prima del bersaglio
	var from := c + dir * (stack_rect.size.x / 2 + 4)
	# la punta si ferma appena fuori dal bordo della carta colpita
	var tx: float = a.rect.size.x / 2 / maxf(0.001, absf(dir.x))
	var ty: float = a.rect.size.y / 2 / maxf(0.001, absf(dir.y))
	to -= dir * (minf(tx, ty) + 4)
	var mid := (from + to) / 2 + Vector2(-dir.y, dir.x) * from.distance_to(to) * 0.18
	var pts := PackedVector2Array()
	for i in 25:
		var k := i / 24.0
		pts.append(from.lerp(mid, k).lerp(mid.lerp(to, k), k))
	var col: Color = a.color
	arrow_layer.draw_polyline(pts, Color(0, 0, 0, 0.35), 7, true)
	arrow_layer.draw_polyline(pts, col, 4, true)
	var tip := pts[-1]
	var back := (pts[-1] - pts[-3]).normalized()
	var side := Vector2(-back.y, back.x)
	var head := PackedVector2Array([tip + back * 6, tip - back * 12 + side * 9, tip - back * 12 - side * 9])
	arrow_layer.draw_colored_polygon(head, col)


# =====================================================================
#  Reazioni rapide (solo frasi predefinite)
# =====================================================================

func _place_react() -> void:
	var z = zones.me
	react_btn.size = Vector2(34, 30)
	if not z.get("row", false):
		# intestazione in colonna: accanto al segnalino del cimitero
		react_btn.position = Vector2(z.gy.position.x + z.gy.size.x + 6, z.gy.position.y + (z.gy.size.y - 30) / 2)
		return
	var x: float = z.name.position.x + z.name.size.x + 6
	if z.near.visible:
		x = z.near.position.x + z.near.size.x + 6
	react_btn.position = Vector2(x, z.name.position.y + (z.name.size.y - 30) / 2)


func _open_reactions() -> void:
	if overlay_layer.has_node("Reazioni"):
		_drop(overlay_layer.get_node("Reazioni"))
		return
	var box := PanelContainer.new()
	box.name = "Reazioni"
	var sb := Art.box(Art.FOGLIO, 14, Art.FOGLIO_BORDO, 1)
	for m in ["left", "right", "top", "bottom"]:
		sb.set("content_margin_" + m, 6)
	sb.shadow_color = Art.OMBRA
	sb.shadow_size = 14
	box.add_theme_stylebox_override("panel", sb)
	var flow := HFlowContainer.new()
	flow.custom_minimum_size.x = 250
	box.add_child(flow)
	for i in Modes.REACTIONS.size():
		var b := W.button(Modes.REACTIONS[i], "ghost_ink", 13)
		var idx := i
		b.pressed.connect(func():
			_drop(box)
			_react(me, idx))
		flow.add_child(b)
	overlay_layer.add_child(box)
	box.reset_size()
	var r := _lr(react_btn)
	box.position = Vector2(clampf(r.position.x, 6, size.x - box.size.x - 6), clampf(r.position.y - box.size.y - 8, 6, size.y - box.size.y - 6))


## Una reazione: fumetto accanto al nome di chi la manda. Al «Ciao!» il computer di solito risponde.
func _react(seat: int, i: int) -> void:
	if seat == me:
		var now := Time.get_ticks_msec()
		if now - _react_last < 1500:
			_toast("Aspetta un attimo prima della prossima")
			return
		_react_last = now
		if i == 0 and randf() < 0.8:
			get_tree().create_timer(1.2 + randf() * 0.8).timeout.connect(func(): if is_instance_valid(self): _bubble(bot.p, 0))
	_bubble(seat, i)


func _bubble(seat: int, i: int) -> void:
	if not Prefs.get_value("react") or mode.kind == "tutorial":
		return
	var w := _who(seat)
	var old := overlay_layer.get_node_or_null("Fumetto" + w)
	if old:
		_drop(old)
	var l := W.label(Modes.REACTIONS[i], 14, Art.INK, Art.bold())
	l.name = "Fumetto" + w
	var sb := Art.box(Art.CARTA, 12)
	sb.content_margin_left = 12
	sb.content_margin_right = 12
	sb.content_margin_top = 6
	sb.content_margin_bottom = 6
	l.add_theme_stylebox_override("normal", sb)
	overlay_layer.add_child(l)
	l.reset_size()
	var r: Rect2 = _lr(zones[w].name)
	l.position = Vector2(clampf(r.position.x, 8, size.x - l.size.x - 8), r.end.y + 6 if w == "opp" else r.position.y - l.size.y - 6)
	if w == "opp":
		Sound.play("click")
		Sound.vibrate(10)
	var tw := l.create_tween()
	tw.tween_interval(2.4)
	tw.tween_property(l, "modulate:a", 0.0, 0.4)
	tw.tween_callback(func(): _drop(l))


## Il computer ogni tanto reagisce (come botReacts in hub.js), dopo le animazioni.
func _bot_reacts(evs: Array) -> void:
	if mode.kind == "tutorial" or evs.is_empty():
		return
	var i = null
	for e in evs:
		var ev: Dictionary = e.ev
		if ev.type == "counter" and ev.player != bot.p and randf() < 0.5:
			i = 1
		if ev.type == "countered" and ev.player == bot.p and randf() < 0.4:
			i = 2
		if ev.type == "end":
			i = (5 if randf() < 0.7 else null) if ev.winner == bot.p else 5
	if i != null:
		var idx: int = i
		get_tree().create_timer(0.4).timeout.connect(func(): if is_instance_valid(self): _bubble(bot.p, idx))


## Il rettangolo (dritto) che contiene la carta in mano dove andrà a fermarsi.
func hand_card_rect(c: Control) -> Rect2:
	var f: Dictionary = c.get_meta("fan", {"pos": c.position, "rot": c.rotation_degrees, "scale": c.scale.x})
	var sz: Vector2 = c.size * f.scale
	var r := Rect2(f.pos + Vector2((c.size.x - sz.x) / 2, c.size.y - sz.y), sz)
	if absf(f.rot) > 0.01:
		# carta ruotata attorno al centro del lato in basso: il rettangolo che la contiene
		var piv: Vector2 = f.pos + Vector2(c.size.x / 2, c.size.y)
		var pts := [r.position, Vector2(r.end.x, r.position.y), r.end, Vector2(r.position.x, r.end.y)]
		var out := Rect2(piv, Vector2.ZERO)
		for q in pts:
			out = out.expand(piv + (q - piv).rotated(deg_to_rad(f.rot)))
		return out
	return r


## La terra che mi manca per le cinque diverse (o "" se non sono a un passo).
func _missing_for_me() -> String:
	if V.is_empty() or V.get("onlyFive", false):
		return ""
	var bf: Dictionary = V.me.bf
	var miss := []
	for t in TYPES:
		if bf[t] == 0:
			miss.append(t)
	return miss[0] if miss.size() == 1 else ""


## Frase che spiega quanto manca alla vittoria («Ti manca solo un'Isola per vincere»).
func _win_hint() -> String:
	if V.is_empty():
		return ""
	const ART := {"W": "una Pianura", "U": "un'Isola", "B": "una Palude", "R": "una Montagna", "G": "una Foresta"}
	var m := _missing_for_me()
	if m != "":
		return ("Gioca %s e vinci!" if V.hand.has(m) else "Ti manca solo %s per vincere") % ART[m]
	for t in TYPES:
		if V.me.bf[t] == 4:
			return ("Gioca %s e fai cinque uguali!" if V.hand.has(t) else "Ti manca solo %s per le cinque uguali") % ART[t]
	return ""


# =====================================================================
#  Effetti (leggeri: pochi nodi, niente disegni ripetuti ogni fotogramma se non servono)
# =====================================================================

## La terra giocata compare nel cerchio con un piccolo rimbalzo.
func _disc_in() -> void:
	if not stack_card.visible:
		return
	stack_card.pivot_offset = stack_card.size / 2
	stack_card.scale = Vector2(0.8, 0.8)
	stack_card.modulate.a = 0.0
	var tw := stack_card.create_tween().set_parallel()
	tw.tween_property(stack_card, "scale", Vector2.ONE, 0.45).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(stack_card, "modulate:a", 1.0, 0.2)


## Onde che si allargano da un punto.
func _ripple(at: Vector2, col: Color, radius: float) -> void:
	var r := W.Ripple.new()
	r.position = at
	r.color = col
	r.radius = radius
	fly_layer.add_child(r)


## La casella della terra appena entrata si gonfia un attimo, con un'onda dorata.
func _slot_pop(w: String, t: String) -> void:
	var sl: W.Slot = zones[w].slots[t]
	var tw := sl.create_tween()
	sl.pop = 1.0
	tw.tween_property(sl, "pop", 0.0, 0.45).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	var r := _slot_rect(w, t)
	_ripple(r.get_center(), Art.SEGNALE, r.size.x * 0.6)


## Nel mio turno il cielo si scalda appena e le colline scivolano un poco: si sente di chi è il turno.
func _sky_turn(mine: bool) -> void:
	var tw := bg.create_tween().set_parallel().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tw.tween_property(bg, "warmth", 1.0 if mine else 0.0, 1.2)
	tw.tween_property(bg, "hills_shift", 10.0 if mine else -10.0, 1.6)
