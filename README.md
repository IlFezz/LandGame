# Atlas

Atlas è il Basic Land Game di Magic giocabile da browser, in due, con stanze e codice d'invito.
Installabile come app su telefono (PWA). Nessuna dipendenza: serve solo Node.js 18 o più recente.

## Provarlo sul tuo computer

```bash
node server.js
```

Apri http://localhost:3000 in due finestre (una normale e una in incognito): crea la stanza nella prima, entra con il codice nella seconda.
Dallo stesso Wi‑Fi puoi giocare anche dal telefono con `http://IP-DEL-COMPUTER:3000` (l'installazione come app richiede però HTTPS, vedi sotto).

Test automatici: `npm test`.

## Metterlo online (gratis, con HTTPS)

Il server tiene le partite in memoria, quindi serve un hosting Node con WebSocket. Il più semplice è **Render**:

1. Carica questa cartella in un repository GitHub.
2. Su https://render.com → **New → Web Service** → scegli il repository.
3. Runtime: Node · Build command: *(vuoto)* · Start command: `node server.js` · Piano: Free.
4. Dopo il deploy avrai un indirizzo `https://...onrender.com`: condividilo e gioca.

Nota: sul piano gratuito il server si addormenta dopo ~15 minuti senza visite e il primo accesso impiega circa un minuto. Se il server si riavvia, le partite in corso vanno perse.

Alternative equivalenti: Railway, Fly.io, Glitch, un VPS qualsiasi (`PORT` viene letto dalle variabili d'ambiente).

## Installare come app

- **Android (Chrome):** apri il sito → menu ⋮ → *Installa app* / *Aggiungi a schermata Home*.
- **iPhone (Safari):** tasto Condividi → *Aggiungi alla schermata Home*.

## Grafica

- Stile **Atlante**: ogni terra è una tavola di un atlante vista dall'alto, in carta ritagliata a strati; il tavolo è una carta nautica con le curve di livello e al centro c'è una rosa dei venti, che fa un quinto di giro a ogni terra giocata.
- Due tavoli, a scelta nella Collezione: **Notte** (predefinito) e **Giorno**.
- Due livelli di grafica, dal menu in partita: **Leggera** (quella di sempre, resta il default) e **Avanzata (prova)** (`public/scene.js`). In Avanzata tutto il tavolo è una sola scena WebGL2 dietro l'interfaccia: le carte nel DOM restano come ancore invisibili (posizione e tocco) e la scena le ridisegna a ogni fotogramma con tavole animate (vento, onde, nebbia, lava, chiome), ombre, inclinazione mentre si trascinano, voli con rotazione. Dentro la scena avvengono anche gli effetti: onde sul tavolo, luce che prende il colore della terra, rosa dei venti che gira e particelle diverse per ogni terra (pulviscolo dorato, spruzzi, fuochi fatui, faville, foglie), più distruzione, contrasto e vittoria (`Scene.fx`, agganciato agli effetti `FX.*`). La risoluzione si abbassa da sola se i fotogrammi rallentano e, se non basta, si torna a Leggera.
- Suoni sintetizzati (nessun file audio): rumore filtrato per carta, acqua, pietra e fuoco, una voce diversa per ogni terra che entra in gioco, un filo di riverbero. La musica si fa più tesa (battito grave, timbro più aperto) quando qualcuno è a un passo dalla vittoria.
- Tutti i disegni (terre, simboli, rosa, dorso, sfondo) sono SVG generati all'avvio da `public/art.js`: nessuna immagine da scaricare. Per cambiarli si modifica quel file.
- Caratteri: TeX Gyre Adventor (licenza GUST) e Lora corsivo (licenza OFL), ridotti ai soli segni necessari con `tools/make_fonts.py` e salvati in `public/fonts/`.
- Effetti (`public/fx.js`): figurine animate solo con `transform` e `opacity` più un canvas a bassa risoluzione per la polvere, con un tetto alle particelle. Ogni terra ha il suo ingresso: sole e pula per la Pianura, marea per l'Isola, fuochi fatui per la Palude, crepa e faville per la Montagna, alberi che spuntano per la Foresta. Una terra distrutta si strappa in frammenti di carta, una terra contrastata riceve il timbro "Annullata", la vittoria accende le cinque terre sulla rosa dei venti. Dal menu si può passare a "Effetti ridotti"; sui dispositivi lenti la riduzione parte da sola.
- Le icone dell'app si rigenerano con `tools/make_icons.py`.
- Su PC e tablet in orizzontale il tavolo occupa tutto lo schermo; sul telefono in orizzontale la rosa dei venti passa a destra per lasciare spazio alle carte. Il registro è nel menu.

## Funzioni

- **Partita contro il computer nel browser**: gira tutta sul telefono con lo stesso codice del server, quindi funziona anche offline e senza aspettare che Render si svegli. Se chiudi l'app a metà, la partita riprende da dove era.
- **Tutorial giocabile** ("Impara a giocare" nella home): una partita guidata di 13 turni contro il Maestro, con mazzi preparati. Spiega tavolo, mano, mazzo, cimitero, turno, l'effetto di ogni terra, il contrasto (serve un'Isola in mano, l'Isola si sceglie da sola, la seconda carta è libera) e il passaggio di turno. Il Maestro gioca solo dopo «Avanti»; «Indietro» rilegge i passaggi già visti; la carta da usare è sollevata con l'etichetta «Gioca questa» e le altre sono spente.
- **Schermo intero**: pulsante giallo sempre presente in cima alla home e al menu, per entrare e uscire. La scelta viene ricordata: se l'ultima volta eri a schermo intero, ci si torna al primo tocco. Su iPhone, dove il browser non lo permette, spiega come installare l'app.
- **Home a schede** (barra in basso; sul telefono in orizzontale una colonna a sinistra):
  - **Gioca**: modalità contro il computer o con un amico, nome, schermo intero e musica.
  - **Profilo**: percentuale di vittorie, vittorie, serie migliore, vittoria più rapida, terre giocate, vittorie per modalità e per tipo, contrasti e terre distrutte; profili salvati e codice di trasferimento in una finestra a parte.
  - **Collezione**: tavolo (Notte/Giorno) e dorso delle carte (Bussola, Meridiani, Correnti).
  - **Impara**: tutorial, promemoria delle cinque terre, regole complete.
  - Le schede scorrono di lato; il foglio ha sempre la stessa altezza, quindi niente salti. Entrare in partita e tornare alla home ha un passaggio animato.
- **Statistiche** (scheda Profilo e menu in partita), separate tra partite contro il computer e contro altri giocatori: partite, vittorie per modalità, come vinci, terre giocate, contrasti, serie migliore. Restano sul dispositivo, una scheda per ogni nome usato; un codice di trasferimento le copia su un altro dispositivo.
- **Computer**, livello facile o normale. Il normale: valuta ogni giocata, contrasta solo quando conviene (sempre se l'avversario sta per vincere), sceglie bersagli sensati e non sbircia le carte nascoste.
- Home essenziale: si sceglie la modalità e le opzioni (difficoltà, tempo per turno) compaiono sotto.
- Musica ambient di sottofondo generata al momento, disattivabile dalla home e dal menu.
- Su PC e tablet il gioco usa tutto lo schermo: carte e campo più grandi, scorciatoie da tastiera (P passa, Esc annulla, M menu).
- Quando una terra risolve, prima avviene il suo effetto e poi la terra va al suo posto.
- Palude: la mano avversaria appare a tutto schermo su sfondo sfocato.
- Stanze con codice di 4 caratteri e link di invito; rientro automatico se cade la connessione.
- **Le carte si giocano sempre al centro della plancia**: si trascinano (la presa è immediata e la carta fluttua) oppure, con i comandi a tocco, si tocca la carta e poi il centro. Se la terra ha un bersaglio, dopo si tocca la carta da colpire; una freccia mostra chi colpisce cosa.
- Mano a ventaglio: le carte si stringono quando sono tante, tutto resta sempre a schermo.
- Cimitero compatto (un segnalino con il totale) che si apre toccandolo.
- Animazioni per ogni evento (distribuzione, pescata, giocata, contrasto, terra annullata, ingresso in gioco, distruzione, recupero, scarto, Pianura) con didascalia che spiega cosa succede.
- Azioni nel pannello centrale e direttamente sul campo (i bersagli validi lampeggiano): la mano resta sempre visibile.
- Timer per turno scelto da chi crea la stanza (30/45/60/90 secondi o illimitato). Lo stesso tempo vale per contrastare e per le scelte. Allo scadere: si passa il turno, la terra avversaria risolve, oppure la scelta viene fatta a caso.
- Un segnale rosso accanto al nome quando un giocatore è a un passo dalla vittoria.
- Spiegazioni sulla plancia attive di default; si spengono dal menu con "Info nella plancia". Se non puoi contrastare, la terra avversaria risolve da sola.
- Contrasto guidato: si vede quale Isola e quale seconda carta verranno scartate e cosa succede ("Isola + Foresta = Palude annullata").
- Testi degli effetti scritti dal punto di vista di chi guarda ("Se risolve, Marco guarderà la tua mano…").
- Menu in partita: schermo intero (in cima), comandi (trascina/tocca), effetti grafici (completi/ridotti, predefiniti completi), info nella plancia (attive di default), musica, effetti sonori, vibrazione, registro, regole, statistiche e il grande pulsante rosso «Esci dalla partita». Le animazioni hanno una sola velocità (lenta).
- Nessuno scorrimento e nessuna sovrapposizione: tutte le misure seguono l'altezza visibile vera (anche con le barre del browser visibili o entrando e uscendo dallo schermo intero); se al centro del tavolo lo spazio non basta, carta giocata, scritte e pulsanti si rimpiccioliscono insieme; home e menu si rimpiccioliscono se non ci stanno.

## Struttura

- `game.js` – motore di gioco con tutte le regole (logica pura, testabile).
- `bot.js` – giocatore computer.
- `hub.js` – stanze, timer e mosse del computer; lo usano sia il server sia il browser (partite contro il computer e tutorial, con i mazzi preparati del tutorial).
- `server.js` – server HTTP + WebSocket; serve anche `game.js`, `bot.js` e `hub.js` al browser.
- `public/` – client (HTML/CSS/JS), tutorial (`tutorial.js`), statistiche (`stats.js`), disegni (`art.js`), effetti (`fx.js`), caratteri (`fonts/`), manifest e service worker.
- `tools/make_fonts.py`, `tools/make_icons.py` – riducono i caratteri e generano le icone.
- `preview-stili/` – le anteprime grafiche usate per scegliere lo stile (non fanno parte del gioco).
- `test/` – test delle regole, test end-to-end con due client, timer, computer e tutorial.

## Regole implementate

- Mazzo da 50 carte (10 per tipo), 5 carte iniziali, niente mulligan, chi inizia salta la prima pescata.
- Una terra per turno; si vince appena una terra entra in gioco e si ha dominio (5 tipi) o 5 terre uguali.
- **Pianura**: riattiva l'effetto di un'altra tua terra non‑Pianura in gioco.
- **Isola**: entrando peschi 1. Dalla mano, scartata con un'altra terra, contrasta la terra appena giocata (e il suo effetto). Un contrasto si può contrastare a sua volta.
- **Palude**: guardi la mano avversaria e scegli una terra da scartare.
- **Montagna**: distruggi una terra avversaria.
- **Foresta**: riprendi in mano una terra dal tuo cimitero.
- I bersagli di Montagna, Foresta e Pianura si dichiarano prima della finestra di contrasto. La Palude e gli effetti riattivati dalla Pianura scelgono alla risoluzione.
- Senza bersagli validi la terra si può giocare comunque, senza effetto.
- La finestra di contrasto viene offerta ogni volta che l'avversario ha almeno 2 carte in mano, così non si rivela se ha un'Isola.
- Mazzo vuoto: non si pesca. Quando entrambi i mazzi sono vuoti e le mani sono vuote, oppure entrambi passano di fila, vince chi ha più tipi distinti in gioco; in parità vince chi ha giocato l'ultima terra.
