import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ month: string }>;
}

/**
 * GET /api/payment-control/[month]
 * Obtém o controle de pagamento de um mês específico
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { month } = await params;

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'Formato de mês inválido. Use YYYY-MM' },
        { status: 400 }
      );
    }

    const control = await prisma.monthlyPaymentControl.findUnique({
      where: { referenceMonth: month },
      include: {
        payments: {
          include: {
            physiotherapist: {
              select: {
                id: true,
                name: true,
                email: true,
                contractType: true,
                status: true,
              }
            }
          },
          orderBy: [
            { physiotherapist: { name: 'asc' } }
          ]
        }
      }
    });

    if (!control) {
      return NextResponse.json(
        { error: 'Controle de pagamento não encontrado para este mês' },
        { status: 404 }
      );
    }

    // Sincroniza fisioterapeutas ativos que ainda não estão no controle
    const activePhysiotherapists = await prisma.physiotherapist.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true }
    });

    const existingPhysioIds = control.payments
      .filter(p => p.physiotherapistId !== null)
      .map(p => p.physiotherapistId);

    const newPhysioIds = activePhysiotherapists
      .filter(p => !existingPhysioIds.includes(p.id))
      .map(p => p.id);

    // Adiciona novos fisioterapeutas ao controle
    if (newPhysioIds.length > 0) {
      await prisma.paymentRecord.createMany({
        data: newPhysioIds.map(physioId => ({
          monthlyControlId: control.id,
          physiotherapistId: physioId,
          grossValue: 0,
          netValue: 0,
          status: 'PENDING',
          emailStatus: 'PENDING',
        }))
      });

      // Recarrega o controle com os novos registros
      const updatedControl = await prisma.monthlyPaymentControl.findUnique({
        where: { referenceMonth: month },
        include: {
          payments: {
            include: {
              physiotherapist: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  contractType: true,
                  status: true,
                }
              }
            },
            orderBy: [
              { physiotherapist: { name: 'asc' } }
            ]
          }
        }
      });

      if (updatedControl) {
        const [year, monthNum] = month.split('-');
        const monthNames = [
          'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        const monthName = `${monthNames[parseInt(monthNum) - 1]} de ${year}`;

        return NextResponse.json({
          ...updatedControl,
          monthName,
        });
      }
    }

    // Formata o nome do mês
    const [year, monthNum] = month.split('-');
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const monthName = `${monthNames[parseInt(monthNum) - 1]} de ${year}`;

    return NextResponse.json({
      ...control,
      monthName,
    });
  } catch (error) {
    console.error('Erro ao buscar controle de pagamento:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar controle de pagamento' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/payment-control/[month]
 * Atualiza o status do controle de pagamento
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { month } = await params;
    const body = await request.json();
    const { status } = body;

    if (!['OPEN', 'PROCESSING', 'CLOSED'].includes(status)) {
      return NextResponse.json(
        { error: 'Status inválido' },
        { status: 400 }
      );
    }

    const control = await prisma.monthlyPaymentControl.update({
      where: { referenceMonth: month },
      data: {
        status,
        closedAt: status === 'CLOSED' ? new Date() : null,
      },
    });

    return NextResponse.json(control);
  } catch (error) {
    console.error('Erro ao atualizar controle de pagamento:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar controle de pagamento' },
      { status: 500 }
    );
  }
}
