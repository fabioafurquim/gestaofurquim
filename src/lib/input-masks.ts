/**
 * Utilitários para máscaras de entrada de dados
 */

/**
 * Aplica máscara de telefone no formato (XX)-XXXXX-XXXX
 */
export const applyPhoneMask = (value: string): string => {
  // Remove todos os caracteres não numéricos
  const numbers = value.replace(/\D/g, '');
  
  // Aplica a máscara conforme o número de dígitos
  if (numbers.length <= 2) {
    return `(${numbers}`;
  } else if (numbers.length <= 7) {
    return `(${numbers.slice(0, 2)})-${numbers.slice(2)}`;
  } else {
    return `(${numbers.slice(0, 2)})-${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  }
};

/**
 * Aplica máscara de CPF no formato XXX.XXX.XXX-XX
 */
export const applyCpfMask = (value: string): string => {
  // Remove todos os caracteres não numéricos
  const numbers = value.replace(/\D/g, '');
  
  // Aplica a máscara conforme o número de dígitos
  if (numbers.length <= 3) {
    return numbers;
  } else if (numbers.length <= 6) {
    return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  } else if (numbers.length <= 9) {
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  } else {
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  }
};

/**
 * Aplica máscara de CNPJ no formato XX.XXX.XXX/XXXX-XX
 */
export const applyCnpjMask = (value: string): string => {
  // Remove todos os caracteres não numéricos
  const numbers = value.replace(/\D/g, '');
  
  // Aplica a máscara conforme o número de dígitos
  if (numbers.length <= 2) {
    return numbers;
  } else if (numbers.length <= 5) {
    return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
  } else if (numbers.length <= 8) {
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`;
  } else if (numbers.length <= 12) {
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`;
  } else {
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12, 14)}`;
  }
};

/**
 * Aplica máscara de moeda brasileira no formato R$ X.XXX,XX
 */
export const applyCurrencyMask = (value: string): string => {
  // Remove todos os caracteres não numéricos
  const numbers = value.replace(/\D/g, '');
  
  // Se não há números, retorna vazio
  if (!numbers) return '';
  
  // Converte para centavos
  const numValue = parseInt(numbers);
  
  // Formata como moeda (divide por 100 para obter reais.centavos)
  const formatted = (numValue / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  return formatted;
};

/**
 * Remove a máscara de moeda e retorna o valor numérico
 */
export const removeCurrencyMask = (value: string): number => {
  const numbers = value.replace(/[^\d]/g, '');
  return numbers ? parseFloat(numbers) / 100 : 0;
};

/**
 * Valida se a chave PIX contém apenas números (para CPF e CNPJ)
 */
export const validateNumericPixKey = (value: string, pixType: string): string => {
  if (pixType === 'CPF' || pixType === 'CNPJ') {
    // Remove todos os caracteres não numéricos
    return value.replace(/\D/g, '');
  }
  return value;
};

/**
 * Remove todos os caracteres não numéricos de uma string
 */
export const removeNonNumeric = (value: string): string => {
  return value.replace(/\D/g, '');
};