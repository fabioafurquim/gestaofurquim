import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Função utilitária para combinar classes CSS de forma inteligente
 * Usa clsx para combinar condicionalmente e tailwind-merge para resolver conflitos do Tailwind
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Função alternativa simples caso não tenha as dependências clsx e tailwind-merge
 * Remove esta função quando instalar as dependências corretas
 */
export function cnSimple(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}