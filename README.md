# PoC — Prospecção Local + Auditoria de Site + Preview de Landing Page

PoC em Node.js (zero dependências externas) para o nicho de **Clínicas Odontológicas & Estética**:
1. Busca estabelecimentos reais via **Google Places API (New)** (`places:searchText`) ou roda em modo `--demo`.
2. Audita o `websiteUri` de cada estabelecimento (sem site, apenas rede social/Linktree, sem HTTPS, sem viewport mobile, lentidão ou erro HTTP).
3. Gera automaticamente uma **Landing Page de prévia** personalizada (`output/previews/<slug>.html`) + mensagem de abordagem pronta (`output/index.html`).

## Como gerar a API Key do Google Places

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2. Crie (ou selecione) um projeto.
3. No menu **APIs e Serviços > Biblioteca**, pesquise por **`Places API (New)`** e clique em **Ativar**.
   - *(Atenção: ative a **Places API (New)**, não apenas a Places API legada, pois este projeto usa o endpoint `places.googleapis.com/v1/places:searchText`.)*
4. Vá em **APIs e Serviços > Credenciais > Criar credenciais > Chave de API**.
5. (Recomendado) Em **Restringir chave > Restrições de API**, restrinja a chave apenas para **Places API (New)**.
6. Copie `.env.example` para `.env` e cole sua chave em `GOOGLE_PLACES_API_KEY=`.

## Como rodar

```bash
# 1. Buscar estabelecimentos reais grátis via OpenStreetMap (sem API Key):
npm run osm
# ou customizando cidade/nicho:
node src/cli.js --osm --query "clinica odontologica em Belo Horizonte MG" --max 10

# 2. Testar offline em modo demo:
npm run demo

# 3. Rodar com Google Places API (quando GOOGLE_PLACES_API_KEY estiver no .env):
npm start

# 4. Abrir o painel e as landing pages geradas no navegador:
npm run serve
```
