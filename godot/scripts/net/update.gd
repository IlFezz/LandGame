## Aggiornamenti dell'APK: all'avvio si chiede al server (/api/versione) qual è l'ultima versione.
## Se è più nuova di questa si propone «Aggiorna», che apre il download dell'APK: Android poi chiede
## «Installare l'aggiornamento?» e partite, statistiche e account restano.
## Solo sull'app Android (nel browser c'è sempre l'ultima versione).
extends RefCounted

const Classifica := preload("res://scripts/net/classifica.gd")
const Version := preload("res://scripts/app/version.gd")


## { code, name, url, notes } se c'è una versione più nuova, altrimenti {}.
static func check(host: Node) -> Dictionary:
	if OS.get_name() != "Android":
		return {}
	var r: Dictionary = await Classifica._call(host, Classifica.base_url() + "/api/versione", HTTPClient.METHOD_GET, "")
	if int(r.get("code", 0)) > Version.CODE and str(r.get("url", "")) != "":
		return r
	return {}
