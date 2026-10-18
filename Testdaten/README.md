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
