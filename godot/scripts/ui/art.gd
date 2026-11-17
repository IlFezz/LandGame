## Grafica di Atlas, stile «Orizzonti»: colori, caratteri (Sora) e disegni (paesaggi piatti di
## scenery.gd) trasformati in immagini alla misura esatta in cui compaiono, così restano nitidi.
extends RefCounted

const Scenery := preload("res://scripts/ui/scenery.gd")

# colori del cielo (cambiano con il tavolo scelto nella Collezione, vedi apply_theme)
static var TAVOLO := Color("#1d1f47")  # cielo in alto
static var TAVOLO2 := Color("#5b3f6e")  # cielo in basso
static var TESTO := Color("#fcf1e3")  # testo chiaro
static var MUTO := Color("#c9bcdc")  # testo secondario
static var RIGA := Color(1, 1, 1, 0.16)  # bordi sottili e caselle vuote
static var OMBRA := Color(0.05, 0.03, 0.15, 0.5)
static var THEME := "crepuscolo"
static var BACK := "sole"  # dorso delle carte
const CARTA := Color("#fcf1e3")  # crema: pulsanti principali e fogli
const CARTA2 := Color("#e9d9c6")
const INK := Color("#1d1b3a")  # testo scuro sul crema
const VETRO := Color(1, 1, 1, 0.10)
const FOGLIO := Color("#2a2452")  # finestre e pannelli: viola scuro, testo chiaro
const FOGLIO_BORDO := Color(1, 1, 1, 0.12)  # pillole e pulsanti secondari, semitrasparenti
const SEGNALE := Color("#ffffff")  # bianco: ciò che si può usare adesso (niente giallo: stile pulito)
const SEGNALE2 := Color("#d9d2ee")
const ROSSO := Color("#ff6f6f")
const AZZURRO := Color("#9fe3ff")  # la terra che manca per vincere
const LAND := {"W": Color("#f2a541"), "U": Color("#4fa3d9"), "B": Color("#8a6fd1"), "R": Color("#e2566a"), "G": Color("#3fae6e")}

const NAMES := {"W": "Pianura", "U": "Isola", "B": "Palude", "R": "Montagna", "G": "Foresta"}
const FXTXT := {
	"W": "Riattiva una tua terra",
	"U": "Pesca una carta, o contrasta",
	"B": "Fai scartare una terra",
	"R": "Distruggi una terra",
	"G": "Riprendi una terra dal cimitero",
}
const LONG_FX := {
	"W": "Riattiva l'effetto di un'altra tua terra in gioco.",
	"U": "Entrando peschi una carta.",
	"B": "Guardi la mano avversaria e scegli una terra da scartare.",
	"R": "Distruggi una terra avversaria in gioco.",
	"G": "Riprendi in mano una terra dal tuo cimitero.",
}

## Tavoli = cieli (Collezione). I colori stanno in Scenery.SKIES.
const THEME_NAMES := [["crepuscolo", "Crepuscolo"], ["alba", "Alba"], ["stellata", "Notte stellata"], ["aurora", "Aurora"]]
const BACKS := [["sole", "Sole"], ["luna", "Luna"], ["colline", "Colline"], ["monti", "Monti"],
	["pini", "Pini"], ["onde", "Onde"], ["stelle", "Stelle"]]
## Nomi dello stile precedente → nuovi (preferenze già salvate).
const OLD_THEME := {"notte": "crepuscolo", "giorno": "alba", "pergamena": "stellata", "corallo": "aurora"}
const OLD_BACK := {"bussola": "sole", "meridiani": "luna", "correnti": "colline", "sestante": "monti",
	"radici": "pini", "maree": "onde"}


static func theme_id(id: String) -> String:
	if Scenery.SKIES.has(id):
		return id
	return OLD_THEME.get(id, "crepuscolo")


static func back_id(id: String) -> String:
	if Scenery.BACKS.has(id):
		return id
	return OLD_BACK.get(id, "sole")


static func apply_theme(id: String) -> void:
	THEME = theme_id(id)
	var k: Array = Scenery.SKIES[THEME]
	TAVOLO = Color(k[0])
	TAVOLO2 = Color(k[1])


static var _tex := {}
static var _fonts := {}
## Pixel veri per unità logica (lo imposta main.gd): serve a disegnare le immagini nitide.
static var px := 1.0


## Sora a peso variabile: 300 leggero, 400 normale, 600 semi-grassetto, 700 grassetto.
static func _sora(weight: int) -> Font:
	if not _fonts.has(weight):
		var base = load("res://assets/fonts/sora.ttf")
		if base is FontFile:
			base.fallbacks = [ThemeDB.fallback_font]  # simboli che Sora non ha (✕ ✓ →)
		if base == null:
			_fonts[weight] = ThemeDB.fallback_font
		else:
			var v := FontVariation.new()
			v.base_font = base
			v.variation_opentype = {TextServerManager.get_primary_interface().name_to_tag("wght"): weight}
			v.fallbacks = [ThemeDB.fallback_font]
			_fonts[weight] = v
	return _fonts[weight]


static func sans() -> Font:
	return _sora(400)


static func bold() -> Font:
	return _sora(700)


static func semi() -> Font:
	return _sora(600)


## Testi di spiegazione: Sora leggero (lo stile Orizzonti non usa il corsivo).
static func serif() -> Font:
	return _sora(300)


static func _viewbox(svg: String) -> Vector2:
	var i := svg.find("viewBox=\"")
	if i < 0:
		return Vector2(100, 100)
	var parts := svg.substr(i + 9, svg.find("\"", i + 9) - i - 9).split(" ")
	return Vector2(float(parts[2]), float(parts[3]))


## Il codice SVG di un disegno: "card-W" (carta), "tile-W" e "tile-W-dim" (casella),
## "ico-W" (cerchio), "bk-sole" (dorso), "hills-crepuscolo", "stars", "ico-T" (cimitero).
static func svg_of(key: String) -> String:
	var parts := key.split("-")
	match parts[0]:
		"card", "art":
			return Scenery.card(parts[1])
		"tile":
			return Scenery.tile(parts[1], parts.size() > 2)
		"ico":
			if parts[1] == "T":
				return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"12\" fill=\"#ffffff\" fill-opacity=\".16\"/><path d=\"M12 6v12M8 10h8\" stroke=\"#fcf1e3\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>"
			return Scenery.disc(parts[1])
		"bk":
			return Scenery.back(parts[1])
		"hills":
			return Scenery.hills(parts[1])
		"stars":
			return Scenery.stars()
	return Scenery.disc("W")


## Il disegno `key` largo `width` unità logiche. Le misure vengono arrotondate a gradini,
## così le immagini già pronte si riusano.
static func tex(key: String, width: float) -> Texture2D:
	var w := maxi(16, int(ceil(width * px / 24.0)) * 24)
	var k := "%s@%d" % [key, w]
	if _tex.has(k):
		return _tex[k]
	var svg := svg_of(key)
	var img := Image.new()
	img.load_svg_from_string(svg, float(w) / _viewbox(svg).x)
	# bordo trasparente tutto intorno: anche le carte inclinate hanno i bordi lisci, senza scalini
	var padded := Image.create(img.get_width() + PAD * 2, img.get_height() + PAD * 2, true, Image.FORMAT_RGBA8)
	img.convert(Image.FORMAT_RGBA8)
	padded.blit_rect(img, Rect2i(Vector2i.ZERO, img.get_size()), Vector2i(PAD, PAD))
	padded.generate_mipmaps()
	var t := ImageTexture.create_from_image(padded)
	_tex[k] = t
	return t


## Pixel trasparenti aggiunti intorno a ogni disegno di tex().
const PAD := 3


## Disegna il disegno `key` esattamente dentro `r` (tenendo conto del bordo trasparente).
static func draw_tex(ci: CanvasItem, key: String, r: Rect2, modulate := Color.WHITE) -> void:
	var t := tex(key, r.size.x)
	var inner := float(t.get_width() - PAD * 2)
	var k := r.size.x / inner
	ci.draw_texture_rect(t, r.grow(PAD * k), false, modulate)


## Un disegno SVG qualunque (icone, lucchetto, paesaggi con il sole spostato), largo `width` unità logiche.
static func svg_tex(key: String, svg: String, width: float) -> Texture2D:
	var w := maxi(8, int(ceil(width * px)))
	var k := "svg:%s@%d" % [key, w]
	if _tex.has(k):
		return _tex[k]
	var img := Image.new()
	img.load_svg_from_string(svg, float(w) / _viewbox(svg).x)
	var t := ImageTexture.create_from_image(img)
	_tex[k] = t
	return t


## Icona a tratto (viewBox 24×24) del colore dato, come le icone della barra delle schede.
static func line_icon(key: String, paths: String, color: Color, width: float) -> Texture2D:
	var svg := "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#%s\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\">%s</svg>" % [color.to_html(false), paths]
	return svg_tex(key + color.to_html(), svg, width)


## Disegna `t` dentro `r` riempiendolo tutto e tagliando ciò che avanza (come "cover" nel CSS).
static func draw_cover(ci: CanvasItem, t: Texture2D, r: Rect2, modulate := Color.WHITE) -> void:
	var ts := t.get_size()
	var k := maxf(r.size.x / ts.x, r.size.y / ts.y)
	var src := Rect2(Vector2.ZERO, r.size / k)
	src.position = (ts - src.size) / 2
	ci.draw_texture_rect_region(t, r, src, modulate)


## Disegna `t` dentro `r` senza tagliare, centrato (come "contain").
static func draw_contain(ci: CanvasItem, t: Texture2D, r: Rect2, modulate := Color.WHITE) -> void:
	var ts := t.get_size() - Vector2(PAD, PAD) * 2  # senza il bordo trasparente
	var k := minf(r.size.x / ts.x, r.size.y / ts.y)
	var s := ts * k
	ci.draw_texture_rect(t, Rect2(r.position + (r.size - s) / 2, s).grow(PAD * k), false, modulate)


## Riquadro arrotondato pieno, con bordo e ombra facoltativi.
static func box(fill: Color, radius: float, border := Color(0, 0, 0, 0), bw := 0.0) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = fill
	sb.set_corner_radius_all(int(round(radius)))
	sb.corner_detail = 8
	sb.anti_aliasing = true
	if bw > 0:
		sb.border_color = border
		sb.set_border_width_all(int(ceil(bw)))
	return sb


## Testo centrato in un punto (comodo nei _draw).
static func draw_text_centered(ci: CanvasItem, f: Font, text: String, center: Vector2, fs: int, color: Color) -> void:
	var tw := f.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
	ci.draw_string(f, center + Vector2(-tw / 2, (f.get_ascent(fs) - f.get_descent(fs)) / 2), text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, color)


## Pillola semitrasparente con un testo (es. «Mazzo 41»), disegnata in `r`.
static func draw_pill(ci: CanvasItem, r: Rect2, text: String, fs: int, highlight := false, open := false) -> void:
	var fill := Color(1, 1, 1, 0.16 if open else 0.10)
	ci.draw_style_box(box(fill, r.size.y / 2 - 1, Color(SEGNALE, 0.9) if highlight else Color(1, 1, 1, 0.12), 2.0 if highlight else 1.0), r)
	draw_text_centered(ci, sans(), text, r.get_center(), fs, TESTO)


## Rettangolo sfumato dall'alto in basso (disegnato subito, senza aspettare una texture).
static func draw_vgrad(ci: CanvasItem, r: Rect2, top: Color, bottom: Color) -> void:
	ci.draw_polygon(PackedVector2Array([r.position, Vector2(r.end.x, r.position.y), r.end, Vector2(r.position.x, r.end.y)]),
		PackedColorArray([top, top, bottom, bottom]))


## Numero in un cerchietto (sopra il mazzo e la mano coperta).
static func draw_count(ci: CanvasItem, c: Vector2, n: int, fs: int) -> void:
	var r := fs * 0.9
	ci.draw_circle(c, r + 1.5, Color(TAVOLO, 0.9))
	ci.draw_circle(c, r, CARTA)
	draw_text_centered(ci, bold(), str(n), c, fs, INK)
