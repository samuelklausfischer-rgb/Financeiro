import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.16";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function formatDateBr(isoDateStr: string): string {
  if (!isoDateStr) return '';
  const parts = isoDateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDateStr;
}

async function fetchOmie(endpoint: string, call: string, param: any[]) {
  const app_key = Deno.env.get('OMIE_APP_KEY');
  const app_secret = Deno.env.get('OMIE_APP_SECRET');

  if (!app_key || !app_secret) {
    throw new Error('Chaves da Omie (OMIE_APP_KEY, OMIE_APP_SECRET) não configuradas no servidor.');
  }

  const response = await fetch(`https://app.omie.com.br/api/v1/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-type': 'application/json' },
    body: JSON.stringify({
      call,
      app_key,
      app_secret,
      param
    })
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`Resposta inválida da Omie: ${text}`);
  }

  if (json.faultstring) {
    throw new Error(json.faultstring);
  }

  return json;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const authHeader = req.headers.get('Authorization')!;

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('Auth Error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { requestId, rowNome, expense } = body;

    if (!expense) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'Dados da despesa (expense) são obrigatórios.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { favorecido, vencimento, valor } = expense;

    // 1. Resolver Favorecido
    let clienteList: any[] = [];
    try {
      const respClientes = await fetchOmie('geral/clientes/', 'ListarClientesResumido', [
        {
          pagina: 1,
          registros_por_pagina: 100,
          clientesFiltro: { razao_social: favorecido }
        }
      ]);
      clienteList = respClientes.clientes_cadastro_resumido || [];
    } catch (err: any) {
      if (!err.message.includes('Nenhum')) {
        console.error("Erro ListarClientesResumido:", err.message);
      }
    }

    if (clienteList.length === 0) {
      try {
        const respClientes2 = await fetchOmie('geral/clientes/', 'ListarClientesResumido', [
          {
            pagina: 1,
            registros_por_pagina: 100,
            clientesFiltro: { nome_fantasia: favorecido }
          }
        ]);
        clienteList = respClientes2.clientes_cadastro_resumido || [];
      } catch (err: any) {
        if (!err.message.includes('Nenhum')) {
          console.error("Erro ListarClientesResumido fant:", err.message);
        }
      }
    }

    const clienteIds = clienteList.map((c: any) => c.codigo_cliente);

    // 2. PesquisarLancamentos
    const dataVencBr = formatDateBr(vencimento);
    let lancamentos: any[] = [];

    try {
      const paramsLancamento: any = {
        nPagina: 1,
        nRegPorPagina: 100,
        dDtVencDe: dataVencBr,
        dDtVencAte: dataVencBr,
        cNatureza: "P"
      };

      const respLancamentos = await fetchOmie('financas/pesquisartitulos/', 'PesquisarLancamentos', [paramsLancamento]);
      lancamentos = respLancamentos.registros || [];
    } catch (err: any) {
      if (!err.message.includes('Nenhum')) {
        console.error("Erro PesquisarLancamentos:", err.message);
        // We do not throw here, just leave lancamentos empty to drop to no_match, unless it's a structural error
      }
    }

    // Filtro
    let matches = lancamentos.filter((l: any) => Math.abs(l.nValorTitulo - valor) < 0.01);
    
    if (clienteIds.length > 0) {
      const matchesComCliente = matches.filter((l: any) => clienteIds.includes(l.nCodCliente));
      if (matchesComCliente.length > 0) {
        matches = matchesComCliente;
      }
    }

    if (matches.length === 0) {
      return new Response(
        JSON.stringify({ 
          status: 'no_match', 
          message: 'Nenhum lançamento exato encontrado para esta data e valor.',
          omieMatchStatus: 'not_found'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const promises = matches.map(async (m: any) => {
      try {
        const conta = await fetchOmie('financas/contapagar/', 'ConsultarContaPagar', [
          { nCodTitulo: m.nCodTitulo }
        ]);

        let pixKey = null;
        let pixQrCode = null;

        const cnab = conta.cnab_integracao_bancaria || {};
        
        if (cnab.codigo_forma_pagamento === 'PIX' || cnab.codigo_forma_pagamento === 'PIXT' || cnab.codigo_forma_pagamento === 'PIXM') {
          pixQrCode = cnab.pix_qrcode || null;
          try {
            const cliente = await fetchOmie('geral/clientes/', 'ConsultarCliente', [
              { codigo_cliente_omie: m.nCodCliente }
            ]);
            pixKey = cliente.dadosBancarios?.cChavePix || null;
          } catch (e) {
            console.error('Falha ao buscar chave PIX no cliente:', e);
          }
        }

        const baseLabel = `Doc: ${conta.codigo_documento || m.nCodTitulo} | ${m.cStatus || ''}`;

        return {
          id: String(m.nCodTitulo),
          label: baseLabel,
          paymentType: cnab.codigo_forma_pagamento,
          message: `Forma original identificada na Omie: ${cnab.codigo_forma_pagamento || 'Nenhuma'}`,
          details: {
            ...m,
            ...conta,
            pixKey,
            pixQrCode,
            numeroBoleto: cnab.cNumBoleto || cnab.cCodigoBarras,
            linhaDigitavel: cnab.cCodigoBarras || cnab.cCodigoBarra
          }
        };
      } catch (err: any) {
        return {
          id: String(m.nCodTitulo),
          label: `Título ${m.nCodTitulo} (Falha ao detalhar)`,
          message: err.message,
          paymentType: 'not_found'
        };
      }
    });

    const detailedMatches = await Promise.all(promises);

    // Identificar qual status de payment formatar para resposta limpa
    let bestMatch = detailedMatches[0];
    let ptType = bestMatch.paymentType?.toLowerCase();
    let finalType = 'not_found';
    if (ptType?.includes('pix')) finalType = 'pix';
    else if (ptType?.includes('bol')) finalType = 'boleto';
    else if (ptType?.includes('tra') || ptType?.includes('doc') || ptType?.includes('ted')) finalType = 'transferencia';

    if (detailedMatches.length === 1) {
      return new Response(
        JSON.stringify({ 
          status: 'success', 
          omieMatchStatus: 'single_match',
          paymentType: finalType,
          label: bestMatch.label,
          message: bestMatch.message,
          details: bestMatch.details,
          matches: detailedMatches
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ 
        status: 'multiple_matches', 
        omieMatchStatus: 'multiple_matches',
        message: 'Múltiplos títulos encontrados. Selecione o correto abaixo.',
        matches: detailedMatches
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Edge Function Error:', error);
    return new Response(
      JSON.stringify({ status: 'error', message: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`Resposta inválida da Omie: ${text}`);
  }

  if (json.faultstring) {
    throw new Error(json.faultstring);
  }

  return json;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { requestId, rowNome, expense } = await req.json();

    if (!expense) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'Dados da despesa (expense) são obrigatórios.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { favorecido, vencimento, valor } = expense;

    // 1. Resolver Favorecido
    // Busca por razao_social
    let clienteList = [];
    try {
      const respClientes = await fetchOmie('geral/clientes/', 'ListarClientesResumido', [
        {
          pagina: 1,
          registros_por_pagina: 100,
          clientesFiltro: { razao_social: favorecido }
        }
      ]);
      clienteList = respClientes.clientes_cadastro_resumido || [];
    } catch (err: any) {
      // Pode falhar se não encontrar, Omie retorna faultstring = "Nenhum cliente..."
      if (!err.message.includes('Nenhum')) {
        throw err;
      }
    }

    if (clienteList.length === 0) {
      // Tenta por nome_fantasia se falhar por razao_social
      try {
        const respClientes2 = await fetchOmie('geral/clientes/', 'ListarClientesResumido', [
          {
            pagina: 1,
            registros_por_pagina: 100,
            clientesFiltro: { nome_fantasia: favorecido }
          }
        ]);
        clienteList = respClientes2.clientes_cadastro_resumido || [];
      } catch (err: any) {
        if (!err.message.includes('Nenhum')) throw err;
      }
    }

    const clienteIds = clienteList.map((c: any) => c.codigo_cliente);

    // 2. PesquisarLancamentos
    const dataVencBr = formatDateBr(vencimento);
    let lancamentos = [];

    // Busca principal por vencimento
    try {
      const paramsLancamento: any = {
        nPagina: 1,
        nRegPorPagina: 100,
        dDtVencDe: dataVencBr,
        dDtVencAte: dataVencBr,
        cNatureza: "P" // Supomos contas a pagar na diária
      };

      const respLancamentos = await fetchOmie('financas/pesquisartitulos/', 'PesquisarLancamentos', [paramsLancamento]);
      lancamentos = respLancamentos.registros || [];
    } catch (err: any) {
      if (!err.message.includes('Nenhum')) {
        throw err;
      }
    }

    // Filtrar lançamentos encontrados
    // Filtro forte: valor exato + cliente correspondente (se conseguimos resolver o cliente)
    let matches = lancamentos.filter((l: any) => l.nValorTitulo === valor);
    
    if (clienteIds.length > 0) {
      const matchesComCliente = matches.filter((l: any) => clienteIds.includes(l.nCodCliente));
      // Se encontrou com o cliente exato, foca neles, senao mantem a busca so por valor
      if (matchesComCliente.length > 0) {
        matches = matchesComCliente;
      }
    }

    if (matches.length === 0) {
      return new Response(
        JSON.stringify({ 
          status: 'no_match', 
          message: 'Nenhum lançamento exato encontrado para esta data e valor.',
          omieMatchStatus: 'not_found'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Se encontramos multiplos, podemos tentar desempatar por parcela ou observacao
    // Na versao 1, vamos retornar os detalhes e, se houver > 1, retornamos multiplos

    const promises = matches.map(async (m: any) => {
      try {
        const conta = await fetchOmie('financas/contapagar/', 'ConsultarContaPagar', [
          { nCodTitulo: m.nCodTitulo }
        ]);

        let pixKey = null;
        let pixQrCode = null;

        // Recuperar chave PIX no cliente se a forma for PIX e não vier no próprio titulo
        if (conta.cnab_integracao_bancaria?.codigo_forma_pagamento === 'PIX') {
          pixQrCode = conta.cnab_integracao_bancaria?.pix_qrcode || null;
          try {
            const cliente = await fetchOmie('geral/clientes/', 'ConsultarCliente', [
              { codigo_cliente_omie: m.nCodCliente }
            ]);
            pixKey = cliente.dadosBancarios?.cChavePix || null;
          } catch (e) {
            // Ignorar erro de cliente
          }
        }

        const baseLabel = \`Doc: \${conta.codigo_documento || m.nCodTitulo} | \${m.cStatus}\`;

        return {
          id: String(m.nCodTitulo),
          label: baseLabel,
          paymentType: conta.cnab_integracao_bancaria?.codigo_forma_pagamento, // 'PIX', 'BOL', 'TRA', etc
          message: \`Forma original identificada na Omie: \${conta.cnab_integracao_bancaria?.codigo_forma_pagamento || 'Nenhuma'}\`,
          details: {
            ...m,
            ...conta,
            pixKey,
            pixQrCode,
            numeroBoleto: conta.cnab_integracao_bancaria?.cNumBoleto,
            linhaDigitavel: conta.cnab_integracao_bancaria?.cCodigoBarras || conta.cnab_integracao_bancaria?.cCodigoBarra
          }
        };
      } catch (err: any) {
        return {
          id: String(m.nCodTitulo),
          label: \`Título \${m.nCodTitulo} (Falha ao detalhar)\`,
          message: err.message,
          paymentType: 'not_found'
        };
      }
    });

    const detailedMatches = await Promise.all(promises);

    if (detailedMatches.length === 1) {
      return new Response(
        JSON.stringify({ 
          status: 'success', 
          omieMatchStatus: 'single_match',
          paymentType: detailedMatches[0].paymentType,
          label: detailedMatches[0].label,
          message: detailedMatches[0].message,
          details: detailedMatches[0].details,
          matches: detailedMatches
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ 
        status: 'multiple_matches', 
        omieMatchStatus: 'multiple_matches',
        message: 'Múltiplos títulos encontrados. Selecione o correto abaixo.',
        matches: detailedMatches
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ status: 'error', message: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});