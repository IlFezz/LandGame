## Preferenze del giocatore, salvate su questo dispositivo (come `prefs` in app.js).
extends RefCounted

const FILE := "user://prefs.cfg"
const DEFAULTS := {
	"name": "",  # il nome con cui giochi: statistiche e obiettivi lo seguono
	"level": "normal",
	"turn_time": 0,  # secondi per turno contro il computer (0: illimitato)
	"theme": "crepuscolo",
	"back": "sole",
	"music": true,
	"sound": true,
	"vibrate": true,
	"info": true,  # spiegazioni sulla plancia
	"react": true,  # reazioni rapide
	"fullscreen": false,
	"tab": "play",
	"friend": {},
	"account": {},  # account sul server { id, token } (scripts/net/account.gd)
	"google": "",  # email dell'account Google collegato ("" se non c'è)  # stanza con un amico in corso { code, token }: riaprendo l'app si può rientrare
}

static var _v := {}


static func load_all() -> void:
	_v = DEFAULTS.duplicate()
	var cfg := ConfigFile.new()
	if cfg.load(FILE) == OK:
		for k in DEFAULTS:
			_v[k] = cfg.get_value("prefs", k, DEFAULTS[k])


static func save_all() -> void:
	var cfg := ConfigFile.new()
	for k in _v:
		cfg.set_value("prefs", k, _v[k])
	cfg.save(FILE)


static func get_value(k: String):
	if _v.is_empty():
		load_all()
	return _v.get(k, DEFAULTS.get(k))


static func set_value(k: String, v) -> void:
	if _v.is_empty():
		load_all()
	_v[k] = v
	save_all()


## Il nome per statistiche e partite ("Giocatore" se non l'hai scritto).
static func player_name() -> String:
	var n: String = get_value("name")
	return n if n.strip_edges() != "" else "Giocatore"
