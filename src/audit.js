const SOCIAL_DOMAINS = [
  'instagram.com',
  'facebook.com',
  'fb.com',
  'linktr.ee',
  'linktree.com',
  'wa.me',
  'api.whatsapp.com',
  'bit.ly',
  'beacons.ai',
  'bio.site',
  'tiktok.com',
];

function isSocialOnlyUrl(rawUrl) {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, '');
    return SOCIAL_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

/**
 * Audita tecnicamente o site de um estabelecimento para identificar oportunidade comercial.
 */
export async function auditWebsite(websiteUri) {
  if (!websiteUri) {
    return {
      status: 'NO_WEBSITE',
      label: 'Sem site cadastrado',
      issues: ['Não possui site próprio cadastrado no Google Perfil da Empresa'],
      responseTimeMs: null,
      httpStatus: null,
      hasHttps: false,
      hasViewport: false,
      hasWhatsappCta: false,
    };
  }

  if (isSocialOnlyUrl(websiteUri)) {
    return {
      status: 'SOCIAL_ONLY',
      label: 'Usa apenas rede social / link de bio',
      issues: [
        'O link cadastrado no Google leva apenas para rede social/agregador, sem página própria de conversão',
      ],
      responseTimeMs: null,
      httpStatus: null,
      hasHttps: websiteUri.startsWith('https://'),
      hasViewport: false,
      hasWhatsappCta: false,
    };
  }

  const issues = [];
  let parsedUrl;
  try {
    parsedUrl = new URL(websiteUri);
  } catch {
    return {
      status: 'SITE_ISSUES',
      label: 'URL inválida no Google',
      issues: ['A URL cadastrada no Google está malformada e não abre'],
      responseTimeMs: null,
      httpStatus: null,
      hasHttps: false,
      hasViewport: false,
      hasWhatsappCta: false,
    };
  }

  const startsWithHttp = parsedUrl.protocol === 'http:';
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(websiteUri, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      },
    });

    const elapsedMs = Date.now() - startedAt;
    const finalUrl = response.url || websiteUri;
    const hasHttps = finalUrl.startsWith('https://');

    if (!hasHttps || startsWithHttp) {
      if (!hasHttps) {
        issues.push('Site sem HTTPS ativo (navegadores exibem aviso de "Não seguro")');
      }
    }

    if (!response.ok) {
      issues.push(`Site retornou erro HTTP ${response.status}`);
      return {
        status: 'SITE_ISSUES',
        label: `Site com erro (${response.status})`,
        issues,
        responseTimeMs: elapsedMs,
        httpStatus: response.status,
        hasHttps,
        hasViewport: false,
        hasWhatsappCta: false,
      };
    }

    const html = await response.text();
    const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
    const hasWhatsappCta = /wa\.me|api\.whatsapp\.com|whatsapp/i.test(html);

    if (!hasViewport) {
      issues.push('Falta meta viewport (layout tende a ficar quebrado ou minúsculo no celular)');
    }
    if (elapsedMs > 2500) {
      issues.push(`Carregamento lento na resposta inicial (${(elapsedMs / 1000).toFixed(1)}s)`);
    }
    if (!hasWhatsappCta) {
      issues.push('Não foi identificado botão/link direto para WhatsApp na página inicial');
    }

    const hasCriticalIssue = !hasHttps || !hasViewport || elapsedMs > 2500 || !hasWhatsappCta;

    return {
      status: hasCriticalIssue ? 'SITE_ISSUES' : 'OK',
      label: hasCriticalIssue ? 'Site com pontos de melhoria' : 'Site funcional',
      issues,
      responseTimeMs: elapsedMs,
      httpStatus: response.status,
      hasHttps,
      hasViewport,
      hasWhatsappCta,
    };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    const reason =
      error?.name === 'AbortError'
        ? 'Site demorou mais de 6s para responder (timeout)'
        : 'Site fora do ar ou erro de conexão/SSL';

    issues.push(reason);

    return {
      status: 'SITE_ISSUES',
      label: 'Site fora do ar / inacessível',
      issues,
      responseTimeMs: elapsedMs,
      httpStatus: null,
      hasHttps: false,
      hasViewport: false,
      hasWhatsappCta: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Calcula prioridade comercial com base na reputação do negócio + oportunidade técnica.
 */
export function scoreOpportunity(place, audit) {
  if (audit.status === 'OK') {
    return { priority: 'baixa', score: 20 };
  }

  let score = 50;
  if (audit.status === 'NO_WEBSITE') score += 30;
  if (audit.status === 'SOCIAL_ONLY') score += 25;
  if (audit.status === 'SITE_ISSUES') score += 20;

  if ((place.rating || 0) >= 4.3) score += 10;
  if ((place.reviewCount || 0) >= 20) score += 10;

  const priority = score >= 80 ? 'alta' : score >= 60 ? 'media' : 'baixa';
  return { priority, score };
}
