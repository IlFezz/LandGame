## Foto di prova di tutte le schermate in situazioni precise (non partite a caso):
##   godot --path godot -s res://tools/shots.gd -- <cartella> <larghezza> <altezza> <scala>
## larghezza e altezza sono in punti (come i px del browser): 354x792 è il telefono del proprietario.
## Non lascia dati: niente partite salvate né profili.
extends SceneTree

const Table := preload("res://scripts/ui/table.gd")
const Home := preload("res://scripts/ui/home.gd")
const Art := preload("res://scripts/ui/art.gd")
const W := preload("res://scripts/ui/widgets.gd")
const Prefs := preload("res://scripts/app/prefs.gd")
const Sheets := preload("res://scripts/ui/sheets.gd")

var out := ""
var host: Control


func _initialize() -> void:
	var a := OS.get_cmdline_user_args()
	out = a[0]
	var w := float(a[1])
	var h := float(a[2])
	var k := float(a[3])
	Prefs.load_all()
	Art.px = k
	DisplayServer.window_set_size(Vector2i(int(w * k), int(h * k)))
	root.content_scale_mode = Window.CONTENT_SCALE_MODE_CANVAS_ITEMS
	root.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_EXPAND
	root.content_scale_size = Vector2i(int(w), int(h))
	await process_frame
	var bg := W.Table.new()
	bg.size = Vector2(w, h)
	root.add_child(bg)
	host = Control.new()
	host.size = Vector2(w, h)
	root.add_child(host)
	# home, tutte le schede
	for tab in ["play", "challenges", "profile", "collection", "learn"]:
		Prefs._v["tab"] = tab
		var home := Home.new()
		home.size = host.size
		host.add_child(home)
		await _wait(0.6)
		await _shot("home_" + tab)
		if tab == "learn":
			Sheets.rules(home._overlays)
			await _wait(0.3)
			await _shot("regole")
		if tab == "challenges":
			home._open_challenge = "corsa"
			home._layout()
			await _wait(0.4)
			await _shot("sfida_aperta")
		if tab == "collection":
			Sheets.goals(home._overlays)
			await _wait(0.3)
			await _shot("obiettivi")
		home.free()
	# tutorial: la pagina con la carta da giocare
	var t := _table()
	t.start("normal", "Giocatore", {}, {"kind": "tutorial"})
	await _wait(0.5)
	await _shot("tutorial_inizio")
	t.coach.page = 11
	t._refresh()
	await _wait(0.5)
	await _shot("tutorial_gioca_questa")
	t.free()
	# il computer gioca una Montagna sulla mia Pianura: contrasto guidato
	t = _table()
	t.start("normal", "Giocatore", {"firstPlayer": 1})
	var g = t.g
	g.players[0]["hand"] = ["U", "B", "G", "W", "R", "R"]
	g.players[0]["bf"] = {"W": 1, "U": 0, "B": 1, "R": 0, "G": 2}
	g.players[1]["hand"] = ["R", "W", "W", "B"]
	g.players[1]["bf"] = {"W": 2, "U": 1, "B": 0, "R": 4, "G": 0}
	g.players[1]["gy"] = {"W": 0, "U": 1, "B": 2, "R": 0, "G": 1}
	g.act(1, {"type": "play", "card": "R", "target": "G"})
	g.take_events()
	t.V = g.view(0)
	t.turn_time = 30
	t._refresh()
	await _wait(0.5)
	await _shot("risposta")
	t._bubble(1, 1)
	t._bubble(0, 5)
	await _wait(0.3)
	await _shot("fumetti")
	t._counter_start()
	t.pick = {"card": "B", "idx": t.V.hand.find("B")}
	t._refresh()
	await _wait(0.4)
	await _shot("contrasto")
	t._counter_cancel()
	# contrasto vero: la Montagna del BOT resta al centro con il timbro «Contrastata»
	var g0 = t.g
	g0.act(0, {"type": "counter", "other": "B"})
	g0.take_events()
	t.V = g0.view(0)
	t._refresh()
	await _wait(0.4)
	await _shot("contrastata")
	t._open_gy("opp")
	await _wait(0.3)
	await _shot("cimitero")
	t._close_overlays()
	t._open_menu()
	await _wait(0.3)
	await _shot("menu")
	t._close_overlays()
	t._open_reactions()
	t._bubble(1, 1)
	await _wait(0.3)
	await _shot("reazioni")
	t.free()
	# la mia Montagna aspetta il bersaglio; poi la Palude: mano avversaria
	t = _table()
	t.start("normal", "Giocatore con un nome lungo", {"firstPlayer": 0})
	g = t.g
	g.players[0]["hand"] = ["R", "B", "U", "G", "W"]
	g.players[1]["bf"] = {"W": 1, "U": 1, "B": 0, "R": 2, "G": 1}
	g.players[1]["hand"] = ["W", "U", "B", "R", "G", "G", "U"]
	t.V = g.view(0)
	t._refresh()
	t.staged = {"card": "R", "idx": 3}
	t._refresh()
	await _wait(0.5)
	await _shot("bersaglio")
	t.staged = null
	t.sel = {"card": "U", "idx": 1}
	t._hover_idx = -1
	t._refresh()
	await _wait(0.4)
	await _shot("carta_scelta")
	t.sel = null
	g.act(0, {"type": "play", "card": "B"})
	g.act(1, {"type": "allow"})
	g.take_events()
	t.V = g.view(0)
	t._refresh()
	await _wait(0.6)
	await _shot("palude")
	t._close_overlays()
	t._show_peek("G")
	await _wait(0.3)
	await _shot("anteprima")
	t._close_peek()
	g.end_game(0, "combo", "Giocatore ha una terra di ogni tipo in gioco!")
	t.new_goals = ["prima", "dominio"]
	t._show_over()
	await _wait(0.3)
	await _shot("fine")
	t.free()
	quit()


func _table() -> Table:
	var t := Table.new()
	t.size = host.size
	t.save_enabled = false
	host.add_child(t)
	return t


func _wait(s: float) -> void:
	await create_timer(s).timeout


func _shot(name: String) -> void:
	await process_frame
	await process_frame
	root.get_texture().get_image().save_png("%s/%s.png" % [out, name])
