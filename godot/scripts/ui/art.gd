## Grafica di Atlas: colori, caratteri e disegni SVG (presi da public/art.js) trasformati in
## immagini alla misura esatta in cui compaiono sullo schermo, così restano sempre nitidi.
extends RefCounted

const Data := preload("res://scripts/ui/art_data.gd")

# colori del tavolo: cambiano con il tema scelto nella Collezione (vedi apply_theme)
static var TAVOLO := Color("#12363f")
static var TAVOLO2 := Color("#0a232b")
static var TESTO := Color("#e9f1ec")
static var MUTO := Color("#93b3b0")
static var RIGA := Color("#d6e8e04d")
static var OMBRA := Color(0, 0, 0, 0.53)
static var TOPO := "topo-n"
static var ROSE := "rose-n"
static var THEME := "notte"
static var BACK := "bussola"  # dorso delle carte
const CARTA := Color("#f4eddd")
const CARTA2 := Color("#e2d6bd")
const INK := Color("#17262d")
const SEGNALE := Color("#f6c453")
const SEGNALE2 := Color("#c9962e")
const ROSSO := Color("#c8402b")
const LAND := {"W": Color("#e0a92e"), "U": Color("#1f8fb8"), "B": Color("#7557a6"), "R": Color("#d9482f"), "G": Color("#23855a")}

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

## Tavoli (style.css): [tavolo, tavolo2, testo, muto, riga, ombra, curve di livello, rosa]
const THEMES := {
	"notte": ["#12363f", "#0a232b", "#e9f1ec", "#93b3b0", "#d6e8e04d", "#00000088", "topo-n", "rose-n"],
	"giorno": ["#e3ebe7", "#cbd8d4", "#17262d", "#54707a", "#17262d47", "#17262d47", "topo-d", "rose-d"],
	"pergamena": ["#ecdfc2", "#d6c299", "#3a2a18", "#7a6446", "#3a2a1847", "#3a2a1852", "topo-p", "rose-p"],
	"corallo": ["#4c201c", "#2c1110", "#f6e7dc", "#c9a092", "#f4d9cc45", "#00000099", "topo-c", "rose-c"],
}
const THEME_NAMES := [["notte", "Notte"], ["giorno", "Giorno"], ["pergamena", "Pergamena"], ["corallo", "Corallo"]]
const BACKS := [["bussola", "Bussola"], ["meridiani", "Meridiani"], ["correnti", "Correnti"], ["sestante", "Sestante"],
	["radici", "Radici"], ["maree", "Maree"], ["stelle", "Stelle"]]


static func apply_theme(id: String) -> void:
	var t: Array = THEMES.get(id, THEMES.notte)
	THEME = id if THEMES.has(id) else "notte"
	TAVOLO = Color(t[0])
	TAVOLO2 = Color(t[1])
	TESTO = Color(t[2])
	MUTO = Color(t[3])
	RIGA = Color(t[4])
	OMBRA = Color(t[5])
	TOPO = t[6]
	ROSE = t[7]


static var _tex := {}
static var _fonts := {}
## Pixel veri per unità logica (lo imposta screen.gd): serve a disegnare le immagini nitide.
static var px := 1.0


static func _font(path: String) -> Font:
	if not _fonts.has(path):
		var f = load(path)
		if f is FontFile:
			f.fallbacks = [ThemeDB.fallback_font]
		_fonts[path] = f if f != null else ThemeDB.fallback_font
	return _fonts[path]


static func sans() -> Font:
	return _font("res://assets/fonts/adventor.woff")


static func bold() -> Font:
	return _font("res://assets/fonts/adventor-bold.woff")


static func serif() -> Font:
	return _font("res://assets/fonts/lora-italic.woff")


static func _viewbox(svg: String) -> Vector2:
	var i := svg.find("viewBox=\"")
	if i < 0:
		return Vector2(100, 100)
	var parts := svg.substr(i + 9, svg.find("\"", i + 9) - i - 9).split(" ")
	return Vector2(float(parts[2]), float(parts[3]))


## Il disegno `key` (es. "art-W", "ico-R", "bk-bussola", "rose-n") largo `width` unità logiche.
## Le misure vengono arrotondate a gradini, così le immagini già pronte si riusano.
static func tex(key: String, width: float) -> Texture2D:
	var w := maxi(16, int(ceil(width * px / 24.0)) * 24)
	var k := "%s@%d" % [key, w]
	if _tex.has(k):
		return _tex[k]
	var svg: String = Data.SVG[key]
	var img := Image.new()
	img.load_svg_from_string(svg, float(w) / _viewbox(svg).x)
	var t := ImageTexture.create_from_image(img)
	_tex[k] = t
	return t


## Un disegno SVG scritto a mano (icone delle schede, lucchetto), largo `width` unità logiche.
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
	var ts := t.get_size()
	var k := minf(r.size.x / ts.x, r.size.y / ts.y)
	var s := ts * k
	ci.draw_texture_rect(t, Rect2(r.position + (r.size - s) / 2, s), false, modulate)


## Riquadro arrotondato pieno, con bordo e ombra facoltativi.
static func box(fill: Color, radius: float, border := Color(0, 0, 0, 0), bw := 0.0) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = fill
	sb.set_corner_radius_all(int(round(radius)))
	sb.corner_detail = 6
	sb.anti_aliasing = true
	if bw > 0:
		sb.border_color = border
		sb.set_border_width_all(int(ceil(bw)))
	return sb
