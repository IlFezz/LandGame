## Prova: gioca da sola la sfida del giorno nel tavolo vero e mostra la risposta della classifica.
##   godot --path godot -s res://tools/daily_probe.gd -- --server=ws://localhost:3999
extends SceneTree

const Table := preload("res://scripts/ui/table.gd")
const Modes := preload("res://scripts/app/modes.gd")
const Classifica := preload("res://scripts/net/classifica.gd")


func _initialize() -> void:
	root.size = Vector2i(390, 844)
	var acc: Dictionary = await Classifica._call(root, Classifica.base_url() + "/api/account", HTTPClient.METHOD_POST, JSON.stringify({"a": "create", "name": "Prova sonda"}))
	for k in 12:
		var t: Table = Table.new()
		root.add_child(t)
		t.size = Vector2(390, 844)
		t.save_enabled = false
		t.deal_anim = false
		await process_frame
		t.autoplay = true
		t.start("normal", "Prova", {}, {"kind": "daily", "daily": Modes.today()})
		var t0 := Time.get_ticks_msec()
		while t.g.phase == "playing" and Time.get_ticks_msec() - t0 < 240000:
			await process_frame
		print("partita ", k, " vincitore ", t.g.winner, " turno ", t.g.turn, " mosse ", t.g.record.size())
		var r: Dictionary = await Classifica.submit(t, Modes.today(), acc, t.g.record)
		print("risposta: ", r)
		t.queue_free()
		if t.g.winner == 0:
			break
	quit()
