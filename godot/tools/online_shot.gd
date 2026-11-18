## Prova tra l'app e il sito: entra nella stanza indicata, gioca da sola (prima carta possibile,
## lascia sempre risolvere) e salva delle foto del tavolo lungo la partita.
##   godot --path godot -s res://tools/online_shot.gd -- CODICE cartella --server=ws://localhost:3999
extends SceneTree

const Table := preload("res://scripts/ui/table.gd")
const Net := preload("res://scripts/net/net.gd")


func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	var code: String = args[0]
	var dir: String = args[1]
	root.size = Vector2i(390, 844)
	DisplayServer.window_set_size(Vector2i(390, 844))
	root.content_scale_size = Vector2i(390, 844)
	var net: Node = Net.new()
	root.add_child(net)
	var msgs: Array = []
	net.message.connect(func(m): msgs.append(m))
	net.send({"t": "join", "code": code, "name": "App"})
	var t0 := Time.get_ticks_msec()
	while not msgs.any(func(m): return m.get("t") == "state" and m.get("game") is Dictionary):
		await process_frame
		if Time.get_ticks_msec() - t0 > 15000:
			print("nessuna risposta: ", msgs)
			quit(1)
			return
	net.paused = true
	var first: Dictionary = msgs.filter(func(m): return m.get("t") == "state" and m.get("game") is Dictionary)[0]
	var t: Table = Table.new()
	root.add_child(t)
	t.size = Vector2(390, 844)
	t.save_enabled = false
	await process_frame
	t.start_online(net, first, "App")
	var shots := 0
	t0 = Time.get_ticks_msec()
	while Time.get_ticks_msec() - t0 < 300000:
		await process_frame
		if t.g.phase != "playing" and not t.busy:
			break
		if t.busy or t._awaiting:
			continue
		if shots < 2 and t.g.turn >= 3 + shots * 3:
			for k in 30:
				await process_frame
			root.get_texture().get_image().save_png("%s/app-%d.png" % [dir, shots])
			shots += 1
		var task := t._task()
		for k in 20:
			await process_frame
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
		elif task == "choice":
			t.act({"type": "choose", "choice": t.V.choice.options[0]})
	for k in 90:
		await process_frame
	root.get_texture().get_image().save_png("%s/app-fine.png" % dir)
	print("fine: fase ", t.g.phase, " vincitore ", t.g.winner, " turno ", t.g.turn)
	t.leave_online()
	preload("res://scripts/app/profile.gd").remove("App")  # niente profili di prova sul PC
	for k in 30:
		await process_frame
	quit()
