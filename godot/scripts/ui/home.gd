## La home a schede, come nella versione web: Gioca, Sfide, Profilo, Collezione, Impara.
## Il foglio ha sempre la stessa misura (niente salti) e, se il contenuto non ci sta, si
## rimpicciolisce: mai scorrere. Sul telefono in orizzontale le schede stanno in una colonna a sinistra.
extends Control

signal play_bot(level: String)
signal play_challenge(id: String)
signal play_daily(day: String)
signal play_tutorial
signal fullscreen_toggled

const Art := preload("res://scripts/ui/art.gd")
const W := preload("res://scripts/ui/widgets.gd")
const Card := preload("res://scripts/ui/card_view.gd")
const Sheets := preload("res://scripts/ui/sheets.gd")
const Prefs := preload("res://scripts/app/prefs.gd")
const Profile := preload("res://scripts/app/profile.gd")
const Modes := preload("res://scripts/app/modes.gd")
const Sound := preload("res://scripts/app/sound.gd")

const TABS := [["play", "Gioca"], ["challenges", "Sfide"], ["profile", "Profilo"], ["collection", "Collezione"], ["learn", "Impara"]]
const TAB_ICON := {
	"play": "<path d=\"M8 5.5v13l10.5-6.5z\"/>",
	"challenges": "<path d=\"M6 21V4\"/><path d=\"M6 4.5c4-2 7 2 12 0v9c-5 2-8-2-12 0\"/>",
	"profile": "<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21c1.5-4.5 4.5-6.5 8-6.5s6.5 2 8 6.5\"/>",
	"collection": "<rect x=\"8\" y=\"3\" width=\"11\" height=\"15\" rx=\"2\"/><path d=\"M5 7v12a2 2 0 0 0 2 2h9\"/>",
	"learn": "<path d=\"M3.5 5.5c3-1.5 5.8-1 8.5 1 2.7-2 5.5-2.5 8.5-1V19c-3-1.5-5.8-1-8.5 1-2.7-2-5.5-2.5-8.5-1z\"/><path d=\"M12 6.5V20\"/>",
}
const LOCK := "<rect x=\"5\" y=\"11\" width=\"14\" height=\"10\" rx=\"2\"/><path d=\"M8 11V8a4 4 0 0 1 8 0v3\"/>"
const LEVELS := [["easy", "Facile"], ["normal", "Normale"], ["hard", "Difficile"]]
const TURN_TIMES := [30, 45, 60, 90, 0]

var tab := "play"
var stats_side := "cpu"
var _panel: Panel
var _pane_box: Control
var _tabs_box: BoxContainer
var _pane: Control
var _side := false  # telefono in orizzontale: schede a sinistra
var _overlays: Control
var _toast_label: Label


func _ready() -> void:
	tab = Prefs.get_value("tab")
	if not TAB_ICON.has(tab):
		tab = "play"
	_panel = Panel.new()
	var sb := Art.box(Art.CARTA, 16)
	sb.shadow_color = Art.OMBRA
	sb.shadow_size = 30
	_panel.add_theme_stylebox_override("panel", sb)
	add_child(_panel)
	_pane_box = Control.new()
	_pane_box.clip_contents = true
	_panel.add_child(_pane_box)
	_overlays = Control.new()
	_overlays.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_overlays)
	_toast_label = W.label("", 14, Art.CARTA, Art.bold())
	_toast_label.add_theme_stylebox_override("normal", _pill())
	_toast_label.visible = false
	_toast_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_toast_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(_toast_label)
	resized.connect(_layout)
	_layout()


func _pill() -> StyleBoxFlat:
	var p := Art.box(Art.INK, 12)
	p.content_margin_left = 14
	p.content_margin_right = 14
	p.content_margin_top = 8
	p.content_margin_bottom = 8
	return p


func _layout() -> void:
	var S := size
	if S.x < 10:
		return
	_overlays.size = S
	for c in _overlays.get_children():
		c.size = S
	_side = S.x / S.y >= 1.1 and S.y <= 520
	var w := minf(S.x - 24, 760.0) if _side else minf(S.x - 24, 440.0)
	var h := S.y - 24 if _side else minf(S.y - 24, 780.0)
	_panel.size = Vector2(w, h)
	_panel.position = (S - _panel.size) / 2
	if _tabs_box != null:
		_tabs_box.queue_free()
	_tabs_box = VBoxContainer.new() if _side else HBoxContainer.new()
	_tabs_box.add_theme_constant_override("separation", 0)
	_panel.add_child(_tabs_box)
	var tab_w := 92.0 if _side else w / TABS.size()
	var tab_h := h / TABS.size() if _side else 62.0
	for t in TABS:
		var b := Button.new()
		b.flat = true
		b.focus_mode = Control.FOCUS_NONE
		b.text = t[1]
		var on: bool = t[0] == tab
		var col := Art.INK if on else Color(Art.INK, 0.5)
		b.icon = Art.line_icon("tab-" + t[0], TAB_ICON[t[0]], col, 24)
		b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
		b.vertical_icon_alignment = VERTICAL_ALIGNMENT_TOP
		b.expand_icon = false
		b.add_theme_constant_override("icon_max_width", 24)  # l'immagine è più grande sugli schermi densi
		b.custom_minimum_size = Vector2(tab_w, tab_h)
		b.add_theme_font_override("font", Art.bold() if on else Art.sans())
		b.add_theme_font_size_override("font_size", 11 if w < 400 else 12)
		for c in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
			b.add_theme_color_override(c, col)
		var id: String = t[0]
		b.pressed.connect(func(): set_tab(id))
		_tabs_box.add_child(b)
	if _side:
		_tabs_box.position = Vector2(4, 0)
		_tabs_box.size = Vector2(tab_w, h)
		_pane_box.position = Vector2(tab_w + 8, 14)
		_pane_box.size = Vector2(w - tab_w - 26, h - 28)
	else:
		_tabs_box.position = Vector2(0, h - tab_h)
		_tabs_box.size = Vector2(w, tab_h)
		_pane_box.position = Vector2(20, 18)
		_pane_box.size = Vector2(w - 40, h - tab_h - 26)
	_panel.queue_redraw()
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
	_pane.position.x += 22 * dir
	_pane.modulate.a = 0
	var tw := _pane.create_tween().set_parallel().set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tw.tween_property(_pane, "position:x", _pane.position.x - 22 * dir, 0.28)
	tw.tween_property(_pane, "modulate:a", 1.0, 0.28)


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
	# se non ci sta (in altezza o in larghezza) si rimpicciolisce tutto insieme
	for i in 3:
		if k >= 1.0:
			break
		_pane.custom_minimum_size.x = area.x / k
		_pane.reset_size()
		ms = _pane.get_combined_minimum_size()
		k = minf(k, minf(area.y / ms.y, area.x / ms.x))
	_pane.scale = Vector2(k, k)
	_pane.size = Vector2(area.x / k, ms.y)
	# controllo finale: con la larghezza vera, l'altezza può essere cresciuta
	var real := _pane.get_combined_minimum_size().y
	if real * k > area.y:
		k = area.y / real
		_pane.scale = Vector2(k, k)
		_pane.size = Vector2(area.x / k, real)
		ms.y = real
	_pane.position = Vector2(0, maxf(0, (area.y - ms.y * k) / 2) if tab == "play" else 0.0)


func toast(text: String) -> void:
	_toast_label.text = text
	_toast_label.visible = true
	_toast_label.size = Vector2(minf(size.x - 40, 420), 0)
	_toast_label.reset_size()
	_toast_label.position = Vector2((size.x - _toast_label.size.x) / 2, size.y - _toast_label.size.y - 30)
	var t := text
	await get_tree().create_timer(2.6).timeout
	if _toast_label.text == t:
		_toast_label.visible = false


# ---------------------------------------------------------------- Gioca

func _seg(options: Array, current, cb: Callable, fs := 14) -> HBoxContainer:
	var seg := HBoxContainer.new()
	seg.add_theme_constant_override("separation", 0)
	for o in options:
		var b := W.button(o[1], "ink" if o[0] == current else "ghost_ink", fs)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var v = o[0]
		b.pressed.connect(func():
			Sound.play("click")
			cb.call(v))
		seg.add_child(b)
	return seg


func _fan() -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(0, 86)
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var lands := ["W", "U", "B", "R", "G"]
	for i in 5:
		var k := Card.new()
		k.kind = lands[i]
		k.mode = "mini"
		k.size = Vector2(52, 72.8)
		k.pivot_offset = Vector2(26, 72.8)
		k.rotation_degrees = (i - 2) * 9
		c.add_child(k)
	c.resized.connect(func():
		for i in 5:
			var k: Control = c.get_child(i)
			k.position = Vector2(c.size.x / 2 - 26 + (i - 2) * 36, 6 + abs(i - 2) * abs(i - 2) * 3))
	return c


func _play_pane() -> Control:
	var top := BoxContainer.new()
	top.vertical = not _side
	top.add_theme_constant_override("separation", 22 if _side else 13)
	var a := VBoxContainer.new()
	a.add_theme_constant_override("separation", 12)
	a.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var b := VBoxContainer.new()
	b.add_theme_constant_override("separation", 12)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.alignment = BoxContainer.ALIGNMENT_CENTER
	top.add_child(a)
	top.add_child(b)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	var full: bool = DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
	var fs := W.button("Esci da schermo intero" if full else "Schermo intero", "full", 15)
	fs.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	fs.pressed.connect(func(): fullscreen_toggled.emit())
	row.add_child(fs)
	var music_on: bool = Prefs.get_value("music")
	var mu := W.button("♪", "ink" if music_on else "ghost_ink", 17)
	mu.custom_minimum_size.x = 48
	mu.pressed.connect(func():
		Sound.set_music(not Prefs.get_value("music"))
		_layout())
	row.add_child(mu)
	a.add_child(row)
	a.add_child(_fan())
	var title := W.label("Atlas", 40, Art.INK, Art.bold())
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	a.add_child(title)
	a.add_child(Sheets.para("Metti in gioco tutte e cinque le terre, oppure cinque uguali.", 15))
	var who := HBoxContainer.new()
	who.add_theme_constant_override("separation", 8)
	who.add_child(W.label("Giochi come", 14, Color(Art.INK, 0.7)))
	var name_edit := LineEdit.new()
	name_edit.text = Prefs.get_value("name")
	name_edit.placeholder_text = "il tuo nome"
	name_edit.max_length = 20
	name_edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_edit.add_theme_font_override("font", Art.bold())
	name_edit.add_theme_font_size_override("font_size", 15)
	name_edit.add_theme_color_override("font_color", Art.INK)
	name_edit.add_theme_color_override("font_placeholder_color", Color(Art.INK, 0.4))
	var es := Art.box(Color("#fffaf0"), 10, Art.INK, 1.5)
	es.content_margin_left = 10
	es.content_margin_right = 10
	es.content_margin_top = 8
	es.content_margin_bottom = 8
	name_edit.add_theme_stylebox_override("normal", es)
	name_edit.add_theme_stylebox_override("focus", es)
	name_edit.text_changed.connect(func(t): Prefs.set_value("name", t.strip_edges()))
	who.add_child(name_edit)
	a.add_child(who)
	b.add_child(Sheets.h4("Contro il computer · anche senza connessione"))
	b.add_child(W.label("Difficoltà", 13, Color(Art.INK, 0.7)))
	b.add_child(_seg(LEVELS, Prefs.get_value("level"), func(v):
		Prefs.set_value("level", v)
		_layout()))
	b.add_child(W.label("Tempo per turno", 13, Color(Art.INK, 0.7)))
	var tt := []
	for v in TURN_TIMES:
		tt.append([v, "%ds" % v if v else "∞"])
	b.add_child(_seg(tt, Prefs.get_value("turn_time"), func(v):
		Prefs.set_value("turn_time", v)
		_layout(), 13))
	var go := W.button("Inizia la partita", "ink", 17)
	go.pressed.connect(func(): play_bot.emit(Prefs.get_value("level")))
	b.add_child(go)
	b.add_child(Sheets.h4("Con un amico"))
	b.add_child(Sheets.para("Le partite tra amici arrivano con il prossimo passo: intanto si gioca nel browser.", 13, Color(0, 0, 0, 0), false))
	return top


# ---------------------------------------------------------------- Sfide

func _challenges_pane() -> Control:
	var a := Profile.load_profile(Prefs.player_name())
	var day := Modes.today()
	var daily: Dictionary = a.get("daily", {})
	var done: Dictionary = a.get("challenges", {})
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	v.add_child(Sheets.title("Sfide"))
	var card := PanelContainer.new()
	var sb := Art.box(Art.INK, 14)
	for m in ["left", "right", "top", "bottom"]:
		sb.set("content_margin_" + m, 15)
	card.add_theme_stylebox_override("panel", sb)
	var cv := VBoxContainer.new()
	cv.add_theme_constant_override("separation", 8)
	card.add_child(cv)
	cv.add_child(W.label("Sfida del giorno", 17, Art.CARTA, Art.bold()))
	var d := Time.get_date_dict_from_system()
	var days := ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"]
	var months := ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"]
	var nice := "%s %d %s" % [days[d.weekday], d.day, months[d.month - 1]]
	var sub := W.label("%s: stessa partenza per tutti, vinci nel minor numero di turni." % (nice.substr(0, 1).to_upper() + nice.substr(1)), 13, Color(Art.CARTA, 0.75), Art.serif())
	sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	sub.custom_minimum_size.x = 200
	cv.add_child(sub)
	var best = daily.get(day)
	if best != null:
		cv.add_child(W.label("Record: turno %d" % best, 13, Art.SEGNALE, Art.bold()))
	var go := W.button("Riprova" if best != null else "Gioca la sfida", "primary", 15)
	go.pressed.connect(func(): play_daily.emit(day))
	cv.add_child(go)
	v.add_child(card)
	var n := 0
	for c in Modes.CHALLENGES:
		if done.has(c.id):
			n += 1
	v.add_child(Sheets.h4("Sfide a tema   %d/%d" % [n, Modes.CHALLENGES.size()]))
	for c in Modes.CHALLENGES:
		# riquadro che cresce con il testo (un Button non si allarga per i figli)
		var b := PanelContainer.new()
		var bs := Art.box(Color("#fffaf0"), 12, Color(Art.INK, 0.12), 1.5)
		for m in ["left", "right", "top", "bottom"]:
			bs.set("content_margin_" + m, 10)
		b.add_theme_stylebox_override("panel", bs)
		b.mouse_filter = Control.MOUSE_FILTER_STOP
		var h := HBoxContainer.new()
		h.add_theme_constant_override("separation", 10)
		h.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var mark := W.label("✓" if done.has(c.id) else "", 16, Art.LAND.G, Art.bold())
		mark.custom_minimum_size.x = 16
		h.add_child(mark)
		var txt := W.label("%s\n%s" % [c.name, c.desc], 12, Art.INK)
		txt.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		txt.custom_minimum_size.x = 150
		h.add_child(txt)
		h.add_child(W.label("turno %d" % done[c.id] if done.has(c.id) else "›", 13, Color(Art.INK, 0.7), Art.bold()))
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
	b.custom_minimum_size = Vector2(0, 92)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var bs := Art.box(Color(0, 0, 0, 0), 12, Art.INK if on else Color(0, 0, 0, 0), 2)
	for st in ["normal", "hover", "pressed"]:
		b.add_theme_stylebox_override(st, bs)
	b.draw.connect(func():
		var pr := Rect2(8, 6, b.size.x - 16, b.size.y - 30)
		draw_prev.call(b, pr)
		if locked:
			b.draw_rect(pr, Color(Art.CARTA, 0.45))
			var lt := Art.line_icon("lock", LOCK, Art.INK, 20)
			b.draw_texture_rect(lt, Rect2(pr.get_center() - Vector2(10, 10), Vector2(20, 20)), false)
		var f := Art.bold() if on else Art.sans()
		var tw := f.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x
		b.draw_string(f, Vector2((b.size.x - tw) / 2, b.size.y - 9), label, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Art.INK))
	b.pressed.connect(cb)
	return b


func _collection_pane() -> Control:
	var a := Profile.load_profile(Prefs.player_name())
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	v.add_child(Sheets.title("Collezione"))
	v.add_child(Sheets.h4("Tavolo"))
	var g1 := GridContainer.new()
	g1.columns = 4
	for t in Art.THEME_NAMES:
		var id: String = t[0]
		var lk := not Profile.unlocked(a, "table", id)
		var colors: Array = Art.THEMES[id]
		g1.add_child(_tile(t[1], Prefs.get_value("theme") == id, lk, func(ci: CanvasItem, r: Rect2):
			ci.draw_style_box(Art.box(Color(colors[1]), 8), r)
			ci.draw_style_box(Art.box(Color(colors[0]), 8), r.grow(-r.size.x * 0.12))
			Art.draw_contain(ci, Art.tex(colors[7], r.size.y), r.grow(-4)),
			func(): _pick("table", id, lk)))
	v.add_child(g1)
	v.add_child(Sheets.h4("Dorso delle carte"))
	var g2 := GridContainer.new()
	g2.columns = 4
	for bk in Art.BACKS:
		var id: String = bk[0]
		var lk := not Profile.unlocked(a, "back", id)
		g2.add_child(_tile(bk[1], Prefs.get_value("back") == id, lk, func(ci: CanvasItem, r: Rect2):
			var h := r.size.y
			var cr := Rect2(r.get_center().x - h / 2.8, r.position.y, h / 1.4, h)
			ci.draw_style_box(Art.box(Art.CARTA, 5), cr.grow(1.5))
			Art.draw_cover(ci, Art.tex("bk-" + id, cr.size.x), cr),
			func(): _pick("back", id, lk)))
	v.add_child(g2)
	var n := 0
	for g in Profile.GOALS:
		if a.get("goals", {}).has(g.id):
			n += 1
	var gb := W.button("Obiettivi   %d/%d" % [n, Profile.GOALS.size()], "ink", 15)
	gb.pressed.connect(func(): Sheets.goals(_overlays))
	v.add_child(gb)
	v.add_child(Sheets.para("I lucchetti si aprono raggiungendo gli obiettivi.", 13))
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
		get_parent().queue_redraw()
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
	v.add_child(Sheets.title("Impara"))
	var card := PanelContainer.new()
	var sb := Art.box(Art.INK, 14)
	for m in ["left", "right", "top", "bottom"]:
		sb.set("content_margin_" + m, 15)
	card.add_theme_stylebox_override("panel", sb)
	var cv := VBoxContainer.new()
	cv.add_theme_constant_override("separation", 8)
	card.add_child(cv)
	cv.add_child(W.label("Tutorial con il Maestro", 17, Art.CARTA, Art.bold()))
	var sub := W.label("Una partita guidata, passo per passo: circa 5 minuti.", 13, Color(Art.CARTA, 0.75), Art.serif())
	sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	cv.add_child(sub)
	if done:
		cv.add_child(W.label("Completato", 13, Art.SEGNALE, Art.bold()))
	var go := W.button("Rifai il tutorial" if done else "Inizia il tutorial", "primary", 15)
	go.pressed.connect(func(): play_tutorial.emit())
	cv.add_child(go)
	v.add_child(card)
	v.add_child(Sheets.h4("Le cinque terre"))
	for t in ["W", "U", "B", "R", "G"]:
		var h := HBoxContainer.new()
		h.add_theme_constant_override("separation", 10)
		var ico := TextureRect.new()
		ico.texture = Art.tex("ico-" + t, 26)
		ico.custom_minimum_size = Vector2(26, 26)
		ico.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ico.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		h.add_child(ico)
		var nm := W.label(Art.NAMES[t], 14, Art.INK, Art.bold())
		nm.custom_minimum_size.x = 84
		h.add_child(nm)
		var fx := W.label(Art.FXTXT[t], 13, Color(Art.INK, 0.75), Art.serif())
		fx.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		fx.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		fx.custom_minimum_size.x = 120
		h.add_child(fx)
		v.add_child(h)
	v.add_child(Sheets.para("Si vince con cinque terre diverse in gioco, oppure cinque uguali.", 14))
	var r := W.button("Regole complete", "ghost_ink", 15)
	r.pressed.connect(func(): Sheets.rules(_overlays))
	v.add_child(r)
	return v
