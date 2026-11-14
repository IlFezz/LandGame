# Basic Land Game online

Il Basic Land Game di Magic giocabile da browser, in due, con stanze e codice d'invito.
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
- Due temi, a scelta dal menu: **Notte** (predefinito) e **Giorno**.
- Tutti i disegni (terre, simboli, rosa, dorso, sfondo) sono SVG generati all'avvio da `public/art.js`: nessuna immagine da scaricare. Per cambiarli si modifica quel file.
- Caratteri: TeX Gyre Adventor (licenza GUST) e Lora corsivo (licenza OFL), ridotti ai soli segni necessari con `tools/make_fonts.py` e salvati in `public/fonts/`.
- Effetti (`public/fx.js`): figurine animate solo con `transform` e `opacity` più un canvas a bassa risoluzione per la polvere, con un tetto alle particelle. Ogni terra ha il suo ingresso: sole e pula per la Pianura, marea per l'Isola, fuochi fatui per la Palude, crepa e faville per la Montagna, alberi che spuntano per la Foresta. Una terra distrutta si strappa in frammenti di carta, una terra contrastata riceve il timbro "Annullata", la vittoria accende le cinque terre sulla rosa dei venti. Dal menu si può passare a "Effetti ridotti"; sui dispositivi lenti la riduzione parte da sola.
- Le icone dell'app si rigenerano con `tools/make_icons.py`.
- Su PC e tablet in orizzontale il tavolo occupa tutto lo schermo; sul telefono in orizzontale la rosa dei venti passa a destra per lasciare spazio alle carte. Il registro è nel menu.

## Funzioni

- **Partita contro il computer**, livello facile o normale. Il normale: valuta ogni giocata, contrasta solo quando conviene (sempre se l'avversario sta per vincere), sceglie bersagli sensati e non sbircia le carte nascoste.
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
- Plancia pulita: le spiegazioni testuali si attivano dal menu con "Info nella plancia". Se non puoi contrastare, la terra avversaria risolve da sola.
- Contrasto guidato: si vede quale Isola e quale seconda carta verranno scartate e cosa succede ("Isola + Foresta = Palude annullata").
- Testi degli effetti scritti dal punto di vista di chi guarda ("Se risolve, Marco guarderà la tua mano…").
- Menu in partita: comandi (trascina/tocca), velocità animazioni (lenta/media/veloce, predefinita lenta), tema (Notte/Giorno), effetti grafici (completi/ridotti), info nella plancia, musica, effetti sonori, vibrazione, registro, regole, esci.

## Struttura

- `game.js` – motore di gioco con tutte le regole (logica pura, testabile).
- `bot.js` – giocatore computer.
- `server.js` – server HTTP + WebSocket, gestione stanze e riconnessione.
- `public/` – client (HTML/CSS/JS), disegni (`art.js`), effetti (`fx.js`), caratteri (`fonts/`), manifest e service worker.
- `tools/make_fonts.py`, `tools/make_icons.py` – riducono i caratteri e generano le icone.
- `preview-stili/` – le anteprime grafiche usate per scegliere lo stile (non fanno parte del gioco).
- `test/` – test delle regole e test end-to-end con due client.

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
