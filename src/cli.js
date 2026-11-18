import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from './env.js';
import { getDemoPlaces, searchGooglePlaces, searchOpenStreetMap } from './places.js';
import { auditWebsite, scoreOpportunity } from './audit.js';
import {
  buildPitchMessage,
  renderClinicLandingHtml,
  renderDashboardHtml,
  slugify,
} from './preview-generator.js';

function parseArgs(argv) {
  const args = { demo: false, osm: false, query: null, maxResults: null };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--demo') {
      args.demo = true;
    } else if (token === '--osm') {
      args.osm = true;
    } else if (token === '--query' && argv[i + 1]) {
      args.query = argv[i + 1];
      i += 1;
    } else if (token === '--max' && argv[i + 1]) {
      args.maxResults = Number(argv[i + 1]);
      i += 1;
    }
  }
  return args;
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const query = args.query || process.env.DEFAULT_QUERY || 'clinica odontologica em Campinas SP';
  const maxResults = args.maxResults || Number(process.env.MAX_RESULTS) || 10;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  const mode = args.demo
    ? 'DEMO'
    : args.osm || !apiKey
    ? 'OPENSTREETMAP'
    : 'GOOGLE_PLACES_API';

  if (mode === 'OPENSTREETMAP' && !args.osm && !apiKey) {
    console.log(
      '[info] GOOGLE_PLACES_API_KEY não configurada — usando OpenStreetMap (grátis, sem API key).\n'
    );
  }

  console.log(
    mode === 'DEMO'
      ? `Buscando leads em modo DEMO (simulação para "${query}")...`
      : mode === 'OPENSTREETMAP'
      ? `Buscando até ${maxResults} estabelecimentos reais no OpenStreetMap para: "${query}"...`
      : `Buscando até ${maxResults} estabelecimentos no Google Places API para: "${query}"...`
  );

  const places =
    mode === 'DEMO'
      ? getDemoPlaces()
      : mode === 'OPENSTREETMAP'
      ? await searchOpenStreetMap({ query, maxResults })
      : await searchGooglePlaces({ apiKey, query, maxResults });

  if (places.length === 0) {
    console.log('Nenhum estabelecimento encontrado para essa busca.');
    return;
  }

  const outputDir = path.resolve(process.cwd(), 'output');
  const previewsDir = path.join(outputDir, 'previews');
  const dataDir = path.join(outputDir, 'data');
  fs.mkdirSync(previewsDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  const basePreviewUrl = process.env.PREVIEW_BASE_URL || 'http://localhost:3000';
  const usedSlugs = new Set();

  const processedLeads = await Promise.all(
    places.map(async (place) => {
      const audit = await auditWebsite(place.websiteUri);
      const opportunity = scoreOpportunity(place, audit);

      let slug = slugify(place.name) || 'clinica';
      let suffix = 2;
      while (usedSlugs.has(slug)) {
        slug = `${slugify(place.name)}-${suffix}`;
        suffix += 1;
      }
      usedSlugs.add(slug);

      const shouldGeneratePreview = audit.status !== 'OK';
      let previewFile = null;
      let pitch = null;

      const leadRecord = {
        ...place,
        slug,
        audit,
        opportunity,
      };

      if (shouldGeneratePreview) {
        previewFile = `previews/${slug}.html`;
        const fullPreviewUrl = `${basePreviewUrl.replace(/\/$/, '')}/${previewFile}`;
        pitch = buildPitchMessage(leadRecord, fullPreviewUrl);

        const html = renderClinicLandingHtml(leadRecord);
        fs.writeFileSync(path.join(outputDir, previewFile), html, 'utf8');
      }

      const fullLead = { ...leadRecord, previewFile, pitch };
      fs.writeFileSync(
        path.join(dataDir, `${slug}.json`),
        JSON.stringify(fullLead, null, 2),
        'utf8'
      );

      return fullLead;
    })
  );

  processedLeads.sort((a, b) => b.opportunity.score - a.opportunity.score);

  const meta = {
    generatedAt: new Date().toISOString(),
    mode,
    query,
    total: processedLeads.length,
    opportunities: processedLeads.filter((l) => l.audit.status !== 'OK').length,
  };

  fs.writeFileSync(
    path.join(outputDir, 'leads-report.json'),
    JSON.stringify({ meta, leads: processedLeads }, null, 2),
    'utf8'
  );

  const dashboardHtml = renderDashboardHtml(processedLeads, meta);
  fs.writeFileSync(path.join(outputDir, 'index.html'), dashboardHtml, 'utf8');

  console.log('\nResumo da execução:');
  console.log(`- Total analisado: ${meta.total}`);
  console.log(`- Oportunidades com preview gerado: ${meta.opportunities}`);
  for (const lead of processedLeads) {
    console.log(
      `  • [${lead.opportunity.priority.toUpperCase()}] ${lead.name} -> ${lead.audit.label}` +
        (lead.previewFile ? ` (${lead.previewFile})` : '')
    );
  }
  console.log('\nPara visualizar o painel e as páginas no navegador, rode: npm run serve');
}

main().catch((error) => {
  console.error('\nFalha ao executar PoC:', error.message);
  process.exit(1);
});
