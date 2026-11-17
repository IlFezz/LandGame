## Statistiche e obiettivi (come stats.js e goals.js): salvati su questo dispositivo, una scheda per
## ogni nome usato. Il codice di trasferimento ha lo stesso formato della versione web, quindi un
## profilo si può copiare dal browser all'app e viceversa.
extends RefCounted

const FILE := "user://profili.json"
const TYPES := ["W", "U", "B", "R", "G"]

const GOALS := [
	{"id": "prima", "name": "Prima vittoria", "desc": "Vinci una partita.", "reward": {"kind": "back", "id": "monti", "name": "dorso Monti"}},
	{"id": "dominio", "name": "Dominio", "desc": "Vinci con cinque terre diverse."},
	{"id": "cinqueuguali", "name": "Cinque di un tipo", "desc": "Vinci con cinque terre uguali."},
	{"id": "cinqueforeste", "name": "Cinque Foreste", "desc": "Vinci con cinque Foreste.", "reward": {"kind": "back", "id": "pini", "name": "dorso Pini"}},
	{"id": "controcontrasto", "name": "Contro-contrasto", "desc": "Contrasta un contrasto.", "reward": {"kind": "back", "id": "onde", "name": "dorso Onde"}},
	{"id": "muro", "name": "Muro", "desc": "Contrasta 3 volte nella stessa partita."},
	{"id": "demolitore", "name": "Demolitore", "desc": "Distruggi 3 terre nella stessa partita."},
	{"id": "lampo", "name": "Lampo", "desc": "Vinci entro il turno 10."},
	{"id": "serie3", "name": "Tre di fila", "desc": "Vinci 3 partite di fila.", "reward": {"kind": "table", "id": "stellata", "name": "cielo Notte stellata"}},
	{"id": "serie5", "name": "Cinque di fila", "desc": "Vinci 5 partite di fila."},
	{"id": "difficile", "name": "Mente fina", "desc": "Batti il computer difficile.", "reward": {"kind": "table", "id": "aurora", "name": "cielo Aurora"}},
	{"id": "esploratore", "name": "Esploratore", "desc": "Gioca 100 terre in totale."},
	{"id": "vittorie10", "name": "Dieci vittorie", "desc": "Vinci 10 partite.", "reward": {"kind": "back", "id": "stelle", "name": "dorso Stelle"}},
	{"id": "difficile3", "name": "Tre volte il difficile", "desc": "Batti 3 volte il computer difficile."},
	{"id": "amico", "name": "In compagnia", "desc": "Vinci una partita contro un amico."},
]


static func bucket() -> Dictionary:
	return {"played": 0, "won": 0, "lost": 0, "draw": 0, "streak": 0, "best": 0, "fastest": 0, "counters": 0, "destroyed": 0,
		"lands": {"W": 0, "U": 0, "B": 0, "R": 0, "G": 0}, "winBy": {"domain": 0, "five": 0, "cards": 0},
		"modes": {"easy": {"p": 0, "w": 0}, "normal": {"p": 0, "w": 0}, "hard": {"p": 0, "w": 0}}}


static func blank() -> Dictionary:
	return {"tutorial": false, "since": int(Time.get_unix_time_from_system() * 1000), "cpu": bucket(), "pvp": bucket()}


static func key_of(name: String) -> String:
	var k := name.strip_edges().to_lower()
	return k if k != "" else "giocatore"


static func all() -> Dictionary:
	if not FileAccess.file_exists(FILE):
		return {}
	var d = JSON.parse_string(FileAccess.get_file_as_string(FILE))
	return d if d is Dictionary else {}


static func _save(a: Dictionary) -> void:
	var f := FileAccess.open(FILE, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(a))


## Completa i dati mancanti (salvataggi vecchi o di un'altra versione).
static func _fill(dst: Dictionary, model: Dictionary) -> Dictionary:
	for k in model:
		if not dst.has(k) or typeof(dst[k]) != typeof(model[k]) and not (model[k] is int and dst[k] is float):
			dst[k] = model[k].duplicate(true) if model[k] is Dictionary else model[k]
		elif model[k] is Dictionary:
			_fill(dst[k], model[k])
	return dst


## Il profilo di `name`, sempre completo.
static func load_profile(name: String) -> Dictionary:
	var p = all().get(key_of(name))
	var s: Dictionary = p.s.duplicate(true) if p is Dictionary and p.get("s") is Dictionary else {}
	_fill(s, blank())
	s.name = p.n if p is Dictionary and p.has("n") else (name if name != "" else "Giocatore")
	return s


static func store(name: String, s: Dictionary) -> void:
	var a := all()
	var rest := s.duplicate(true)
	rest.erase("name")
	a[key_of(name)] = {"n": name, "s": rest}
	_save(a)


static func profile_names() -> Array:
	var out := []
	for k in all():
		out.append(all()[k].get("n", k))
	return out


# ---------- partita in corso ----------

## mode: "easy" | "normal" | "hard" | "daily" | "challenge" | "friend"
static func fresh(mode: String, challenge = null, daily = null, tutorial := false) -> Dictionary:
	return {"mode": mode, "challenge": challenge, "daily": daily, "tutorial": tutorial,
		"lands": {"W": 0, "U": 0, "B": 0, "R": 0, "G": 0}, "counters": 0, "cc": 0, "destroyed": 0}


## Aggiorna i conteggi della partita in corso con un evento del motore.
static func track(cur: Dictionary, ev: Dictionary, me: int) -> void:
	match ev.get("type"):
		"play":
			if ev.player == me:
				cur.lands[ev.card] += 1
		"counter":
			if ev.player == me:
				cur.counters += 1
				if ev.n >= 2:
					cur.cc += 1
		"destroy":
			if ev.by == me:
				cur.destroyed += 1


## Fine partita: aggiorna il profilo e restituisce gli id degli obiettivi appena raggiunti.
## info: { name, won, winner_null, bf (campo mio), reason, turn }
static func finish(cur: Dictionary, info: Dictionary) -> Array:
	var name: String = info.name
	var a := load_profile(name)
	if cur.tutorial:
		a.tutorial = true
		store(name, a)
		return []
	var won: bool = info.won
	var five = null
	for t in TYPES:
		if info.bf[t] >= 5:
			five = t
			break
	var how := "cards" if info.reason == "cards" else "five" if five != null else "domain"
	# sfide: si registra il record (meno turni), le statistiche normali restano pulite
	if cur.mode == "daily" or cur.mode == "challenge":
		var book_key := "daily" if cur.mode == "daily" else "challenges"
		if not a.get(book_key) is Dictionary:
			a[book_key] = {}
		var key: String = cur.daily if cur.mode == "daily" else cur.challenge
		if won and (not a[book_key].has(key) or info.turn < a[book_key][key]):
			a[book_key][key] = info.turn
		store(name, a)
		return []
	if not ["combo", "cards", "surrender"].has(info.reason):
		store(name, a)
		return []
	var s: Dictionary = a.pvp if cur.mode == "friend" else a.cpu
	s.played += 1
	if s.modes.has(cur.mode):
		s.modes[cur.mode].p += 1
	if info.winner_null:
		s.draw += 1
		s.streak = 0
	elif won:
		s.won += 1
		if s.modes.has(cur.mode):
			s.modes[cur.mode].w += 1
		s.streak += 1
		s.best = maxi(s.best, s.streak)
		s.winBy[how] += 1
		if not s.fastest or info.turn < s.fastest:
			s.fastest = info.turn
	else:
		s.lost += 1
		s.streak = 0
	for t in cur.lands:
		s.lands[t] += cur.lands[t]
	s.counters += cur.counters
	s.destroyed += cur.destroyed
	var got := check_goals(a, {"won": won, "how": how, "fiveOf": five, "turn": info.turn, "mode": cur.mode, "cur": cur, "reason": info.reason})
	store(name, a)
	return got


static func goal(id: String) -> Dictionary:
	for g in GOALS:
		if g.id == id:
			return g
	return {}


## L'obiettivo che sblocca un dorso o un tavolo ({} se è libero).
static func lock_for(kind: String, id: String) -> Dictionary:
	for g in GOALS:
		if g.has("reward") and g.reward.kind == kind and g.reward.id == id:
			return g
	return {}


static func unlocked(a: Dictionary, kind: String, id: String) -> bool:
	var g := lock_for(kind, id)
	return g.is_empty() or (a.get("goals") is Dictionary and a.goals.has(g.id))


static func check_goals(a: Dictionary, x: Dictionary) -> Array:
	if not a.get("goals") is Dictionary:
		a.goals = {}
	var out := []
	# una vittoria per resa dell'avversario non vale per gli obiettivi
	var won: bool = x.won and x.reason != "surrender"
	var c: Dictionary = x.cur
	var streak := maxi(int(a.cpu.streak), int(a.pvp.streak))
	var lands := 0
	for t in TYPES:
		lands += int(a.cpu.lands[t]) + int(a.pvp.lands[t])
	var tests := {
		"prima": won,
		"dominio": won and x.how == "domain",
		"cinqueuguali": won and x.how == "five",
		"cinqueforeste": won and x.how == "five" and x.fiveOf == "G",
		"controcontrasto": c.cc > 0,
		"muro": c.counters >= 3,
		"demolitore": c.destroyed >= 3,
		"lampo": won and x.turn <= 10,
		"serie3": won and streak >= 3,
		"serie5": won and streak >= 5,
		"difficile": won and x.mode == "hard",
		"esploratore": lands >= 100,
		"vittorie10": won and a.cpu.won + a.pvp.won >= 10,
		"difficile3": won and a.cpu.modes.hard.w >= 3,
		"amico": won and x.mode == "friend",
	}
	for g in GOALS:
		if not a.goals.has(g.id) and tests[g.id]:
			a.goals[g.id] = int(Time.get_unix_time_from_system() * 1000)
			out.append(g.id)
	return out


# ---------- trasferimento (stesso formato della versione web) ----------

static func export_code(name: String) -> String:
	var s := load_profile(name)
	return "ATLAS1-" + Marshalls.utf8_to_base64(JSON.stringify({"n": s.name, "s": s}))


## Importa un codice; restituisce il nome del profilo, oppure "" se il codice non è valido.
static func import_code(code: String) -> String:
	var raw := code.strip_edges().replace(" ", "").replace("\n", "")
	var pre := ""
	for p in ["ATLAS1-", "BLG1-"]:
		if raw.begins_with(p):
			pre = p
	if pre == "":
		return ""
	var d = JSON.parse_string(Marshalls.base64_to_utf8(raw.substr(pre.length())))
	if not d is Dictionary or not d.get("n") is String or not d.get("s") is Dictionary or not d.s.get("cpu") is Dictionary:
		return ""
	var s: Dictionary = d.s
	s.erase("name")
	_fill(s, blank())
	store(d.n, s)
	return d.n


## Cancella un profilo (serve ai test).
static func remove(name: String) -> void:
	var a := all()
	a.erase(key_of(name))
	_save(a)
