## Quanto spesso il computer difficile batte il normale (nel browser circa 2 volte su 3):
##   godot --headless --path godot -s res://tests/strength.gd
## Dura qualche minuto. Il difficile gioca metà partite per primo e metà per secondo.
extends SceneTree
const Game := preload("res://scripts/rules/game.gd")
const Bot := preload("res://scripts/rules/bot.gd")
func _init() -> void:
	var n := 100
	var w := 0
	var rounds := 0
	var decisions := 0
	for i in n:
		var hs := i % 2
		var g = Game.new(["X", "Y"])
		var bots := [null, null]
		bots[hs] = Bot.new(g, hs, {"level": "hard"})
		bots[1 - hs] = Bot.new(g, 1 - hs)
		while g.phase == "playing":
			var p: int = g.actor()
			bots[p].last_rounds = 0
			g.act(p, bots[p].decide())
			if p == hs and bots[p].last_rounds > 0:
				rounds += bots[p].last_rounds
				decisions += 1
		if g.winner == hs:
			w += 1
	print("il difficile batte il normale %d volte su %d (in media %d giri di simulazione per decisione)" % [w, n, rounds / max(1, decisions)])
	quit(0)
