## Classifica della sfida del giorno sul server (classifica.js): leggere la classifica di un giorno e
## mandare una partita vinta (con tutte le mosse: il server la rigioca e la accetta solo se è vera).
## Le funzioni vanno chiamate con await e restituiscono sempre un dizionario: { error } se qualcosa
## non va (per esempio niente connessione).
extends RefCounted

const Net := preload("res://scripts/net/net.gd")


## Indirizzo del server per le richieste normali (https://..., senza /ws).
static func base_url() -> String:
	var u := Net.server_url()
	u = u.replace("wss://", "https://").replace("ws://", "http://")
	return u.substr(0, u.length() - 3) if u.ends_with("/ws") else u


static func board(host: Node, day: String, name: String) -> Dictionary:
	return await _call(host, "%s/api/classifica?day=%s&name=%s" % [base_url(), day, name.uri_encode()], HTTPClient.METHOD_GET, "")


static func submit(host: Node, day: String, name: String, steps: Array) -> Dictionary:
	return await _call(host, base_url() + "/api/classifica", HTTPClient.METHOD_POST,
		JSON.stringify({"day": day, "name": name, "steps": steps}))


static func _call(host: Node, url: String, method: int, body: String) -> Dictionary:
	var req := HTTPRequest.new()
	req.timeout = 70.0  # la prima richiesta del giorno sveglia il server: può volerci un po'
	host.add_child(req)
	var err := req.request(url, ["Content-Type: application/json"], method, body)
	if err != OK:
		req.queue_free()
		return {"error": "Classifica non raggiungibile."}
	var res: Array = await req.request_completed
	req.queue_free()
	if res[0] != HTTPRequest.RESULT_SUCCESS:
		return {"error": "Classifica non raggiungibile: controlla la connessione."}
	var d = JSON.parse_string((res[3] as PackedByteArray).get_string_from_utf8())
	if not d is Dictionary:
		return {"error": "Risposta del server non valida."}
	return preload("res://scripts/rules/game.gd")._ints(d)
