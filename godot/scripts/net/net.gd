## Collegamento con il server delle partite tra amici (server.js della versione web), via WebSocket.
## Stessi messaggi del browser (hub.js): create, join, action, rematch, react, leave → joined, state,
## react, error. Se la linea cade si ricollega da solo (dopo 1, 2, 4, 8 secondi) e rientra nella
## stanza con il proprio gettone, come fa il browser.
extends Node

signal message(m: Dictionary)
signal online_changed(online: bool)

const Game := preload("res://scripts/rules/game.gd")
const Prefs := preload("res://scripts/app/prefs.gd")

## Indirizzo del server: lo stesso del sito (Render). Per le prove si cambia con --server=ws://...
const DEFAULT_URL := "wss://landgame-mrsc.onrender.com/ws"

var url := DEFAULT_URL
var online := false
var session := {}  # { code, token }: per rientrare nella stanza dopo una caduta della linea
var _ws: WebSocketPeer = null
var _queue: Array = []
var _retry := 0
var _wait := 0.0
var _closed := false
var paused := false  # mentre si apre il tavolo i messaggi aspettano qui, così non se ne perde nessuno
var _held: Array = []


func _ready() -> void:
	url = server_url()
	_open()


## L'indirizzo del server: quello del sito; nel browser lo stesso della pagina; per le prove --server=.
static func server_url() -> String:
	var u := DEFAULT_URL
	if OS.has_feature("web"):
		# nel browser il gioco sta sullo stesso server: stesso indirizzo della pagina
		var host = JavaScriptBridge.eval("location.host")
		var https = JavaScriptBridge.eval("location.protocol") == "https:"
		if host is String and host != "":
			u = ("wss://" if https else "ws://") + host + "/ws"
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--server="):
			u = a.get_slice("=", 1)
	return u


func _open() -> void:
	_ws = WebSocketPeer.new()
	_ws.inbound_buffer_size = 1 << 20
	if _ws.connect_to_url(url) != OK:
		_ws = null
		_wait = _backoff()


func _backoff() -> float:
	var s := minf(pow(2.0, _retry), 8.0)
	_retry += 1
	return s


## Invia un messaggio (se la linea non c'è ancora, parte appena si collega).
func send(m: Dictionary) -> void:
	if online:
		_ws.send_text(JSON.stringify(m))
	else:
		_queue.append(m)


## Consegna i messaggi tenuti da parte mentre il tavolo si apriva.
func resume() -> void:
	paused = false
	var held := _held
	_held = []
	for d in held:
		message.emit(d)


## Indirizzo del sito (per il link d'invito): https://.../?room=CODICE apre la stanza nel browser.
func site_link(code: String) -> String:
	var u := url.replace("wss://", "https://").replace("ws://", "http://")
	if u.ends_with("/ws"):
		u = u.substr(0, u.length() - 3)
	return u + "/?room=" + code


## La stanza è finita o abbandonata: non si propone più di rientrare.
static func forget() -> void:
	Prefs.set_value("friend", {})


## Chiude per sempre (si esce dalla stanza o si torna alla home).
func shut() -> void:
	_closed = true
	if _ws != null:
		_ws.close()
	_ws = null
	online = false
	queue_free()


func _process(delta: float) -> void:
	if _closed:
		return
	if _ws == null:
		_wait -= delta
		if _wait <= 0:
			_open()
		return
	_ws.poll()
	var st := _ws.get_ready_state()
	if st == WebSocketPeer.STATE_OPEN:
		if not online:
			online = true
			_retry = 0
			# rientro nella stanza dopo una caduta (se non sto già creando o entrando)
			var asking := _queue.any(func(m): return m.t == "create" or m.t == "join")
			if not session.is_empty() and not asking:
				_ws.send_text(JSON.stringify({"t": "join", "code": session.code, "token": session.token}))
			for m in _queue:
				_ws.send_text(JSON.stringify(m))
			_queue.clear()
			online_changed.emit(true)
		while _ws != null and _ws.get_available_packet_count() > 0:
			var d = JSON.parse_string(_ws.get_packet().get_string_from_utf8())
			if d is Dictionary:
				d = Game._ints(d)  # i numeri del JSON arrivano come decimali
				if d.get("t") == "joined":
					session = {"code": d.code, "token": d.token}
					Prefs.set_value("friend", session)  # per rientrare anche dopo aver chiuso l'app
				if paused:
					_held.append(d)
				else:
					message.emit(d)
	elif st == WebSocketPeer.STATE_CLOSED:
		_ws = null
		_wait = _backoff()
		if online:
			online = false
			online_changed.emit(false)
