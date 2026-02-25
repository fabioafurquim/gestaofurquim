/**
 * Gerador de arquivo CNAB 240 para pagamentos via PIX - Banco Inter
 * Baseado no padrão FEBRABAN para transferências via PIX
 */

export interface CompanyData {
  cnpj: string;
  nome: string;
  conta: string;
  conta_dv: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  cidade: string;
  cep: string;
  estado: string;
}

export interface Payment {
  nome: string;
  cpf_cnpj: string;
  tipo_chave_pix: 'CPF' | 'CNPJ' | 'EMAIL' | 'CELULAR' | 'ALEATORIA';
  chave_pix: string;
  valor: number;
}

/**
 * Remove acentos e caracteres especiais de uma string
 */
function removerAcentosEEspeciais(texto: string): string {
  if (!texto) return '';
  // Remove acentos e caracteres especiais, mantém apenas alfanuméricos e espaços
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove caracteres especiais
    .toUpperCase();
}

/**
 * Formata um campo alfanumérico com espaços à direita
 */
function formatarAlfa(valor: string | number, tamanho: number): string {
  const valorStr = removerAcentosEEspeciais(String(valor || ''));
  return valorStr.padEnd(tamanho, ' ').substring(0, tamanho);
}

/**
 * Formata um campo numérico com zeros à esquerda
 */
function formatarNum(valor: string | number, tamanho: number): string {
  const valorStr = String(valor || '0').replace(/\D/g, ''); // Remove não-numéricos
  return valorStr.padStart(tamanho, '0').substring(valorStr.length > tamanho ? valorStr.length - tamanho : 0);
}

/**
 * Formata chave PIX preservando caracteres especiais
 */
function formatarChavePix(chave: string, tamanho: number): string {
  if (!chave) return ''.padEnd(tamanho, ' ');
  return chave.padEnd(tamanho, ' ').substring(0, tamanho);
}

/**
 * Gera arquivo CNAB 240 para pagamentos via PIX
 */
export function gerarCnabPix(
  dadosEmpresa: CompanyData,
  pagamentos: Payment[],
  numeroSequencialArquivo: number
): { nomeArquivo: string; conteudo: string } {
  // Mapeamento do tipo de chave para código CNAB
  const mapaTipoChave: Record<string, string> = {
    'CELULAR': '01',
    'EMAIL': '02',
    'CPF': '03',
    'CNPJ': '03', // CPF e CNPJ usam o mesmo código
    'ALEATORIA': '04',
    'DADOS_BANCARIOS': '05'
  };

  const agora = new Date();
  const dataGeracao = agora.toLocaleDateString('pt-BR').replace(/\//g, '').split('').reverse().join(''); // DDMMAAAA
  const horaGeracao = agora.toTimeString().substring(0, 8).replace(/:/g, ''); // HHMMSS

  const linhasCnab: string[] = [];

  // 1. HEADER DO ARQUIVO
  let headerArquivo = '';
  headerArquivo += formatarNum('077', 3); // Código do Banco (Inter)
  headerArquivo += formatarNum('0000', 4); // Lote de Serviço
  headerArquivo += formatarNum('0', 1); // Tipo de Registro
  headerArquivo += formatarAlfa('', 9); // Uso Exclusivo FEBRABAN
  headerArquivo += formatarNum('2', 1); // Tipo de Inscrição (CNPJ)
  headerArquivo += formatarNum(dadosEmpresa.cnpj.replace(/\D/g, ''), 14); // CNPJ da Empresa
  headerArquivo += formatarAlfa('', 20); // Código do Convênio
  headerArquivo += formatarNum('0001', 5); // Agência (sempre 0001 no Inter)
  headerArquivo += formatarAlfa('9', 1); // DV da Agência (sempre 9 no Inter)
  headerArquivo += formatarNum(dadosEmpresa.conta, 12); // Número da Conta
  headerArquivo += formatarNum(dadosEmpresa.conta_dv, 1); // DV da Conta
  headerArquivo += formatarAlfa('', 1); // DV Ag/Conta
  headerArquivo += formatarAlfa(dadosEmpresa.nome, 30); // Nome da Empresa
  headerArquivo += formatarAlfa('BANCO INTER', 30); // Nome do Banco
  headerArquivo += formatarAlfa('', 10); // Uso Exclusivo FEBRABAN
  headerArquivo += formatarNum('1', 1); // Código Remessa (1)
  headerArquivo += formatarNum(dataGeracao, 8); // Data de Geração
  headerArquivo += formatarNum(horaGeracao, 6); // Hora de Geração
  headerArquivo += formatarNum(numeroSequencialArquivo, 6); // Número Sequencial
  headerArquivo += formatarNum('107', 3); // Versão do Layout
  headerArquivo += formatarNum('01600', 5); // Densidade de Gravação
  headerArquivo += formatarAlfa('', 20); // Reservado Banco
  headerArquivo += formatarAlfa('', 20); // Reservado Empresa
  headerArquivo += formatarAlfa('', 29); // Uso Exclusivo FEBRABAN

  linhasCnab.push(headerArquivo);

  // 2. HEADER DE LOTE
  let headerLote = '';
  headerLote += formatarNum('077', 3); // Código do Banco
  headerLote += formatarNum('0001', 4); // Lote de Serviço
  headerLote += formatarNum('1', 1); // Tipo de Registro
  headerLote += formatarAlfa('C', 1); // Tipo da Operação (Crédito)
  headerLote += formatarNum('30', 2); // Tipo do Serviço (Pagamento Salários)
  headerLote += formatarNum('45', 2); // Forma de Lançamento (PIX)
  headerLote += formatarNum('046', 3); // Versão do Layout
  headerLote += formatarAlfa('', 1); // Uso Exclusivo FEBRABAN
  headerLote += formatarNum('2', 1); // Tipo de Inscrição (CNPJ)
  headerLote += formatarNum(dadosEmpresa.cnpj.replace(/\D/g, ''), 14); // CNPJ
  headerLote += formatarAlfa('', 20); // Código do Convênio
  headerLote += formatarNum('0001', 5); // Agência
  headerLote += formatarNum('9', 1); // DV da Agência
  headerLote += formatarNum(dadosEmpresa.conta, 12); // Conta
  headerLote += formatarNum(dadosEmpresa.conta_dv, 1); // DV da Conta
  headerLote += formatarAlfa('', 1); // DV Ag/Conta
  headerLote += formatarAlfa(dadosEmpresa.nome, 30); // Nome da Empresa
  headerLote += formatarAlfa('', 40); // Mensagem
  // Endereço da Empresa
  headerLote += formatarAlfa(dadosEmpresa.logradouro, 30); // Logradouro
  headerLote += formatarNum(dadosEmpresa.numero, 5); // Número
  headerLote += formatarAlfa(dadosEmpresa.complemento || '', 15); // Complemento
  headerLote += formatarAlfa(dadosEmpresa.cidade, 20); // Cidade
  const cep = dadosEmpresa.cep.replace(/\D/g, '');
  headerLote += formatarNum(cep.substring(0, 5), 5); // CEP
  headerLote += formatarNum(cep.substring(5), 3); // Complemento CEP
  headerLote += formatarAlfa(dadosEmpresa.estado, 2); // Estado
  headerLote += formatarAlfa('', 8); // Uso Exclusivo FEBRABAN
  headerLote += formatarAlfa('', 10); // Códigos de Ocorrência

  linhasCnab.push(headerLote);

  let somaValoresLote = 0;
  let numeroSequencialRegistro = 0;

  // 3. REGISTROS DE DETALHE (SEGMENTOS A e B)
  for (const pagamento of pagamentos) {
    numeroSequencialRegistro++;
    somaValoresLote += pagamento.valor;

    // SEGMENTO A
    let segmentoA = '';
    segmentoA += formatarNum('077', 3); // Código do Banco
    segmentoA += formatarNum('0001', 4); // Lote de Serviço
    segmentoA += formatarNum('3', 1); // Tipo de Registro
    segmentoA += formatarNum(numeroSequencialRegistro * 2 - 1, 5); // Nº Sequencial
    segmentoA += formatarAlfa('A', 1); // Código do Segmento
    segmentoA += formatarNum('0', 1); // Tipo de Movimento
    segmentoA += formatarNum('00', 2); // Código da Instrução
    segmentoA += formatarNum('000', 3); // Código da Câmara
    // Dados bancários zerados para PIX
    segmentoA += formatarNum('0', 3); // Código do Banco Favorecido
    segmentoA += formatarNum('0', 5); // Agência Favorecido
    segmentoA += formatarNum('0', 1); // DV Agência Favorecido
    segmentoA += formatarNum('0', 12); // Conta Favorecido
    segmentoA += formatarNum('0', 1); // DV Conta Favorecido
    segmentoA += formatarAlfa('', 1); // DV Ag/Conta Favorecido
    segmentoA += formatarAlfa(pagamento.nome, 30); // Nome do Favorecido
    segmentoA += formatarAlfa(`PAG${numeroSequencialRegistro}`, 20); // Nº do Documento
    segmentoA += formatarNum(dataGeracao, 8); // Data do Pagamento
    segmentoA += formatarAlfa('BRL', 3); // Tipo da Moeda
    segmentoA += formatarNum('0', 15); // Quantidade da Moeda
    const valorPagamentoStr = Math.round(pagamento.valor * 100).toString(); // Valor em centavos
    segmentoA += formatarNum(valorPagamentoStr, 15); // Valor do Pagamento
    segmentoA += formatarAlfa('', 20); // Nº do Documento Banco
    segmentoA += formatarAlfa('', 8); // Data Real Efetivação
    segmentoA += formatarNum('0', 15); // Valor Real Efetivação
    segmentoA += formatarAlfa('', 40); // Informação 2
    segmentoA += formatarAlfa('', 3); // Código Finalidade DOC
    segmentoA += formatarAlfa('', 10); // Complemento Finalidade
    segmentoA += formatarAlfa('', 10); // Uso Exclusivo FEBRABAN
    segmentoA += formatarAlfa('', 10); // Códigos de Ocorrência

    linhasCnab.push(segmentoA);

    // SEGMENTO B
    let segmentoB = '';
    segmentoB += formatarNum('077', 3); // Código do Banco
    segmentoB += formatarNum('0001', 4); // Lote de Serviço
    segmentoB += formatarNum('3', 1); // Tipo de Registro
    segmentoB += formatarNum(numeroSequencialRegistro * 2, 5); // Nº Sequencial
    segmentoB += formatarAlfa('B', 1); // Código do Segmento

    const tipoChavePagamento = pagamento.tipo_chave_pix.toUpperCase();
    const codigoChave = mapaTipoChave[tipoChavePagamento] || '02';

    segmentoB += formatarAlfa(codigoChave, 3); // Forma de Iniciação

    const tipoInscricao = tipoChavePagamento === 'CNPJ' ? '2' : '1';
    segmentoB += formatarNum(tipoInscricao, 1); // Tipo de Inscrição

    // CPF/CNPJ apenas se a chave for desse tipo
    const cpfCnpjFavorecido = ['CPF', 'CNPJ'].includes(tipoChavePagamento) ? pagamento.chave_pix.replace(/\D/g, '') : '';
    segmentoB += formatarNum(cpfCnpjFavorecido, 14); // CPF/CNPJ Favorecido
    segmentoB += formatarAlfa('', 35); // TX ID
    segmentoB += formatarAlfa('', 60); // Brancos

    // Chave PIX apenas se NÃO for CPF/CNPJ
    const chavePix = !['CPF', 'CNPJ'].includes(tipoChavePagamento) ? pagamento.chave_pix : '';
    segmentoB += formatarChavePix(chavePix, 99); // Chave PIX
    segmentoB += formatarAlfa('', 6); // Brancos
    segmentoB += formatarNum('0', 8); // Código ISPB
    segmentoB += formatarAlfa('', 10); // Uso Exclusivo FEBRABAN

    linhasCnab.push(segmentoB);
  }

  // 4. TRAILER DE LOTE
  const totalRegistrosLote = pagamentos.length * 2 + 2; // (Seg A + Seg B) * N + Header + Trailer
  let trailerLote = '';
  trailerLote += formatarNum('077', 3); // Código do Banco
  trailerLote += formatarNum('0001', 4); // Lote de Serviço
  trailerLote += formatarNum('5', 1); // Tipo de Registro
  trailerLote += formatarAlfa('', 9); // Uso Exclusivo FEBRABAN
  trailerLote += formatarNum(totalRegistrosLote, 6); // Quantidade de Registros
  const somaValoresLoteStr = Math.round(somaValoresLote * 100).toString(); // Em centavos
  trailerLote += formatarNum(somaValoresLoteStr, 18); // Somatória dos Valores
  trailerLote += formatarNum('0', 18); // Somatória Quantidade Moedas
  trailerLote += formatarAlfa('', 6); // Número Aviso Débito
  trailerLote += formatarAlfa('', 165); // Uso Exclusivo FEBRABAN
  trailerLote += formatarAlfa('', 10); // Códigos de Ocorrência

  linhasCnab.push(trailerLote);

  // 5. TRAILER DO ARQUIVO
  const totalRegistrosArquivo = linhasCnab.length + 1;
  let trailerArquivo = '';
  trailerArquivo += formatarNum('077', 3); // Código do Banco
  trailerArquivo += formatarNum('9999', 4); // Lote de Serviço
  trailerArquivo += formatarNum('9', 1); // Tipo de Registro
  trailerArquivo += formatarAlfa('', 9); // Uso Exclusivo FEBRABAN
  trailerArquivo += formatarNum('1', 6); // Quantidade de Lotes
  trailerArquivo += formatarNum(totalRegistrosArquivo, 6); // Quantidade de Registros
  trailerArquivo += formatarAlfa('', 211); // Uso Exclusivo FEBRABAN

  linhasCnab.push(trailerArquivo);

  // 6. GERAR CONTEÚDO DO ARQUIVO
  const nomeArquivo = `C1240_001_${formatarNum(numeroSequencialArquivo, 7)}.REM`;
  
  const conteudo = linhasCnab
    .map(linha => linha.padEnd(240, ' ').substring(0, 240)) // Garantir 240 caracteres por linha
    .join('\n');

  return { nomeArquivo, conteudo };
}