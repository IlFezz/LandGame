## Condivisione di un testo (l'invito per una stanza): sul telefono Android si apre il menu di sistema
## «Condividi» (WhatsApp, Telegram, messaggi…); nel browser si usa la condivisione del browser se
## c'è; altrimenti il testo viene copiato. Restituisce false se ha solo copiato.
extends RefCounted


static func text(msg: String, title := "Invita un amico") -> bool:
	if OS.get_name() == "Android" and Engine.has_singleton("AndroidRuntime"):
		var rt = Engine.get_singleton("AndroidRuntime")
		var activity = rt.getActivity()
		var Intent = JavaClassWrapper.wrap("android.content.Intent")
		var Uri = JavaClassWrapper.wrap("android.net.Uri")
		if activity != null and Intent != null and Uri != null:
			# l'Intent si crea da un indirizzo "intent:", così non serve chiamare costruttori Java
			var spec := "intent:#Intent;action=android.intent.action.SEND;type=text/plain;S.android.intent.extra.TEXT=%s;end" % Uri.encode(msg)
			var intent = Intent.parseUri(spec, 0)
			if intent != null:
				var chooser = Intent.createChooser(intent, title)
				activity.runOnUiThread(rt.createRunnableFromGodotCallable(func(): activity.startActivity(chooser)))
				return true
	if OS.has_feature("web"):
		var ok = JavaScriptBridge.eval("(function(t){ if (navigator.share) { navigator.share({ text: t }).catch(function(){}); return true; } return false; })(%s)" % JSON.stringify(msg))
		if ok == true:
			return true
	DisplayServer.clipboard_set(msg)
	return false
