## La partita tra amici vista dal tavolo: ha gli stessi campi e funzioni del motore (game.gd) che il
## tavolo usa, ma le regole girano sul server. Le mosse partono verso il server; gli stati che
## arrivano diventano eventi da animare, esattamente come quelli del motore locale.
extends RefCounted

var me := 0
var net: Node
var room := {}  # ultimo messaggio "state" senza la partita: stanza, posti, tempo, rivincita
var V := {}
var events: Array = []

# gli stessi campi del motore che il tavolo legge
var phase = "playing"
var turn = 1
var step = "main"
var active = 0
var pending = null
var choice = null
var winner = null
var end_reason = null
var end_text = ""
var log_lines: Array = []
var players: Array = [{}, {}]


func _init(n: Node, seat: int) -> void:
	net = n
	me = seat


## Un messaggio "state" del server: gli eventi vanno in coda, la vista diventa quella finale.
func push_state(m: Dictionary) -> void:
	room = m.duplicate()
	room.erase("game")
	room.erase("steps")
	me = int(m.seat)
	for st in m.get("steps", []):
		events.append({"ev": st.ev, "views": [st.game, st.game]})
	if m.get("game") is Dictionary:
		_apply(m.game)


func _apply(v: Dictionary) -> void:
	V = v
	phase = v.phase
	turn = v.turn
	step = v.step
	active = v.active
	pending = v.pending
	choice = v.choice
	winner = v.winner
	end_reason = v.endReason
	end_text = v.endText if v.endText != null else ""
	log_lines = v.log
	players = [{}, {}]
	players[me] = v.me
	players[1 - me] = v.opp


func view(_p: int) -> Dictionary:
	return V


## La mossa va al server; la risposta arriva come nuovo stato (o come errore).
func act(_p: int, a: Dictionary):
	net.send({"t": "action", "a": a})
	return null


func take_events() -> Array:
	var e := events
	events = []
	return e


func actor():
	if phase != "playing":
		return null
	match step:
		"main":
			return active
		"response":
			return pending.responder if pending != null else null
		"choice":
			return choice.player if choice != null else null
	return null


func name_of(p: int) -> String:
	return players[p].get("name", "")


## Nome dell'avversario e se è collegato.
func opp_seat() -> Dictionary:
	var seats: Array = room.get("seats", [])
	return seats[1 - me] if seats.size() > 1 and seats[1 - me] is Dictionary else {}
