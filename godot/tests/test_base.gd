## Base comune dei test: controlli e preparazione di partite con mani e campo decisi a mano.
## Ogni test termina con `return true`: se uno script si rompe a metà, il test risulta fallito.
extends RefCounted

const Game := preload("res://scripts/rules/game.gd")
const Bot := preload("res://scripts/rules/bot.gd")
const TYPES := Game.TYPES

var failures: Array = []


func check(cond: bool, msg := "condizione falsa") -> void:
	if not cond:
		failures.append(msg)


func eq(got, want, msg := "") -> void:
	if not deep_eq(got, want):
		failures.append("%satteso %s, ottenuto %s" % [msg + ": " if msg != "" else "", str(want), str(got)])


## L'azione deve andare a buon fine (il motore restituisce null).
func is_ok(r) -> void:
	if r != null:
		failures.append("azione rifiutata: " + str(r))


## L'azione deve essere rifiutata (il motore restituisce un messaggio).
func refused(r) -> void:
	if r == null:
		failures.append("l'azione doveva essere rifiutata")


static func deep_eq(a, b) -> bool:
	var ta := typeof(a)
	var tb := typeof(b)
	if (ta == TYPE_INT or ta == TYPE_FLOAT) and (tb == TYPE_INT or tb == TYPE_FLOAT):
		return a == b
	if ta != tb:
		return false
	if ta == TYPE_DICTIONARY:
		if a.size() != b.size():
			return false
		for k in a:
			if not b.has(k) or not deep_eq(a[k], b[k]):
				return false
		return true
	if ta == TYPE_ARRAY:
		if a.size() != b.size():
			return false
		for i in a.size():
			if not deep_eq(a[i], b[i]):
				return false
		return true
	return a == b


static func count(over := {}) -> Dictionary:
	var c := Game.empty_count()
	c.merge(over, true)
	return c


## Prepara una partita con mani/campo controllati. Turno 1 di P0 in fase main.
func setup(o := {}, names := ["Anna", "Bruno"]):
	var g = Game.new(names, {"firstPlayer": 0})
	for i in 2:
		var pl = g.players[i]
		pl["hand"] = o.get("h%d" % i, []).duplicate()
		pl["bf"] = count(o.get("bf%d" % i, {}))
		pl["gy"] = count(o.get("gy%d" % i, {}))
		if o.has("deck%d" % i):
			pl["deck"] = o["deck%d" % i].duplicate()
	return g


## Azione semplice per chi deve agire (passa, lascia risolvere, prima scelta).
static func simple_action(g) -> Dictionary:
	if g.step == "main":
		return {"type": "pass"}
	if g.step == "response":
		return {"type": "allow"}
	return {"type": "choose", "choice": g.choice.options[0]}
