## Modalità contro il computer prese da hub.js: sfide a tema, sfida del giorno (stesso mescolamento
## della versione web per la stessa data), tutorial con i mazzi preparati e le mosse del Maestro.
extends RefCounted

const BOT_SEAT := 1

## Sfide: il giocatore è sempre il posto 0. `opts` va al motore delle regole.
const CHALLENGES := [
	{"id": "cinque", "name": "Cinque uguali", "desc": "Vinci solo con cinque terre uguali: le cinque diverse non bastano.", "level": "normal", "opts": {"onlyFive": [true, false]}},
	{"id": "svantaggio", "name": "In svantaggio", "desc": "Il computer parte con Pianura, Isola e Palude già in gioco.", "level": "normal", "opts": {"setup": [null, {"bf": {"W": 1, "U": 1, "B": 1}}]}},
	{"id": "senzaisole", "name": "Senza Isole", "desc": "Nel tuo mazzo non ci sono Isole: non puoi contrastare.", "level": "normal", "opts": {"setup": [{"without": ["U"]}, null]}},
	{"id": "manocorta", "name": "Mano corta", "desc": "Parti con 3 carte invece di 5.", "level": "normal", "opts": {"setup": [{"hand": 3}, null]}},
	{"id": "corsa", "name": "Corsa", "desc": "Vinci entro il turno 14, altrimenti perdi.", "level": "normal", "opts": {"turnLimit": {"turn": 14, "loser": 0}}},
	{"id": "duello", "name": "Duello difficile", "desc": "Contro il computer difficile, che gioca per primo.", "level": "hard", "opts": {"firstPlayer": 1}},
]

## Reazioni rapide: solo frasi predefinite.
const REACTIONS := ["Ciao!", "Bella mossa", "Ops", "Ci penso…", "Fortuna!", "Bella partita"]


static func challenge(id: String) -> Dictionary:
	for c in CHALLENGES:
		if c.id == id:
			return c
	return {}


## La data di oggi come "2026-11-16".
static func today() -> String:
	var d := Time.get_date_dict_from_system()
	return "%04d-%02d-%02d" % [d.year, d.month, d.day]


# ---------- numeri casuali con seme: identici a seeded() di hub.js ----------

static func _u32(x: int) -> int:
	return x & 0xFFFFFFFF


## Math.imul di JavaScript, su interi a 32 bit senza segno.
static func imul(a: int, b: int) -> int:
	a = _u32(a)
	b = _u32(b)
	var ah := (a >> 16) & 0xFFFF
	var al := a & 0xFFFF
	var bh := (b >> 16) & 0xFFFF
	var bl := b & 0xFFFF
	return _u32(al * bl + (_u32(ah * bl + al * bh) << 16))


class Seeded extends RefCounted:
	var a := 0

	func next() -> float:
		var M = load("res://scripts/app/modes.gd")
		a = M._u32(a + 0x6D2B79F5)
		var t: int = M.imul(a ^ (a >> 15), 1 | a)
		t = M._u32(M._u32(t + M.imul(t ^ (t >> 7), 61 | t)) ^ t)
		return float(M._u32(t ^ (t >> 14))) / 4294967296.0


## Generatore con seme (lo stesso di hub.js): con la stessa stringa dà gli stessi numeri del browser.
static func seeded(text: String) -> Callable:
	var h := _u32(1779033703 ^ text.length())
	for i in text.length():
		h = imul(h ^ text.unicode_at(i), 3432918353)
		h = _u32((h << 13) | (h >> 19))
	var s := Seeded.new()
	s.a = h
	return func(): return s.next()  # la funzione tiene vivo il generatore


## Opzioni del motore per la sfida del giorno.
static func daily_opts(day: String) -> Dictionary:
	return {"rng": seeded("atlas-" + day), "firstPlayer": 0}


# ---------- tutorial ----------
# Ordine di pescata (la prima carta dell'elenco è la prima pescata). Il resto del mazzo viene dopo.
# Al 9° turno si impara a passare, quindi si vince al 13°.
const TUT_ME := ["U", "G", "R", "W", "B", "G", "W", "B", "R", "U", "G", "W", "R"]
const TUT_BOT := ["R", "B", "R", "W", "G", "G", "W", "R", "B", "W", "R"]


static func tutorial_deck(order: Array) -> Array:
	var left := {"W": 10, "U": 10, "B": 10, "R": 10, "G": 10}
	for c in order:
		left[c] -= 1
	var rest := []
	# in fondo al mazzo niente Isole, così il computer non può contrastare per caso
	for t in ["W", "B", "R", "G", "U"]:
		for i in left[t]:
			rest.append(t)
	var rev := order.duplicate()
	rev.reverse()
	return rest + rev  # si pesca dalla fine


static func tutorial_opts() -> Dictionary:
	return {"decks": [tutorial_deck(TUT_ME), tutorial_deck(TUT_BOT)], "firstPlayer": 0}


## La mossa preparata del Maestro (null: gioca il computer normale).
static func tutorial_bot_move(g):
	var me := BOT_SEAT
	if g.step == "response":
		return {"type": "allow"}
	if g.step == "choice":
		var o: Array = g.choice.options
		for c in ["G", "R"]:
			if o.has(c):
				return {"type": "choose", "choice": c}
		return {"type": "choose", "choice": o[0]}
	var plans := {2: ["R", "U"], 4: ["B"], 6: ["R", "G"], 8: ["W"], 10: ["G"], 12: ["W", "G"]}
	var plan = plans.get(g.turn)
	var hand: Array = g.players[me].hand
	if plan != null and hand.has(plan[0]):
		var valid = g.targets_for(me, plan[0])
		if valid == null:
			valid = []
		var a := {"type": "play", "card": plan[0]}
		if plan.size() > 1 and valid.has(plan[1]):
			a.target = plan[1]
		elif not valid.is_empty():
			a.target = valid[0]
		return a
	return null
