import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

import { prisma } from '@/lib/prisma';
import {
  buildMonthlyShiftPaymentEntries,
  groupMonthlyShiftPaymentEntries,
} from '@/lib/payment-calculator';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'payments');

/**
 * Interface para os dados de pagamento de um fisioterapeuta
 */
interface PaymentData {
  physiotherapistId: number;
  name: string;
  email: string;
  contractType: 'PJ' | 'RPA' | 'NO_CONTRACT';
  totalShifts: number;
  totalShiftValue: number;
  additionalValue: number;
  grossValue: number;
  netValue: number;
  rpaFileName: string | null;
  rpaFileId: string | null;
  rpaFilePath: string | null;
  rpaValorServico: number | null;
  rpaOutrosDescontos: number | null;
  rpaIss: number | null;
  rpaIrrf: number | null;
  rpaInss: number | null;
  rpaTotalDescontos: number | null;
  nfFileName: string | null;
  nfFileId: string | null;
  nfFilePath: string | null;
  approved: boolean;
  emailStatus: 'PENDING' | 'SENT' | 'FAILED';
  emailSentAt: string | null;
}

/**
 * GET /api/payments/[month]
 * Busca e calcula os dados de pagamento para todos os fisioterapeutas no mês especificado
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ month: string }> }
) {
  try {
    const { month } = await params;

    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(month)) {
      return NextResponse.json(
        { error: 'Formato de mês inválido. Use YYYY-MM' },
        { status: 400 }
      );
    }

    const [year, monthNumber] = month.split('-').map(Number);
    const startDate = new Date(year, monthNumber - 1, 1);

    const monthlyControl = await prisma.monthlyPaymentControl.findUnique({
      where: { referenceMonth: month },
      include: {
        payments: true,
      },
    });

    const entries = await buildMonthlyShiftPaymentEntries(month);
    const summaries = groupMonthlyShiftPaymentEntries(entries);
    const summaryByPhysioId = new Map(
      summaries.map((summary) => [summary.physiotherapistId, summary] as const)
    );

    const physiotherapists = await prisma.physiotherapist.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        email: true,
        contractType: true,
        additionalValue: true,
      },
    });

    const monthDir = path.join(UPLOADS_DIR, month);
    const uploadedFiles = fs.existsSync(monthDir) ? fs.readdirSync(monthDir) : [];

    const paymentData: PaymentData[] = [];

    for (const physio of physiotherapists) {
      const summary = summaryByPhysioId.get(physio.id);
      const totalShifts = summary?.totalShifts ?? 0;
      const totalShiftValue = summary?.totalShiftValue ?? 0;
      const additionalValue = Number(physio.additionalValue) || 0;
      const grossValue = totalShiftValue + additionalValue;

      const existingRecord = monthlyControl?.payments.find(
        (payment) => payment.physiotherapistId === physio.id
      );

      const sanitizedName = physio.name.replace(/[^a-zA-Z0-9]/g, '_');
      const rpaFile = uploadedFiles.find((file) =>
        file.startsWith(`RPA_${sanitizedName}_${month}`)
      );
      const nfFile = uploadedFiles.find((file) =>
        file.startsWith(`NF_${sanitizedName}_${month}`)
      );

      paymentData.push({
        physiotherapistId: physio.id,
        name: physio.name,
        email: physio.email || '',
        contractType: (physio.contractType as 'PJ' | 'RPA' | 'NO_CONTRACT') || 'NO_CONTRACT',
        totalShifts,
        totalShiftValue,
        additionalValue,
        grossValue,
        netValue: existingRecord ? Number(existingRecord.netValue) : grossValue,
        rpaFileName: existingRecord?.rpaFileName || rpaFile || null,
        rpaFileId: existingRecord?.rpaFileId || null,
        rpaFilePath: rpaFile ? path.join(monthDir, rpaFile) : null,
        rpaValorServico: existingRecord?.rpaValorServico ? Number(existingRecord.rpaValorServico) : null,
        rpaOutrosDescontos: existingRecord?.rpaOutrosDescontos ? Number(existingRecord.rpaOutrosDescontos) : null,
        rpaIss: existingRecord?.rpaIss ? Number(existingRecord.rpaIss) : null,
        rpaIrrf: existingRecord?.rpaIrrf ? Number(existingRecord.rpaIrrf) : null,
        rpaInss: existingRecord?.rpaInss ? Number(existingRecord.rpaInss) : null,
        rpaTotalDescontos: existingRecord?.rpaTotalDescontos ? Number(existingRecord.rpaTotalDescontos) : null,
        nfFileName: existingRecord?.nfFileName || nfFile || null,
        nfFileId: existingRecord?.nfFileId || null,
        nfFilePath: nfFile ? path.join(monthDir, nfFile) : null,
        approved: existingRecord?.status === 'PAID' || false,
        emailStatus: (existingRecord?.emailStatus as 'PENDING' | 'SENT' | 'FAILED') || 'PENDING',
        emailSentAt: existingRecord?.emailSentAt?.toISOString() || null,
      });
    }

    paymentData.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      month,
      monthName: startDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      payments: paymentData,
    });
  } catch (error) {
    console.error('Erro ao buscar dados de pagamento:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/payments/[month]
 * Atualiza os dados de pagamento (valores editados, descontos RPA, aprovações)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ month: string }> }
) {
  try {
    const { month } = await params;
    const body = await request.json();
    const { payments } = body;

    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(month)) {
      return NextResponse.json(
        { error: 'Formato de mês inválido. Use YYYY-MM' },
        { status: 400 }
      );
    }

    if (!Array.isArray(payments)) {
      return NextResponse.json(
        { error: 'Dados de pagamento inválidos' },
        { status: 400 }
      );
    }

    let monthlyControl = await prisma.monthlyPaymentControl.findUnique({
      where: { referenceMonth: month },
    });

    if (!monthlyControl) {
      monthlyControl = await prisma.monthlyPaymentControl.create({
        data: { referenceMonth: month },
      });
    }

    for (const payment of payments) {
      await prisma.paymentRecord.upsert({
        where: {
          monthlyControlId_physiotherapistId: {
            monthlyControlId: monthlyControl.id,
            physiotherapistId: payment.physiotherapistId,
          },
        },
        update: {
          grossValue: payment.grossValue,
          netValue: payment.netValue,
          rpaValorServico: payment.rpaValorServico,
          rpaOutrosDescontos: payment.rpaOutrosDescontos,
          rpaIss: payment.rpaIss,
          rpaIrrf: payment.rpaIrrf,
          rpaInss: payment.rpaInss,
          rpaTotalDescontos: payment.rpaTotalDescontos,
          rpaFileName: payment.rpaFileName,
          rpaFileId: payment.rpaFileId,
          nfFileName: payment.nfFileName,
          nfFileId: payment.nfFileId,
          status: payment.approved ? 'PAID' : 'PENDING',
          emailStatus: payment.emailStatus || 'PENDING',
        },
        create: {
          monthlyControlId: monthlyControl.id,
          physiotherapistId: payment.physiotherapistId,
          grossValue: payment.grossValue,
          netValue: payment.netValue,
          rpaValorServico: payment.rpaValorServico,
          rpaOutrosDescontos: payment.rpaOutrosDescontos,
          rpaIss: payment.rpaIss,
          rpaIrrf: payment.rpaIrrf,
          rpaInss: payment.rpaInss,
          rpaTotalDescontos: payment.rpaTotalDescontos,
          rpaFileName: payment.rpaFileName,
          rpaFileId: payment.rpaFileId,
          nfFileName: payment.nfFileName,
          nfFileId: payment.nfFileId,
          status: payment.approved ? 'PAID' : 'PENDING',
          emailStatus: payment.emailStatus || 'PENDING',
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Dados de pagamento atualizados com sucesso',
      payments,
    });
  } catch (error) {
    console.error('Erro ao atualizar dados de pagamento:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
