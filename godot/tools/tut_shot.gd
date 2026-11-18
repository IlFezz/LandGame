## Foto del tutorial nei passaggi con un pulsante cerchiato (per controllare il contorno).
##   godot --path godot -s res://tools/tut_shot.gd -- cartella
extends SceneTree

const Table := preload("res://scripts/ui/table.gd")


func _initialize() -> void:
	var dir: String = OS.get_cmdline_user_args()[0]
	root.size = Vector2i(390, 844)
	DisplayServer.window_set_size(Vector2i(390, 844))
	root.content_scale_size = Vector2i(390, 844)
	var t: Table = Table.new()
	root.add_child(t)
	t.size = Vector2(390, 844)
	await process_frame
	t.save_enabled = false
	t.deal_anim = false
	t.start("normal", "zz foto", {}, {"kind": "tutorial"})
	var shots := {}
	var t0 := Time.get_ticks_msec()
	while t.g.phase == "playing" and Time.get_ticks_msec() - t0 < 120000 and shots.size() < 3:
		await process_frame
		if t.busy or t.coach == null:
			continue
		var P = t.coach.shown()
		if P == null:
			continue
		if P.get("info", false) or P.get("go", false):
			t.coach.next()
			continue
		var hl: String = P.get("hl", "")
		if hl.begins_with("btn:") and not shots.has(hl + str(t.V.turn)) and t.V.turn in [2, 6]:
			for k in 20:
				await process_frame
			root.get_texture().get_image().save_png("%s/tut-%d-%s.png" % [dir, t.V.turn, hl.substr(4).replace(" ", "_")])
			shots[hl + str(t.V.turn)] = true
		var task: String = t._task()
		if hl.begins_with("hand:") and task == "main":
			t._play_card(t.V.hand.find(hl.substr(5)))
		elif t.staged != null:
			var c: String = t.staged.card
			if c == "G":
				t.act({"type": "play", "card": "G", "target": "U"})
			elif c == "W":
				t.act({"type": "play", "card": "W", "target": "R"})
			else:
				t.act({"type": "play", "card": c, "target": t._board_targets().opp[0]})
		elif hl == "btn:Contrasta":
			t._counter_start()
		elif hl == "btn:Conferma":
			t.act({"type": "counter", "other": t.pick.card})
		elif hl.begins_with("btn:"):
			t.act({"type": "allow"} if task == "response" else {"type": "pass"})
		elif task == "response" and t.counter_mode and t.pick == null:
			var plan = t._counter_plan()
			for i in plan.eligible.size():
				if plan.eligible[i]:
					t.pick = {"card": t.V.hand[i], "idx": i}
					t._refresh()
					break
		elif task == "choice":
			t.act({"type": "choose", "choice": t.V.choice.options[0]})
		for k in 3:
			await process_frame
	preload("res://scripts/app/profile.gd").remove("zz foto")
	quit()
