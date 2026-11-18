# Atlas — versione Godot

Il gioco rifatto in **Godot 4.7 (GDScript)** per Android, iPhone e web. Regole e funzioni sono quelle della versione web (vedi il `README.md` nella cartella principale).

## A che punto siamo

1. ✅ **Motore delle regole e computer**, tradotti da `game.js` e `bot.js`, con i test.
2. ✅ **Tavolo e carte giocabili contro il computer, offline**, con home a schede, sfide, tutorial, statistiche, obiettivi, collezione, suoni e musica.
3. Grafica nuova, effetti e suoni veri.
4. ✅ **Partite tra amici** con lo stesso server Node (`server.js`) della versione web.
5. Pubblicazione sugli store.

Premendo ▶ nell'editor si apre la home a schede, come nella versione web (sul telefono in orizzontale le schede sono una colonna a sinistra):
- **Gioca**: schermo intero (giallo, sempre in cima), musica ♪, nome, difficoltà, tempo per turno (30/45/60/90 secondi o illimitato), «Inizia la partita».
- **Sfide**: la sfida del giorno (stesso mescolamento della versione web per la stessa data: stesse mani nel browser e nell'app) e le sei sfide a tema, con i record.
- **Profilo**: statistiche contro il computer e contro giocatori; «Profili e trasferimento» con il codice, che ha lo stesso formato del web (un profilo si copia dal browser all'app e viceversa).
- **Collezione**: cieli del tavolo Crepuscolo, Alba, Notte stellata, Aurora e sette dorsi (Sole, Luna, Colline, Monti, Pini, Onde, Stelle), con i lucchetti degli obiettivi; elenco dei 15 obiettivi.
- **Impara**: tutorial con il Maestro (13 turni, stessi testi, «Avanti»/«Indietro», l'elemento di cui si parla è cerchiato e la carta da usare porta «Gioca questa»), le cinque terre, le regole complete.

Se l'app viene chiusa a metà partita, alla riapertura la partita riprende da dove era. Le sfide non contano per statistiche, obiettivi e sblocchi.

### Il tavolo (passo 2, prima parte)
- Stesse misure della versione web in tutti i formati: telefono verticale, telefono orizzontale (rosa dei venti a destra), tablet e PC (campo al centro). Le misure sono in "punti" come i px del browser: su un telefono ad alta densità tutto viene ingrandito in proporzione. Niente scorrimento e niente sovrapposizioni (c'è un test che lo controlla in 9 formati).
- **Stile «Orizzonti»** (scelto dal proprietario il 17/11/2026, al posto dell'Atlante della versione web): ogni terra è un paesaggio piatto a strati con cielo sfumato e sole o luna (Pianura dune dorate, Isola mare e isolotti, Palude crepuscolo con alberi spogli, Montagna picchi rossi, Foresta pini). Sfondo: cielo che sfuma dal blu notte al viola con colline in fondo. Carte con il paesaggio in alto e la fascia del nome in basso; campo a caselle quadrate con il numero sotto (spente se vuote); la terra che manca per vincere è tratteggiata in azzurro con «+». Al centro la terra giocata compare in un grande cerchio. Carattere Sora (licenza SIL OFL, in `assets/fonts/`). Tutti i disegni sono SVG generati da `scripts/ui/scenery.gd`, trasformati in immagini alla misura esatta dello schermo: sempre nitidi.
- Sul telefono il gioco è sempre in verticale (anche girando il telefono) e a schermo intero vero (barre di sistema nascoste; in alto al centro resta libero lo spazio del foro della fotocamera). La carta si gioca lasciandola in qualunque punto del campo centrale. La mano dell'avversario e i mazzi si vedono come carte coperte, con il dorso scelto nella Collezione. La carta contrastata porta un timbro azzurro «Contrastata» (oro «Torna in gioco» se il contrasto viene contrastato). Nella home si cambia scheda anche scorrendo il dito; le sfide a tema si aprono a tendina con «Gioca la sfida»; gli obiettivi mostrano accanto l'oggetto che sbloccano.
- Niente giallo: evidenziazioni, interruttori e pulsanti sono bianchi o trasparenti. Le scritte sulla plancia sono tutte uguali (grassetto, senza sfondo) e stanno in alto nello spazio centrale, lontane dal tuo campo. Il tempo per turno è un anello bianco sottile con i secondi, accanto alla scritta di stato (rosso tenue negli ultimi 5 secondi). I fumetti delle reazioni stanno sopra le carte ma sotto menu e finestre.
- A inizio partita il mazzo si mescola al centro e le carte vengono distribuite una alla volta, alternate. La carta giocata vola dal punto esatto in cui la lasci (o dal centro, se aspettava il bersaglio) e non si sdoppia; le carte scartate partono proprio da quella toccata. Le frecce sono scie bianche morbide con un anello sul bersaglio. Quando un giocatore ha 4 terre uguali il numero sotto la casella è in un cerchio pieno (rosso per l'avversario) e la casella ha un alone; quando ci arriva l'avversario compare anche «Attento: BOT ha 4 …». Menu e finestre stanno sempre sopra mano e tempo. Il cambio di scheda nella home ha sempre la stessa animazione.
- Effetti coerenti con lo stile, leggeri: il paesaggio entra nel cerchio con un rimbalzo; la casella della terra che entra si gonfia con un'onda dorata; il contrasto manda onde azzurre dal cerchio; la terra annullata si spegne e il cerchio si richiude; sulla terra distrutta scende la notte; nel tuo turno il cielo si scalda appena e le colline scivolano; la vittoria accende raggi dorati che girano piano. I pulsanti si abbassano un poco quando li premi.
- Le carte si giocano al centro: trascinandole (la presa è immediata) oppure toccando la carta e poi il centro. Montagna, Foresta e Pianura restano al centro finché non si tocca il bersaglio (che lampeggia); ✕ annulla. La Foresta apre da sola il cimitero.
- Contrasto guidato: «Contrasta» segna l'Isola da scartare, si tocca in mano la seconda carta, la formula mostra cosa succede («Isola + Foresta → Montagna ✕»), poi «Conferma». Se non puoi contrastare, la terra avversaria risolve da sola dopo una pausa casuale.
- Palude: la mano avversaria a tutto schermo, si tocca la carta da far scartare.
- Tenendo premuta una carta (in mano, in campo, al centro) la vedi in grande con il suo effetto.
- Ogni evento ha la sua animazione (pescata, giocata, contrasto, annullamento, ingresso, distruzione, recupero, scarto) con la didascalia; la rosa dei venti fa un quinto di giro a ogni terra giocata.
- Menu: schermo intero, registro della partita, «Esci dalla partita». Fine partita con «Rivincita». Su PC: P passa, Esc annulla, M menu.

- Freccia dalla terra giocata al suo bersaglio; tempo per turno con la barra (rossa negli ultimi 5 secondi, poi passa il turno o lascia risolvere da solo); reazioni rapide (sei frasi, anche il computer ogni tanto risponde).
- Suoni e musica sintetizzati come nel browser (stesse note); la musica si prepara su un thread la prima volta e poi si riusa. Vibrazione sul telefono.
- Menu in partita: schermo intero, info nella plancia, musica, effetti sonori, vibrazione, reazioni rapide, registro, regole, statistiche, «Esci dalla partita» con conferma.

### Partite tra amici (passo 4)
- Nella scheda Gioca, «Con un amico» apre una finestra: tempo per turno, «Crea una stanza» oppure il codice di 4 caratteri e «Entra». Chi crea la stanza vede il codice grande, «Copia il codice» e «In attesa che il tuo amico entri…».
- L'app parla con lo stesso server del sito (`server.js`, WebSocket, stessi messaggi di `hub.js`): si gioca anche contro chi usa il browser. Le regole girano sul server; il tavolo è lo stesso della partita contro il computer (`scripts/net/remote_game.gd` gli presenta la partita del server come se fosse il motore locale).
- Il tempo per turno lo tiene il server (allo scadere gioca lui). Reazioni rapide tra i due giocatori. Se la linea cade l'app si ricollega da sola e rientra nella stanza; se cade all'avversario compare «… si è scollegato: aspetta che rientri».
- Tra giocatori ci si arrende (dal menu: «Arrenditi», con conferma) invece di uscire. A fine partita «Rivincita» parte quando la chiedono tutti e due. Le partite contano nelle statistiche «contro giocatori» e per l'obiettivo «In compagnia».
- Indirizzo del server: `DEFAULT_URL` in `scripts/net/net.gd` (wss://landgame-mrsc.onrender.com/ws, lo stesso del sito); per le prove si cambia con `--server=ws://localhost:3999`.
- Prova automatica (serve il server acceso sul PC: `PORT=3999 node server.js`):
  `godot --headless --path godot -s res://tests/only.gd -- test_online --server=ws://localhost:3999` — crea una stanza, fa entrare un secondo giocatore, gioca una partita intera, reazioni, rivincita e resa.

### Foto di prova
`--finestra=390x844 --scala=1 --partita=normal --da-solo --foto=file.png --attesa=20` (dopo `--` sulla riga di comando di Godot) apre il tavolo alla misura voluta, fa giocare il computer anche al posto tuo e salva una foto dello schermo.

## Aprirlo

Godot 4.7 → *Importa* → scegli `godot/project.godot`.

Il renderer è **Compatibilità** (OpenGL): è l'unico che funziona anche nella versione web e va bene anche sui telefoni più vecchi; per un gioco di carte in 2D non serve altro.

## Provarlo sul telefono Android

Serve una volta sola: i modelli di esportazione di Godot 4.7.2 (Editor → Gestisci modelli di esportazione), l'Android SDK e Java 17 indicati nelle impostazioni dell'editor (Esporta → Android), e sul telefono il «Debug USB» attivo (Opzioni sviluppatore).

Poi, con il telefono collegato via cavo:

```bash
bash godot/tools/android.sh
```

crea `build/atlas.apk` (versione di prova), la installa e avvia Atlas. Il tasto «Indietro» chiude le finestre aperte, in partita apre il menu, dalla home esce. Home e tavolo stanno dentro la zona sicura dello schermo (fotocamera e barre di sistema).

## Test

```bash
godot --headless --path godot -s res://tests/run_tests.gd
```

(`godot` è l'eseguibile di Godot, per esempio `F:\Godot_v4.7.2-stable_win64.exe\Godot_v4.7.2-stable_win64_console.exe`.) Esce con codice 0 se tutto va bene. Dura circa un minuto, quasi tutto per le 2000 partite casuali e per le partite del computer difficile.

Altri due script, da lanciare allo stesso modo:
- `tests/bench.gd` misura la velocità delle simulazioni del computer difficile.
- `tests/strength.gd` fa giocare 100 partite tra difficile e normale e dice quante ne vince il difficile (qualche minuto).

## Struttura

- `scripts/rules/game.gd` (`AtlasGame`) – motore delle regole, logica pura: stesse regole, stessi messaggi del registro, stesse viste ed eventi di `game.js`. Le chiavi dei dizionari che escono dal motore (viste, eventi, azioni) sono le stesse della versione web, così al passo 4 il client parlerà con lo stesso server senza traduzioni.
- `scripts/rules/bot.gd` (`AtlasBot`) – computer facile, normale e difficile, come `bot.js`. Con `decide_async()` pensa su un thread separato e risponde con il segnale `decided`: il tavolo non si blocca mai.
- `scripts/rules/sim.gd` – la simulazione veloce usata solo dal difficile: stesse regole e stesse scelte del computer normale, ma con soli numeri. I test la confrontano mossa per mossa con la partita vera.
- `scripts/main.gd`, `scenes/main.tscn` – avvio, scala dello schermo, home o partita ripresa.
- `scripts/net/` – `net.gd` (collegamento WebSocket al server, si ricollega da solo), `remote_game.gd` (la partita del server vista dal tavolo).
- `scripts/app/` – `modes.gd` (sfide, sfida del giorno, tutorial: da hub.js), `profile.gd` (statistiche e obiettivi: da stats.js e goals.js), `prefs.gd` (preferenze), `sound.gd` (suoni, musica, vibrazione).
- `scripts/ui/home.gd` (home a schede), `scripts/ui/sheets.gd` (regole, obiettivi, profilo, trasferimento), `scripts/ui/coach.gd` (il Maestro del tutorial).
- `scripts/ui/table.gd` – il tavolo: disposizione, input, animazioni, partita contro il computer.
- `scripts/ui/card_view.gd`, `scripts/ui/widgets.gd`, `scripts/ui/art.gd`, `scripts/ui/scenery.gd` – carta, elementi del tavolo ed effetti, colori e caratteri, paesaggi/dorsi/cieli in SVG.
- `tools/shots.gd` – foto di tutte le schermate in situazioni precise: `godot --path godot -s res://tools/shots.gd -- <cartella> 354 792 1.25` (telefono del proprietario; 792 354 per l'orizzontale, 1280 720 1 per il PC).
- `tests/` – i test di `test/game.test.js` e `test/bot.test.js` tradotti, i test della simulazione veloce, di sfide/statistiche/obiettivi/trasferimento (`test_modes.gd`) e del tavolo (si gioca con il mouse simulato: trascinare, toccare, bersagli, contrasto, Palude, Foresta, una partita intera, il tutorial completo seguendo il Maestro, partita salvata e ripresa, tempo scaduto, freccia, nessuna sovrapposizione in 9 formati). `tests/only.gd -- test_table` esegue una serie sola.

Differenze dalla versione web, tutte interne:
- `opts` accetta anche `seed` (un numero): con lo stesso seme la partita è sempre uguale. Servirà alla sfida del giorno.
- GDScript è circa 3 volte più lento del browser. Per giocare forte come sul web, il difficile non pensa 120 ms ma fa almeno 80 giri di simulazione (quelli che il browser fa in 120 ms), che su un PC sono circa 300–450 ms, e mai più di un secondo, anche su un telefono lento. Pensa su un thread, quindi l'attesa non blocca nulla e si sovrappone alle animazioni. Prova con `tests/strength.gd`: batte il normale 59 volte su 100 (nel browser circa 65).

Non ancora fatti (passo 4): le partite tra amici attraverso il server (stanze, codice, rientro, resa).
