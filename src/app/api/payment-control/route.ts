import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/payment-control
 * Lista todos os controles de pagamento mensais
 */
export async function GET() {
  try {
    const controls = await prisma.monthlyPaymentControl.findMany({
      orderBy: { referenceMonth: 'desc' },
      include: {
        _count: {
          select: { payments: true }
        }
      }
    });

    return NextResponse.json(controls);
  } catch (error) {
    console.error('Erro ao listar controles de pagamento:', error);
    return NextResponse.json(
      { error: 'Erro ao listar controles de pagamento' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/payment-control
 * Cria um novo controle de pagamento mensal ou retorna o existente
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { referenceMonth } = body;

    if (!referenceMonth || !/^\d{4}-\d{2}$/.test(referenceMonth)) {
      return NextResponse.json(
        { error: 'Mês de referência inválido. Use o formato YYYY-MM' },
        { status: 400 }
      );
    }

    // Verifica se já existe
    let control = await prisma.monthlyPaymentControl.findUnique({
      where: { referenceMonth },
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
          }
        }
      }
    });

    if (control) {
      return NextResponse.json(control);
    }

    // Cria novo controle
    control = await prisma.monthlyPaymentControl.create({
      data: {
        referenceMonth,
        status: 'OPEN',
      },
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
          }
        }
      }
    });

    // Busca todos os fisioterapeutas ativos para criar registros iniciais
    const activePhysiotherapists = await prisma.physiotherapist.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        email: true,
        contractType: true,
      }
    });

    // Cria registros de pagamento para cada fisioterapeuta ativo
    if (activePhysiotherapists.length > 0) {
      await prisma.paymentRecord.createMany({
        data: activePhysiotherapists.map((physio: { id: number; name: string; email: string; contractType: string }) => ({
          monthlyControlId: control!.id,
          physiotherapistId: physio.id,
          grossValue: 0,
          netValue: 0,
          status: 'PENDING',
          emailStatus: 'PENDING',
        }))
      });

      // Recarrega com os pagamentos criados
      control = await prisma.monthlyPaymentControl.findUnique({
        where: { id: control.id },
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
            }
          }
        }
      });
    }

    return NextResponse.json(control, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar controle de pagamento:', error);
    return NextResponse.json(
      { error: 'Erro ao criar controle de pagamento' },
      { status: 500 }
    );
  }
}
