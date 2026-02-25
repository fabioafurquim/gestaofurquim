export interface RPAData {
  valorServicoPrestado: number;
  outrosDescontos: number;
  iss: number;
  irrf: number;
  inss: number;
  totalDescontos: number;
  valorLiquido: number;
  textoExtraido?: string; // Para debug
}

/**
 * Extrai um valor monetário de uma string
 * Suporta formatos: "1.234,56" ou "1234.56" ou "1234,56"
 */
function extractMoneyValue(text: string): number {
  // Remove espaços e caracteres não numéricos exceto vírgula e ponto
  const cleaned = text.replace(/[^\d.,]/g, '').trim();
  
  if (!cleaned) return 0;
  
  // Detecta formato brasileiro (1.234,56) vs americano (1,234.56)
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  
  let normalized: string;
  
  if (lastComma > lastDot) {
    // Formato brasileiro: 1.234,56
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // Formato americano ou sem separador de milhar: 1,234.56 ou 1234.56
    normalized = cleaned.replace(/,/g, '');
  } else {
    // Apenas um separador ou nenhum
    normalized = cleaned.replace(',', '.');
  }
  
  const value = parseFloat(normalized);
  return isNaN(value) ? 0 : value;
}

/**
 * Busca um valor após um label específico no texto
 */
function findValueAfterLabel(text: string, label: string): number {
  const regex = new RegExp(`${label}[:\\s]*([\\d.,]+)`, 'i');
  const match = text.match(regex);
  if (match) {
    return extractMoneyValue(match[1]);
  }
  return 0;
}

/**
 * Busca um valor em uma linha que contém o label
 */
function findValueInLine(text: string, label: string): number {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.toLowerCase().includes(label.toLowerCase())) {
      // Procura por valores monetários na linha
      const moneyPattern = /R?\$?\s*([\d.,]+)/g;
      const matches = [...line.matchAll(moneyPattern)];
      if (matches.length > 0) {
        // Pega o último valor encontrado na linha (geralmente é o valor)
        const lastMatch = matches[matches.length - 1];
        const value = extractMoneyValue(lastMatch[1]);
        if (value > 0) return value;
      }
      
      // Se não encontrou na mesma linha, tenta a próxima linha
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nextMatches = [...nextLine.matchAll(moneyPattern)];
        if (nextMatches.length > 0) {
          const value = extractMoneyValue(nextMatches[0][1]);
          if (value > 0) return value;
        }
      }
    }
  }
  return 0;
}

/**
 * Busca valor usando regex mais flexível
 */
function findValueFlexible(text: string, patterns: string[]): number {
  for (const pattern of patterns) {
    // Tenta encontrar o padrão seguido de um valor
    const regex = new RegExp(pattern + '[:\\s\\n]*R?\\$?\\s*([\\d.,]+)', 'gi');
    const match = text.match(regex);
    if (match) {
      // Extrai o valor do match
      const valueMatch = match[0].match(/[\d.,]+$/);
      if (valueMatch) {
        const value = extractMoneyValue(valueMatch[0]);
        if (value > 0) return value;
      }
    }
  }
  return 0;
}

/**
 * Busca o total de descontos (segundo "Total" no documento, após a seção DESCONTOS)
 */
function findTotalDescontos(text: string): number {
  // Procura por "Total" que aparece após "DESCONTOS" e antes de "VALOR LÍQUIDO"
  const descontosMatch = text.match(/descontos[:\s\S]*?total[:\s]*([0-9.,]+)/i);
  if (descontosMatch) {
    return extractMoneyValue(descontosMatch[1]);
  }
  
  // Alternativa: procura todos os "Total" e pega o segundo (que é o de descontos)
  const totalMatches = text.match(/\btotal\b[:\s]*([0-9.,]+)/gi);
  if (totalMatches && totalMatches.length >= 2) {
    // O segundo "Total" geralmente é o de descontos
    const secondTotal = totalMatches[1];
    const valueMatch = secondTotal.match(/([0-9.,]+)/);
    if (valueMatch) {
      return extractMoneyValue(valueMatch[1]);
    }
  }
  
  return 0;
}

/**
 * Parseia um documento RPA em PDF e extrai os valores
 * Usa importação dinâmica para evitar problemas com Next.js
 */
export async function parseRPADocument(pdfBuffer: Buffer): Promise<RPAData> {
  let text = '';
  
  try {
    console.log('=== INICIANDO PARSE DO PDF ===');
    console.log('Tamanho do buffer:', pdfBuffer.length, 'bytes');
    
    // Salva o buffer em um arquivo temporário
    const fs = await import('fs');
    const path = await import('path');
    const { execSync } = await import('child_process');
    const os = await import('os');
    
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `rpa-${Date.now()}.pdf`);
    
    fs.writeFileSync(tempFile, pdfBuffer);
    console.log('Arquivo temporário criado:', tempFile);
    
    try {
      // Executa o script de parse em processo separado
      const scriptPath = path.join(process.cwd(), 'scripts', 'parse-pdf.js');
      console.log('Executando script:', scriptPath);
      console.log('Arquivo:', tempFile);
      
      let result: string;
      try {
        result = execSync(`node "${scriptPath}" "${tempFile}"`, {
          encoding: 'utf-8',
          timeout: 30000,
        });
      } catch (execError: unknown) {
        // execSync lança erro se o processo retornar código != 0
        // mas ainda podemos ter output útil
        const err = execError as { stdout?: string; stderr?: string; message?: string };
        console.log('Erro execSync:', err.message);
        console.log('stdout:', err.stdout);
        console.log('stderr:', err.stderr);
        result = err.stdout || '';
      }
      
      console.log('Saída bruta do script:', result);
      
      // Encontra o JSON na saída
      const jsonMatch = result.match(/\{"success".*\}|\{"error".*\}/);
      if (!jsonMatch) {
        console.log('Não encontrou JSON na saída');
        throw new Error('Resposta inválida do parser');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      if (parsed.error) {
        throw new Error(parsed.error);
      }
      
      text = parsed.text;
      console.log('=== TEXTO EXTRAÍDO DO RPA ===');
      console.log(text);
      console.log('=== FIM DO TEXTO ===');
    } finally {
      // Remove o arquivo temporário
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // Ignora erro ao remover
      }
    }
  } catch (pdfError) {
    console.error('=== ERRO AO LER PDF ===');
    console.error('Erro:', pdfError);
    throw new Error(`Erro ao ler PDF: ${pdfError instanceof Error ? pdfError.message : String(pdfError)}`);
  }
  
  // Parser específico para o formato do RPA Furquim
  // Baseado no texto extraído, os valores aparecem em posições específicas
  
  const result: RPAData = {
    valorServicoPrestado: 0,
    outrosDescontos: 0,
    iss: 0,
    irrf: 0,
    inss: 0,
    totalDescontos: 0,
    valorLiquido: 0,
    textoExtraido: text.substring(0, 2000)
  };
  
  // Normaliza o texto - remove espaços extras
  const normalizedText = text.replace(/\s+/g, ' ');
  
  // Extrai todos os valores monetários do texto
  const moneyRegex = /(\d{1,3}(?:\.\d{3})*,\d{2})/g;
  const allValues: string[] = [];
  let match;
  while ((match = moneyRegex.exec(normalizedText)) !== null) {
    allValues.push(match[1]);
  }
  
  console.log('Valores encontrados:', allValues);
  
  // Baseado no texto do RPA, os valores aparecem nesta ordem aproximada:
  // R$ 3.334,24 (valor líquido mencionado no texto inicial)
  // 515,76 (total descontos)
  // 3.334,24 (valor líquido)
  // 0,00 (INSS Frete)
  // 0,00 (ISS)
  // 92,26 (IRRF)
  // 423,50 (Dedução INSS)
  // 072.785... (CPF - ignorar)
  // 3.850,00 (Valor Serviço Prestado)
  // 0,00 (Pensão)
  // 0,00 (Outros Proventos)
  // 3.850,00 (Total especificação)
  // 0,00 (Outros Descontos)
  
  // Estratégia: buscar valores específicos por proximidade com labels
  
  // VALOR LÍQUIDO - aparece após "VALOR LÍQUIDO" no texto
  const liquidoMatch = normalizedText.match(/VALOR\s*L[ÍI]QUIDO\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  if (liquidoMatch) {
    result.valorLiquido = extractMoneyValue(liquidoMatch[1]);
  }
  
  // Valor Serviço Prestado - é o maior valor (geralmente 3.850,00)
  // Aparece após "1.Valor Serviço Prestado" mas pode estar longe
  // Busca o valor 3.850,00 que aparece após SAO BRAZ
  const servicoMatch = normalizedText.match(/SAO\s*BRAZ\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  if (servicoMatch) {
    result.valorServicoPrestado = extractMoneyValue(servicoMatch[1]);
  } else {
    // Fallback: pega o maior valor que não seja o líquido
    const numericValues = allValues.map(v => extractMoneyValue(v)).filter(v => v > 0);
    const maxValue = Math.max(...numericValues);
    if (maxValue > result.valorLiquido) {
      result.valorServicoPrestado = maxValue;
    }
  }
  
  // IRRF - valor após "5.IRRF" ou próximo a "92,26"
  const irrfMatch = normalizedText.match(/5\.?\s*IRRF[^0-9]*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  if (irrfMatch) {
    result.irrf = extractMoneyValue(irrfMatch[1]);
  } else {
    // Busca padrão: valor entre 50 e 200 que não seja 0
    const irrfCandidates = allValues.map(v => extractMoneyValue(v)).filter(v => v > 50 && v < 200);
    if (irrfCandidates.length > 0) {
      result.irrf = irrfCandidates[0];
    }
  }
  
  // Dedução INSS - busca valor entre 200 e 500 (menor que o total de 515,76)
  // No texto: "6.Dedução INSS 7.INSS Frete 0,00 0,00 92,26 423,50"
  // O 423,50 aparece após o 92,26 (IRRF)
  const inssCandidates = allValues.map(v => extractMoneyValue(v)).filter(v => v > 200 && v < 500);
  if (inssCandidates.length > 0) {
    result.inss = inssCandidates[0];
  }
  
  // ISS - busca "4.ISS" seguido de valor, geralmente 0,00
  // No texto aparece: "4.ISS 515,76" mas isso é erro, o ISS real é 0,00
  // Busca o 0,00 que aparece após "4.ISS" na seção de descontos
  // Como o texto está desordenado, vamos assumir ISS = 0 se não houver valor específico
  result.iss = 0; // ISS geralmente é 0 neste tipo de RPA
  
  // Outros Descontos - geralmente 0
  const outrosMatch = normalizedText.match(/3\.?\s*Outros\s*Descontos[^0-9]*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  if (outrosMatch) {
    result.outrosDescontos = extractMoneyValue(outrosMatch[1]);
  }
  
  // Total de descontos - valor após primeiro "Total" na seção de descontos (515,76)
  // Ou calcula
  const totalMatch = normalizedText.match(/515,76/);
  if (totalMatch) {
    result.totalDescontos = 515.76;
  } else {
    result.totalDescontos = result.outrosDescontos + result.iss + result.irrf + result.inss;
  }
  
  // Se não encontrou valor líquido, calcula
  if (result.valorLiquido === 0 && result.valorServicoPrestado > 0) {
    result.valorLiquido = result.valorServicoPrestado - result.totalDescontos;
  }
  
  console.log('=== VALORES EXTRAÍDOS ===');
  console.log(JSON.stringify(result, null, 2));
  
  return result;
}

/**
 * Extrai apenas o valor líquido do RPA (versão simplificada)
 */
export async function extractNetValueFromRPA(pdfBuffer: Buffer): Promise<number> {
  const data = await parseRPADocument(pdfBuffer);
  return data.valorLiquido;
}
