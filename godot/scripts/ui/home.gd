## La home nello stile «Orizzonti»: tutto direttamente sul cielo, le schede in fondo (solo testo, con
## una lineetta sotto quella scelta): Gioca, Sfide, Profilo, Collezione, Impara.
## Se il contenuto non ci sta si rimpicciolisce: mai scorrere. Sul telefono in orizzontale le schede
## stanno in una colonna a sinistra.
extends Control

signal play_bot(level: String)
signal play_challenge(id: String)
signal play_daily(day: String)
signal play_tutorial
signal resume_game  # riprende la partita rimasta in corso quando l'app è stata chiusa
signal play_friend(code: String)  # "" = crea una stanza, altrimenti entra con il codice
signal friend_cancel  # esce dalla stanza mentre si aspetta l'amico
signal fullscreen_toggled

const Art := preload("res://scripts/ui/art.gd")
const W := preload("res://scripts/ui/widgets.gd")
const Sheets := preload("res://scripts/ui/sheets.gd")
const Prefs := preload("res://scripts/app/prefs.gd")
const Profile := preload("res://scripts/app/profile.gd")
const Modes := preload("res://scripts/app/modes.gd")
const Sound := preload("res://scripts/app/sound.gd")
const Table := preload("res://scripts/ui/table.gd")

const TABS := [["play", "Gioca"], ["challenges", "Sfide"], ["profile", "Profilo"], ["collection", "Collezione"], ["learn", "Impara"]]
const TAB_ICON := {
	"play": "<path d=\"M8 5.5v13l10.5-6.5z\"/>",
	"challenges": "<path d=\"M6 21V4\"/><path d=\"M6 4.5c4-2 7 2 12 0v9c-5 2-8-2-12 0\"/>",
	"profile": "<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21c1.5-4.5 4.5-6.5 8-6.5s6.5 2 8 6.5\"/>",
	"collection": "<rect x=\"8\" y=\"3\" width=\"11\" height=\"15\" rx=\"2\"/><path d=\"M5 7v12a2 2 0 0 0 2 2h9\"/>",
	"learn": "<path d=\"M3.5 5.5c3-1.5 5.8-1 8.5 1 2.7-2 5.5-2.5 8.5-1V19c-3-1.5-5.8-1-8.5 1-2.7-2-5.5-2.5-8.5-1z\"/><path d=\"M12 6.5V20\"/>",
}
const LOCK := "<rect x=\"5\" y=\"11\" width=\"14\" height=\"10\" rx=\"2\"/><path d=\"M8 11V8a4 4 0 0 1 8 0v3\"/>"
const FULL_ICON := "<path d=\"M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5\"/>"
const NOTE_ICON := "<path d=\"M9 18V5l11-2v13\"/><circle cx=\"6\" cy=\"18\" r=\"3\"/><circle cx=\"17\" cy=\"16\" r=\"3\"/>"
const NOTE_OFF_ICON := "<path d=\"M9 18V5l11-2v13\"/><circle cx=\"6\" cy=\"18\" r=\"3\"/><circle cx=\"17\" cy=\"16\" r=\"3\"/><path d=\"M3 3l18 18\"/>"
const FULL_EXIT_ICON := "<path d=\"M9 4v5H4M15 4v5h5M20 15h-5v5M4 15h5v5\"/>"
const LEVELS := [["easy", "Facile"], ["normal", "Normale"], ["hard", "Difficile"]]
const TURN_TIMES := [30, 45, 60, 90, 0]

var tab := "play"
var stats_side := "cpu"
var _open_challenge := ""  # la sfida a tema aperta (a tendina) nella scheda Sfide
var _pane_box: Control
var _tabs: Control
var _pane: Control
var _side := false  # telefono in orizzontale: schede a sinistra
var _overlays: Control
var _toast_label: Label
var _corner: HBoxContainer  # schermo intero e musica, in alto a destra


func _ready() -> void:
	tab = Prefs.get_value("tab")
	if not TABS.any(func(t): return t[0] == tab):
		tab = "play"
	_pane_box = Control.new()
	_pane_box.clip_contents = false  # le schede entrano dal bordo vero dello schermo
	add_child(_pane_box)
	_tabs = Control.new()
	add_child(_tabs)
	_corner = HBoxContainer.new()
	_corner.add_theme_constant_override("separation", 10)
	add_child(_corner)
	_overlays = Control.new()
	_overlays.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_overlays)
	_toast_label = W.label("", 14, Art.INK, Art.semi())
	var p := Art.box(Art.CARTA, 14)
	p.content_margin_left = 16
	p.content_margin_right = 16
	p.content_margin_top = 10
	p.content_margin_bottom = 10
	_toast_label.add_theme_stylebox_override("normal", p)
	_toast_label.visible = false
	_toast_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_toast_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(_toast_label)
	resized.connect(_layout)
	_layout()


func _round_button(icon: String, key: String, _on: bool, cb: Callable) -> Button:
	var b := W.icon_button(icon, key, 22)
	b.custom_minimum_size = Vector2(46, 46)
	b.pressed.connect(cb)
	return b


func _layout() -> void:
	var S := size
	if S.x < 10:
		return
	_overlays.size = S
	_side = S.x / S.y >= 1.1 and S.y <= 520
	# in alto a destra, solo nella scheda Gioca: musica e (su PC e nel browser) schermo intero.
	# Nell'app del telefono lo schermo è già intero: il pulsante non serve.
	for c in _corner.get_children():
		c.queue_free()
	var corner := tab == "play"
	if corner:
		var music_on: bool = Prefs.get_value("music")
		var mb := _round_button(NOTE_ICON if music_on else NOTE_OFF_ICON, "note" + str(music_on), music_on, func():
			Sound.set_music(not Prefs.get_value("music"))
			_layout())
		mb.modulate.a = 1.0 if music_on else 0.6
		_corner.add_child(mb)
		if not OS.has_feature("mobile"):
			var full: bool = DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
			var fb := _round_button(FULL_EXIT_ICON if full else FULL_ICON, "full" + str(full), full, func(): fullscreen_toggled.emit())
			fb.tooltip_text = "Esci da schermo intero" if full else "Schermo intero"
			_corner.add_child(fb)
	_corner.reset_size()
	_corner.position = Vector2(S.x - _corner.size.x - 16, 16)
	var top_room := 74.0 if corner else 22.0
	# schede
	for c in _tabs.get_children():
		c.queue_free()
	var margin := 16.0 if S.x < 500 else 28.0
	var content_w := minf(S.x - margin * 2, 520.0)
	if _side:
		var tw := 150.0
		_tabs.position = Vector2(margin, 16)
		_tabs.size = Vector2(tw, S.y - 32)
		_pane_box.position = Vector2(margin + tw + 18, top_room if corner else 18.0)
		_pane_box.size = Vector2(S.x - margin * 2 - tw - 18 - (_corner.size.x + 10 if corner else 0.0), S.y - _pane_box.position.y - 16)
		if corner:
			_pane_box.position.y = 18
	else:
		var th := 70.0
		var bottom := 14.0 if OS.has_feature("mobile") else 8.0
		var tabs_w := minf(S.x - 12, 560.0)  # la barra delle schede usa quasi tutta la larghezza
		_tabs.position = Vector2((S.x - tabs_w) / 2, S.y - th - bottom)
		_tabs.size = Vector2(tabs_w, th)
		_pane_box.position = Vector2((S.x - content_w) / 2, top_room)
		_pane_box.size = Vector2(content_w, S.y - top_room - th - bottom - 14)
	var line := ColorRect.new()
	line.color = Color(1, 1, 1, 0.14)
	line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if _side:
		line.position = Vector2(_tabs.size.x - 1, 0)
		line.size = Vector2(1, _tabs.size.y)
	else:
		line.size = Vector2(_tabs.size.x, 1)
	_tabs.add_child(line)
	var n := TABS.size()
	for i in n:
		var t: Array = TABS[i]
		var on: bool = t[0] == tab
		# la scheda è disegnata a mano: icona e scritta in posizioni esatte, mai fuori dal suo spazio
		var b := Button.new()
		b.flat = true
		b.focus_mode = Control.FOCUS_NONE
		for st in ["normal", "hover", "pressed", "focus"]:
			b.add_theme_stylebox_override(st, StyleBoxEmpty.new())
		var tab_w: float = (_tabs.size.x - 8) if _side else _tabs.size.x / n
		# stessa misura per tutte le schede: quella che fa stare la più lunga
		var fs := 15
		while fs > 10 and TABS.any(func(x): return Art.semi().get_string_size(x[1], HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x > tab_w - 6 - (34.0 if _side else 0.0)):
			fs -= 1
		var col := Art.TESTO if on else Color(Art.TESTO, 0.6)
		var label: String = t[1]
		var ico := Art.line_icon("tab-" + t[0], TAB_ICON[t[0]], col, 24)
		var side := _side
		b.draw.connect(func():
			var f := Art.semi() if on else Art.sans()
			if side:
				var cy := b.size.y / 2
				b.draw_texture_rect(ico, Rect2(4, cy - 12, 24, 24), false)
				b.draw_string(f, Vector2(38, cy + (f.get_ascent(fs) - f.get_descent(fs)) / 2), label, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, col)
			else:
				var block := 24 + 6 + fs * 1.1
				var top := (b.size.y - block) / 2
				b.draw_texture_rect(ico, Rect2(b.size.x / 2 - 12, top, 24, 24), false)
				Art.draw_text_centered(b, f, label, Vector2(b.size.x / 2, top + 30 + fs * 0.55), fs, col))
		if _side:
			b.position = Vector2(0, i * (_tabs.size.y / n))
			b.size = Vector2(_tabs.size.x - 8, _tabs.size.y / n)
		else:
			b.position = Vector2(i * _tabs.size.x / n, 4)
			b.size = Vector2(_tabs.size.x / n, _tabs.size.y - 4)
		var id: String = t[0]
		b.pressed.connect(func(): set_tab(id))
		_tabs.add_child(b)
		if on:
			var u := ColorRect.new()
			u.color = Art.TESTO
			u.mouse_filter = Control.MOUSE_FILTER_IGNORE
			if _side:
				u.position = Vector2(_tabs.size.x - 3, b.position.y + b.size.y * 0.25)
				u.size = Vector2(3, b.size.y * 0.5)
			else:
				u.position = Vector2(b.position.x + b.size.x * 0.12, 0)
				u.size = Vector2(b.size.x * 0.76, 3)
			_tabs.add_child(u)
	_build_pane()


## Cambio scheda: sempre la stessa animazione. La scheda vecchia scorre fuori da un bordo dello
## schermo e la nuova entra dall'altro, insieme, con la stessa velocità. La nuova viene misurata
## prima di partire, così durante lo scorrimento non cambia mai posizione o misura.
func set_tab(id: String) -> void:
	if id == tab or _sliding:
		return
	var order := TABS.map(func(t): return t[0])
	var dir := 1 if order.find(id) > order.find(tab) else -1
	tab = id
	Prefs.set_value("tab", id)
	Sound.play("click")
	_sliding = true
	var old := _pane
	_pane = null
	if old != null:
		var gp := old.global_position
		old.reparent(self)
		old.global_position = gp
	_layout()
	var p := _pane
	p.visible = false
	# misura completa prima di partire (i testi a capo hanno bisogno di qualche fotogramma)
	for k in 3:
		await get_tree().process_frame
		_fit_pane()
	if not is_instance_valid(p):
		_sliding = false
		return
	var w := size.x
	var dur := 0.3
	p.visible = true
	_slide_x = dir * w
	_fit_pane()
	var tw := create_tween().set_parallel().set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tw.tween_method(func(v: float):
		_slide_x = v
		if is_instance_valid(p):
			p.position.x = v, dir * w, 0.0, dur)
	if old != null:
		tw.tween_property(old, "position:x", old.position.x - dir * w, dur)
	await tw.finished
	if old != null:
		old.queue_free()
	_slide_x = 0.0
	_sliding = false
	_fit_pane()


var _sliding := false
var _slide_x := 0.0  # spostamento della scheda nuova mentre entra


## Scorrendo il dito a destra o a sinistra si passa alla scheda vicina.
var _swipe_from := Vector2.ZERO
var _swipe_t := 0
var _swipe_on := false


func _input(e: InputEvent) -> void:
	if not is_visible_in_tree() or _overlays.get_child_count() > 0:
		return
	if e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT:
		if e.pressed:
			_swipe_from = e.position
			_swipe_t = Time.get_ticks_msec()
			_swipe_on = true
		elif _swipe_on:
			_swipe_on = false
			var d: Vector2 = e.position - _swipe_from
			if absf(d.x) > 60 and absf(d.x) > absf(d.y) * 1.6 and Time.get_ticks_msec() - _swipe_t < 700:
				var order := TABS.map(func(t): return t[0])
				var i := order.find(tab) + (1 if d.x < 0 else -1)
				if i >= 0 and i < order.size():
					get_viewport().set_input_as_handled()
					set_tab(order[i])


func refresh() -> void:
	_layout()


func _build_pane() -> void:
	if _pane != null:
		_pane.queue_free()
	match tab:
		"play":
			_pane = _play_pane()
		"challenges":
			_pane = _challenges_pane()
		"profile":
			_pane = Sheets.profile_panel(stats_side, func(s):
				stats_side = s
				_layout(), func(): Sheets.transfer(_overlays, refresh))
		"collection":
			_pane = _collection_pane()
		"learn":
			_pane = _learn_pane()
	_pane_box.add_child(_pane)
	_fit_pane.call_deferred()
	# i testi a capo conoscono la loro altezza solo dopo aver avuto la larghezza: seconda misura
	get_tree().process_frame.connect(_fit_pane, CONNECT_ONE_SHOT)
	# i testi lunghi (RichTextLabel) a volte si misurano un attimo dopo: terza misura
	get_tree().create_timer(0.08).timeout.connect(_fit_pane)


## Il contenuto prende tutta la larghezza; se è più alto dello spazio si rimpicciolisce.
func _fit_pane() -> void:
	if _pane == null or not is_instance_valid(_pane):
		return
	var area := _pane_box.size
	if area.x < 10 or area.y < 10:
		return
	_pane.scale = Vector2.ONE
	_pane.custom_minimum_size.x = area.x
	_pane.reset_size()
	var ms := _pane.get_combined_minimum_size()
	var k := minf(1.0, minf(area.y / maxf(1.0, ms.y), area.x / maxf(1.0, ms.x)))
	for i in 3:
		if k >= 1.0:
			break
		_pane.custom_minimum_size.x = area.x / k
		_pane.reset_size()
		ms = _pane.get_combined_minimum_size()
		k = minf(k, minf(area.y / ms.y, area.x / ms.x))
	_pane.scale = Vector2(k, k)
	_pane.size = Vector2(area.x / k, ms.y)
	var real := _pane.get_combined_minimum_size().y
	if real * k > area.y:
		k = area.y / real
		_pane.scale = Vector2(k, k)
		_pane.size = Vector2(area.x / k, real)
		ms.y = real
	# «Gioca» al centro dello spazio, le altre schede partono dall'alto
	var free := area.y - ms.y * k
	_pane.position = Vector2(_slide_x, maxf(0, free / 2) if tab == "play" else 0.0)


func toast(text: String) -> void:
	_toast_label.text = text
	_toast_label.visible = true
	_toast_label.size = Vector2(minf(size.x - 40, 420), 0)
	_toast_label.reset_size()
	_toast_label.position = Vector2((size.x - _toast_label.size.x) / 2, size.y - _toast_label.size.y - 80)
	var t := text
	await get_tree().create_timer(2.6).timeout
	if _toast_label.text == t:
		_toast_label.visible = false


# ---------------------------------------------------------------- pezzi comuni

## Scelta tra più valori: pillole affiancate, quella scelta crema.
func _seg(options: Array, current, cb: Callable, fs := 14) -> HBoxContainer:
	var seg := HBoxContainer.new()
	seg.add_theme_constant_override("separation", 6)
	for o in options:
		var b := W.button(o[1], "ink" if o[0] == current else "dark", fs)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var v = o[0]
		b.pressed.connect(func():
			Sound.play("click")
			cb.call(v))
		seg.add_child(b)
	return seg


## Casella di testo di vetro (nome, codice della stanza).
func _edit(placeholder: String, max_len: int, fs := 17) -> LineEdit:
	var e := LineEdit.new()
	e.placeholder_text = placeholder
	e.max_length = max_len
	e.add_theme_font_override("font", Art.semi())
	e.add_theme_font_size_override("font_size", fs)
	e.add_theme_color_override("font_color", Art.TESTO)
	e.add_theme_color_override("font_placeholder_color", Color(Art.TESTO, 0.45))
	e.add_theme_color_override("caret_color", Art.TESTO)
	var es := Art.box(Color(1, 1, 1, 0.14), 22, Color(1, 1, 1, 0.3), 1)
	es.content_margin_left = 20
	es.content_margin_right = 20
	es.content_margin_top = 13
	es.content_margin_bottom = 13
	e.add_theme_stylebox_override("normal", es)
	var esf := es.duplicate()
	esf.border_color = Color(Art.TESTO, 0.7)
	e.add_theme_stylebox_override("focus", esf)
	return e


# ---------------------------------------------------------------- Con un amico

func _close_sheets() -> void:
	for c in _overlays.get_children():
		_overlays.remove_child(c)
		c.queue_free()


## «Con un amico»: crea una stanza (il codice si manda all'amico) o entra con il suo codice.
func friend_sheet() -> void:
	_close_sheets()
	var v := Sheets.sheet(_overlays, "Amico", 380)
	v.add_child(Sheets.title("Con un amico", 26))
	v.add_child(Sheets.para("Crea una stanza e manda il codice al tuo amico, oppure scrivi il codice che ti ha mandato. Si gioca anche contro chi usa il sito.", 15))
	var tt := []
	for t in TURN_TIMES:
		tt.append([t, "%ds" % t if t else "∞"])
	var trow := HBoxContainer.new()
	trow.add_theme_constant_override("separation", 10)
	trow.add_child(W.label("Tempo", 13, Color(Art.TESTO, 0.7)))
	var ts := _seg(tt, Prefs.get_value("turn_time"), func(val):
		Prefs.set_value("turn_time", val)
		friend_sheet(), 12)
	ts.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	trow.add_child(ts)
	v.add_child(trow)
	v.add_child(Sheets.button("Crea una stanza", "ink", func(): play_friend.emit(""), 18))
	var or_l := W.label("oppure entra con un codice", 14, Color(Art.TESTO, 0.65))
	or_l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(or_l)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	var code := _edit("CODICE", 4, 20)
	code.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	code.alignment = HORIZONTAL_ALIGNMENT_CENTER
	code.text_changed.connect(func(t):
		var up: String = t.to_upper()
		if up != t:
			var c := code.caret_column
			code.text = up
			code.caret_column = c)
	var join := func():
		var c := code.text.strip_edges().to_upper()
		if c.length() != 4:
			toast("Il codice ha 4 caratteri")
			return
		play_friend.emit(c)
	code.text_submitted.connect(func(_t): join.call())
	row.add_child(code)
	var jb := W.button("Entra", "dark", 17)
	jb.pressed.connect(join)
	row.add_child(jb)
	v.add_child(row)
	v.add_child(Sheets.button("Chiudi", "ghost", _close_sheets, 15))
	Sheets.fit(v)


## Mentre ci si collega al server (la prima volta può volerci un po': il server si sveglia).
func friend_connecting() -> void:
	_close_sheets()
	var v := Sheets.sheet(_overlays, "Amico", 360)
	v.add_child(Sheets.title("Collegamento…", 24))
	v.add_child(Sheets.para("Mi collego al server. Se è la prima partita di oggi potrebbe volerci qualche secondo.", 15))
	v.add_child(Sheets.button("Annulla", "ghost", func():
		_close_sheets()
		friend_cancel.emit(), 15))
	Sheets.fit(v)


## Stanza creata: il codice grande da mandare all'amico.
func friend_waiting(code: String, turn_time: int) -> void:
	_close_sheets()
	var v := Sheets.sheet(_overlays, "Amico", 360)
	v.add_child(Sheets.para("Manda questo codice al tuo amico", 15))
	var big := W.label(code, 56, Art.TESTO, Art.bold())
	big.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(big)
	v.add_child(Sheets.para("Tempo per turno: %s" % ("%d secondi" % turn_time if turn_time else "illimitato"), 14))
	v.add_child(Sheets.button("Copia il codice", "ink", func():
		DisplayServer.clipboard_set("Giochiamo ad Atlas! Codice stanza: %s" % code)
		toast("Codice copiato"), 17))
	var wait := W.label("In attesa che il tuo amico entri…", 14, Color(Art.TESTO, 0.65))
	wait.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(wait)
	var tw := wait.create_tween().set_loops().set_trans(Tween.TRANS_SINE)
	tw.tween_property(wait, "modulate:a", 0.4, 0.9)
	tw.tween_property(wait, "modulate:a", 1.0, 0.9)
	v.add_child(Sheets.button("Esci dalla stanza", "ghost", func():
		_close_sheets()
		friend_cancel.emit(), 15))
	Sheets.fit(v)


## Riquadro di vetro (le schede Sfide e Impara).
func _glass(pad := 16) -> PanelContainer:
	var card := PanelContainer.new()
	var sb := Art.box(Color(1, 1, 1, 0.08), 20, Color(1, 1, 1, 0.12), 1)
	for m in ["left", "right", "top", "bottom"]:
		sb.set("content_margin_" + m, pad)
	card.add_theme_stylebox_override("panel", sb)
	return card


## Le cinque terre come piccole icone quadrate, leggermente inclinate (il logo della home).
func _logo_tiles(s: float) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(0, s * 1.3)
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var lands := ["W", "U", "B", "R", "G"]
	var rots := [-8.0, -3.0, 0.0, 4.0, 8.0]
	var ups := [6.0, 1.0, -2.0, 1.0, 6.0]
	c.draw.connect(func():
		var gap := s * 0.14
		var total := s * 5 + gap * 4
		var x0 := (c.size.x - total) / 2
		for i in 5:
			var ctr := Vector2(x0 + i * (s + gap) + s / 2, c.size.y / 2 + ups[i])
			c.draw_set_transform(ctr, deg_to_rad(rots[i]))
			var r := Rect2(-Vector2(s, s) / 2, Vector2(s, s))
			var sh := Art.box(Color(0, 0, 0, 0), s * 0.22)
			sh.shadow_color = Color(0, 0, 0, 0.35)
			sh.shadow_size = int(s * 0.18)
			sh.shadow_offset = Vector2(0, s * 0.08)
			c.draw_style_box(sh, r)
			Art.draw_tex(c, "tile-" + lands[i], r)
		c.draw_set_transform(Vector2.ZERO))
	c.resized.connect(c.queue_redraw)
	return c


# ---------------------------------------------------------------- Gioca

func _play_pane() -> Control:
	var top := BoxContainer.new()
	top.vertical = not _side
	top.add_theme_constant_override("separation", 26 if _side else 14)
	var a := VBoxContainer.new()
	a.add_theme_constant_override("separation", 10)
	a.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	a.alignment = BoxContainer.ALIGNMENT_CENTER
	var b := VBoxContainer.new()
	b.add_theme_constant_override("separation", 12)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.alignment = BoxContainer.ALIGNMENT_END
	top.add_child(a)
	top.add_child(b)
	a.add_child(_logo_tiles(34.0 if _side else 46.0))
	var title := W.label("Atlas", 64, Art.TESTO, Art.bold())
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	a.add_child(title)
	var sub := W.label("Cinque terre, una mappa da completare.", 16, Color(Art.TESTO, 0.85))
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	a.add_child(sub)
	if not _side:
		var spacer := Control.new()
		spacer.custom_minimum_size.y = 28
		a.add_child(spacer)
	b.add_child(W.label("Il tuo nome", 14, Color(Art.TESTO, 0.8)))
	var name_edit := _edit("Scrivi il tuo nome", 20)
	name_edit.text = Prefs.get_value("name")
	name_edit.text_changed.connect(func(t): Prefs.set_value("name", t.strip_edges()))
	b.add_child(name_edit)
	b.add_child(_seg(LEVELS, Prefs.get_value("level"), func(v):
		Prefs.set_value("level", v)
		_layout(), 14))
	var tt := []
	for v in TURN_TIMES:
		tt.append([v, "%ds" % v if v else "∞"])
	var trow := HBoxContainer.new()
	trow.add_theme_constant_override("separation", 10)
	var tl := W.label("Tempo", 13, Color(Art.TESTO, 0.7))
	trow.add_child(tl)
	var ts := _seg(tt, Prefs.get_value("turn_time"), func(v):
		Prefs.set_value("turn_time", v)
		_layout(), 12)
	ts.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	trow.add_child(ts)
	b.add_child(trow)
	var go := W.button("Contro il computer", "primary", 19)
	go.pressed.connect(func():
		Table.forget_save()
		play_bot.emit(Prefs.get_value("level")))
	if Table.saved_game().is_empty():
		b.add_child(go)
	else:
		# partita rimasta in corso: due pulsanti affiancati nello stesso spazio di «Contro il computer»
		var h := go.get_combined_minimum_size().y
		go.free()
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 10)
		for x in [["Riprendi", "primary", func(): resume_game.emit()],
				["Nuova partita", "dark", func():
					Table.forget_save()
					play_bot.emit(Prefs.get_value("level"))]]:
			var bt := W.button(x[0], x[1], 17)
			bt.custom_minimum_size.y = h
			bt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			bt.size_flags_stretch_ratio = 1.0
			bt.pressed.connect(x[2])
			row.add_child(bt)
		b.add_child(row)
	var friend := W.button("Con un amico", "dark", 19)
	friend.pressed.connect(func():
		Sound.play("click")
		friend_sheet())
	b.add_child(friend)
	return top


# ---------------------------------------------------------------- Sfide

func _challenges_pane() -> Control:
	var a := Profile.load_profile(Prefs.player_name())
	var day := Modes.today()
	var daily: Dictionary = a.get("daily", {})
	var done: Dictionary = a.get("challenges", {})
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	var t := W.label("Sfide", 30, Art.TESTO, Art.bold())
	v.add_child(t)
	var card := _glass(18)
	var cv := VBoxContainer.new()
	cv.add_theme_constant_override("separation", 8)
	card.add_child(cv)
	cv.add_child(W.label("Sfida del giorno", 19, Art.TESTO, Art.bold()))
	var d := Time.get_date_dict_from_system()
	var days := ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"]
	var months := ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"]
	var nice := "%s %d %s" % [days[d.weekday], d.day, months[d.month - 1]]
	var sub := W.label("%s: stessa partenza per tutti, vinci nel minor numero di turni." % (nice.substr(0, 1).to_upper() + nice.substr(1)), 13, Color(Art.TESTO, 0.75), Art.serif())
	sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	sub.custom_minimum_size.x = 200
	cv.add_child(sub)
	var best = daily.get(day)
	if best != null:
		cv.add_child(W.label("Record: turno %d" % best, 13, Art.SEGNALE, Art.semi()))
	var go := W.button("Riprova" if best != null else "Gioca la sfida", "primary", 16)
	go.pressed.connect(func(): play_daily.emit(day))
	cv.add_child(go)
	v.add_child(card)
	var n := 0
	for c in Modes.CHALLENGES:
		if done.has(c.id):
			n += 1
	v.add_child(W.label("Sfide a tema   %d/%d" % [n, Modes.CHALLENGES.size()], 14, Color(Art.TESTO, 0.7), Art.semi()))
	for c in Modes.CHALLENGES:
		# toccandola si apre (a tendina) con la descrizione e il pulsante «Gioca la sfida»
		var opened: bool = _open_challenge == c.id
		var b := _glass(14)
		b.mouse_filter = Control.MOUSE_FILTER_STOP
		var col := VBoxContainer.new()
		col.add_theme_constant_override("separation", 8)
		col.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var h := HBoxContainer.new()
		h.add_theme_constant_override("separation", 10)
		h.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var mark := W.label("✓" if done.has(c.id) else "", 16, Art.LAND.G.lightened(0.3), Art.bold())
		mark.custom_minimum_size.x = 14
		h.add_child(mark)
		var nm := W.label(c.name, 16, Art.TESTO, Art.semi())
		nm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		h.add_child(nm)
		if done.has(c.id):
			h.add_child(W.label("turno %d" % done[c.id], 13, Art.SEGNALE, Art.semi()))
		var chev := W.label("⌃" if opened else "⌄", 16, Color(Art.TESTO, 0.7), Art.semi())
		chev.text = "–" if opened else "+"
		h.add_child(chev)
		col.add_child(h)
		if opened:
			var desc := W.label(c.desc, 14, Color(Art.TESTO, 0.85))
			desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			desc.custom_minimum_size.x = 150
			col.add_child(desc)
			var lvl := W.label("Contro il computer %s" % {"hard": "difficile", "easy": "facile"}.get(c.level, "normale"), 12, Color(Art.TESTO, 0.6))
			col.add_child(lvl)
			var play := W.button("Gioca la sfida", "primary", 15)
			var cid: String = c.id
			play.pressed.connect(func(): play_challenge.emit(cid))
			col.add_child(play)
		b.add_child(col)
		var id: String = c.id
		b.gui_input.connect(func(e):
			if e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT and not e.pressed:
				Sound.play("click")
				_open_challenge = "" if _open_challenge == id else id
				_layout())
		v.add_child(b)
	return v


# ---------------------------------------------------------------- Collezione

func _tile(label: String, on: bool, locked: bool, draw_prev: Callable, cb: Callable) -> Button:
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = Vector2(0, 100)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var bs := Art.box(Color(1, 1, 1, 0.10 if on else 0.0), 16, Art.TESTO if on else Color(0, 0, 0, 0), 2)
	for st in ["normal", "hover", "pressed"]:
		b.add_theme_stylebox_override(st, bs)
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	b.draw.connect(func():
		var pr := Rect2(8, 7, b.size.x - 16, b.size.y - 32)
		draw_prev.call(b, pr)
		if locked:
			b.draw_style_box(Art.box(Color(Art.TAVOLO, 0.55), 10), pr)
			var lt := Art.line_icon("lock", LOCK, Art.TESTO, 20)
			b.draw_texture_rect(lt, Rect2(pr.get_center() - Vector2(10, 10), Vector2(20, 20)), false)
		var f := Art.semi() if on else Art.sans()
		Art.draw_text_centered(b, f, label, Vector2(b.size.x / 2, b.size.y - 13), 12, Art.TESTO if on else Color(Art.TESTO, 0.75)))
	b.pressed.connect(cb)
	return b


func _collection_pane() -> Control:
	var a := Profile.load_profile(Prefs.player_name())
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	v.add_child(W.label("Collezione", 30, Art.TESTO, Art.bold()))
	v.add_child(W.label("Cielo del tavolo", 14, Color(Art.TESTO, 0.7), Art.semi()))
	var g1 := GridContainer.new()
	g1.columns = 4
	for t in Art.THEME_NAMES:
		var id: String = t[0]
		var lk := not Profile.unlocked(a, "table", id)
		var sky: Array = Art.Scenery.SKIES[id]
		g1.add_child(_tile(t[1], Prefs.get_value("theme") == id or Art.theme_id(Prefs.get_value("theme")) == id, lk, func(ci: CanvasItem, r: Rect2):
			# anteprima: il cielo sfumato con le colline
			Art.draw_vgrad(ci, r, Color(sky[0]), Color(sky[1]))
			var hh := r.size.x * 0.3
			Art.draw_tex(ci, "hills-" + id, Rect2(r.position.x, r.end.y - hh, r.size.x, hh)),
			func(): _pick("table", id, lk)))
	v.add_child(g1)
	v.add_child(W.label("Dorso delle carte", 14, Color(Art.TESTO, 0.7), Art.semi()))
	var g2 := GridContainer.new()
	g2.columns = 7 if _side else 4  # in orizzontale tutti i dorsi su una riga
	for bk in Art.BACKS:
		var id: String = bk[0]
		var lk := not Profile.unlocked(a, "back", id)
		g2.add_child(_tile(bk[1], Art.back_id(Prefs.get_value("back")) == id, lk, func(ci: CanvasItem, r: Rect2):
			var h := r.size.y
			var cr := Rect2(r.get_center().x - h / 2.8, r.position.y, h / 1.4, h)
			Art.draw_tex(ci, "bk-" + id, cr),
			func(): _pick("back", id, lk)))
	v.add_child(g2)
	var n := 0
	for g in Profile.GOALS:
		if a.get("goals", {}).has(g.id):
			n += 1
	var gb := W.button("Obiettivi   %d/%d" % [n, Profile.GOALS.size()], "primary", 16)
	gb.pressed.connect(func(): Sheets.goals(_overlays))
	v.add_child(gb)
	var note := W.label("I lucchetti si aprono raggiungendo gli obiettivi.", 13, Color(Art.TESTO, 0.7), Art.serif())
	note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(note)
	return v


func _pick(kind: String, id: String, locked: bool) -> void:
	if locked:
		var g := Profile.lock_for(kind, id)
		Sound.play("deny")
		toast("Si sblocca con l'obiettivo «%s»: %s" % [g.name, g.desc])
		return
	Sound.play("click")
	if kind == "table":
		Prefs.set_value("theme", id)
		Art.apply_theme(id)
		for c in get_parent().get_children():
			if c is Control:
				c.queue_redraw()
	else:
		Prefs.set_value("back", id)
		Art.BACK = id
	_layout()


# ---------------------------------------------------------------- Impara

func _learn_pane() -> Control:
	var done: bool = Profile.load_profile(Prefs.player_name()).tutorial
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	v.add_child(W.label("Impara", 30, Art.TESTO, Art.bold()))
	var card := _glass(18)
	var cv := VBoxContainer.new()
	cv.add_theme_constant_override("separation", 8)
	card.add_child(cv)
	cv.add_child(W.label("Tutorial con il Maestro", 19, Art.TESTO, Art.bold()))
	var sub := W.label("Una partita guidata, passo per passo: circa 5 minuti.", 13, Color(Art.TESTO, 0.75), Art.serif())
	sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	cv.add_child(sub)
	if done:
		cv.add_child(W.label("Completato", 13, Art.SEGNALE, Art.semi()))
	var go := W.button("Rifai il tutorial" if done else "Inizia il tutorial", "primary", 16)
	go.pressed.connect(func(): play_tutorial.emit())
	cv.add_child(go)
	v.add_child(card)
	# in orizzontale le cinque terre vanno in una seconda colonna: il testo resta grande
	var v2 := v
	if _side:
		v2 = VBoxContainer.new()
		v2.add_theme_constant_override("separation", 10)
	v2.add_child(W.label("Le cinque terre", 14, Color(Art.TESTO, 0.7), Art.semi()))
	for t in ["W", "U", "B", "R", "G"]:
		var h := HBoxContainer.new()
		h.add_theme_constant_override("separation", 12)
		var ico := TextureRect.new()
		ico.texture = Art.tex("tile-" + t, 34)
		ico.custom_minimum_size = Vector2(34, 34)
		ico.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ico.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		h.add_child(ico)
		var nm := W.label(Art.NAMES[t], 15, Art.TESTO, Art.semi())
		nm.custom_minimum_size.x = 88
		nm.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		h.add_child(nm)
		var fx := W.label(Art.FXTXT[t], 13, Color(Art.TESTO, 0.75), Art.serif())
		fx.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		fx.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		fx.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		fx.custom_minimum_size.x = 120
		h.add_child(fx)
		v2.add_child(h)
	var win := W.label("Si vince con cinque terre diverse in gioco, oppure cinque uguali.", 14, Color(Art.TESTO, 0.85))
	win.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	win.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v2.add_child(win)
	var r := W.button("Regole complete", "dark", 15)
	r.pressed.connect(func(): Sheets.rules(_overlays))
	v2.add_child(r)
	if _side:
		var cols := HBoxContainer.new()
		cols.add_theme_constant_override("separation", 22)
		v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		v2.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		cols.add_child(v)
		cols.add_child(v2)
		return cols
	return v
