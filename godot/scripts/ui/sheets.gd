## Finestre e pannelli condivisi tra home e tavolo: regole, obiettivi, profilo con le statistiche,
## profili e trasferimento. Tutto si rimpicciolisce per stare nello schermo: mai scorrere.
extends RefCounted

const Art := preload("res://scripts/ui/art.gd")
const W := preload("res://scripts/ui/widgets.gd")
const Profile := preload("res://scripts/app/profile.gd")
const Prefs := preload("res://scripts/app/prefs.gd")
const TYPES := ["W", "U", "B", "R", "G"]


## Velo + foglio di carta centrato. Restituisce il contenitore in cui aggiungere i contenuti;
## dopo averli aggiunti si chiama fit(). `host` è il nodo che riceve il velo (a tutto schermo).
static func sheet(host: Control, name: String, width := 400.0) -> VBoxContainer:
	var veil := ColorRect.new()
	veil.name = name
	veil.color = Color(Art.TAVOLO2, 0.82)
	veil.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)  # copre il genitore, qualunque misura abbia
	host.add_child(veil)
	var panel := PanelContainer.new()
	var sb := Art.box(Art.FOGLIO, 22, Art.FOGLIO_BORDO, 1)
	for m in ["left", "right", "top", "bottom"]:
		sb.set("content_margin_" + m, 22)
	sb.shadow_color = Art.OMBRA
	sb.shadow_size = 30
	panel.add_theme_stylebox_override("panel", sb)
	veil.add_child(panel)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	panel.add_child(v)
	v.set_meta("panel", panel)
	v.set_meta("width", width)
	veil.resized.connect(fit.bind(v))
	return v


static func fit(v: VBoxContainer) -> void:
	if not is_instance_valid(v):
		return
	fit_panel(v.get_meta("panel"), float(v.get_meta("width")))


## Centra un foglio nel suo velo e, se non ci sta (in altezza o in larghezza), lo rimpicciolisce
## tutto insieme: mai scorrere, mai uscire dallo schermo. Si ripete ai due fotogrammi successivi,
## perché i testi a capo conoscono la loro altezza solo dopo aver ricevuto la larghezza.
static func fit_panel(panel: Control, want_w: float) -> void:
	_do_fit(panel, want_w)
	var tree := panel.get_tree()
	if tree == null:
		return
	tree.process_frame.connect(func(): _do_fit(panel, want_w), CONNECT_ONE_SHOT)
	tree.create_timer(0.05).timeout.connect(func(): _do_fit(panel, want_w))


static func _do_fit(panel: Control, want_w: float) -> void:
	if not is_instance_valid(panel) or panel.get_parent() == null:
		return
	var S: Vector2 = (panel.get_parent() as Control).size
	if S.x < 10 or S.y < 10:
		return
	var w := minf(want_w, S.x - 24)
	panel.scale = Vector2.ONE
	panel.custom_minimum_size.x = w
	panel.size = Vector2(w, 0)
	panel.reset_size()
	var ps := panel.get_combined_minimum_size()
	ps.x = maxf(ps.x, w)
	var k := minf(1.0, minf((S.y - 24) / ps.y, (S.x - 24) / ps.x))
	panel.pivot_offset = Vector2.ZERO
	panel.scale = Vector2(k, k)
	panel.size = ps
	panel.position = (S - ps * k) / 2


static func close(n: Node) -> void:
	if n != null and n.get_parent():
		n.get_parent().remove_child(n)
		n.queue_free()


static func title(text: String, fs := 22) -> Label:
	var t := W.label(text, fs, Art.TESTO, Art.bold())
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return t


static func para(text: String, fs := 15, color := Color(0, 0, 0, 0), center := true) -> Label:
	var l := W.label(text, fs, color if color.a > 0 else Color(Art.TESTO, 0.75), Art.serif())
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	if center:
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return l


static func h4(text: String) -> Label:
	var l := W.label(text, 13, Color(Art.TESTO, 0.6), Art.bold())
	return l


static func rich(bbcode: String, fs := 14) -> RichTextLabel:
	var r := RichTextLabel.new()
	r.bbcode_enabled = true
	r.fit_content = true
	r.scroll_active = false
	r.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	r.add_theme_font_override("normal_font", Art.sans())
	r.add_theme_font_override("bold_font", Art.bold())
	r.add_theme_font_override("italics_font", Art.serif())
	for f in ["normal_font_size", "bold_font_size", "italics_font_size"]:
		r.add_theme_font_size_override(f, fs)
	r.add_theme_color_override("default_color", Art.TESTO)
	r.add_theme_constant_override("line_separation", 3)
	r.text = bbcode
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return r


static func button(text: String, kind: String, cb: Callable, fs := 15) -> Button:
	var b := W.button(text, kind, fs)
	b.pressed.connect(cb)
	return b


# ---------------------------------------------------------------- regole

static func rules(host: Control) -> void:
	var v := sheet(host, "Regole", 520)
	v.add_child(title("Regole"))
	v.add_child(rich(
		"[b]Obiettivo[/b]  Avere in gioco una terra di ogni tipo, oppure 5 terre dello stesso tipo. Si vince appena la terra entra in gioco.\n" +
		"[b]Preparazione[/b]  Mazzo da 50 carte, 10 per tipo. Si pescano 5 carte, niente mulligan. Chi inizia salta la prima pescata.\n" +
		"[b]Turno[/b]  Peschi una carta, poi puoi giocare [b]una[/b] terra (o passare). L'effetto si attiva quando entra in gioco.\n" +
		"[b]Pianura[/b]: riattiva l'effetto di un'altra tua terra in gioco (non Pianura).\n" +
		"[b]Isola[/b]: quando entra peschi 1 carta. Dalla mano, scartala con un'altra terra per contrastare la terra appena giocata dall'avversario (e il suo effetto). Anche un contrasto può essere contrastato.\n" +
		"[b]Palude[/b]: guardi la mano avversaria e scegli una terra da scartare.\n" +
		"[b]Montagna[/b]: distruggi una terra avversaria in gioco.\n" +
		"[b]Foresta[/b]: riprendi in mano una terra dal tuo cimitero.\n" +
		"Senza bersagli la terra si gioca comunque, senza effetto.\n" +
		"[b]Comandi[/b]  Porta la carta al centro (trascinandola, o toccandola e poi toccando il centro). Se ha un bersaglio, tocca poi la carta da colpire: terra avversaria per la Montagna, tua terra per la Pianura, carta nel tuo cimitero per la Foresta. Tenendo premuta una carta la vedi in grande.\n" +
		"[b]Tempo[/b]  Se il tempo scade passi il turno; se scade durante una risposta la terra avversaria risolve.\n" +
		"[b]Carte finite[/b]  Se un mazzo è vuoto non si pesca. Quando entrambi i mazzi sono vuoti e nessuno può o vuole più giocare, vince chi ha più tipi di terra diversi in gioco; in parità vince chi ha giocato l'ultima terra.", 14))
	var veil: Node = v.get_meta("panel").get_parent()
	v.add_child(button("Chiudi", "ink", func(): close(veil)))
	fit(v)


# ---------------------------------------------------------------- obiettivi

## Gli obiettivi: tutta la larghezza dello schermo, una riga per obiettivo con il nome in grande, la
## descrizione sotto e, accanto, in piccolo, l'oggetto che sblocca (il dorso o il cielo del tavolo).
static func goals(host: Control) -> void:
	var a := Profile.load_profile(Prefs.player_name())
	var got: Dictionary = a.get("goals", {})
	var v := sheet(host, "Obiettivi", minf(host.size.x - 16, 620.0))
	v.add_theme_constant_override("separation", 8)
	var n := 0
	for g in Profile.GOALS:
		if got.has(g.id):
			n += 1
	var head := HBoxContainer.new()
	var t := W.label("Obiettivi", 24, Art.TESTO, Art.bold())
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(t)
	head.add_child(W.label("%d / %d" % [n, Profile.GOALS.size()], 18, Art.SEGNALE, Art.semi()))
	v.add_child(head)
	var cols := 2 if host.size.x >= 700 else 1
	var grid := GridContainer.new()
	grid.columns = cols
	grid.add_theme_constant_override("h_separation", 16)
	grid.add_theme_constant_override("v_separation", 4)
	for g in Profile.GOALS:
		var ok: bool = got.has(g.id)
		var row := HBoxContainer.new()
		row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_theme_constant_override("separation", 10)
		var mark := Control.new()
		mark.custom_minimum_size = Vector2(22, 22)
		mark.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		mark.draw.connect(func():
			var c := Vector2(11, 11)
			if ok:
				mark.draw_circle(c, 11, Art.LAND.G)
				mark.draw_polyline(PackedVector2Array([c + Vector2(-5, 0), c + Vector2(-1, 4), c + Vector2(6, -4)]), Color.WHITE, 2.2, true)
			else:
				mark.draw_arc(c, 10, 0, TAU, 32, Color(1, 1, 1, 0.3), 1.5, true))
		row.add_child(mark)
		var txt := VBoxContainer.new()
		txt.add_theme_constant_override("separation", 0)
		txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		txt.add_child(W.label(g.name, 15, Art.TESTO if ok else Color(Art.TESTO, 0.85), Art.semi()))
		var d := W.label(g.desc, 13, Color(Art.TESTO, 0.65))
		d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		d.custom_minimum_size.x = 120
		txt.add_child(d)
		row.add_child(txt)
		if g.has("reward"):
			row.add_child(_reward_preview(g.reward, ok))
		grid.add_child(row)
	v.add_child(grid)
	var veil: Node = v.get_meta("panel").get_parent()
	v.add_child(button("Chiudi", "ink", func(): close(veil)))
	fit(v)


## L'oggetto sbloccato da un obiettivo, in piccolo: un dorso di carta o un cielo con le colline.
static func _reward_preview(reward: Dictionary, unlocked: bool) -> Control:
	var c := Control.new()
	var is_back: bool = reward.kind == "back"
	c.custom_minimum_size = Vector2(30, 42) if is_back else Vector2(48, 34)
	c.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	c.tooltip_text = reward.name
	c.draw.connect(func():
		var r := Rect2(Vector2.ZERO, c.size)
		if is_back:
			Art.draw_tex(c, "bk-" + reward.id, r)
		else:
			var sky: Array = Art.Scenery.SKIES[reward.id]
			var sb := Art.box(Color(sky[1]), 6)
			c.draw_style_box(sb, r)
			Art.draw_vgrad(c, r.grow(-2), Color(sky[0]), Color(sky[1]))
			var hh := r.size.x * 0.3
			Art.draw_tex(c, "hills-" + reward.id, Rect2(r.position.x + 2, r.end.y - hh - 2, r.size.x - 4, hh))
		if not unlocked:
			c.draw_style_box(Art.box(Color(Art.TAVOLO, 0.55), 6), r)
			var lt := Art.line_icon("lock", "<rect x=\"5\" y=\"11\" width=\"14\" height=\"10\" rx=\"2\"/><path d=\"M8 11V8a4 4 0 0 1 8 0v3\"/>", Art.TESTO, 14)
			c.draw_texture_rect(lt, Rect2(r.get_center() - Vector2(7, 7), Vector2(14, 14)), false))
	return c


# ---------------------------------------------------------------- profilo

## Il pannello Profilo con le statistiche (`side`: "cpu" o "pvp"). on_side(side) per cambiare lato,
## on_transfer() per aprire profili e trasferimento.
static func profile_panel(side: String, on_side: Callable, on_transfer: Callable) -> VBoxContainer:
	var a := Profile.load_profile(Prefs.player_name())
	var s: Dictionary = a[side]
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 9)
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 12)
	var av := Control.new()
	av.custom_minimum_size = Vector2(54, 54)
	var initial: String = (a.name as String).strip_edges().substr(0, 1).to_upper()
	av.draw.connect(func():
		av.draw_circle(Vector2(27, 27), 27, Color(1, 1, 1, 0.5))
		av.draw_circle(Vector2(27, 27), 25, Art.CARTA)
		av.draw_circle(Vector2(27, 27), 22, Color("#3d3577"))
		var f := Art.bold()
		var tw := f.get_string_size(initial, HORIZONTAL_ALIGNMENT_LEFT, -1, 25).x
		av.draw_string(f, Vector2(27 - tw / 2, 27 + f.get_ascent(25) * 0.36), initial, HORIZONTAL_ALIGNMENT_LEFT, -1, 25, Art.CARTA))
	head.add_child(av)
	var who := VBoxContainer.new()
	who.add_theme_constant_override("separation", 0)
	who.add_child(W.label(a.name, 20, Art.TESTO, Art.bold()))
	var total := int(a.cpu.played) + int(a.pvp.played)
	var sub := "Ancora nessuna partita: le statistiche si riempiono giocando." if total == 0 else \
		"%d %s%s" % [total, "partita giocata" if total == 1 else "partite giocate", " · tutorial completato" if a.tutorial else ""]
	var sl := W.label(sub, 12, Color(Art.TESTO, 0.65))
	sl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	sl.custom_minimum_size.x = 200
	who.add_child(sl)
	who.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(who)
	v.add_child(head)
	var seg := HBoxContainer.new()
	for o in [["cpu", "Contro il computer"], ["pvp", "Contro giocatori"]]:
		var b := W.button(o[1], "ink" if side == o[0] else "ghost_ink", 13)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var id: String = o[0]
		b.pressed.connect(func(): on_side.call(id))
		seg.add_child(b)
	v.add_child(seg)
	# anello con la percentuale di vittorie e tre numeri
	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 12)
	var pct := int(round(100.0 * s.won / s.played)) if s.played > 0 else 0
	var ring := Control.new()
	ring.custom_minimum_size = Vector2(80, 80)
	ring.draw.connect(func():
		ring.draw_arc(Vector2(40, 40), 34, 0, TAU, 64, Color(Art.TESTO, 0.12), 8, true)
		if pct > 0:
			ring.draw_arc(Vector2(40, 40), 34, -PI / 2, -PI / 2 + TAU * pct / 100.0, 64, Art.TESTO, 8, true)
		var f := Art.bold()
		var t := "%d%%" % pct
		var tw := f.get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, 19).x
		ring.draw_string(f, Vector2(40 - tw / 2, 44), t, HORIZONTAL_ALIGNMENT_LEFT, -1, 19, Art.TESTO)
		var f2 := Art.sans()
		var tw2 := f2.get_string_size("vinte", HORIZONTAL_ALIGNMENT_LEFT, -1, 10).x
		ring.draw_string(f2, Vector2(40 - tw2 / 2, 57), "vinte", HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color(Art.TESTO, 0.6)))
	top.add_child(ring)
	for k in [[s.played, "partite"], [s.best, "serie migliore"], [s.fastest if s.fastest else "–", "turni, vittoria più rapida"]]:
		var box := VBoxContainer.new()
		box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		box.add_theme_constant_override("separation", 0)
		var n := W.label(str(int(k[0])) if not k[0] is String else k[0], 24, Art.TESTO, Art.bold())
		n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		box.add_child(n)
		var l := W.label(k[1], 11, Color(Art.TESTO, 0.7))
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.custom_minimum_size.x = 60
		box.add_child(l)
		top.add_child(box)
	v.add_child(top)
	v.add_child(h4("Terre giocate"))
	var maxl := 1
	for t in TYPES:
		maxl = maxi(maxl, int(s.lands[t]))
	for t in TYPES:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		var ico := TextureRect.new()
		ico.texture = Art.tex("ico-" + t, 20)
		ico.custom_minimum_size = Vector2(20, 20)
		ico.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ico.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		row.add_child(ico)
		var bar := Control.new()
		bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		bar.custom_minimum_size.y = 20
		var k2: float = float(s.lands[t]) / maxl
		bar.draw.connect(func():
			var r := Rect2(0, 5, bar.size.x, 10)
			bar.draw_style_box(Art.box(Color(Art.TESTO, 0.08), 5), r)
			if k2 > 0:
				bar.draw_style_box(Art.box(Art.TESTO, 5), Rect2(0, 5, maxf(10, bar.size.x * k2), 10)))
		row.add_child(bar)
		var num := W.label(str(int(s.lands[t])), 13, Art.TESTO, Art.bold())
		num.custom_minimum_size.x = 34
		num.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		row.add_child(num)
		v.add_child(row)
	var cols := HBoxContainer.new()
	cols.add_theme_constant_override("separation", 16)
	var res := [["Facile", "%d / %d" % [s.modes.easy.w, s.modes.easy.p]], ["Normale", "%d / %d" % [s.modes.normal.w, s.modes.normal.p]],
		["Difficile", "%d / %d" % [s.modes.hard.w, s.modes.hard.p]]] if side == "cpu" else \
		[["Vinte", str(int(s.won))], ["Perse", str(int(s.lost))], ["Pari", str(int(s.draw))]]
	cols.add_child(_rows("Vittorie" if side == "cpu" else "Risultati", res))
	cols.add_child(_rows("Come vinci", [["Cinque diverse", str(int(s.winBy.domain))], ["Cinque uguali", str(int(s.winBy.five))], ["Carte finite", str(int(s.winBy.cards))]]))
	v.add_child(cols)
	var more := W.label("Contrasti fatti  %d      Terre distrutte  %d" % [s.counters, s.destroyed], 13, Color(Art.TESTO, 0.75))
	more.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(more)
	v.add_child(button("Profili e trasferimento", "ghost_ink", on_transfer, 13))
	return v


static func _rows(head: String, rows: Array) -> VBoxContainer:
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_theme_constant_override("separation", 3)
	v.add_child(h4(head))
	for r in rows:
		var h := HBoxContainer.new()
		var a := W.label(r[0], 13, Art.TESTO)
		a.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		h.add_child(a)
		h.add_child(W.label(r[1], 13, Art.TESTO, Art.bold()))
		v.add_child(h)
	return v


# ---------------------------------------------------------------- trasferimento

static func transfer(host: Control, on_change: Callable) -> void:
	var name := Prefs.player_name()
	var v := sheet(host, "Trasferimento", 440)
	var veil: Node = v.get_meta("panel").get_parent()
	v.add_child(title("Profili e trasferimento"))
	v.add_child(para("Le statistiche seguono il nome con cui giochi e restano su questo dispositivo.", 14))
	var others := []
	for n in Profile.profile_names():
		if Profile.key_of(n) != Profile.key_of(name):
			others.append(n)
	if not others.is_empty():
		v.add_child(h4("Altri profili su questo dispositivo"))
		var flow := HFlowContainer.new()
		for n in others:
			var b := W.button(n, "ghost_ink", 13)
			var nn: String = n
			b.pressed.connect(func():
				Prefs.set_value("name", nn)
				close(veil)
				on_change.call())
			flow.add_child(b)
		v.add_child(flow)
	v.add_child(h4("Su un altro dispositivo (anche la versione nel browser)"))
	v.add_child(para("Copia il codice e incollalo nel Profilo dell'altro telefono o computer.", 13, Color(0, 0, 0, 0), false))
	var code := LineEdit.new()
	code.placeholder_text = "Incolla un codice"
	code.add_theme_font_size_override("font_size", 13)
	code.add_theme_color_override("font_color", Art.TESTO)
	var es := Art.box(Color(1, 1, 1, 0.08), 12, Color(1, 1, 1, 0.2), 1)
	es.content_margin_left = 10
	es.content_margin_right = 10
	es.content_margin_top = 8
	es.content_margin_bottom = 8
	code.add_theme_stylebox_override("normal", es)
	code.add_theme_stylebox_override("focus", es)
	var msg := para("", 13)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	var copy := W.button("Copia codice", "ink", 13)
	copy.pressed.connect(func():
		DisplayServer.clipboard_set(Profile.export_code(name))
		msg.text = "Codice copiato.")
	row.add_child(copy)
	code.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(code)
	var imp := W.button("Importa", "ink", 13)
	imp.pressed.connect(func():
		var n := Profile.import_code(code.text)
		if n == "":
			msg.text = "Codice non valido."
			return
		Prefs.set_value("name", n)
		close(veil)
		on_change.call())
	row.add_child(imp)
	v.add_child(row)
	v.add_child(msg)
	v.add_child(button("Chiudi", "ink", func(): close(veil)))
	fit(v)
