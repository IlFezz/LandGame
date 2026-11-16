## Misura la velocità delle simulazioni del computer difficile:
##   godot --headless --path godot -s res://tests/bench.gd
extends SceneTree
const Game := preload("res://scripts/rules/game.gd")
const Bot := preload("res://scripts/rules/bot.gd")
func _init() -> void:
	var g = Game.new(["A", "B"], {"firstPlayer": 0, "seed": 7})
	var b = Bot.new(g, 0, {"level": "hard"})
	var t0 := Time.get_ticks_usec()
	var n := 2000
	var base = b.determinize()
	for i in n:
		b.playout(b.determinize(base))
	print("partita simulata: %.3f ms l'una" % ((Time.get_ticks_usec() - t0) / 1000.0 / n))
	t0 = Time.get_ticks_usec()
	var a = b.decide()
	print("decisione del difficile: %d ms, %d giri di simulazione" % [(Time.get_ticks_usec() - t0) / 1000, b.last_rounds])
	quit(0)
