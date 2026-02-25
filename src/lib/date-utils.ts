import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Verifica se uma data é fim de semana (sábado ou domingo)
 */
export function isWeekend(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // 0 = domingo, 6 = sábado
}

/**
 * Verifica se uma data é dia útil (segunda a sexta)
 */
export function isWeekday(date: Date): boolean {
  return !isWeekend(date);
}

/**
 * Verifica se uma data é feriado cadastrado
 */
export async function isHoliday(date: Date): Promise<boolean> {
  try {
    // Converte a data para string no formato YYYY-MM-DD e depois usa parseLocalDate
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const localDate = parseLocalDate(dateString);
    
    const holiday = await prisma.holiday.findUnique({
      where: {
        date: localDate
      }
    });
    return !!holiday;
  } catch (error) {
    console.error('Erro ao verificar feriado:', error);
    return false;
  }
}

/**
 * Verifica se uma data é considerada "fim de semana" para fins de plantão
 * (inclui sábados, domingos e feriados)
 */
export async function isWeekendOrHoliday(date: Date): Promise<boolean> {
  const weekend = isWeekend(date);
  const holiday = await isHoliday(date);
  return weekend || holiday;
}

/**
 * Verifica se uma data é considerada "dia útil" para fins de plantão
 * (segunda a sexta, excluindo feriados)
 */
export async function isWorkday(date: Date): Promise<boolean> {
  const weekday = isWeekday(date);
  const holiday = await isHoliday(date);
  return weekday && !holiday;
}

/**
 * Converte uma string de data no formato YYYY-MM-DD para Date no timezone local
 * Evita problemas de interpretação UTC que podem causar shift de um dia
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // month é zero-indexed
}

/**
 * Formata uma data para o padrão brasileiro (DD/MM/AAAA)
 */
export function formatDateBR(date: Date): string {
  return date.toLocaleDateString('pt-BR');
}

/**
 * Formata uma data para o padrão ISO (AAAA-MM-DD)
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Converte uma string de data para objeto Date
 */
export function parseDate(dateString: string): Date {
  return new Date(dateString);
}

/**
 * Obtém o nome do dia da semana em português
 */
export function getDayName(date: Date): string {
  const days = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado'
  ];
  return days[date.getDay()];
}

/**
 * Formata uma data para exibição em português brasileiro
 * Evita problemas de timezone ao usar parseLocalDate
 */
export function formatDateForDisplay(dateString: string): string {
  try {
    const date = parseLocalDate(dateString.split('T')[0]); // Remove horário se presente
    return date.toLocaleDateString('pt-BR');
  } catch (error) {
    console.error('Erro ao formatar data:', error);
    return dateString;
  }
}

/**
 * Obtém todos os feriados cadastrados
 */
export async function getAllHolidays() {
  try {
    return await prisma.holiday.findMany({
      orderBy: {
        date: 'asc'
      }
    });
  } catch (error) {
    console.error('Erro ao buscar feriados:', error);
    return [];
  }
}