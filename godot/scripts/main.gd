## Schermata provvisoria (passo 1): fa giocare il computer normale contro il difficile
## e mostra il registro, per vedere che motore e computer funzionano dentro Godot.
## Il tavolo vero arriva al passo 2.
extends Control

const Game := preload("res://scripts/rules/game.gd")
const Bot := preload("res://scripts/rules/bot.gd")

@onready var _log: RichTextLabel = %Log
@onready var _again: Button = %Again


func _ready() -> void:
	_again.pressed.connect(_play)
	_play()


func _play() -> void:
	var g = Game.new(["BOT normale", "BOT difficile"])
	var bots := [Bot.new(g, 0), Bot.new(g, 1, {"level": "hard", "budget": 60})]
	while g.phase == "playing":
		var p: int = g.actor()
		var err = g.act(p, bots[p].decide())
		if err != null:
			push_error("Mossa non valida: %s" % err)
			break
	_log.text = "\n".join(g.log_lines)
	_log.scroll_to_line(_log.get_line_count())
