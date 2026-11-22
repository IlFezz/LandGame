## Prova dell'account contro un server di prova: crea, cambia nome, nome già preso, copia del profilo.
## Rimette a posto preferenze e profili del PC alla fine.
##   godot --headless --path godot -s res://tools/account_probe.gd -- --server=ws://localhost:3998
extends SceneTree

const Account := preload("res://scripts/net/account.gd")
const Prefs := preload("res://scripts/app/prefs.gd")
const Profile := preload("res://scripts/app/profile.gd")
const Classifica := preload("res://scripts/net/classifica.gd")


func _initialize() -> void:
	var files := ["user://prefs.cfg", "user://profili.json"]
	var backup := {}
	for f in files:
		backup[f] = FileAccess.get_file_as_bytes(f) if FileAccess.file_exists(f) else null
	var host := Node.new()
	root.add_child(host)
	await process_frame
	Prefs.load_all()
	Prefs.set_value("account", {})
	Prefs.set_value("name", "Vecchio Nome")
	var p := Profile.load_profile("Vecchio Nome")
	p.cpu.won = 7
	Profile.store("Vecchio Nome", p)
	Account.live = true
	print("crea: ", await Account.ensure(host), " nome ", Prefs.get_value("name"), " vittorie ", Profile.load_profile(Prefs.player_name()).cpu.won)
	var other: Dictionary = await Classifica._call(host, Classifica.base_url() + "/api/account", HTTPClient.METHOD_POST, JSON.stringify({"a": "create", "name": "Preso"}))
	print("altro: ", other.get("name"))
	print("rinomina: ", await Account.rename(host, "Nome Nuovo"), " -> ", Prefs.get_value("name"), " vittorie ", Profile.load_profile(Prefs.player_name()).cpu.won)
	print("nome preso: ", await Account.rename(host, "preso"), " -> ", Prefs.get_value("name"))
	await Account.push(host)
	var a := Account.info()
	var l: Dictionary = await Classifica._call(host, Classifica.base_url() + "/api/account", HTTPClient.METHOD_POST, JSON.stringify({"a": "load", "id": a.id, "token": a.token}))
	print("sul server: ", l.name, " vittorie ", l.profile.cpu.won)
	print("codice con account: ", Marshalls.base64_to_utf8(Profile.export_code(Prefs.player_name()).substr(7)).contains(a.id))
	for f in files:
		if backup[f] == null:
			DirAccess.remove_absolute(f)
		else:
			var fa := FileAccess.open(f, FileAccess.WRITE)
			fa.store_buffer(backup[f])
	quit()
