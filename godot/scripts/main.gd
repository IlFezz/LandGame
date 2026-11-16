## Schermata provvisoria (passo 1): il computer normale gioca contro il difficile e il registro
## si riempie mossa dopo mossa. Il difficile pensa su un thread separato, quindi la finestra
## resta sempre fluida. Il tavolo vero arriva al passo 2.
extends Control

const Game := preload("res://scripts/rules/game.gd")
const Bot := preload("res://scripts/rules/bot.gd")

@onready var _log: RichTextLabel = %Log
@onready var _again: Button = %Again
@onready var _status: Label = %Status

var _match := 0  # numero della partita in corso: una partita vecchia si ferma da sola


func _ready() -> void:
	_again.pressed.connect(_play)
	_play()


func _play() -> void:
	_match += 1
	var id := _match
	var g = Game.new(["BOT normale", "BOT difficile"])
	var bots := [Bot.new(g, 0), Bot.new(g, 1, {"level": "hard"})]
	_log.text = ""
	var shown := 0
	while g.phase == "playing":
		var p: int = g.actor()
		var bot = bots[p]
		var a
		if bot.hard:
			_status.text = "BOT difficile sta pensando…"
			bot.decide_async()
			a = await bot.decided
		else:
			a = bot.decide()
		if id != _match:
			return  # è iniziata un'altra partita
		var err = g.act(p, a)
		if err != null:
			push_error("Mossa non valida: %s" % err)
			break
		for i in range(shown, g.log_lines.size()):
			_log.append_text(g.log_lines[i] + "\n")
		shown = g.log_lines.size()
		_status.text = "Turno %d" % g.turn
		await get_tree().create_timer(0.15).timeout
		if id != _match:
			return
	_status.text = g.end_text if g.end_text != "" else "Partita finita"
