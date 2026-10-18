# Testdaten – Pfandbriefbank-Demo

Fiktive Demo-Daten (keine echten Firmen oder Personen außer dem vorgegebenen
LAM) für die Base_Chat-WebUI-Demo: über das Admin-Panel importieren
(CSV-Import → PostgreSQL), danach Chat-Fragen über die Daten stellen.

**Referenzdatum „heute“: 18.10.2026** – die Offen-/Erledigt-Logik der
KWG18-Checks ist auf dieses Datum zugeschnitten.

## Dateien

| Datei                  | Zeilen | Inhalt                                                             |
| ---------------------- | ------ | ------------------------------------------------------------------ |
| `deal.csv`             | 28     | Deals (1–50 Mio. EUR, LAM: Anantha Padmanaban, Status: Ausgezahlt) |
| `loan.csv`             | 72     | Loans (SAPID, Beträge = exakte Summe je Deal)                      |
| `release_estate.csv`   | 72     | Objekte (Marktwert ≈ 1,2–2,0× Loan-Betrag)                         |
| `business_partner.csv` | 23     | BusinessPartner (meist 1 Deal, teils mehrere)                      |
| `kwg18_check.csv`      | 66     | KWG18-Checks (Jahre 2010–2030, Offen/Erledigt)                     |
| `SYSTEM_PROMPT.md`     | –      | System Prompt für den Chatbot (Beziehungen, Aliase, SQL)           |

Format: RFC-4180-CSV (Komma), UTF-8, ISO-Daten (JJJJ-MM-TT), Beträge als
ganze EUR-Zahlen. Alle Namen, Adressen und Kennzahlen sind erfunden.

## Demo-Fragen & erwartete Antworten (Stand 18.10.2026)

**1. Welcher Kunde hat noch offene KWG18?**

- Alpenblick Immobilien KG
- Donauufer Hotels GmbH
- Elbseite Wohnbau GmbH
- Hanseatic Living GmbH & Co. KG
- Isar Bürogrundstücke GmbH
- Logistikpark Main GmbH
- Neckar Park Immobilien AG
- Nordlicht Properties GmbH
- Rheinland Grundbesitz GmbH
- Ruhr Industrie-Immobilien GmbH
- Spree City Estates GmbH
- Stadthafen Entwicklung GmbH
- Südkurve Hotelbetriebe GmbH
- Weser Quartier GmbH
- Westfalen Gewerbebau AG

**2. Welche Kunden müssen in den nächsten 3 Monaten KWG18 machen (bis 18.01.2027)?**

- Rheinland Grundbesitz GmbH (Fällig 16.11.2026)
- Nordlicht Properties GmbH (Fällig 04.12.2026)
- Westfalen Gewerbebau AG (Fällig 18.12.2026)
- Alpenblick Immobilien KG (Fällig 28.12.2026)
- Hanseatic Living GmbH & Co. KG (Fällig 09.01.2027)

**3. Welche KWG18 stehen in 2027 an?**

- Hanseatic Living GmbH & Co. KG (Fällig 09.01.2027)
- Alpenblick Immobilien KG (Fällig 22.01.2027)
- Südkurve Hotelbetriebe GmbH (Fällig 15.03.2027)
- Logistikpark Main GmbH (Fällig 20.04.2027)
- Stadthafen Entwicklung GmbH (Fällig 28.05.2027)
- Elbseite Wohnbau GmbH (Fällig 07.08.2027)
- Weser Quartier GmbH (Fällig 05.10.2027)
- Spree City Estates GmbH (Fällig 30.11.2027)
