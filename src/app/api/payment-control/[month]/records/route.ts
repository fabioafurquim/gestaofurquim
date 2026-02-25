import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ month: string }>;
}

/**
 * POST /api/payment-control/[month]/records
 * Adiciona um novo registro de pagamento (para fisioterapeuta não cadastrado)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { month } = await params;
    const body = await request.json();
    const { manualName, manualEmail, manualContractType, grossValue } = body;

    // Busca o controle do mês
    const control = await prisma.monthlyPaymentControl.findUnique({
      where: { referenceMonth: month },
    });

    if (!control) {
      return NextResponse.json(
        { error: 'Controle de pagamento não encontrado para este mês' },
        { status: 404 }
      );
    }

    if (!manualName || !manualContractType) {
      return NextResponse.json(
        { error: 'Nome e tipo de contrato são obrigatórios' },
        { status: 400 }
      );
    }

    const record = await prisma.paymentRecord.create({
      data: {
        monthlyControlId: control.id,
        manualName,
        manualEmail,
        manualContractType,
        grossValue: grossValue || 0,
        netValue: grossValue || 0,
        status: 'PENDING',
        emailStatus: 'PENDING',
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar registro de pagamento:', error);
    return NextResponse.json(
      { error: 'Erro ao criar registro de pagamento' },
      { status: 500 }
    );
  }
}
