## Misura la velocità delle simulazioni del computer difficile:
##   godot --headless --path godot -s res://tests/bench.gd
extends SceneTree
const Game := preload("res://scripts/rules/game.gd")
const Bot := preload("res://scripts/rules/bot.gd")
func _init() -> void:
	seed(1)
	var g = Game.new(["A", "B"], {"firstPlayer": 0, "seed": 7})
	var b = Bot.new(g, 0, {"level": "hard"})
	var t0 := Time.get_ticks_usec()
	var n := 500
	for i in n:
		b.playout(b.determinize())
	print("playout: %.3f ms l'uno" % ((Time.get_ticks_usec() - t0) / 1000.0 / n))
	t0 = Time.get_ticks_usec()
	for i in 20000:
		b.decide_main()
	print("decide_main: %.4f ms" % ((Time.get_ticks_usec() - t0) / 1000.0 / 20000))
	t0 = Time.get_ticks_usec()
	for i in 2000:
		g.clone()
	print("clone: %.4f ms" % ((Time.get_ticks_usec() - t0) / 1000.0 / 2000))
	quit(0)
