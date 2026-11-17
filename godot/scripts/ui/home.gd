## La home nello stile «Orizzonti»: tutto direttamente sul cielo, le schede in fondo (solo testo, con
## una lineetta sotto quella scelta): Gioca, Sfide, Profilo, Collezione, Impara.
## Se il contenuto non ci sta si rimpicciolisce: mai scorrere. Sul telefono in orizzontale le schede
## stanno in una colonna a sinistra.
extends Control

signal play_bot(level: String)
signal play_challenge(id: String)
signal play_daily(day: String)
signal play_tutorial
signal fullscreen_toggled

const Art := preload("res://scripts/ui/art.gd")
const W := preload("res://scripts/ui/widgets.gd")
const Sheets := preload("res://scripts/ui/sheets.gd")
const Prefs := preload("res://scripts/app/prefs.gd")
const Profile := preload("res://scripts/app/profile.gd")
const Modes := preload("res://scripts/app/modes.gd")
const Sound := preload("res://scripts/app/sound.gd")

const TABS := [["play", "Gioca"], ["challenges", "Sfide"], ["profile", "Profilo"], ["collection", "Collezione"], ["learn", "Impara"]]
const LOCK := "<rect x=\"5\" y=\"11\" width=\"14\" height=\"10\" rx=\"2\"/><path d=\"M8 11V8a4 4 0 0 1 8 0v3\"/>"
const FULL_ICON := "<path d=\"M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5\"/>"
const NOTE_ICON := "<path d=\"M9 18V5l11-2v13\"/><circle cx=\"6\" cy=\"18\" r=\"3\"/><circle cx=\"17\" cy=\"16\" r=\"3\"/>"
const LEVELS := [["easy", "Facile"], ["normal", "Normale"], ["hard", "Difficile"]]
const TURN_TIMES := [30, 45, 60, 90, 0]

var tab := "play"
var stats_side := "cpu"
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
	_pane_box.clip_contents = true
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


func _round_button(icon: String, key: String, on: bool, cb: Callable) -> Button:
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = Vector2(44, 44)
	b.icon = Art.line_icon(key, icon, Art.TESTO, 22)
	b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	b.add_theme_constant_override("icon_max_width", 22)
	for st in ["normal", "hover", "pressed"]:
		b.add_theme_stylebox_override(st, Art.box(Color(1, 1, 1, 0.16 if on else 0.08), 21, Color(1, 1, 1, 0.14), 1))
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	b.pressed.connect(cb)
	return b


func _layout() -> void:
	var S := size
	if S.x < 10:
		return
	_overlays.size = S
	_side = S.x / S.y >= 1.1 and S.y <= 520
	# in alto a destra: schermo intero (sempre presente) e musica
	for c in _corner.get_children():
		c.queue_free()
	var full: bool = DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
	var fb := _round_button(FULL_ICON, "full", full, func(): fullscreen_toggled.emit())
	fb.tooltip_text = "Esci da schermo intero" if full else "Schermo intero"
	_corner.add_child(fb)
	var music_on: bool = Prefs.get_value("music")
	_corner.add_child(_round_button(NOTE_ICON, "note" + str(music_on), music_on, func():
		Sound.set_music(not Prefs.get_value("music"))
		_layout()))
	_corner.reset_size()
	_corner.position = Vector2(S.x - _corner.size.x - 16, 16)
	# schede
	for c in _tabs.get_children():
		c.queue_free()
	var margin := 16.0 if S.x < 500 else 28.0
	var content_w := minf(S.x - margin * 2, 520.0)
	if _side:
		var tw := 110.0
		_tabs.position = Vector2(margin, 16)
		_tabs.size = Vector2(tw, S.y - 32)
		_pane_box.position = Vector2(margin + tw + 16, 70)
		_pane_box.size = Vector2(S.x - margin * 2 - tw - 16, S.y - 86)
	else:
		var th := 54.0
		_tabs.position = Vector2((S.x - content_w) / 2, S.y - th - 8)
		_tabs.size = Vector2(content_w, th)
		_pane_box.position = Vector2((S.x - content_w) / 2, 72)
		_pane_box.size = Vector2(content_w, S.y - 72 - th - 16)
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
		var b := Button.new()
		b.flat = true
		b.focus_mode = Control.FOCUS_NONE
		b.text = t[1]
		b.add_theme_font_override("font", Art.semi() if on else Art.sans())
		# la scritta deve stare nella sua scheda: se è lunga si rimpicciolisce
		var tab_w: float = (_tabs.size.x - 8) if _side else _tabs.size.x / n
		# stessa misura per tutte le schede: quella che fa stare la più lunga
		var fs := 15
		while fs > 10 and TABS.any(func(x): return Art.semi().get_string_size(x[1], HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x > tab_w - 6):
			fs -= 1
		b.add_theme_font_size_override("font_size", fs)
		b.clip_text = true
		var col := Art.TESTO if on else Color(Art.TESTO, 0.6)
		for c in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
			b.add_theme_color_override(c, col)
		if _side:
			b.alignment = HORIZONTAL_ALIGNMENT_LEFT
			b.position = Vector2(0, i * (_tabs.size.y / n))
			b.size = Vector2(_tabs.size.x - 8, _tabs.size.y / n)
		else:
			b.position = Vector2(i * _tabs.size.x / n, 2)
			b.size = Vector2(_tabs.size.x / n, _tabs.size.y - 2)
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


func set_tab(id: String) -> void:
	if id == tab:
		return
	var order := TABS.map(func(t): return t[0])
	var dir := 1 if order.find(id) > order.find(tab) else -1
	tab = id
	Prefs.set_value("tab", id)
	Sound.play("click")
	_layout()
	# la nuova scheda arriva scorrendo di lato e sfumando
	var p := _pane
	p.modulate.a = 0
	await get_tree().process_frame
	await get_tree().process_frame
	if not is_instance_valid(p):
		return
	var x := p.position.x
	p.position.x = x + 26 * dir
	var tw := p.create_tween().set_parallel().set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tw.tween_property(p, "position:x", x, 0.3)
	tw.tween_property(p, "modulate:a", 1.0, 0.3)


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
	# «Gioca» sta in fondo (come nell'immagine dello stile), le altre schede partono dall'alto
	var free := area.y - ms.y * k
	_pane.position = Vector2(0, maxf(0, free) if tab == "play" else 0.0)


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
			c.draw_texture_rect(Art.tex("tile-" + lands[i], s), r, false)
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
	a.add_child(_logo_tiles(46))
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
	var name_edit := LineEdit.new()
	name_edit.text = Prefs.get_value("name")
	name_edit.placeholder_text = "Scrivi il tuo nome"
	name_edit.max_length = 20
	name_edit.add_theme_font_override("font", Art.semi())
	name_edit.add_theme_font_size_override("font_size", 17)
	name_edit.add_theme_color_override("font_color", Art.TESTO)
	name_edit.add_theme_color_override("font_placeholder_color", Color(Art.TESTO, 0.45))
	name_edit.add_theme_color_override("caret_color", Art.TESTO)
	var es := Art.box(Color(1, 1, 1, 0.14), 22, Color(1, 1, 1, 0.3), 1)
	es.content_margin_left = 20
	es.content_margin_right = 20
	es.content_margin_top = 13
	es.content_margin_bottom = 13
	name_edit.add_theme_stylebox_override("normal", es)
	var esf := es.duplicate()
	esf.border_color = Color(Art.TESTO, 0.7)
	name_edit.add_theme_stylebox_override("focus", esf)
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
	go.pressed.connect(func(): play_bot.emit(Prefs.get_value("level")))
	b.add_child(go)
	var friend := W.button("Con un amico", "dark", 19)
	friend.pressed.connect(func(): toast("Le partite tra amici arrivano con il prossimo passo: intanto si gioca nel browser."))
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
		# riquadro che cresce con il testo (un Button non si allarga per i figli)
		var b := _glass(12)
		b.mouse_filter = Control.MOUSE_FILTER_STOP
		var h := HBoxContainer.new()
		h.add_theme_constant_override("separation", 10)
		h.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var mark := W.label("✓" if done.has(c.id) else "", 16, Art.LAND.G.lightened(0.3), Art.bold())
		mark.custom_minimum_size.x = 14
		h.add_child(mark)
		var txt := Sheets.rich("[b]%s[/b]\n%s" % [c.name, c.desc], 13)
		txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		txt.custom_minimum_size.x = 150
		h.add_child(txt)
		var right := W.label("turno %d" % done[c.id] if done.has(c.id) else "›", 14, Color(Art.TESTO, 0.7), Art.semi())
		right.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		h.add_child(right)
		b.add_child(h)
		var id: String = c.id
		b.gui_input.connect(func(e):
			if e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT and not e.pressed:
				play_challenge.emit(id))
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
			ci.draw_texture_rect(Art.tex("hills-" + id, r.size.x), Rect2(r.position.x, r.end.y - hh, r.size.x, hh), false),
			func(): _pick("table", id, lk)))
	v.add_child(g1)
	v.add_child(W.label("Dorso delle carte", 14, Color(Art.TESTO, 0.7), Art.semi()))
	var g2 := GridContainer.new()
	g2.columns = 4
	for bk in Art.BACKS:
		var id: String = bk[0]
		var lk := not Profile.unlocked(a, "back", id)
		g2.add_child(_tile(bk[1], Art.back_id(Prefs.get_value("back")) == id, lk, func(ci: CanvasItem, r: Rect2):
			var h := r.size.y
			var cr := Rect2(r.get_center().x - h / 2.8, r.position.y, h / 1.4, h)
			ci.draw_texture_rect(Art.tex("bk-" + id, cr.size.x), cr, false),
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
	v.add_child(W.label("Le cinque terre", 14, Color(Art.TESTO, 0.7), Art.semi()))
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
		v.add_child(h)
	var win := W.label("Si vince con cinque terre diverse in gioco, oppure cinque uguali.", 14, Color(Art.TESTO, 0.85))
	win.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	win.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(win)
	var r := W.button("Regole complete", "dark", 15)
	r.pressed.connect(func(): Sheets.rules(_overlays))
	v.add_child(r)
	return v
