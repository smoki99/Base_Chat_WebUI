# PostgreSQL-Setup (Lokal & CI)

## Voraussetzungen

- PostgreSQL 14+ (empfohlen: 16)
- `psql` im PATH

## 1. User & Datenbank anlegen (einmalig)

```bash
sudo -u postgres psql -c "CREATE USER chatbot WITH PASSWORD 'chatbot';"
sudo -u postgres psql -c "CREATE DATABASE chatbot OWNER chatbot;"
```

> Nur beim allerersten Mal nötig. Bei CI übernimmt der `postgres:16`-Service-Container dies automatisch.

## 2. Schema + Seed laden

```bash
bash apps/api/scripts/setup-db.sh
```

Das Script:

1. Wartet bis PostgreSQL erreichbar ist (max. 30 s)
2. `DROP TABLE IF EXISTS products CASCADE`
3. Erzeugt Tabelle `products` + 3 Indizes (GIN Full-Text-Search, category, location)
4. Lädt 100 Seed-Produkte (Hamburg, Berlin, München)
5. Druckt die Anzahl: `[db] Done. 100 products in database.`

### Eigene `DATABASE_URL` verwenden

```bash
DATABASE_URL=postgres://user:pass@host:5432/dbname bash apps/api/scripts/setup-db.sh
```

## 3. Verifizieren

```bash
# Produkt-Anzahl
PGPASSWORD=chatbot psql -U chatbot -h localhost -d chatbot -c "SELECT COUNT(*) FROM products;"

# Stichproben-Suche
PGPASSWORD=chatbot psql -U chatbot -h localhost -d chatbot \
  -c "SELECT sku, name FROM products WHERE to_tsvector('german', name) @@ plainto_tsquery('german', 'fisch') LIMIT 5;"
```

## 4. MCP-Server testen

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_products","arguments":{"query":"fisch"}}}' \
  | timeout 5 node apps/api/scripts/sql-mcp-server.mjs 2>/dev/null
```

Erwartete Antwort: JSON mit `Fischbrötchen`, `Fischstäbchen`, …

## Dateien

| Pfad                                  | Zweck                                               |
| ------------------------------------- | --------------------------------------------------- |
| `apps/api/db/schema.sql`              | Tabelle `products` + Indizes                        |
| `apps/api/db/seed.sql`                | 100 Seed-Produkte                                   |
| `apps/api/scripts/setup-db.sh`        | Reset-Script (DROP → CREATE → SEED)                 |
| `apps/api/scripts/sql-mcp-server.mjs` | MCP-Stdio-Server (`search_products`, `get_product`) |

## CI

Die CI (`ci.yml`) nutzt einen `postgres:16`-Service-Container, legt User/DB an
und führt `setup-db.sh` vor den Integrationstests aus – kein manuelles Eingreifen nötig.
