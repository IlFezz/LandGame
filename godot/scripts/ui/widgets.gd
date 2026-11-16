## Piccoli elementi del tavolo disegnati da codice: casella del campo, mazzo, dorsi
## dell'avversario, cimitero, pulsanti. Come card_view.gd, si ridisegnano solo quando cambiano.
extends RefCounted

const Art := preload("res://scripts/ui/art.gd")
const Card := preload("res://scripts/ui/card_view.gd")


## Pulsante nello stile della versione web. kind: "pass", "primary", "counter", "ghost", "dark",
## "exit", "full" (giallo).
static func button(text: String, kind := "dark", fs := 15) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_NONE
	style_button(b, kind, fs)
	return b


static func style_button(b: Button, kind: String, fs: int) -> void:
	var fill := Art.TAVOLO2
	var fg := Art.TESTO
	var border := Art.TESTO
	var lip := Color(0, 0, 0, 0)
	match kind:
		"pass", "primary":
			fill = Art.CARTA
			fg = Art.INK
			border = Art.CARTA
			lip = Art.CARTA2
		"counter":
			fill = Art.LAND.U
			fg = Color.WHITE
			border = Art.LAND.U
			lip = Color("#14506e")
		"ghost":
			fill = Color(0, 0, 0, 0)
			fg = Color(Art.TESTO, 0.8)
			border = Color(0, 0, 0, 0)
		"exit":
			fill = Art.ROSSO
			fg = Color.WHITE
			border = Art.ROSSO
			lip = Color("#7d2416")
		"full":
			fill = Art.SEGNALE
			fg = Art.INK
			border = Art.SEGNALE
			lip = Art.SEGNALE2
		"ink":
			fill = Art.INK
			fg = Art.CARTA
			border = Art.INK
		"ghost_ink":
			fill = Color(0, 0, 0, 0)
			fg = Art.INK
			border = Color(Art.INK, 0.25)
	var pad_x := fs * 1.3
	var pad_y := fs * 0.75
	for state in ["normal", "hover", "pressed", "disabled"]:
		var sb := Art.box(fill if state != "hover" else fill.lightened(0.06), 10, border, 1.5)
		sb.content_margin_left = pad_x
		sb.content_margin_right = pad_x
		sb.content_margin_top = pad_y
		sb.content_margin_bottom = pad_y
		if lip.a > 0 and state != "pressed":
			sb.shadow_color = lip
			sb.shadow_size = 0
			sb.shadow_offset = Vector2(0, 3)
			sb.expand_margin_bottom = 0
		if state == "pressed":
			sb.content_margin_top = pad_y + 1
			sb.content_margin_bottom = pad_y - 1
		b.add_theme_stylebox_override(state, sb)
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	for c in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color"]:
		b.add_theme_color_override(c, fg)
	b.add_theme_font_override("font", Art.bold() if kind != "ghost" else Art.sans())
	b.add_theme_font_size_override("font_size", fs)


static func label(text := "", fs := 15, color = null, font: Font = null) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", font if font != null else Art.sans())
	l.add_theme_font_size_override("font_size", fs)
	l.add_theme_color_override("font_color", color if color != null else Art.TESTO)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


## Casella del campo per un tipo di terra: vuota (tratteggiata, col simbolo) o con la carta e il numero.
class Slot extends Control:
	var land := "W"
	var count := 0
	var card_mode := "mini"
	var target := false  # bersaglio valido: bordo giallo che pulsa
	var _card: Control
	var _t := 0.0

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		_card = Card.new()
		_card.mode = "mini"
		_card.visible = false
		_card.shadow = false
		add_child(_card)
		resized.connect(_fit)

	func _fit() -> void:
		_card.size = size
		queue_redraw()

	func set_state(n: int, tgt: bool, cmode: String) -> void:
		if n == count and tgt == target and cmode == card_mode and _card.kind == land:
			return
		count = n
		target = tgt
		card_mode = cmode
		_card.kind = land
		_card.mode = cmode
		_card.visible = n > 0
		set_process(tgt)
		queue_redraw()

	func _process(delta: float) -> void:
		_t += delta
		queue_redraw()

	func card_rect() -> Rect2:
		return Rect2(position, size)

	func _draw() -> void:
		var w := size.x
		var rad := w * 0.055
		if count == 0:
			var sb := Art.box(Color(0, 0, 0, 0), rad, Art.RIGA, 1.5)
			draw_style_box(sb, Rect2(Vector2.ZERO, size))
			var d := w * 0.34
			Art.draw_contain(self, Art.tex("ico-" + land, d), Rect2((size - Vector2(d, d)) / 2, Vector2(d, d)), Color(1, 1, 1, 0.38))
		if target:
			var k := 0.5 + 0.5 * sin(_t * TAU)
			draw_style_box(Art.box(Color(0, 0, 0, 0), rad + 6, Color(Art.SEGNALE, 0.25 + 0.2 * k), 3), Rect2(-6, -6, w + 12, size.y + 12))
			draw_style_box(Art.box(Color(0, 0, 0, 0), rad + 3, Art.SEGNALE, 3), Rect2(-3, -3, w + 6, size.y + 6))

	## Il numero sopra la carta va disegnato sopra di lei: lo fa un figlio aggiunto per ultimo.
	func _notification(what: int) -> void:
		if what == NOTIFICATION_READY:
			var c := CountBadge.new()
			c.slot = self
			add_child(c)


class CountBadge extends Control:
	var slot: Slot

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE

	func _ready() -> void:
		slot.resized.connect(queue_redraw)
		slot.draw.connect(queue_redraw)

	func _draw() -> void:
		if slot.count < 2:
			return
		var w := slot.size.x
		var d := clampf(w * 0.3, 20, 30)
		var c := Vector2(w + 7 - d / 2, -7 + d / 2)
		var five := slot.count >= 4
		draw_circle(c, d / 2 + 1.5, Art.INK if five else Art.CARTA)
		draw_circle(c, d / 2, Art.SEGNALE if five else Art.INK)
		var f := Art.bold()
		var fs := int(d * 0.55)
		var s := str(slot.count)
		var tw := f.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
		draw_string(f, c + Vector2(-tw / 2, f.get_ascent(fs) * 0.38), s, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Art.INK if five else Art.CARTA)


## Mazzo: una pila sdraiata, più spessa quante più carte ha; accanto il numero.
class Deck extends Control:
	var count := 40
	var pw := 15.0
	var fs := 13

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE

	func set_count(n: int) -> void:
		if n != count:
			count = n
			queue_redraw()

	func pile_rect() -> Rect2:
		var ph := pw * 1.4
		return Rect2(position + Vector2(0, (size.y - ph) / 2), Vector2(pw, ph))

	func _draw() -> void:
		var ph := pw * 1.4
		var y := (size.y - ph) / 2 - 2
		var layers := 3 if count > 30 else 2 if count > 12 else 1 if count > 0 else 0
		if count == 0:
			draw_rect(Rect2(0, y, pw, ph), Art.RIGA, false, 1.5)
		else:
			for i in range(layers * 2, 0, -1):
				var o := i * 1.5
				draw_rect(Rect2(o - 1.5, y + o - 1.5, pw + 3, ph + 3), Art.CARTA if i % 2 == 0 else Art.CARTA2)
			draw_rect(Rect2(-1.5, y - 1.5, pw + 3, ph + 3), Art.CARTA)
			Art.draw_cover(self, Art.tex("bk-" + Art.BACK, pw), Rect2(0, y, pw, ph))
		var f := Art.sans()
		draw_string(f, Vector2(pw + 12, size.y / 2 + f.get_ascent(fs) * 0.36), str(count), HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Art.MUTO)


## La mano dell'avversario: dorsi aperti a ventaglio e il numero in un segnalino.
class Backs extends Control:
	var count := 5
	var bw := 13.0
	var fs := 12

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE

	func set_count(n: int) -> void:
		if n != count:
			count = n
			queue_redraw()

	func fan_rect() -> Rect2:
		return Rect2(position, Vector2(size.x * 0.6, size.y))

	func _draw() -> void:
		var k := mini(count, 10)
		var mid := (k - 1) / 2.0
		var step := 7.0 if k > 6 else 10.0
		var bh := bw * 1.4
		var x0 := bw * 0.6
		var base_y := size.y / 2 + bh * 0.45
		for i in k:
			var x := x0 + i * bw * 0.45
			var ang := deg_to_rad((i - mid) * step)
			var pivot := Vector2(x + bw / 2, base_y + bh * 0.6)
			draw_set_transform(pivot, ang)
			var r := Rect2(Vector2(-bw / 2, -bh * 1.6 + bh * 0.6), Vector2(bw, bh))
			draw_rect(r.grow(1.5), Art.CARTA)
			Art.draw_cover(self, Art.tex("bk-" + Art.BACK, bw), r)
		draw_set_transform(Vector2.ZERO)
		var f := Art.bold()
		var s := str(count)
		var tw := f.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
		var bx := x0 + maxf(k, 1) * bw * 0.45 + bw * 0.9
		var bh2 := fs * 1.6
		var bwid := maxf(bh2 * 1.1, tw + 12)
		draw_style_box(Art.box(Art.CARTA, bh2 / 2), Rect2(bx, (size.y - bh2) / 2, bwid, bh2))
		draw_string(f, Vector2(bx + (bwid - tw) / 2, size.y / 2 + f.get_ascent(fs) * 0.36), s, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Art.INK)


## Segnalino del cimitero: la croce e il totale; si tocca per aprire il dettaglio.
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

	func _draw() -> void:
		var h := size.y
		var r := Rect2(Vector2.ZERO, size)
		draw_style_box(Art.box(Color(0, 0, 0, 0), h / 2, Art.TESTO if open else Art.RIGA, 1.5), r)
		if target:
			var k := 0.5 + 0.5 * sin(_t * TAU)
			draw_style_box(Art.box(Color(0, 0, 0, 0), h / 2 + 3, Color(Art.SEGNALE, 0.6 + 0.4 * k), 3), r.grow(3))
		var d := h * 0.68
		Art.draw_contain(self, Art.tex("ico-T", d), Rect2(h * 0.16, (h - d) / 2, d, d))
		var f := Art.bold()
		draw_string(f, Vector2(h * 0.16 + d + 7, h / 2 + f.get_ascent(fs) * 0.36), str(total), HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Art.TESTO)


## Puntino accanto al nome: giallo quando è il turno di quel giocatore.
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
			draw_circle(c, 7.5, Color(Art.SEGNALE, 0.25))
			draw_circle(c, 4.5, Art.SEGNALE)
		else:
			draw_arc(c, 3.75, 0, TAU, 20, Art.MUTO, 1.5, true)


## Sfondo: tavolo con le curve di livello e la rosa dei venti al centro.
class Table extends Control:
	var rose_center := Vector2.ZERO
	var rose_size := 0.0
	var rose_angle := 0.0:
		set(v):
			rose_angle = v
			queue_redraw()
	var _grad: GradientTexture2D

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		var g := Gradient.new()
		g.set_color(0, Art.TAVOLO)
		g.set_color(1, Art.TAVOLO2)
		_grad = GradientTexture2D.new()
		_grad.gradient = g
		_grad.fill = GradientTexture2D.FILL_RADIAL
		_grad.fill_from = Vector2(0.5, 0.38)
		_grad.fill_to = Vector2(1.1, 1.0)
		_grad.width = 256
		_grad.height = 256
		resized.connect(queue_redraw)

	func _draw() -> void:
		_grad.gradient.set_color(0, Art.TAVOLO)
		_grad.gradient.set_color(1, Art.TAVOLO2)
		draw_texture_rect(_grad, Rect2(Vector2.ZERO, size), false)
		Art.draw_cover(self, Art.tex(Art.TOPO, maxf(size.x, size.y * 0.55)), Rect2(Vector2.ZERO, size))
		if rose_size > 0:
			var t := Art.tex(Art.ROSE, rose_size)
			draw_set_transform(rose_center, deg_to_rad(rose_angle))
			draw_texture_rect(t, Rect2(-Vector2(rose_size, rose_size) / 2, Vector2(rose_size, rose_size)), false, Color(1, 1, 1, 0.7))
			draw_set_transform(Vector2.ZERO)
