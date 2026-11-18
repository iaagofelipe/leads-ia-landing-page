function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function slugify(text) {
  return String(text || 'clinica')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function buildWhatsappUrl(phone, clinicName) {
  const digits = String(phone || '').replace(/\D/g, '');
  const normalized =
    digits.length >= 10 && !digits.startsWith('55') ? `55${digits}` : digits;
  const text = encodeURIComponent(
    `Olá! Vi a página da ${clinicName} e gostaria de agendar uma avaliação.`
  );
  return normalized ? `https://wa.me/${normalized}?text=${text}` : '#contato';
}

function extractCity(address) {
  const raw = String(address || '').trim();
  const withDash = raw.match(/(?:,|•)\s*([^,•-]+?)\s*-\s*[^,•\d]+$/);
  if (withDash) return withDash[1].trim();
  const simple = raw.match(/^([^,•-]+?)(?:\s+[A-Z]{2})?$/);
  if (simple && raw && !/\d/.test(simple[1])) return simple[1].trim();
  return 'sua região';
}

/**
 * Monta mensagem personalizada de abordagem conforme o diagnóstico técnico do lead.
 */
export function buildPitchMessage(lead, previewUrl) {
  const ratingText =
    lead.rating && lead.reviewCount
      ? `vi que vocês têm nota ${lead.rating.toFixed(1)} (${lead.reviewCount} avaliações) no Google`
      : 'vi o perfil de vocês no Google';

  if (lead.audit.status === 'NO_WEBSITE') {
    return (
      `Olá, equipe da ${lead.name}! Tudo bem? ` +
      `Estava pesquisando clínicas bem avaliadas na região e ${ratingText}, mas notei que vocês ainda não têm uma página própria vinculada lá. ` +
      `Para mostrar na prática como isso ajuda a transformar buscas do Google em agendamentos no WhatsApp, montei uma prévia gratuita com a identidade de vocês: ${previewUrl} ` +
      `Se gostarem, eu coloco no ar com domínio próprio e cuido de toda a parte técnica e atualizações por uma mensalidade acessível. Posso te explicar em 2 minutos como funciona?`
    );
  }

  if (lead.audit.status === 'SOCIAL_ONLY') {
    return (
      `Olá, equipe da ${lead.name}! Tudo bem? ` +
      `Notei que vocês ${ratingText}, mas o link do Google está levando direto para rede social, onde muitos pacientes acabam se distraindo antes de chamar no WhatsApp. ` +
      `Montei uma prévia de página focada em conversão e agendamento direto para a ${lead.name}: ${previewUrl} ` +
      `Se fizer sentido, consigo colocar no ar em domínio próprio e manter tudo atualizado para vocês. Quer dar uma olhada sem compromisso?`
    );
  }

  const mainIssue = lead.audit.issues[0] || 'problemas de carregamento e adaptação no celular';
  return (
    `Olá, equipe da ${lead.name}! Tudo bem? ` +
    `Ao acessar o site cadastrado no perfil de vocês no Google, notei um ponto técnico que pode estar fazendo pacientes desistirem antes de agendar (${mainIssue.toLowerCase()}). ` +
    `Aproveitei e preparei uma prévia modernizada e rápida para celular de como a página de vocês poderia ficar: ${previewUrl} ` +
    `Se curtirem, eu assumo a publicação no domínio de vocês e a manutenção contínua. Posso te mandar os detalhes?`
  );
}

/**
 * Gera o HTML completo da Landing Page de prévia para o nicho de Clínica Odontológica / Estética.
 */
export function renderClinicLandingHtml(lead) {
  const name = escapeHtml(lead.name);
  const category = escapeHtml(lead.category || 'Clínica Odontológica & Estética');
  const address = escapeHtml(lead.address || 'Endereço sob consulta');
  const phone = escapeHtml(lead.phone || 'Atendimento via WhatsApp');
  const city = escapeHtml(extractCity(lead.address));
  const whatsappUrl = escapeHtml(buildWhatsappUrl(lead.internationalPhone || lead.phone, lead.name));
  const mapsUrl = escapeHtml(lead.googleMapsUri || '#localizacao');
  const hasRating = typeof lead.rating === 'number';
  const ratingBadge = hasRating
    ? `★ ${lead.rating.toFixed(1)} no Google (${lead.reviewCount || 0} avaliações)`
    : 'Atendimento humanizado e especializado';

  const hoursHtml =
    lead.openingHours && lead.openingHours.length > 0
      ? lead.openingHours
          .map(
            (item) =>
              `<li class="flex items-center justify-between border-b border-slate-100 py-2 text-sm text-slate-600"><span>${escapeHtml(item)}</span></li>`
          )
          .join('\n')
      : `<li class="text-sm text-slate-600 py-2">Segunda a Sexta: 08:30 – 18:30</li>
         <li class="text-sm text-slate-600 py-2">Sábado: 08:30 – 12:30</li>`;

  return `<!doctype html>
<html lang="pt-BR" class="scroll-smooth">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name} — Prévia Exclusiva</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-50 text-slate-800 antialiased">
  <!-- Barra discreta de demonstração -->
  <div class="bg-slate-900 text-slate-100 text-xs py-2 px-4 text-center">
    <span class="inline-block rounded bg-emerald-500/20 text-emerald-300 px-2 py-0.5 font-semibold mr-2">PRÉVIA DEMO</span>
    Protótipo personalizado gerado para <strong>${name}</strong> — pronto para publicar em domínio próprio.
  </div>

  <!-- Header -->
  <header class="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
      <div>
        <p class="font-bold text-slate-900 leading-tight text-base sm:text-lg">${name}</p>
        <p class="text-xs text-teal-700 font-medium">${category}</p>
      </div>
      <nav class="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
        <a href="#tratamentos" class="hover:text-teal-700 transition">Tratamentos</a>
        <a href="#diferenciais" class="hover:text-teal-700 transition">Diferenciais</a>
        <a href="#localizacao" class="hover:text-teal-700 transition">Localização</a>
      </nav>
      <a href="${whatsappUrl}" target="_blank" rel="noopener"
         class="inline-flex items-center gap-2 rounded-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2.5 shadow-sm transition">
        Agendar Avaliação
      </a>
    </div>
  </header>

  <!-- Hero -->
  <section class="relative overflow-hidden bg-gradient-to-br from-teal-950 via-teal-900 to-slate-900 text-white">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid md:grid-cols-12 gap-10 items-center">
      <div class="md:col-span-7 space-y-6">
        <div class="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3.5 py-1.5 text-xs sm:text-sm font-medium text-teal-100">
          <span>${escapeHtml(ratingBadge)}</span>
        </div>
        <h1 class="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
          Sorriso saudável e estética natural com atendimento em ${city}
        </h1>
        <p class="text-base sm:text-lg text-teal-100/90 max-w-2xl leading-relaxed">
          Na <strong>${name}</strong>, unimos tecnologia, planejamento individualizado e conforto para cuidar da sua saúde bucal e autoestima sem pressa.
        </p>
        <div class="flex flex-col sm:flex-row gap-3 pt-2">
          <a href="${whatsappUrl}" target="_blank" rel="noopener"
             class="inline-flex justify-center items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-4 text-base shadow-lg transition">
            Agendar pelo WhatsApp
          </a>
          <a href="#tratamentos"
             class="inline-flex justify-center items-center rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-6 py-4 text-base transition">
            Ver Especialidades
          </a>
        </div>
      </div>

      <div class="md:col-span-5">
        <div class="rounded-2xl bg-white text-slate-800 p-6 sm:p-8 shadow-2xl space-y-5">
          <p class="text-xs font-bold uppercase tracking-wider text-teal-700">Atendimento Rápido</p>
          <h2 class="text-xl font-bold text-slate-900">Agende sua consulta sem burocracia</h2>
          <ul class="space-y-3 text-sm text-slate-600">
            <li class="flex items-start gap-2.5">
              <span class="text-emerald-600 font-bold">✓</span>
              <span>Avaliação completa com plano de tratamento transparente</span>
            </li>
            <li class="flex items-start gap-2.5">
              <span class="text-emerald-600 font-bold">✓</span>
              <span>Resposta rápida diretamente no WhatsApp da recepção</span>
            </li>
            <li class="flex items-start gap-2.5">
              <span class="text-emerald-600 font-bold">✓</span>
              <span>Localização prática: ${address}</span>
            </li>
          </ul>
          <a href="${whatsappUrl}" target="_blank" rel="noopener"
             class="block w-full text-center rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3.5 transition">
            Falar com a ${name}
          </a>
          <p class="text-xs text-center text-slate-400">Telefone: ${phone}</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Tratamentos -->
  <section id="tratamentos" class="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
    <div class="text-center max-w-2xl mx-auto mb-12">
      <p class="text-xs font-bold uppercase tracking-wider text-teal-700 mb-2">Especialidades</p>
      <h2 class="text-2xl sm:text-4xl font-bold text-slate-900">Tratamentos pensados para resultado e conforto</h2>
    </div>

    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <div class="rounded-2xl bg-white p-6 border border-slate-200 shadow-sm hover:shadow-md transition">
        <div class="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold mb-4">01</div>
        <h3 class="font-bold text-lg text-slate-900 mb-2">Implantes & Prótese</h3>
        <p class="text-sm text-slate-600 leading-relaxed">Reabilitação segura e funcional para devolver firmeza ao mastigar e naturalidade ao sorrir.</p>
      </div>
      <div class="rounded-2xl bg-white p-6 border border-slate-200 shadow-sm hover:shadow-md transition">
        <div class="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold mb-4">02</div>
        <h3 class="font-bold text-lg text-slate-900 mb-2">Lentes & Clareamento</h3>
        <p class="text-sm text-slate-600 leading-relaxed">Estética dental planejada para harmonia do rosto, brilho natural e preservação da estrutura.</p>
      </div>
      <div class="rounded-2xl bg-white p-6 border border-slate-200 shadow-sm hover:shadow-md transition">
        <div class="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold mb-4">03</div>
        <h3 class="font-bold text-lg text-slate-900 mb-2">Harmonização Facial</h3>
        <p class="text-sm text-slate-600 leading-relaxed">Procedimentos sutis com foco em equilíbrio, rejuvenescimento e resultados elegantes.</p>
      </div>
      <div class="rounded-2xl bg-white p-6 border border-slate-200 shadow-sm hover:shadow-md transition">
        <div class="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold mb-4">04</div>
        <h3 class="font-bold text-lg text-slate-900 mb-2">Check-up & Ortodontia</h3>
        <p class="text-sm text-slate-600 leading-relaxed">Prevenção, limpeza, alinhadores e acompanhamento contínuo para toda a família.</p>
      </div>
    </div>
  </section>

  <!-- Diferenciais -->
  <section id="diferenciais" class="bg-white border-y border-slate-200 py-16">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-3 gap-8">
      <div>
        <p class="text-3xl font-extrabold text-teal-700 mb-2">${hasRating ? lead.rating.toFixed(1) : '4.9'}★</p>
        <h3 class="font-bold text-slate-900 mb-1">Reputação comprovada</h3>
        <p class="text-sm text-slate-600">Pacientes satisfeitos recomendando o atendimento e os resultados da clínica.</p>
      </div>
      <div>
        <p class="text-3xl font-extrabold text-teal-700 mb-2">100%</p>
        <h3 class="font-bold text-slate-900 mb-1">Plano personalizado</h3>
        <p class="text-sm text-slate-600">Cada caso é avaliado individualmente antes de qualquer procedimento.</p>
      </div>
      <div>
        <p class="text-3xl font-extrabold text-teal-700 mb-2">Rápido</p>
        <h3 class="font-bold text-slate-900 mb-1">Agendamento direto</h3>
        <p class="text-sm text-slate-600">Sem formulários longos: fale direto com a recepção pelo WhatsApp em segundos.</p>
      </div>
    </div>
  </section>

  <!-- Localização e Horários -->
  <section id="localizacao" class="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
    <div class="grid md:grid-cols-2 gap-8 items-start">
      <div class="rounded-2xl bg-white p-8 border border-slate-200 shadow-sm space-y-4">
        <p class="text-xs font-bold uppercase tracking-wider text-teal-700">Onde estamos</p>
        <h2 class="text-2xl font-bold text-slate-900">${name}</h2>
        <p class="text-slate-600 text-sm leading-relaxed">${address}</p>
        <p class="text-slate-700 font-medium text-sm">Telefone / WhatsApp: ${phone}</p>
        <div class="flex flex-wrap gap-3 pt-2">
          <a href="${whatsappUrl}" target="_blank" rel="noopener"
             class="inline-flex items-center rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-5 py-3 transition">
            Chamar no WhatsApp
          </a>
          <a href="${mapsUrl}" target="_blank" rel="noopener"
             class="inline-flex items-center rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-semibold px-5 py-3 transition">
            Abrir no Google Maps
          </a>
        </div>
      </div>

      <div class="rounded-2xl bg-white p-8 border border-slate-200 shadow-sm">
        <p class="text-xs font-bold uppercase tracking-wider text-teal-700 mb-2">Horário de Atendimento</p>
        <h3 class="text-xl font-bold text-slate-900 mb-4">Programe sua visita</h3>
        <ul>
          ${hoursHtml}
        </ul>
      </div>
    </div>
  </section>

  <footer class="bg-slate-900 text-slate-400 text-xs py-8 px-4 text-center">
    <p>© ${new Date().getFullYear()} ${name}. Página modelo demonstrativa.</p>
  </footer>

  <!-- Botão flutuante WhatsApp -->
  <a href="${whatsappUrl}" target="_blank" rel="noopener"
     class="fixed bottom-5 right-5 z-40 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-3.5 shadow-xl text-sm transition">
    WhatsApp • Agendar
  </a>
</body>
</html>`;
}

/**
 * Gera o painel HTML local (output/index.html) para inspecionar leads, previews e copiar mensagens.
 */
export function renderDashboardHtml(leads, meta) {
  const cards = leads
    .map((lead, idx) => {
      const badgeColor =
        lead.audit.status === 'NO_WEBSITE'
          ? 'bg-emerald-100 text-emerald-800'
          : lead.audit.status === 'SOCIAL_ONLY'
          ? 'bg-amber-100 text-amber-800'
          : lead.audit.status === 'SITE_ISSUES'
          ? 'bg-rose-100 text-rose-800'
          : 'bg-slate-100 text-slate-700';

      const issuesList = lead.audit.issues
        .map((issue) => `<li>• ${escapeHtml(issue)}</li>`)
        .join('');

      const pitchAttr = escapeHtml(lead.pitch || '');

      return `
      <article class="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-lg font-bold text-slate-900">${escapeHtml(lead.name)}</h2>
              <span class="text-xs font-semibold px-2.5 py-1 rounded-full ${badgeColor}">
                ${escapeHtml(lead.audit.label)}
              </span>
              <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-900 text-white uppercase">
                Prioridade ${escapeHtml(lead.opportunity.priority)}
              </span>
            </div>
            <p class="text-xs text-slate-500 mt-1">
              ${lead.rating ? `★ ${lead.rating.toFixed(1)} (${lead.reviewCount} avaliações) • ` : ''}${escapeHtml(lead.address)}
            </p>
            <p class="text-xs text-slate-500">
              Tel: ${escapeHtml(lead.phone || 'Não informado')} • Site atual: ${
        lead.websiteUri
          ? `<a class="underline text-teal-700" href="${escapeHtml(lead.websiteUri)}" target="_blank" rel="noopener">${escapeHtml(lead.websiteUri)}</a>`
          : '<em>Nenhum</em>'
      }
            </p>
          </div>
          <div class="flex items-center gap-2">
            ${
              lead.previewFile
                ? `<a href="${escapeHtml(lead.previewFile)}" target="_blank"
                      class="rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2.5 transition">
                     Abrir Landing Page
                   </a>`
                : ''
            }
          </div>
        </div>

        ${
          issuesList
            ? `<ul class="text-xs text-slate-600 bg-slate-50 rounded-xl p-3 space-y-1">${issuesList}</ul>`
            : ''
        }

        ${
          lead.pitch
            ? `<div class="space-y-2">
                 <div class="flex items-center justify-between">
                   <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Mensagem sugerida</span>
                   <button type="button"
                           data-pitch="${pitchAttr}"
                           onclick="copyPitch(this, 'status-${idx}')"
                           class="rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1.5 transition">
                     Copiar mensagem
                   </button>
                 </div>
                 <p class="text-xs text-slate-700 bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 leading-relaxed">${escapeHtml(lead.pitch)}</p>
                 <p id="status-${idx}" class="text-xs text-emerald-700 font-medium hidden">Copiado para a área de transferência!</p>
               </div>`
            : ''
        }
      </article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PoC Prospecção & Previews</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-100 text-slate-800 antialiased">
  <main class="max-w-5xl mx-auto px-4 py-10 space-y-6">
    <header class="rounded-2xl bg-slate-900 text-white p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-xs uppercase tracking-wider text-emerald-400 font-bold">PoC • Nicho Odontologia & Estética</p>
        <h1 class="text-2xl font-bold mt-1">Painel de Leads & Previews Geradas</h1>
        <p class="text-sm text-slate-300 mt-1">Busca: <strong>${escapeHtml(meta.query)}</strong> • Modo: ${escapeHtml(meta.mode)} • Total: ${leads.length}</p>
      </div>
    </header>
    <section class="space-y-4">
      ${cards}
    </section>
  </main>
  <script>
    async function copyPitch(btn, statusId) {
      const text = btn.getAttribute('data-pitch') || '';
      await navigator.clipboard.writeText(text);
      const el = document.getElementById(statusId);
      if (el) {
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 2000);
      }
    }
  </script>
</body>
</html>`;
}
