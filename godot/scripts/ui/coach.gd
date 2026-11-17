## Tutorial: il riquadro del Maestro sopra il tavolo (traduzione di public/tutorial.js).
## Ogni momento della partita ha una o più pagine: le prime spiegano («Avanti»), l'ultima chiede di
## fare qualcosa (giocare, passare, contrastare) oppure di far giocare il Maestro. «Indietro» rilegge.
## L'elemento di cui si parla è cerchiato; la carta da giocare porta l'etichetta «Gioca questa».
extends Control

signal go

const Art := preload("res://scripts/ui/art.gd")
const W := preload("res://scripts/ui/widgets.gd")
const ART_NAMES := {"W": "la Pianura", "U": "l'Isola", "B": "la Palude", "R": "la Montagna", "G": "la Foresta"}
const WAIT_TEXT := {
	2: "Hai giocato la tua terra e il turno è finito. Ora tocca al Maestro: pesca una carta e gioca una terra.",
	4: "Tocca di nuovo al Maestro. Vediamo cosa gioca.",
	6: "Turno del Maestro. Ha ancora una Montagna in mano: stai attento.",
	8: "Tocca al Maestro. Gli hai distrutto tutte le terre: vediamo come risponde.",
	10: "Hai passato il turno: ora tocca al Maestro.",
	12: "Ultimo turno del Maestro.",
}

var t  # il tavolo
var page := 0
var key := ""
var history: Array = []
var back := 0
var waiting := false  # tocca al Maestro: aspetta «Avanti»
var _panel: PanelContainer
var _text: RichTextLabel
var _note: Label
var _back_btn: Button
var _fwd_btn: Button
var _rings: Array = []  # rettangoli da cerchiare
var _tag_rect := Rect2()
var _t := 0.0


func _init(table) -> void:
	t = table
	name = "Coach"
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _ready() -> void:
	_panel = PanelContainer.new()
	var sb := Art.box(Art.FOGLIO, 18, Color(1, 1, 1, 0.22), 1.0)
	for m in ["left", "right", "top", "bottom"]:
		sb.set("content_margin_" + m, 14)
	sb.shadow_color = Art.OMBRA
	sb.shadow_size = 24
	sb.shadow_offset = Vector2(0, 6)
	_panel.add_theme_stylebox_override("panel", sb)
	add_child(_panel)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 8)
	_panel.add_child(v)
	_note = W.label("Stai rileggendo un passaggio precedente", 11, Color(Art.TESTO, 0.6))
	v.add_child(_note)
	_text = RichTextLabel.new()
	_text.bbcode_enabled = true
	_text.fit_content = true
	_text.scroll_active = false
	_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_text.add_theme_font_override("normal_font", Art.sans())
	_text.add_theme_font_override("bold_font", Art.bold())
	_text.add_theme_color_override("default_color", Art.TESTO)
	_text.add_theme_constant_override("line_separation", 4)
	_text.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(_text)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	_back_btn = W.button("Indietro", "dark", 13)
	_back_btn.pressed.connect(prev)
	row.add_child(_back_btn)
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(sp)
	_fwd_btn = W.button("Avanti", "primary", 13)
	_fwd_btn.pressed.connect(next)
	row.add_child(_fwd_btn)
	v.add_child(row)
	update()


func _process(delta: float) -> void:
	_t += delta
	if not _rings.is_empty():
		queue_redraw()


# ---------------------------------------------------------------- il copione

func _how(land: String) -> String:
	return "Trascina %s evidenziata al centro del tavolo e lasciala lì (oppure toccala e poi tocca il centro)." % land


func _info(text: String, hl := "") -> Dictionary:
	return {"text": text, "hl": hl}


func _play(card: String, text: String) -> Dictionary:
	return {"text": text, "card": card, "hl": "hand:" + card,
		"allow": func(a): return a.type == "play" and a.card == card,
		"wrong": "In questo passaggio puoi giocare solo %s, la carta evidenziata." % ART_NAMES[card]}


func _allow_page(text: String) -> Dictionary:
	return {"text": text, "hl": "btn:Lascia risolvere", "allow": func(a): return a.type == "allow",
		"wrong": "In questo passaggio premi «Lascia risolvere»."}


func pages() -> Array:
	var T: int = t.V.turn
	var task: String = t._task()
	if task == "main" and t.staged != null:
		var txt: String = {"G": "Ora tocca l'[b]Isola[/b] nel tuo cimitero: tornerà nella tua mano.",
			"R": "Ora tocca una terra del Maestro: è il bersaglio della Montagna e verrà distrutta.",
			"W": "Ora tocca la tua [b]Montagna[/b]: la Pianura ne ripeterà l'effetto."}.get(t.staged.card, "")
		var c: String = t.staged.card
		return [{"text": txt, "allow": func(a): return a.type == "play" and a.card == c}]
	if task == "main":
		match T:
			1:
				return [
					_info("Benvenuto in [b]Atlas[/b]! È un gioco di carte per due giocatori. Il Maestro ti insegnerà a giocare con una partita vera, passo per passo."),
					_info("Ogni carta è una [b]terra[/b]. Ce ne sono cinque tipi: [b]Pianura[/b], [b]Isola[/b], [b]Palude[/b], [b]Montagna[/b] e [b]Foresta[/b]. Ogni tipo ha un colore e un simbolo.", "hand"),
					_info("Si vince così: avere in gioco [b]una terra di ogni tipo[/b], oppure [b]cinque terre dello stesso tipo[/b]. Si vince nel momento in cui la terra giusta entra in gioco."),
					_info("Questo è il tuo [b]campo[/b]: le terre che hai in gioco. C'è un posto per ogni tipo, e il numero indica quante terre di quel tipo hai.", "bf:me"),
					_info("In alto c'è il campo del Maestro. Le sue carte in mano le vedi coperte: sai quante sono, ma non quali.", "bf:opp"),
					_info("In basso c'è la tua [b]mano[/b]: le carte che puoi giocare. Il Maestro le vede coperte.", "hand"),
					_info("Accanto al tuo nome ci sono il [b]mazzo[/b], con le carte che restano da pescare, e il [b]cimitero[/b], dove finiscono le terre distrutte o scartate.", "deckgy:me"),
					_info("Come funziona un turno: all'inizio peschi una carta (chi inizia la partita salta la prima pescata). Poi puoi giocare [b]una sola terra[/b], oppure passare il turno."),
					_info("Ogni terra ha un [b]effetto[/b] che si attiva quando entra in gioco. Te li presento uno alla volta, mentre giochi."),
					_info("Quando giochi una terra, l'avversario può provare a fermarla prima che entri in gioco: si chiama [b]contrasto[/b]. Lo vedremo più avanti."),
					_info("Cominciamo con l'[b]Isola[/b]. Il suo effetto: quando entra in gioco [b]peschi una carta[/b].", "hand:U"),
					_play("U", _how("l'[b]Isola[/b]")),
				]
			3:
				return [
					_info("La Montagna del Maestro ha distrutto la tua Isola. Le terre distrutte finiscono nel [b]cimitero[/b]: tocca il segnalino accanto al tuo nome per vedere cosa contiene.", "gy:me"),
					_info("A inizio turno hai pescato una carta. Ora ti presento la [b]Foresta[/b]: quando entra in gioco [b]riprendi in mano una terra dal tuo cimitero[/b].", "hand:G"),
					_play("G", _how("la [b]Foresta[/b]") + " Poi tocca l'Isola nel cimitero."),
				]
			5:
				return [
					_info("La Palude ti ha fatto scartare una carta, ma la Foresta ti aveva già fatto recuperare l'Isola: ce l'hai di nuovo in mano."),
					_info("La [b]Montagna[/b]: quando entra in gioco [b]distrugge una terra dell'avversario[/b], a tua scelta.", "hand:R"),
					_play("R", _how("la [b]Montagna[/b]") + " Poi tocca una terra del Maestro."),
				]
			7:
				return [
					_info("Contrasto riuscito: la Montagna del Maestro è finita nel suo cimitero senza effetto, e la tua Foresta è salva."),
					_info("La [b]Pianura[/b]: quando entra in gioco [b]ripete l'effetto di un'altra tua terra già in gioco[/b]. Sulla Montagna, per esempio, distrugge un'altra terra avversaria.", "hand:W"),
					_play("W", _how("la [b]Pianura[/b]") + " Poi tocca la tua Montagna."),
				]
			9:
				return [
					_info("Hai in gioco Foresta, Montagna e Pianura: tre tipi su cinque. Ti mancano l'Isola e la Palude.", "bf:me"),
					_info("Non sei obbligato a giocare una terra ogni turno. Puoi [b]passare il turno[/b]: per esempio per tenerti un'Isola in mano e poter contrastare l'avversario."),
					{"text": "Prova: premi [b]«Passa il turno»[/b]. Il turno va al Maestro senza che tu giochi nulla.", "hl": "btn:Passa il turno", "pass": true,
						"allow": func(a): return a.type == "pass", "wrong": "In questo passaggio premi «Passa il turno»."},
				]
			11:
				return [_play("U", "Ora gioca l'[b]Isola[/b]: pescherai una carta e avrai quattro tipi di terra in gioco. " + _how("l'[b]Isola[/b]"))]
			13:
				return [
					_info("Hai quattro tipi diversi in gioco. Il punto esclamativo rosso accanto al tuo nome avvisa che sei a un passo dalla vittoria; lo vedrai anche accanto all'avversario, quando sarà lui a esserlo.", "name:me"),
					_info("La [b]Palude[/b]: quando entra in gioco guardi la mano dell'avversario e scegli una terra che dovrà scartare. Ma qui basta che entri in gioco: è il quinto tipo che ti manca.", "hand:B"),
					_play("B", "Gioca la [b]Palude[/b] e vinci. " + _how("la [b]Palude[/b]")),
				]
	if task == "response":
		match T:
			2:
				return [
					_info("Il Maestro ha giocato una [b]Montagna[/b]: distrugge una terra dell'avversario. La freccia indica il bersaglio: la tua Isola."),
					_info("La sua terra non è ancora entrata in gioco. Adesso puoi [b]contrastarla[/b] (lo impareremo tra poco) oppure [b]lasciarla risolvere[/b]: in quel caso entra in gioco e il suo effetto si applica."),
					_allow_page("Questa volta premi [b]«Lascia risolvere»[/b]."),
				]
			4:
				return [
					_info("Il Maestro ha giocato una [b]Palude[/b]: quando entra in gioco guarda la tua mano e sceglie una terra che dovrai scartare nel cimitero."),
					_allow_page("Premi [b]«Lascia risolvere»[/b]."),
				]
			6:
				if t.counter_mode:
					if t.pick != null:
						return [{"text": "Premi [b]«Conferma»[/b]: l'Isola e la terra scelta vanno nel tuo cimitero, e la Montagna del Maestro ci finisce senza effetto.",
							"hl": "btn:Conferma", "allow": func(a): return a.type == "counter"}]
					return [{"text": "L'Isola è già stata scelta da sola: è quella segnata in rosso. Ora tocca nella tua mano [b]un'altra terra qualsiasi[/b] da scartare insieme a lei.",
						"allow": func(a): return a.type == "counter"}]
				return [
					_info("Il Maestro gioca un'altra [b]Montagna[/b], questa volta contro la tua Foresta. Fermalo con un [b]contrasto[/b]."),
					_info("Il contrasto si può fare [b]solo se hai un'Isola in mano[/b]. Si scartano due carte: l'Isola più un'altra terra a tua scelta. La terra dell'avversario finisce nel cimitero e il suo effetto non avviene.", "hand:U"),
					_info("Quando premi «Contrasta», l'Isola viene [b]scelta automaticamente[/b]: tu devi solo toccare la seconda terra da scartare, poi confermare."),
					_info("Attenzione: anche l'avversario può contrastare il tuo contrasto, se ha un'Isola. Vince chi contrasta per ultimo."),
					{"text": "Premi [b]«Contrasta»[/b].", "hl": "btn:Contrasta", "allow": func(a): return a.type == "counter",
						"wrong": "In questo passaggio premi «Contrasta»."},
				]
			8:
				return [
					_info("Il Maestro ha giocato una [b]Pianura[/b], ma non ha altre terre in gioco da riattivare: entrerà in gioco senza effetto."),
					_allow_page("Non hai Isole in mano, quindi non puoi contrastare. Premi [b]«Lascia risolvere»[/b]."),
				]
			10:
				return [
					_info("Il Maestro ha giocato una [b]Foresta[/b] per riprendere una terra dal suo cimitero. Hai un'Isola in mano: potresti contrastarla."),
					_info("Ma contrastare costa due carte, e la Foresta del Maestro non ti danneggia. In più l'Isola ti serve per vincere: conviene tenerla."),
					_allow_page("Premi [b]«Lascia risolvere»[/b]."),
				]
			12:
				return [_allow_page("Il Maestro gioca una [b]Pianura[/b] per ripetere l'effetto della sua Foresta. Non ti danneggia: premi [b]«Lascia risolvere»[/b].")]
		return [_allow_page("Premi [b]«Lascia risolvere»[/b].")]
	if task == "choice" and T == 7:
		return [{"text": "La Pianura ripete l'effetto della Montagna: tocca la terra del Maestro da distruggere."}]
	return []


## La pagina dal vivo del momento attuale (o null).
func live():
	if t.V.is_empty() or t.V.phase != "playing" or t.busy:
		return null
	if waiting:
		var txt: String = "Il Maestro ha guardato la tua mano: ora sceglie quale terra farti scartare." if t.g.step == "choice" else WAIT_TEXT.get(int(t.V.turn), "Tocca al Maestro.")
		return {"key": "wait|%d|%s" % [t.V.turn, t.g.step], "page": {"text": txt, "go": true}, "last": true, "i": 0}
	var ps := pages()
	if ps.is_empty():
		return null
	var k := "%d|%s|%s|%s%s" % [t.V.turn, t._task(), "st" if t.staged != null else "", "c" if t.counter_mode else "", "p" if t.pick != null else ""]
	if k != key:
		key = k
		page = 0
		back = 0
	var i := mini(page, ps.size() - 1)
	return {"key": k, "page": ps[i], "last": i == ps.size() - 1, "i": i}


## Quello che il riquadro mostra: una pagina già letta (Indietro) oppure quella dal vivo.
func shown():
	var L = live()
	if L == null:
		return null
	var id := "%s#%d" % [L.key, L.i]
	if history.is_empty() or history[-1].id != id:
		history.append({"id": id, "text": L.page.text})
	if back > 0:
		return {"review": true, "text": history[history.size() - 1 - back].text}
	var p: Dictionary = L.page.duplicate()
	p.info = not L.last
	return p


func next() -> void:
	if back > 0:
		back -= 1
	elif waiting and shown() != null and shown().get("go", false):
		waiting = false
		go.emit()
	else:
		page += 1
	t._refresh()


func prev() -> void:
	if back < history.size() - 1:
		back += 1
	t._refresh()


## false se la mossa non è quella che il tutorial chiede (e spiega perché).
func allows(a: Dictionary) -> bool:
	var P = shown()
	if P == null:
		return true
	if P.get("review", false):
		t._toast("Stai rileggendo: premi «Avanti» per tornare al punto in cui eri")
		return false
	if P.get("info", false) or P.get("go", false):
		t._toast("Premi «Avanti» per continuare")
		return false
	if not P.has("allow") or P.allow.call(a):
		return true
	t._toast(P.get("wrong", "Segui il consiglio del tutorial"))
	return false


func wants_pass() -> bool:
	var P = shown()
	return P != null and P.get("pass", false) and not P.get("review", false)


## Il Maestro aspetta «Avanti» prima di giocare.
func wait_go() -> void:
	waiting = true
	t._refresh()
	await go


# ---------------------------------------------------------------- disegno

## Riposiziona il riquadro e cerchia l'elemento di cui si parla (dopo ogni _refresh del tavolo).
func update() -> void:
	if _panel == null:
		return
	size = t.size
	var P = shown()
	if t.tut_idx != -1 and (P == null or not P.has("card")):
		t.tut_idx = -1
		t._place_hand(true)
	_rings = []
	_tag_rect = Rect2()
	visible = P != null
	if P == null:
		queue_redraw()
		return
	_note.visible = P.get("review", false)
	_text.text = P.text
	_back_btn.visible = back < history.size() - 1
	_fwd_btn.visible = P.get("review", false) or P.get("info", false) or P.get("go", false)
	var fs := int(clampf(t._fs.get("status", 14) as float, 13, 18))
	for f in ["normal_font_size", "bold_font_size"]:
		_text.add_theme_font_size_override(f, fs)
	# dove sta il riquadro: sopra il centro del tavolo (come Tut.place in tutorial.js)
	var c: Rect2 = t.center_rect
	var w: float
	var pos: Vector2
	if t.lay == "portrait":
		w = minf(t.size.x * 0.92, 460.0)
		pos = Vector2((t.size.x - w) / 2, c.position.y + 2)
	elif t.lay == "wide":
		w = minf(t.size.x * 0.27, 480.0)
		pos = Vector2(maxf(16, c.position.x + 8), 0)
	else:
		w = c.size.x
		pos = Vector2(c.position.x, c.position.y + 34)
	_panel.custom_minimum_size.x = w
	_text.custom_minimum_size.x = w - 28  # il testo deve sapere quanto è largo per calcolare l'altezza
	_text.size.x = w - 28
	_panel.size = Vector2(w, 0)
	_panel.reset_size()
	var h := _panel.get_combined_minimum_size().y
	if t.lay == "wide":
		pos.y = c.get_center().y - h / 2
	_panel.position = pos
	_panel.size = Vector2(w, h)
	if not P.get("review", false):
		_highlight(P)
	queue_redraw()


func _highlight(P: Dictionary) -> void:
	var hl: String = P.get("hl", "")
	if hl == "":
		return
	var parts := hl.split(":", true, 1)
	var what := parts[0]
	var arg := parts[1] if parts.size() > 1 else ""
	match what:
		"hand":
			if arg == "":
				var r := Rect2()
				for c in t.hand_cards:
					var cr: Rect2 = t.hand_card_rect(c)
					r = cr if r.size == Vector2.ZERO else r.merge(cr)
				_rings.append(r.grow(6))
			else:
				for i in t.hand_cards.size():
					var c: Control = t.hand_cards[i]
					if c.kind == arg and c.visible:
						# la carta da usare si alza e porta l'etichetta; le altre si spengono
						if P.has("card"):
							for o in t.hand_cards:
								if o != c:
									o.modulate.a = 0.45
							if t.tut_idx != i:
								t.tut_idx = i
								t._place_hand(true)
						var cr: Rect2 = t.hand_card_rect(c)
						if P.has("card"):
							_tag_rect = Rect2(cr.position + Vector2(0, -28), Vector2(cr.size.x, 22))
						_rings.append(cr.grow(5))
						break
		"bf":
			var z = t.zones[arg]
			_rings.append(t._lr(z.slots["W"]).merge(t._lr(z.slots["G"])).grow(6))
		"gy":
			_rings.append(t._lr(t.zones[arg].gy).grow(4))
		"deckgy":
			_rings.append(t._lr(t.zones[arg].deck).grow(4))
			_rings.append(t._lr(t.zones[arg].gy).grow(4))
		"name":
			_rings.append(t._lr(t.zones[arg].name).merge(t._lr(t.zones[arg].near)).grow(6))
		"btn":
			for b in _buttons(t.actions):
				if b.text == arg:
					_rings.append(t._lr(b).grow(5))


func _buttons(n: Node) -> Array:
	var out := []
	for c in n.get_children():
		if c is Button:
			out.append(c)
		out.append_array(_buttons(c))
	return out


func _draw() -> void:
	var k := 0.5 + 0.5 * sin(_t * TAU)
	var screen := Rect2(Vector2(4, 4), size - Vector2(8, 8))
	for r0 in _rings:
		var r: Rect2 = r0.intersection(screen)
		draw_style_box(Art.box(Color(0, 0, 0, 0), 12, Color(Art.SEGNALE, 0.35 + 0.35 * k), 3), r.grow(4))
		draw_style_box(Art.box(Color(0, 0, 0, 0), 10, Art.SEGNALE, 3), r)
	if _tag_rect.has_area():
		var f := Art.bold()
		var txt := "Gioca questa"
		var tw := f.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x + 16
		var r := Rect2(_tag_rect.get_center().x - tw / 2, _tag_rect.position.y, tw, 22)
		draw_style_box(Art.box(Art.SEGNALE, 11), r)
		draw_string(f, Vector2(r.position.x + 8, r.position.y + 15), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Art.INK)
