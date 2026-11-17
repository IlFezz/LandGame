## Crea le icone dell'app dallo stile Orizzonti (scripts/ui/scenery.gd):
##   godot --headless --path godot -s res://tools/make_icon.gd
extends SceneTree
const Scenery := preload("res://scripts/ui/scenery.gd")


func _init() -> void:
	_png(Scenery.app_icon(false), 192, "res://assets/icons/icona-192.png")
	_png(Scenery.app_icon(false), 512, "res://assets/icons/icona-512.png")
	_png(Scenery.app_icon(true), 432, "res://assets/icons/icona-adattiva-512.png")
	var f := FileAccess.open("res://icon.svg", FileAccess.WRITE)
	f.store_string(Scenery.app_icon(false))
	f.close()
	print("icone create")
	quit()


func _png(svg: String, size: int, path: String) -> void:
	var img := Image.new()
	img.load_svg_from_string(svg, size / 512.0)
	img.save_png(path)
