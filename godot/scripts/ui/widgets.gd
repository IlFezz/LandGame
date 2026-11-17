## Elementi del tavolo nello stile «Orizzonti», disegnati da codice: caselle del campo (paesaggi
## quadrati con il numero sotto), pillole (mano, mazzo, cimitero), pulsanti, sfondo con il cielo e
## le colline. Come card_view.gd, si ridisegnano solo quando cambiano.
extends RefCounted

const Art := preload("res://scripts/ui/art.gd")
const Card := preload("res://scripts/ui/card_view.gd")


## Pulsante a pillola. kind: "pass"/"primary"/"ink" (crema), "counter" (azzurro Isola),
## "ghost" (solo testo), "dark"/"ghost_ink" (vetro), "exit" (rosso), "full" (oro).
static func button(text: String, kind := "dark", fs := 15) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_NONE
	style_button(b, kind, fs)
	return b


static func style_button(b: Button, kind: String, fs: int) -> void:
	var fill := Art.VETRO
	var fg := Art.TESTO
	var border := Color(1, 1, 1, 0.14)
	match kind:
		"pass", "primary", "ink":
			fill = Art.CARTA
			fg = Art.INK
			border = Art.CARTA
		"counter":
			fill = Art.LAND.U
			fg = Color.WHITE
			border = Art.LAND.U
		"ghost":
			fill = Color(0, 0, 0, 0)
			fg = Color(Art.TESTO, 0.85)
			border = Color(0, 0, 0, 0)
		"exit":
			fill = Art.ROSSO
			fg = Color.WHITE
			border = Art.ROSSO
		"full":
			fill = Art.SEGNALE
			fg = Art.INK
			border = Art.SEGNALE
	var pad_x := fs * 1.4
	var pad_y := fs * 0.8
	var rad := fs * 1.36  # pillola: angoli tondi poco meno di metà altezza (se no si vede una giuntura)
	for state in ["normal", "hover", "pressed", "disabled"]:
		var f := fill
		if state == "hover":
			f = fill.lightened(0.08) if fill.a > 0.5 else Color(1, 1, 1, fill.a + 0.06)
		elif state == "pressed":
			f = fill.darkened(0.08) if fill.a > 0.5 else Color(1, 1, 1, fill.a + 0.1)
		var sb := Art.box(f, rad, border, 1.2 if border.a > 0 else 0.0)
		sb.content_margin_left = pad_x
		sb.content_margin_right = pad_x
		sb.content_margin_top = pad_y
		sb.content_margin_bottom = pad_y
		b.add_theme_stylebox_override(state, sb)
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	for c in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color"]:
		b.add_theme_color_override(c, fg)
	b.add_theme_font_override("font", Art.semi() if kind != "ghost" else Art.sans())
	b.add_theme_font_size_override("font_size", fs)
	# un piccolo "respiro" quando si preme: il pulsante si abbassa di poco
	if not b.has_meta("respiro"):
		b.set_meta("respiro", true)
		b.button_down.connect(func():
			b.pivot_offset = b.size / 2
			b.create_tween().tween_property(b, "scale", Vector2(0.96, 0.96), 0.06))
		b.button_up.connect(func():
			if is_instance_valid(b):
				b.create_tween().tween_property(b, "scale", Vector2.ONE, 0.14).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT))


const MENU_ICON := "<path d=\"M5 7h14M5 12h14M5 17h14\"/>"


## Pulsante tondo di vetro con un'icona a tratto disegnata esattamente al centro.
static func icon_button(paths: String, key: String, icon_size := 20.0) -> Button:
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.flat = true
	for st in ["normal", "hover", "pressed", "focus"]:
		b.add_theme_stylebox_override(st, StyleBoxEmpty.new())
	b.draw.connect(func():
		var r := minf(b.size.x, b.size.y) / 2
		var c := b.size / 2
		var on := b.is_pressed() or b.is_hovered()
		b.draw_circle(c, r, Color(1, 1, 1, 0.16 if on else 0.10))
		b.draw_arc(c, r - 0.5, 0, TAU, 64, Color(1, 1, 1, 0.14), 1.0, true)
		var t := Art.line_icon(key, paths, Art.TESTO, icon_size)
		b.draw_texture_rect(t, Rect2(c - Vector2(icon_size, icon_size) / 2, Vector2(icon_size, icon_size)), false))
	b.mouse_entered.connect(b.queue_redraw)
	b.mouse_exited.connect(b.queue_redraw)
	b.button_down.connect(b.queue_redraw)
	b.button_up.connect(b.queue_redraw)
	return b


static func label(text := "", fs := 15, color = null, font: Font = null) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", font if font != null else Art.sans())
	l.add_theme_font_size_override("font_size", fs)
	l.add_theme_color_override("font_color", color if color != null else Art.TESTO)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


## Casella del campo: il paesaggio della terra (spento se vuota) e sotto il numero.
## Se è la terra che manca per vincere: contorno tratteggiato azzurro con «+».
class Slot extends Control:
	var land := "W"
	var count := 0
	var card_mode := "mini"
	var target := false  # bersaglio valido: alone d'oro che pulsa
	var missing := false  # l'unica terra che manca per le cinque diverse
	var pop := 0.0:  # 0–1: la casella si gonfia un attimo quando entra una terra (effetto)
		set(v):
			pop = v
			queue_redraw()
	var night := 0.0:  # 0–1: la casella si spegne (effetto della distruzione)
		set(v):
			night = v
			queue_redraw()
	var _t := 0.0

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		resized.connect(queue_redraw)

	func set_state(n: int, tgt: bool, _cmode: String, miss := false) -> void:
		if n == count and tgt == target and miss == missing:
			return
		count = n
		target = tgt
		missing = miss
		set_process(tgt or miss)
		queue_redraw()

	func _process(delta: float) -> void:
		_t += delta
		queue_redraw()

	## Il quadrato del paesaggio (la parte alta della casella).
	func tile_rect() -> Rect2:
		var s := minf(size.x, size.y / 1.32)
		return Rect2(Vector2((size.x - s) / 2, 0), Vector2(s, s))

	func card_rect() -> Rect2:
		var t := tile_rect()
		return Rect2(position + t.position, t.size)

	func _draw() -> void:
		var tr := tile_rect()
		var s := tr.size.x
		var rad := s * 0.22
		var k := 0.5 + 0.5 * sin(_t * TAU)
		if missing and count == 0:
			# tratteggio azzurro con il «+»: la terra che serve per vincere
			_dashed(tr.grow(-1), rad, Color(Art.AZZURRO, 0.65 + 0.35 * k), 2.0)
			var c := tr.get_center()
			var a := s * 0.13
			draw_line(c - Vector2(a, 0), c + Vector2(a, 0), Art.AZZURRO, 2.2, true)
			draw_line(c - Vector2(0, a), c + Vector2(0, a), Art.AZZURRO, 2.2, true)
		else:
			var g := 1.0 + pop * 0.12
			var r2 := Rect2(tr.get_center() - tr.size * g / 2, tr.size * g)
			if count > 0:
				var sh := Art.box(Color(0, 0, 0, 0), rad)
				sh.shadow_color = Color(Art.OMBRA, 0.6)
				sh.shadow_size = int(s * 0.1)
				sh.shadow_offset = Vector2(0, s * 0.05)
				draw_style_box(sh, r2)
			Art.draw_tex(self, "tile-%s%s" % [land, "" if count > 0 else "-dim"], r2)
			if night > 0:
				draw_style_box(Art.box(Color("#17152e", night * 0.75), rad), r2)
		if target:
			draw_style_box(Art.box(Color(0, 0, 0, 0), rad + 6, Color(Art.SEGNALE, 0.25 + 0.3 * k), 4), tr.grow(5))
			draw_style_box(Art.box(Color(0, 0, 0, 0), rad + 2, Art.SEGNALE, 2.5), tr.grow(2))
		# sotto: il numero, oppure il nome della terra che manca
		var fs := int(clampf(s * 0.24, 11, 22))
		var y := tr.end.y + (size.y - tr.end.y) / 2 + 1
		if missing and count == 0:
			Art.draw_text_centered(self, Art.semi(), Art.NAMES[land], Vector2(size.x / 2, y), int(fs * 0.8), Art.AZZURRO)
		else:
			var col := Art.SEGNALE if count >= 4 else (Art.TESTO if count > 0 else Color(Art.TESTO, 0.45))
			Art.draw_text_centered(self, Art.bold() if count > 0 else Art.sans(), str(count), Vector2(size.x / 2, y), fs, col)

	func _dashed(r: Rect2, rad: float, col: Color, w: float) -> void:
		# contorno a trattini con gli angoli tondi
		var pts := PackedVector2Array()
		var steps := 10
		var corners := [[r.position + Vector2(rad, rad), PI], [Vector2(r.end.x - rad, r.position.y + rad), PI * 1.5],
			[r.end - Vector2(rad, rad), 0.0], [Vector2(r.position.x + rad, r.end.y - rad), PI * 0.5]]
		for c in corners:
			for i in steps + 1:
				var a: float = c[1] + (PI / 2) * i / steps
				pts.append(c[0] + Vector2(cos(a), sin(a)) * rad)
		pts.append(pts[0])
		var dash := 6.0
		var gap := 5.0
		var on := true
		var left := dash
		for i in pts.size() - 1:
			var a: Vector2 = pts[i]
			var b: Vector2 = pts[i + 1]
			var seg := a.distance_to(b)
			var pos := 0.0
			while pos < seg:
				var step := minf(left, seg - pos)
				var p1 := a.lerp(b, pos / seg)
				var p2 := a.lerp(b, (pos + step) / seg)
				if on:
					draw_line(p1, p2, col, w, true)
				pos += step
				left -= step
				if left <= 0.001:
					on = not on
					left = dash if on else gap


const DECK_ICON := "<rect x=\"6\" y=\"3\" width=\"12\" height=\"17\" rx=\"2.5\"/><path d=\"M9 20.5v.5a1.5 1.5 0 0 0 1.5 1.5h7A2.5 2.5 0 0 0 20 20V7\"/>"
const HAND_ICON := "<rect x=\"3\" y=\"6\" width=\"10\" height=\"14\" rx=\"2\" transform=\"rotate(-12 8 13)\"/><rect x=\"11\" y=\"5\" width=\"10\" height=\"14\" rx=\"2\" transform=\"rotate(10 16 12)\"/>"


## Pillola con parola e numero («Mazzo 41»), oppure, se manca spazio, icona e numero.
class Pill extends Control:
	var count := 0
	var fs := 13
	var word := ""
	var icon := ""
	var compact := false:
		set(v):
			compact = v
			queue_redraw()

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE

	func set_count(n: int) -> void:
		if n != count:
			count = n
			queue_redraw()

	func text() -> String:
		return ("%d" % count) if compact else ("%s %d" % [word, count])

	## Larghezza che serve (pensata per i numeri fino a 50, così non cambia durante la partita).
	func needed_width(small := compact) -> float:
		var t := "50" if small else "%s 50" % word
		var w := Art.sans().get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
		# compatta: margine, icona, spazio, numero, margine
		return w + (fs * 0.7 + fs * 1.15 + 4 + fs * 0.75 if small else fs * 1.8)

	func pile_rect() -> Rect2:
		var h := size.y * 0.8
		return Rect2(position + Vector2(size.x / 2 - h * 0.36, (size.y - h) / 2), Vector2(h * 0.72, h))

	func fan_rect() -> Rect2:
		return pile_rect()

	func _draw() -> void:
		var h := minf(size.y, fs * 2.4)
		var r := Rect2(Vector2(0, (size.y - h) / 2), Vector2(minf(size.x, needed_width()), h))
		if not compact:
			Art.draw_pill(self, r, text(), fs)
			return
		draw_style_box(Art.box(Color(1, 1, 1, 0.10), h / 2 - 1, Color(1, 1, 1, 0.12), 1.0), r)
		var isz := fs * 1.15
		var x := r.position.x + fs * 0.7
		draw_texture_rect(Art.line_icon(word, icon, Art.TESTO, isz), Rect2(x, r.get_center().y - isz / 2, isz, isz), false)
		var f := Art.sans()
		draw_string(f, Vector2(x + isz + 4, r.get_center().y + (f.get_ascent(fs) - f.get_descent(fs)) / 2), str(count), HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Art.TESTO)


## Mazzo: «Mazzo 41».
class Deck extends Pill:
	var pw := 15.0

	func _init() -> void:
		super()
		word = "Mazzo"
		icon = DECK_ICON


## La mano dell'avversario: «Mano 4».
class Backs extends Pill:
	signal width_changed
	var bw := 13.0

	func _init() -> void:
		super()
		word = "Mano"
		icon = HAND_ICON


## Il cimitero: una pillola «✝ 3» che si tocca per aprire il dettaglio.
class GyBadge extends Control:
	signal pressed
	var total := 0
	var fs := 14
	var open := false
	var target := false
	var _t := 0.0

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_STOP

	func set_state(n: int, is_open: bool, tgt: bool) -> void:
		if n == total and is_open == open and tgt == target:
			return
		total = n
		open = is_open
		target = tgt
		set_process(tgt)
		queue_redraw()

	func _process(delta: float) -> void:
		_t += delta
		queue_redraw()

	func _gui_input(e: InputEvent) -> void:
		if e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT and not e.pressed:
			pressed.emit()
			accept_event()

	## Larghezza che serve: icona e numero (fino a due cifre).
	func needed_width() -> float:
		var h := fs / 0.42
		return h * 0.16 + h * 0.56 + 4 + Art.semi().get_string_size("50", HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x + h * 0.24

	func _draw() -> void:
		var h := size.y
		var r := Rect2(Vector2.ZERO, size)
		if target:
			var k := 0.5 + 0.5 * sin(_t * TAU)
			draw_style_box(Art.box(Color(0, 0, 0, 0), h / 2 + 4, Color(Art.SEGNALE, 0.35 + 0.4 * k), 3), r.grow(4))
		draw_style_box(Art.box(Color(1, 1, 1, 0.18 if open else 0.10), h / 2 - 1, Color(Art.SEGNALE, 0.9) if target else Color(1, 1, 1, 0.12), 1.0), r)
		var d := h * 0.56
		Art.draw_contain(self, Art.tex("ico-T", d), Rect2(h * 0.16, (h - d) / 2, d, d))
		var f := Art.semi()
		draw_string(f, Vector2(h * 0.16 + d + 4, h / 2 + (f.get_ascent(fs) - f.get_descent(fs)) / 2), str(total), HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Art.TESTO)


## Puntino accanto al nome: d'oro quando è il turno di quel giocatore.
class Dot extends Control:
	var active := false

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		custom_minimum_size = Vector2(9, 9)

	func set_active(a: bool) -> void:
		if a != active:
			active = a
			queue_redraw()

	func _draw() -> void:
		var c := size / 2
		if active:
			draw_circle(c, 8, Color(Art.SEGNALE, 0.25))
			draw_circle(c, 4.5, Art.SEGNALE)
		else:
			draw_arc(c, 3.75, 0, TAU, 20, Art.MUTO, 1.5, true)


## Sfondo: cielo sfumato, stelle (cieli notturni), colline in fondo e il grande cerchio al centro
## (l'«orizzonte» dove si posano le carte). La luce del cielo cambia piano col turno.
class Table extends Control:
	var rose_center := Vector2.ZERO  # centro del cerchio
	var rose_size := 0.0  # diametro del cerchio
	var rose_angle := 0.0:  # (resta per compatibilità: un quinto di giro a ogni terra)
		set(v):
			rose_angle = v
			queue_redraw()
	var warmth := 0.0:  # 0 turno dell'avversario, 1 mio turno: il cielo si scalda un poco
		set(v):
			warmth = v
			queue_redraw()
	var hills_shift := 0.0:  # le colline scivolano piano (parallasse, con il turno)
		set(v):
			hills_shift = v
			queue_redraw()
	var _grad: GradientTexture2D

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		var g := Gradient.new()
		_grad = GradientTexture2D.new()
		_grad.gradient = g
		_grad.fill_from = Vector2(0.5, 0)
		_grad.fill_to = Vector2(0.5, 1)
		_grad.width = 8
		_grad.height = 256
		resized.connect(queue_redraw)

	func _draw() -> void:
		var top := Art.TAVOLO
		var bottom := Art.TAVOLO2.lerp(Color("#c9786f"), 0.12 * warmth)
		Art.draw_vgrad(self, Rect2(Vector2.ZERO, size), top, bottom)
		var sky: Array = Art.Scenery.SKIES[Art.THEME]
		if sky[4]:
			var st := Art.tex("stars", 400)
			var tile := 400.0
			var y := 0.0
			while y < size.y * 0.7:
				var x := 0.0
				while x < size.x:
					draw_texture_rect(st, Rect2(x, y, tile, tile), false, Color(1, 1, 1, 0.8))
					x += tile
				y += tile
		# colline: larghe quanto lo schermo, alte un terzo della larghezza
		var hw := maxf(size.x * 1.15, 400.0)
		var hh := hw * 0.3
		Art.draw_tex(self, "hills-" + Art.THEME, Rect2(-size.x * 0.075 + hills_shift, size.y - hh, hw, hh))
		if rose_size > 0:
			# l'orizzonte: un cerchio leggero, con un anello appena più chiaro
			var r := rose_size / 2
			draw_circle(rose_center, r, Color(1, 1, 1, 0.045))
			draw_arc(rose_center, r, 0, TAU, 96, Color(1, 1, 1, 0.10), 2.0, true)
			draw_arc(rose_center, r * 0.82, 0, TAU, 96, Color(1, 1, 1, 0.05), 1.0, true)


## Onde che si allargano da un punto (il contrasto dell'Isola, una terra che entra in gioco).
## Si cancella da sola quando ha finito.
class Ripple extends Control:
	var color := Color.WHITE
	var radius := 60.0
	var rings := 3
	var dur := 0.9
	var _t := 0.0

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE

	func _process(delta: float) -> void:
		_t += delta
		queue_redraw()
		if _t > dur + 0.3:
			queue_free()

	func _draw() -> void:
		for i in rings:
			var k := clampf((_t - i * 0.15) / dur, 0.0, 1.0)
			if k <= 0.0 or k >= 1.0:
				continue
			var e := 1.0 - pow(1.0 - k, 3.0)
			draw_arc(Vector2.ZERO, radius * (0.55 + 0.75 * e), 0, TAU, 72, Color(color, 0.55 * (1.0 - k)), 3.0 * (1.0 - k) + 1.0, true)


## Raggi di luce dorata che girano piano (la vittoria). `strength` 0–1 per farli comparire.
class Rays extends Control:
	var strength := 0.0:
		set(v):
			strength = v
			queue_redraw()
	var radius := 300.0
	var color := Color("#ffd27a")
	var _a := 0.0

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE

	func _process(delta: float) -> void:
		_a += delta * 0.12
		queue_redraw()

	func _draw() -> void:
		if strength <= 0.0:
			return
		var n := 14
		for i in n:
			var a := _a + TAU * i / n
			var w := TAU / n * 0.32
			var pts := PackedVector2Array([Vector2.ZERO, Vector2(cos(a - w), sin(a - w)) * radius, Vector2(cos(a + w), sin(a + w)) * radius])
			draw_colored_polygon(pts, Color(color, 0.10 * strength))
		draw_circle(Vector2.ZERO, radius * 0.32, Color(color, 0.12 * strength))
		draw_circle(Vector2.ZERO, radius * 0.18, Color(color, 0.16 * strength))
