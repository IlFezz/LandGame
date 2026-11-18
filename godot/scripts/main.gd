## Avvio di Atlas: adatta la scala allo schermo, applica tema e preferenze, mostra la home o il tavolo.
## Le misure dell'interfaccia sono in "punti" come i px del browser: su un telefono ad alta densità
## tutto viene ingrandito in proporzione, così scritte e carte hanno la stessa misura della versione web.
## Se l'app era stata chiusa a metà partita, la partita riprende da dove era.
extends Control

const Art := preload("res://scripts/ui/art.gd")
const W := preload("res://scripts/ui/widgets.gd")
const Table := preload("res://scripts/ui/table.gd")
const Home := preload("res://scripts/ui/home.gd")
const Prefs := preload("res://scripts/app/prefs.gd")
const Sound := preload("res://scripts/app/sound.gd")
const Net := preload("res://scripts/net/net.gd")

var _factor := 1.0
var _bg: W.Table
var _home: Home
var _table: Table
var _net: Node = null  # collegamento al server mentre si prepara una partita con un amico


func _ready() -> void:
	get_tree().quit_on_go_back = false  # il tasto Indietro lo gestiamo noi
	if OS.has_feature("mobile"):
		# telefono: sempre in verticale; tablet: gira come lo tieni. Sempre a schermo intero.
		DisplayServer.screen_set_orientation(DisplayServer.SCREEN_SENSOR if is_tablet() else DisplayServer.SCREEN_PORTRAIT)
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)
	Prefs.load_all()
	Art.apply_theme(Prefs.get_value("theme"))
	Art.BACK = Art.back_id(Prefs.get_value("back"))
	if Prefs.get_value("fullscreen") and not OS.has_feature("mobile"):
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)
	_factor = _screen_factor()
	Art.px = _factor
	get_tree().root.size_changed.connect(_fit_window)
	_fit_window()
	_bg = W.Table.new()
	_bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_bg)
	Sound.prepare()
	# solo per le prove: "--partita=livello" apre subito il tavolo, "--finestra=LxA" fissa la misura
	# della finestra, "--foto=file.png" salva una foto dello schermo dopo "--attesa=secondi" ed esce,
	# "--scheda=..." apre la home su una scheda, "--tutorial" apre il tutorial
	var args := OS.get_cmdline_user_args()
	var foto := ""
	var attesa := 3.0
	var tab := ""
	for a in args:
		var v := a.get_slice("=", 1)
		if a.begins_with("--finestra="):
			DisplayServer.window_set_size(Vector2i(int(v.get_slice("x", 0)), int(v.get_slice("x", 1))))
		elif a.begins_with("--foto="):
			foto = v
		elif a.begins_with("--attesa="):
			attesa = float(v)
		elif a.begins_with("--scheda="):
			tab = v
	if tab != "":
		Prefs.set_value("tab", tab)
	var started := false
	for a in args:
		if a.begins_with("--partita="):
			_start(a.get_slice("=", 1))
			started = true
			if args.has("--da-solo"):
				_table.autoplay = true
			for b in args:
				if b.begins_with("--tempo="):
					await get_tree().process_frame
					await get_tree().process_frame
					_table.turn_time = int(b.get_slice("=", 1))
		elif a == "--tutorial":
			_start("normal", {"kind": "tutorial"})
			started = true
	if not started:
		# riaprendo l'app si parte sempre dalla home: se c'era una partita in corso, al posto di
		# «Contro il computer» ci sono «Riprendi» e «Nuova partita». (Se l'app era solo in
		# sottofondo, senza essere chiusa, si torna invece direttamente alla partita.)
		_show_home()
		# solo per le prove: "--amico" apre la finestra «Con un amico», "--amico=attesa" la stanza creata
		for a in args:
			if a == "--amico":
				_home.friend_sheet()
			elif a == "--amico=attesa":
				_home.friend_waiting("K7QD", 60)
			elif a == "--classifica":
				load("res://scripts/ui/sheets.gd").classifica(_home._overlays, load("res://scripts/app/modes.gd").today())
	if foto != "":
		await get_tree().create_timer(attesa).timeout
		get_viewport().get_texture().get_image().save_png(foto)
		get_tree().quit()


## Quanti pixel veri per un "punto": la densità dello schermo (come devicePixelRatio).
func _screen_factor() -> float:
	var f := 1.0
	if OS.has_feature("mobile"):
		f = DisplayServer.screen_get_dpi() / 160.0
		if is_tablet():
			# sul tablet tutto si ingrandisce in proporzione allo schermo, ma restando almeno
			# 540 × 860 punti: in verticale è come un telefono grande, in orizzontale come un PC piccolo
			var dp := Vector2(DisplayServer.screen_get_size()) / f
			f *= clampf(minf(minf(dp.x, dp.y) / 540.0, maxf(dp.x, dp.y) / 860.0), 1.0, 1.5)
	else:
		f = maxf(DisplayServer.screen_get_scale(), 1.0)
		if OS.get_name() == "Windows":
			f = maxf(f, DisplayServer.screen_get_dpi() / 96.0)
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--scala="):
			f = float(a.get_slice("=", 1))
	return clampf(f, 1.0, 4.0)


## Tablet: il lato corto dello schermo è di almeno 600 punti (la stessa regola di Android).
static func is_tablet() -> bool:
	if not OS.has_feature("mobile"):
		return false
	var dp := Vector2(DisplayServer.screen_get_size()) / (DisplayServer.screen_get_dpi() / 160.0)
	return minf(dp.x, dp.y) >= 600.0


func _fit_window() -> void:
	var win := get_tree().root
	var s := Vector2(win.size) / _factor
	win.content_scale_size = Vector2i(maxi(1, int(s.x)), maxi(1, int(s.y)))
	_fit_safe.call_deferred()


## Sul telefono la zona sicura esclude fotocamera e barre di sistema: home e tavolo stanno lì dentro,
## lo sfondo del tavolo invece arriva fino ai bordi.
## Schermo intero vero: le barre di sistema sono nascoste, quindi si lascia spazio solo al foro
## della fotocamera (in alto), e solo per l'altezza del foro.
func _safe_margins() -> Array:
	if not OS.has_feature("mobile"):
		return [0.0, 0.0, 0.0, 0.0]
	# niente margine: il tavolo e la home tengono libero il centro in alto, dove sta il foro
	return [0.0, 0.0, 0.0, 0.0]


func _fit_safe() -> void:
	var m := _safe_margins()
	for c in [_home, _table]:
		if c != null and is_instance_valid(c):
			c.offset_left = m[0]
			c.offset_top = m[1]
			c.offset_right = -m[2]
			c.offset_bottom = -m[3]


## Il tasto «Indietro» di Android: chiude le finestre aperte, poi apre il menu della partita;
## dalla home esce dall'app.
func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST:
		if _table != null and is_instance_valid(_table):
			if _table.overlay_layer.get_child_count() > 0 and not _table.overlay_layer.has_node("Over"):
				_table._close_overlays()
				_table._refresh()
			else:
				_table._open_menu()
		elif _home != null and is_instance_valid(_home) and _home._overlays.get_child_count() > 0:
			for c in _home._overlays.get_children():
				c.queue_free()
		else:
			get_tree().quit()


func toggle_fullscreen() -> void:
	var full := DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if full else DisplayServer.WINDOW_MODE_FULLSCREEN)
	Prefs.set_value("fullscreen", not full)
	Sound.play("click")
	if _home != null:
		_home.refresh()


func _show_home() -> void:
	if _home != null:
		_home.queue_free()
	_bg.queue_redraw()
	_home = Home.new()
	_home.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_home)
	_fit_safe()
	_home.play_bot.connect(func(level): _start(level))
	_home.play_challenge.connect(func(id): _start("normal", {"kind": "challenge", "challenge": id}))
	_home.play_daily.connect(func(day): _start("normal", {"kind": "daily", "daily": day}))
	_home.play_tutorial.connect(func(): _start("normal", {"kind": "tutorial"}))
	_home.fullscreen_toggled.connect(toggle_fullscreen)
	_home.play_friend.connect(_friend)
	_home.rejoin_friend.connect(func():
		var s: Dictionary = Prefs.get_value("friend")
		if s.has("code") and s.has("token"):
			_friend(str(s.code), str(s.token)))
	_home.resume_game.connect(func():
		var saved := Table.saved_game()
		if saved.is_empty():
			_home.refresh()
		else:
			Sound.play("click")
			_resume(saved))
	_home.friend_cancel.connect(_friend_cancel)


## Partita con un amico: ci si collega al server e si crea una stanza (code "") o si entra.
func _friend(code: String, token := "") -> void:
	Sound.play("click")
	_friend_cancel()
	_net = Net.new()
	add_child(_net)
	_net.message.connect(_on_friend_msg)
	var who := Prefs.player_name()
	if code == "":
		_net.send({"t": "create", "name": who, "turnTime": int(Prefs.get_value("turn_time"))})
	elif token != "":
		_net.send({"t": "join", "code": code, "token": token, "name": who})  # rientro nella propria stanza
	else:
		_net.send({"t": "join", "code": code, "name": who})
	_home.friend_connecting()


func _on_friend_msg(m: Dictionary) -> void:
	if _net == null or _home == null:
		return
	match m.get("t"):
		"state":
			if m.get("game") is Dictionary:
				# l'amico è entrato: si va al tavolo, che da qui in poi parla con il server
				var net := _net
				_net = null
				net.message.disconnect(_on_friend_msg)
				net.paused = true
				_make_table()
				await get_tree().process_frame
				_table.start_online(net, m, Prefs.player_name())
			else:
				_home.friend_waiting(str(m.code), int(m.get("turnTime", 0)), _net.site_link(str(m.code)))
		"error":
			_home._close_sheets()
			var msg := str(m.msg)
			if msg.contains("non trovata") and not Prefs.get_value("friend").is_empty():
				msg = "Quella partita non c'è più: il tuo amico è uscito o è passato troppo tempo."
			Net.forget()
			_home.refresh()
			_home.toast(msg)
			_friend_cancel()


func _friend_cancel() -> void:
	if _net != null:
		Net.forget()
		_net.send({"t": "leave"})
		_net.get_tree().create_timer(0.3).timeout.connect(_net.shut)
		_net = null


func _make_table() -> void:
	if _home != null:
		_home.queue_free()
		_home = null
	if _table != null:
		_table.queue_free()
	_table = Table.new()
	_table.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_table)
	_fit_safe()
	_table.exit_requested.connect(_end_game)
	_table.fullscreen_requested.connect(func():
		toggle_fullscreen()
		_table._close_overlays())
	# passaggio animato dalla home al tavolo
	_table.modulate.a = 0
	_table.create_tween().tween_property(_table, "modulate:a", 1.0, 0.35)


func _start(level: String, mode := {}) -> void:
	Sound.play("click")
	_make_table()
	await get_tree().process_frame
	_table.start(level, Prefs.player_name(), {}, mode)


func _resume(saved: Dictionary) -> void:
	_make_table()
	await get_tree().process_frame
	_table.resume(saved)


func _end_game() -> void:
	if _table != null:
		if _table.online:
			_table.leave_online()
		_table.queue_free()
		_table = null
	_show_home()
