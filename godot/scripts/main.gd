## Avvio di Atlas: adatta la scala allo schermo, mostra la home e il tavolo.
## Le misure dell'interfaccia sono in "punti" come i px del browser: su un telefono ad alta densità
## tutto viene ingrandito in proporzione, così scritte e carte hanno la stessa misura della versione web.
extends Control

const Art := preload("res://scripts/ui/art.gd")
const W := preload("res://scripts/ui/widgets.gd")
const Card := preload("res://scripts/ui/card_view.gd")
const Table := preload("res://scripts/ui/table.gd")
const LEVELS := [["easy", "Facile"], ["normal", "Normale"], ["hard", "Difficile"]]
const SAVE := "user://prefs.cfg"

var _factor := 1.0
var _bg: W.Table
var _home: Control
var _table: Table
var _level := "normal"
var _name := "Giocatore"


func _ready() -> void:
	_load_prefs()
	_factor = _screen_factor()
	Art.px = _factor
	get_tree().root.size_changed.connect(_fit_window)
	_fit_window()
	_bg = W.Table.new()
	_bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_bg)
	_show_home()
	# solo per le prove: "--partita=livello" apre subito il tavolo, "--finestra=LxA" fissa la misura
	# della finestra, "--foto=file.png" salva una foto dello schermo dopo "--attesa=secondi" ed esce
	var foto := ""
	var attesa := 3.0
	for a in OS.get_cmdline_user_args():
		var v := a.get_slice("=", 1)
		if a.begins_with("--finestra="):
			DisplayServer.window_set_size(Vector2i(int(v.get_slice("x", 0)), int(v.get_slice("x", 1))))
		elif a.begins_with("--foto="):
			foto = v
		elif a.begins_with("--attesa="):
			attesa = float(v)
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--partita="):
			_start(a.get_slice("=", 1))
			if OS.get_cmdline_user_args().has("--da-solo"):
				_table.autoplay = true
	if foto != "":
		await get_tree().create_timer(attesa).timeout
		get_viewport().get_texture().get_image().save_png(foto)
		get_tree().quit()


## Quanti pixel veri per un "punto": la densità dello schermo (come devicePixelRatio).
func _screen_factor() -> float:
	var f := 1.0
	if OS.has_feature("mobile"):
		f = DisplayServer.screen_get_dpi() / 160.0
	else:
		f = maxf(DisplayServer.screen_get_scale(), 1.0)
		if OS.get_name() == "Windows":
			f = maxf(f, DisplayServer.screen_get_dpi() / 96.0)
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--scala="):
			f = float(a.get_slice("=", 1))
	return clampf(f, 1.0, 4.0)


func _fit_window() -> void:
	var win := get_tree().root
	var s := Vector2(win.size) / _factor
	win.content_scale_size = Vector2i(maxi(1, int(s.x)), maxi(1, int(s.y)))


func _load_prefs() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(SAVE) == OK:
		_level = cfg.get_value("gioco", "livello", "normal")
		_name = cfg.get_value("gioco", "nome", "Giocatore")
		if cfg.get_value("schermo", "intero", false) and not OS.has_feature("mobile"):
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)


func _save_prefs() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("gioco", "livello", _level)
	cfg.set_value("gioco", "nome", _name)
	cfg.set_value("schermo", "intero", DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN)
	cfg.save(SAVE)


func toggle_fullscreen() -> void:
	var full := DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if full else DisplayServer.WINDOW_MODE_FULLSCREEN)
	_save_prefs()
	if _home != null:
		_show_home()


# ---------------------------------------------------------------- home

func _show_home() -> void:
	if _home != null:
		_home.queue_free()
	_home = Control.new()
	_home.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_home)
	var panel := PanelContainer.new()
	var sb := Art.box(Art.CARTA, 16)
	for m in ["left", "right"]:
		sb.set("content_margin_" + m, 22)
	sb.content_margin_top = 22
	sb.content_margin_bottom = 18
	sb.shadow_color = Art.OMBRA
	sb.shadow_size = 30
	panel.add_theme_stylebox_override("panel", sb)
	_home.add_child(panel)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 13)
	panel.add_child(v)
	var full: bool = DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
	var fs_btn := W.button("Esci da schermo intero" if full else "Schermo intero", "full", 16)
	fs_btn.pressed.connect(toggle_fullscreen)
	v.add_child(fs_btn)
	v.add_child(_fan())
	var title := W.label("Atlas", 40, Art.INK, Art.bold())
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(title)
	var sub := W.label("Cinque terre diverse o cinque uguali: chi ci arriva per primo vince.", 15, Color(Art.INK, 0.75), Art.serif())
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(sub)
	var who := HBoxContainer.new()
	who.add_theme_constant_override("separation", 8)
	who.add_child(W.label("Il tuo nome", 14, Color(Art.INK, 0.7)))
	var name_edit := LineEdit.new()
	name_edit.text = _name
	name_edit.max_length = 18
	name_edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_edit.add_theme_font_override("font", Art.bold())
	name_edit.add_theme_font_size_override("font_size", 15)
	name_edit.add_theme_color_override("font_color", Art.INK)
	var es := Art.box(Color("#fffaf0"), 10, Art.INK, 1.5)
	es.content_margin_left = 10
	es.content_margin_right = 10
	es.content_margin_top = 8
	es.content_margin_bottom = 8
	name_edit.add_theme_stylebox_override("normal", es)
	name_edit.add_theme_stylebox_override("focus", es)
	name_edit.text_changed.connect(func(t): _name = t.strip_edges() if t.strip_edges() != "" else "Giocatore")
	who.add_child(name_edit)
	v.add_child(who)
	v.add_child(W.label("Contro il computer", 14, Color(Art.INK, 0.7), Art.bold()))
	var seg := HBoxContainer.new()
	seg.add_theme_constant_override("separation", 0)
	for l in LEVELS:
		var b := W.button(l[1], "ink" if l[0] == _level else "ghost_ink", 14)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.pressed.connect(func():
			_level = l[0]
			_save_prefs()
			_show_home())
		seg.add_child(b)
	v.add_child(seg)
	var play := W.button("Gioca", "ink", 17)
	play.pressed.connect(func(): _start(_level))
	v.add_child(play)
	var soon := W.label("Partite tra amici, sfide, tutorial e statistiche arrivano nei prossimi passi.", 13, Color(Art.INK, 0.55), Art.serif())
	soon.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	soon.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(soon)
	_fit_home.call_deferred(panel)
	if not _home.resized.is_connected(_fit_home):
		_home.resized.connect(_fit_home.bind(panel))


## Ventaglio delle cinque terre, come nella home web.
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


func _fit_home(panel: PanelContainer) -> void:
	if not is_instance_valid(panel) or _home == null:
		return
	var S := _home.size
	var w := minf(430.0, S.x - 28)
	panel.custom_minimum_size.x = w
	panel.reset_size()
	var ps := panel.get_combined_minimum_size()
	ps.x = w
	var k := minf(1.0, (S.y - 24) / ps.y)  # se non ci sta si rimpicciolisce, mai scorrere
	panel.scale = Vector2(k, k)
	panel.size = ps
	panel.position = (S - ps * k) / 2


# ---------------------------------------------------------------- partita

func _start(level: String) -> void:
	_save_prefs()
	if _home != null:
		_home.queue_free()
		_home = null
	if _table != null:
		_table.queue_free()
	_table = Table.new()
	_table.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_table)
	_table.exit_requested.connect(_end_game)
	_table.fullscreen_requested.connect(func():
		toggle_fullscreen()
		_table._close_overlays())
	await get_tree().process_frame
	_table.start(level, _name)


func _end_game() -> void:
	if _table != null:
		_table.queue_free()
		_table = null
	_show_home()
