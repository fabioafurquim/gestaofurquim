import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { gerarCnabPix, CompanyData, Payment } from '@/lib/cnab-generator';

/**
 * Dados da empresa FURQUIM FISIOTERAPIA LTDA
 */
const DADOS_EMPRESA: CompanyData = {
  cnpj: '53914002000152',
  nome: 'FURQUIM FISIOTERAPIA LTDA',
  conta: '34242533',
  conta_dv: '1',
  logradouro: 'RUA DO SOL',
  numero: '368',
  complemento: '',
  cidade: 'CURITIBA',
  cep: '81910350',
  estado: 'PR'
};

/**
 * Mapeia o tipo de chave PIX do banco de dados para o formato do CNAB
 */
function mapearTipoChavePix(tipoPix: string | null): 'CPF' | 'CNPJ' | 'EMAIL' | 'CELULAR' | 'ALEATORIA' {
  switch (tipoPix?.toUpperCase()) {
    case 'CPF':
      return 'CPF';
    case 'CNPJ':
      return 'CNPJ';
    case 'EMAIL':
      return 'EMAIL';
    case 'CELULAR':
    case 'TELEFONE':
      return 'CELULAR';
    case 'ALEATORIA':
    case 'RANDOM':
      return 'ALEATORIA';
    default:
      return 'EMAIL'; // Padrão para email se não especificado
  }
}

/**
 * Obtém a chave PIX baseada no tipo e nos dados do fisioterapeuta
 */
function obterChavePix(fisioterapeuta: any): { tipo: 'CPF' | 'CNPJ' | 'EMAIL' | 'CELULAR' | 'ALEATORIA'; chave: string } {
  // Se tem chave PIX específica, usa ela
  if (fisioterapeuta.chavePix) {
    return {
      tipo: mapearTipoChavePix(fisioterapeuta.tipoPix),
      chave: fisioterapeuta.chavePix
    };
  }

  // Senão, usa CPF para RPA ou CNPJ para PJ
  if (fisioterapeuta.contractType === 'PJ') {
    return {
      tipo: 'CNPJ',
      chave: fisioterapeuta.cnpjEmpresa || fisioterapeuta.cpf || ''
    };
  } else {
    return {
      tipo: 'CPF',
      chave: fisioterapeuta.cpf || ''
    };
  }
}

/**
 * Interface para dados de pagamento recebidos do frontend
 */
interface PaymentInput {
  physiotherapistId: number;
  totalShiftValue: number;
  additionalValue: number;
  rpaDiscount: number;
  totalValue: number;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ month: string }> }) {
  try {
    const { month } = await params;
    const { payments: paymentInputs }: { payments: PaymentInput[] } = await request.json();

    if (!paymentInputs || paymentInputs.length === 0) {
      return NextResponse.json({ error: 'Nenhum pagamento fornecido' }, { status: 400 });
    }

    // Buscar dados dos fisioterapeutas
    const physiotherapistIds = paymentInputs.map(p => p.physiotherapistId);
    
    const physiotherapists = await prisma.physiotherapist.findMany({
      where: {
        id: { in: physiotherapistIds }
      },
      select: {
        id: true,
        name: true,
        cpf: true,
        contractType: true,
        chavePix: true,
        tipoPix: true,
        cnpjEmpresa: true
      }
    });

    // Criar mapa de fisioterapeutas por ID
    const physiotherapistMap = new Map(physiotherapists.map(p => [p.id, p]));

    // Preparar dados para o CNAB usando os valores do frontend
    const pagamentos: Payment[] = [];

    for (const paymentInput of paymentInputs) {
      const fisioterapeuta = physiotherapistMap.get(paymentInput.physiotherapistId);
      if (!fisioterapeuta) {
        continue;
      }

      // Usar valores diretamente do frontend (já calculados)
      const valorFinal = paymentInput.totalValue;

      // Só incluir no CNAB se o valor for maior que zero
      if (valorFinal > 0) {
        const { tipo, chave } = obterChavePix(fisioterapeuta);

        pagamentos.push({
          nome: fisioterapeuta.name,
          cpf_cnpj: fisioterapeuta.contractType === 'PJ' && fisioterapeuta.cnpjEmpresa 
            ? fisioterapeuta.cnpjEmpresa 
            : fisioterapeuta.cpf,
          valor: valorFinal,
          chave_pix: chave,
          tipo_chave_pix: tipo
        });
      }
    }

    if (pagamentos.length === 0) {
      return NextResponse.json({ error: 'Nenhum pagamento válido encontrado' }, { status: 400 });
    }

    // Gerar arquivo CNAB
    const conteudoCnab = gerarCnabPix(DADOS_EMPRESA, pagamentos, 1);
    const nomeArquivo = `CNAB_${month.replace('-', '_')}.REM`;

    return new NextResponse(conteudoCnab.conteudo, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
      },
    });

  } catch (error) {
    console.error('Erro ao gerar CNAB:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor ao gerar CNAB' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ month: string }> }) {
  try {
    const { month } = await params;
    
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'Formato de mês inválido. Use YYYY-MM' }, { status: 400 });
    }

    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);

    // Buscar todos os plantões do mês com dados dos fisioterapeutas
    const shifts = await prisma.shift.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        physiotherapist: {
          select: {
            id: true,
            name: true,
            cpf: true,
            contractType: true,
            hourValue: true,
            additionalValue: true,
            tipoPix: true,
            chavePix: true,
            cnpjEmpresa: true,
          },
        },
      },
    });

    if (shifts.length === 0) {
      return NextResponse.json({ error: 'Nenhum plantão encontrado para o mês especificado' }, { status: 404 });
    }

    // Agrupar plantões por fisioterapeuta e calcular valores
    const paymentsByPhysio = new Map<string, {
      physiotherapist: any;
      totalShifts: number;
      totalShiftValue: number;
      additionalValue: number;
      totalValue: number;
      rpaDiscount: number;
      shifts: any[];
    }>();

    for (const shift of shifts) {
      if (!shift.physiotherapist) continue;

      const physioId = shift.physiotherapist.id.toString();
      const hourValue = Number(shift.physiotherapist.hourValue) || 0;
      const additionalValue = Number(shift.physiotherapist.additionalValue) || 0;
      
      if (!paymentsByPhysio.has(physioId)) {
        paymentsByPhysio.set(physioId, {
          physiotherapist: shift.physiotherapist,
          totalShifts: 0,
          totalShiftValue: 0,
          additionalValue: additionalValue,
          totalValue: 0,
          rpaDiscount: 0,
          shifts: []
        });
      }

      const payment = paymentsByPhysio.get(physioId)!;
      payment.totalShifts += 1;
      payment.shifts.push(shift);
    }

    // Calcular valores usando a mesma lógica da interface (shiftsCount * hourValue)
    for (const [physioId, payment] of paymentsByPhysio) {
      const hourValue = Number(payment.physiotherapist.hourValue) || 0;
      payment.totalShiftValue = payment.totalShifts * hourValue;
    }

    // Calcular valores finais e preparar dados para CNAB
    const pagamentos: Payment[] = [];
    
    for (const [physioId, payment] of paymentsByPhysio) {
      const { physiotherapist } = payment;
      
      // Calcular desconto RPA (zerado por padrão, como na interface)
      if (physiotherapist.contractType === 'RPA') {
        payment.rpaDiscount = 0; // Zerado por padrão, editável pelo usuário na interface
      }
      
      // Calcular valor total
      payment.totalValue = payment.totalShiftValue + payment.additionalValue - payment.rpaDiscount;
      
      // Só incluir no CNAB se o valor total for maior que zero
      if (payment.totalValue > 0) {
        const chavePix = obterChavePix(physiotherapist);
        
        pagamentos.push({
          nome: physiotherapist.name,
          cpf_cnpj: physiotherapist.contractType === 'PJ' && physiotherapist.cnpjEmpresa 
            ? physiotherapist.cnpjEmpresa 
            : physiotherapist.cpf,
          tipo_chave_pix: chavePix.tipo,
          chave_pix: chavePix.chave,
          valor: payment.totalValue
        });
      }
    }

    if (pagamentos.length === 0) {
      return NextResponse.json({ error: 'Nenhum pagamento válido encontrado para gerar CNAB' }, { status: 404 });
    }

    // Gerar número sequencial do arquivo (pode ser baseado na data ou incrementado)
    const numeroSequencial = parseInt(month.replace('-', '')) % 9999 + 1;
    
    // Gerar arquivo CNAB
    const { nomeArquivo, conteudo } = gerarCnabPix(DADOS_EMPRESA, pagamentos, numeroSequencial);

    // Retornar arquivo para download
    return new NextResponse(conteudo, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=ascii',
        'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
        'Content-Length': conteudo.length.toString(),
      },
    });

  } catch (error) {
    console.error('Erro ao gerar CNAB:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor ao gerar CNAB' },
      { status: 500 }
    );
  }
}