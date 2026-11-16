## Foto di prova delle carte:  godot --path godot -s res://tools/shot_cards.gd -- <file.png>
extends SceneTree
const Card := preload("res://scripts/ui/card_view.gd")
const Art := preload("res://scripts/ui/art.gd")
func _initialize() -> void:
	root.size = Vector2i(1100, 520)
	var bg := ColorRect.new()
	bg.color = Art.TAVOLO
	bg.size = Vector2(1100, 520)
	root.add_child(bg)
	var x := 20.0
	var modes := ["full", "compact", "mini", "mini_named", "full"]
	var i := 0
	for k in ["W", "U", "B", "R", "G"]:
		var c := Card.new()
		c.kind = k
		c.mode = modes[i]
		c.size = Vector2(150, 210)
		c.position = Vector2(x, 30)
		root.add_child(c)
		var s := Card.new()
		s.kind = k
		s.mode = "compact"
		s.size = Vector2(70, 98)
		s.position = Vector2(x, 300)
		if i == 1: s.ring = Art.SEGNALE
		if i == 2: s.ring = Art.ROSSO; s.badge = "✕"
		if i == 3: s.dim = 0.55
		root.add_child(s)
		x += 170
		i += 1
	var b := Card.new()
	b.kind = "back"
	b.size = Vector2(150, 210)
	b.position = Vector2(x, 30)
	root.add_child(b)
	for f in 8:
		await process_frame
	var img := root.get_texture().get_image()
	img.save_png(OS.get_cmdline_user_args()[0])
	quit()
