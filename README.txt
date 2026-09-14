MATTEO'S FINANCE
================

Descrizione
-----------
Matteo's Finance è una web app personale per registrare entrate e uscite, controllare l'andamento mensile, costruire previsioni finanziarie e pianificare obiettivi economici.

I dati dell'app vengono salvati localmente nel dispositivo tramite la memoria locale del browser.

FUNZIONI PRINCIPALI
===================

1. DASHBOARD
------------
La Dashboard mostra il riepilogo finanziario del mese selezionato:
- totale disponibile;
- saldo del mese;
- entrate;
- uscite;
- risparmio;
- ripartizione delle uscite per categoria;
- calendario giornaliero del mese, visualizzato 7 giorni alla volta;
- navigazione tra i giorni del mese tramite frecce e swipe;
- evidenziazione del giorno corrente.

2. MOVIMENTI
------------
Consente di registrare e consultare:
- entrate;
- uscite;
- data;
- descrizione;
- categoria;
- importo.

I movimenti possono essere filtrati per mese, per entrate o per uscite.

Le categorie includono Auto, che ha sostituito la precedente categoria Benzina. I dati più vecchi eventualmente salvati con la categoria Benzina vengono riconosciuti come Auto.

3. PREVISIONI
-------------
La funzione Previsioni serve a stimare il comportamento finanziario dei mesi futuri sulla base dello storico dell'utente.

LOGICA DELLA PREVISIONE

La previsione utilizza tutti i mesi storici disponibili che precedono il mese oggetto della previsione, escludendo sempre il mese in corso.

In altre parole:
- il mese corrente non viene utilizzato per costruire la propria previsione;
- i movimenti reali inseriti nel mese corrente non modificano la media storica della previsione;
- con il passare dei mesi, un mese appena concluso entra nello storico e contribuisce alle previsioni successive;
- in questo modo la base statistica della previsione cresce progressivamente con i dati disponibili.

La media viene calcolata categoria per categoria. Se una categoria non compare in un determinato mese storico, quel mese contribuisce con valore zero per quella categoria.

Non viene applicato alcun fattore artificiale -5% sulle entrate o +5% sulle uscite: la previsione attuale utilizza la media storica effettiva.

EVENTI FUTURI

Gli eventi futuri permettono di inserire entrate o uscite già conosciute, ma che non sono ancora state registrate come movimenti reali.

Gli eventi futuri vengono aggiunti alla previsione con il loro importo reale.

Quindi la previsione è composta da:
MEDIA STORICA + EVENTI FUTURI

I movimenti reali del mese corrente non vengono aggiunti alla previsione.

Per le uscite previste, anche la ripartizione per categoria utilizza la stessa logica del totale: media storica di tutti i mesi precedenti disponibili + eventuali eventi futuri, senza inserire le uscite reali del mese corrente.

CONFRONTO PREVISIONE / REALTÀ

All'inizio del mese successivo viene conservata una fotografia della previsione del mese precedente.

Il programma può quindi confrontare:
- risparmio previsto;
- risparmio reale;
- differenza tra i due valori.

La previsione storica utilizzata per il confronto viene congelata tramite uno snapshot, in modo che i dati inseriti successivamente non cambino retroattivamente il valore di riferimento.

4. OBIETTIVI
------------
La sezione Obiettivi serve a pianificare una spesa importante o una meta economica, per esempio un viaggio, un acquisto, un corso o un progetto personale.

Ogni obiettivo può avere:
- nome;
- costo;
- data iniziale;
- data finale prevista;
- priorità bassa, media o alta;
- importo già salvato;
- analisi della possibilità di raggiungimento.

IN CORSO

Gli obiettivi non ancora completati vengono mostrati nella sezione In corso.

ANALIZZA

L'analisi confronta il costo dell'obiettivo con le risorse che le previsioni possono permettere di destinare all'obiettivo.

Tiene conto del periodo dell'obiettivo, della priorità, delle risorse disponibili, delle previsioni e dei cuscinetti finanziari impostati.

Il risultato può indicare se l'obiettivo è:
- in linea;
- in ritardo;
- non finanziabile nelle condizioni attuali.

Il programma può inoltre stimare il mese di possibile completamento.

CUSCINETTO

Gli obiettivi non devono necessariamente consumare tutto il saldo disponibile. Il sistema considera il cuscinetto minimo e il cuscinetto ideale impostati dall'utente per mantenere una riserva di sicurezza.

PIÙ OBIETTIVI

Quando sono presenti più obiettivi contemporaneamente, la disponibilità viene distribuita considerando soprattutto priorità e scadenza, così da favorire gli obiettivi più urgenti o importanti.

QUALITÀ DEI DATI
-----------------
Nelle Impostazioni è possibile indicare il capitale iniziale e il mese da cui è iniziata la registrazione dei movimenti.

Se l'utente prova a registrare un movimento in un mese che supera una o più mensilità precedenti non compilate, Matteo's Finance mostra una finestra di avviso con le opzioni Annulla e Ignora e prosegui. Se l'utente prosegue, la registrazione viene effettuata ma Previsioni e Obiettivi mostrano in rosso l'avviso: "i dati visualizzati non sono affidabili".

Il mese impostato come inizio della registrazione è considerato il punto di partenza del periodo, anche se non contiene movimenti. Il controllo riguarda esclusivamente i buchi presenti nei mesi successivi, quando l'utente ha già iniziato a registrare dati.

5. TIENI NOTA
-------------
Tieni nota è un registro delle spese appartenenti a uno specifico obiettivo.

Le note non sono movimenti finanziari reali.

Ogni nota contiene:
- data;
- descrizione;
- importo.

Le note vengono visualizzate in ordine cronologico e il programma mostra il totale delle spese annotate.

Il semplice salvataggio delle note non modifica il saldo dell'app.

6. FINE OBIETTIVO
-----------------
Quando un obiettivo viene terminato, il programma chiede se sono state inserite tutte le spese.

Se la risposta è NO, l'utente può tornare al registro e aggiungere altre spese.

Se la risposta è SÌ:
- il programma somma tutte le spese annotate;
- crea una sola movimentazione reale di tipo uscita;
- assegna alla movimentazione la categoria Obiettivi;
- utilizza come descrizione il nome dell'obiettivo;
- utilizza come data la data di completamento;
- utilizza come importo il totale delle note.

In questo modo molte piccole spese di un obiettivo vengono trasformate in un'unica movimentazione reale, mantenendo però il dettaglio originale nelle note.

Dopo la registrazione viene mostrata la schermata di vittoria e l'obiettivo passa nella sezione Completati.

7. COMPLETATI
-------------
Gli obiettivi raggiunti vengono spostati nella sezione Completati.

Ogni obiettivo completato può essere consultato per vedere lo storico delle spese annotate.

Un obiettivo completato può anche essere archiviato tramite il piccolo pulsante Archivia presente nella sua card.

8. ARCHIVIATI
-------------
Archiviati contiene gli obiettivi che sono stati completati ma che l'utente non vuole più mantenere nella lista principale dei Completati.

L'archiviazione non cancella l'obiettivo, le note, la movimentazione o lo storico.

Nella sezione Archiviati viene mostrata solamente una riga con il nome dell'obiettivo. La riga è cliccabile.

Toccando la riga viene visualizzata la card completa dell'obiettivo archiviato, con:
- informazioni dell'obiettivo;
- data di completamento;
- importo registrato;
- possibilità di consultare le note;
- pulsante Ripristina.

Premendo Ripristina, l'obiettivo torna nella sezione Completati.

9. BACKUP E IMPOSTAZIONI
------------------------
Le Impostazioni raccolgono le funzioni di configurazione dell'app e di gestione dei dati disponibili nella versione corrente.

Sono disponibili anche:
- capitale iniziale;
- mese di inizio registrazione;
- cuscinetto di sicurezza;
- cancellazione dei movimenti;
- backup ed esportazione/importazione dei dati;
- reset del mese o dell'intero archivio.

OBIETTIVO GENERALE DEL PROGRAMMA
================================
Matteo's Finance distingue tre livelli principali:

MOVIMENTI = ciò che è realmente successo.
PREVISIONI = ciò che, sulla base dello storico e degli eventi conosciuti, è ragionevole aspettarsi.
OBIETTIVI = ciò che l'utente vuole riuscire a finanziare e realizzare.

L'obiettivo dell'app è quindi aiutare l'utente a capire non solo quanto denaro ha oggi, ma anche come sta andando, cosa può aspettarsi nei prossimi mesi e quali obiettivi può realisticamente permettersi.
