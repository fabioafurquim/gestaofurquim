import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ month: string; recordId: string }>;
}

/**
 * GET /api/payment-control/[month]/records/[recordId]
 * Obtém um registro de pagamento específico
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { recordId } = await params;
    const id = parseInt(recordId);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'ID de registro inválido' },
        { status: 400 }
      );
    }

    const record = await prisma.paymentRecord.findUnique({
      where: { id },
      include: {
        physiotherapist: {
          select: {
            id: true,
            name: true,
            email: true,
            contractType: true,
          }
        },
        monthlyControl: true,
      }
    });

    if (!record) {
      return NextResponse.json(
        { error: 'Registro de pagamento não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error('Erro ao buscar registro de pagamento:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar registro de pagamento' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/payment-control/[month]/records/[recordId]
 * Atualiza um registro de pagamento
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { recordId } = await params;
    const id = parseInt(recordId);
    const body = await request.json();

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'ID de registro inválido' },
        { status: 400 }
      );
    }

    const {
      grossValue,
      netValue,
      rpaOutrosDescontos,
      rpaIss,
      rpaIrrf,
      rpaInss,
      rpaTotalDescontos,
      status,
    } = body;

    const updateData: Record<string, unknown> = {};

    if (grossValue !== undefined) updateData.grossValue = grossValue;
    if (netValue !== undefined) updateData.netValue = netValue;
    if (rpaOutrosDescontos !== undefined) updateData.rpaOutrosDescontos = rpaOutrosDescontos;
    if (rpaIss !== undefined) updateData.rpaIss = rpaIss;
    if (rpaIrrf !== undefined) updateData.rpaIrrf = rpaIrrf;
    if (rpaInss !== undefined) updateData.rpaInss = rpaInss;
    if (rpaTotalDescontos !== undefined) updateData.rpaTotalDescontos = rpaTotalDescontos;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'PAID') {
        updateData.paidAt = new Date();
      }
    }

    const record = await prisma.paymentRecord.update({
      where: { id },
      data: updateData,
      include: {
        physiotherapist: {
          select: {
            id: true,
            name: true,
            email: true,
            contractType: true,
          }
        }
      }
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error('Erro ao atualizar registro de pagamento:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar registro de pagamento' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/payment-control/[month]/records/[recordId]
 * Remove um registro de pagamento (apenas para registros manuais)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { recordId } = await params;
    const id = parseInt(recordId);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'ID de registro inválido' },
        { status: 400 }
      );
    }

    // Verifica se é um registro manual
    const record = await prisma.paymentRecord.findUnique({
      where: { id },
    });

    if (!record) {
      return NextResponse.json(
        { error: 'Registro de pagamento não encontrado' },
        { status: 404 }
      );
    }

    if (record.physiotherapistId) {
      return NextResponse.json(
        { error: 'Não é possível excluir registros de fisioterapeutas cadastrados' },
        { status: 400 }
      );
    }

    await prisma.paymentRecord.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir registro de pagamento:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir registro de pagamento' },
      { status: 500 }
    );
  }
}
