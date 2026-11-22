## Account del giocatore sul server (account.js). Al primo avvio con internet si crea da solo un
## account ospite («Ospite4821»), oppure con il nome che si usava già, se nessun altro lo ha preso.
## Id e chiave segreta restano in Prefs "account". Con l'account il nome è unico, la classifica conta
## l'account e statistiche e sblocchi hanno una copia sul server.
## Le funzioni vanno chiamate con await; la rete si usa solo se `live` è vero (lo accende main.gd:
## le prove automatiche non toccano il server vero).
extends RefCounted

const Classifica := preload("res://scripts/net/classifica.gd")
const Prefs := preload("res://scripts/app/prefs.gd")
const Profile := preload("res://scripts/app/profile.gd")

static var live := false
static var _creating := false


static func info() -> Dictionary:
	var a = Prefs.get_value("account")
	return a if a is Dictionary and a.get("id", "") != "" and a.get("token", "") != "" else {}


static func has() -> bool:
	return not info().is_empty()


static func _post(host: Node, m: Dictionary) -> Dictionary:
	var r := await Classifica._call(host, Classifica.base_url() + "/api/account", HTTPClient.METHOD_POST, JSON.stringify(m))
	if r.get("unknown", false):
		Prefs.set_value("account", {})  # il server non conosce più l'account: se ne crea uno nuovo
	return r


static func _auth(m: Dictionary) -> Dictionary:
	var a := info()
	m.id = a.id
	m.token = a.token
	return m


## Crea l'account se non c'è ancora. Restituisce true se ora c'è.
static func ensure(host: Node) -> bool:
	if has():
		return true
	if not live:
		return false
	if _creating:
		while _creating and is_instance_valid(host):
			await host.get_tree().process_frame
		return has()
	_creating = true
	var old := Prefs.player_name()
	var had_name := str(Prefs.get_value("name")).strip_edges() != ""
	var prof := Profile.load_profile(old)
	prof.erase("name")
	var r := await _post(host, {"a": "create", "name": old if had_name else "", "profile": prof})
	_creating = false
	if not r.has("id"):
		return false
	Prefs.set_value("account", {"id": r.id, "token": r.token})
	_adopt(old, r.name)
	return true


## Il nome deciso dal server diventa il nome del profilo su questo dispositivo (statistiche comprese).
static func _adopt(old: String, new: String) -> void:
	if Profile.key_of(old) != Profile.key_of(new) or old != new:
		Profile.rename(old, new)
	Prefs.set_value("name", new)


## Cambia nome. { name } se è andata bene, { error } se il nome è di un altro o manca internet.
static func rename(host: Node, name: String) -> Dictionary:
	if not await ensure(host):
		if not live:
			_adopt(Prefs.player_name(), name)
			return {"name": name}
		return {"error": "Serve internet per cambiare nome."}
	var r := await _post(host, _auth({"a": "rename", "name": name}))
	if r.has("name"):
		_adopt(Prefs.player_name(), r.name)
	return r


## Copia di sicurezza del profilo sul server (dopo ogni partita). Senza internet non fa niente.
static func push(host: Node) -> void:
	if not live or not await ensure(host):
		return
	var prof := Profile.load_profile(Prefs.player_name())
	prof.erase("name")
	await _post(host, _auth({"a": "save", "profile": prof}))


# ---------- accesso con Google (google.js sul server) ----------
# Si apre la pagina di Google nel browser con un codice casuale; Google rimanda il giocatore al server,
# che controlla l'accesso. Intanto l'app chiede al server ogni due secondi se è fatto.

const GOOGLE_CLIENT := "548261437152-foj6sji9mmh2j1iiil8tle2u987fev4d.apps.googleusercontent.com"


static func google_start() -> String:
	var state := Crypto.new().generate_random_bytes(16).hex_encode()
	var q := {"client_id": GOOGLE_CLIENT, "response_type": "id_token", "scope": "openid email profile",
		"redirect_uri": Classifica.base_url() + "/api/google", "response_mode": "form_post",
		"nonce": state, "state": state, "prompt": "select_account"}
	var parts := []
	for k in q:
		parts.append("%s=%s" % [k, str(q[k]).uri_encode()])
	OS.shell_open("https://accounts.google.com/o/oauth2/v2/auth?" + "&".join(parts))
	return state


## Una domanda al server: { wait } se Google non ha ancora risposto, { error }, oppure l'account fatto
## (e in quel caso è già salvato qui: nome, chiave e, se si è passati a un altro account, il suo profilo).
static func google_poll(host: Node, state: String) -> Dictionary:
	var m := {"a": "google", "state": state}
	if has():
		_auth(m)
	var r := await _post(host, m)
	if not r.has("id"):
		return r
	var old := Prefs.player_name()
	if r.has("token"):
		Prefs.set_value("account", {"id": r.id, "token": r.token})
	if r.get("switched", false):
		# questo Google era già di un altro account: si entra in quello, con le sue statistiche
		var prof = r.get("profile")
		var s: Dictionary = prof if prof is Dictionary else {}
		Profile.store(r.name, Profile._fill(s, Profile.blank()))
		Prefs.set_value("name", r.name)
	else:
		_adopt(old, r.name)
	Prefs.set_value("google", r.get("google", ""))
	return r
