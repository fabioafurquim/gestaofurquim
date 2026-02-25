import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPaymentReceipt } from '@/lib/gmail-sender';
import { uploadFileToDrive, isAuthenticated } from '@/lib/google-drive';
import fs from 'fs';
import path from 'path';

interface RouteParams {
  params: Promise<{ month: string; recordId: string }>;
}

/**
 * POST /api/payment-control/[month]/records/[recordId]/send-email
 * Envia e-mail com comprovante de pagamento
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { month, recordId } = await params;
    const id = parseInt(recordId);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'ID de registro inválido' },
        { status: 400 }
      );
    }

    // Verifica autenticação do Google
    if (!isAuthenticated()) {
      return NextResponse.json(
        { error: 'Google não autenticado. Configure a autenticação primeiro.' },
        { status: 401 }
      );
    }

    // Busca o registro
    const record = await prisma.paymentRecord.findUnique({
      where: { id },
      include: {
        physiotherapist: true,
        monthlyControl: true,
      }
    });

    if (!record) {
      return NextResponse.json(
        { error: 'Registro de pagamento não encontrado' },
        { status: 404 }
      );
    }

    // Verifica se tem e-mail
    const email = record.physiotherapist?.email || record.manualEmail;
    if (!email) {
      return NextResponse.json(
        { error: 'E-mail do destinatário não encontrado' },
        { status: 400 }
      );
    }

    // Verifica se tem comprovante PIX
    if (!record.pixReceiptFileId && !record.pixReceiptFileName) {
      return NextResponse.json(
        { error: 'Comprovante PIX não anexado' },
        { status: 400 }
      );
    }

    // Nome do fisioterapeuta e ano para estrutura de pastas
    const physiotherapistName = record.physiotherapist?.name || record.manualName || 'Desconhecido';
    const [year] = month.split('-');
    const contractType = record.physiotherapist?.contractType || record.manualContractType;

    // Lê o comprovante PIX do arquivo local
    let pixReceiptBuffer: Buffer;
    if (record.pixReceiptFileId && fs.existsSync(record.pixReceiptFileId)) {
      pixReceiptBuffer = fs.readFileSync(record.pixReceiptFileId);
    } else {
      return NextResponse.json(
        { error: 'Arquivo do comprovante PIX não encontrado. Faça o upload novamente.' },
        { status: 400 }
      );
    }

    // Faz upload do PIX para o Drive
    let pixDriveResult;
    try {
      pixDriveResult = await uploadFileToDrive(
        pixReceiptBuffer,
        record.pixReceiptFileName || 'comprovante_pix.pdf',
        'application/pdf',
        physiotherapistName,
        year,
        'Comprovantes PIX'
      );
      console.log('PIX enviado para o Drive:', pixDriveResult);
    } catch (error) {
      console.error('Erro ao enviar PIX para o Drive:', error);
      return NextResponse.json(
        { error: 'Erro ao enviar comprovante PIX para o Google Drive' },
        { status: 500 }
      );
    }

    // Lê e faz upload do RPA se existir (apenas para contratos RPA)
    let rpaBuffer: Buffer | undefined;
    let rpaDriveResult;
    
    if (contractType === 'RPA' && record.rpaFileId && fs.existsSync(record.rpaFileId)) {
      rpaBuffer = fs.readFileSync(record.rpaFileId);
      try {
        rpaDriveResult = await uploadFileToDrive(
          rpaBuffer,
          record.rpaFileName || 'rpa.pdf',
          'application/pdf',
          physiotherapistName,
          year,
          'RPA'
        );
        console.log('RPA enviado para o Drive:', rpaDriveResult);
      } catch (error) {
        console.error('Erro ao enviar RPA para o Drive:', error);
        // Continua sem o RPA no Drive
      }
    }

    // Envia o e-mail
    const result = await sendPaymentReceipt(
      email,
      month,
      pixReceiptBuffer,
      record.pixReceiptFileName || 'comprovante_pix.pdf',
      rpaBuffer,
      record.rpaFileName || undefined
    );

    if (!result.success) {
      // Atualiza status do e-mail como falha
      await prisma.paymentRecord.update({
        where: { id },
        data: {
          emailStatus: 'FAILED',
        }
      });

      return NextResponse.json(
        { error: result.error || 'Erro ao enviar e-mail' },
        { status: 500 }
      );
    }

    // Atualiza status do e-mail e IDs do Drive
    const updateData: Record<string, unknown> = {
      emailStatus: 'SENT',
      emailSentAt: new Date(),
    };
    
    // Atualiza os IDs do Drive (substitui o caminho local pelo ID do Drive)
    if (pixDriveResult) {
      updateData.pixReceiptFileId = pixDriveResult.fileId;
    }
    if (rpaDriveResult) {
      updateData.rpaFileId = rpaDriveResult.fileId;
    }

    await prisma.paymentRecord.update({
      where: { id },
      data: updateData,
    });

    // Remove arquivos locais após upload bem-sucedido
    try {
      if (record.pixReceiptFileId && fs.existsSync(record.pixReceiptFileId)) {
        fs.unlinkSync(record.pixReceiptFileId);
      }
      if (record.rpaFileId && fs.existsSync(record.rpaFileId)) {
        fs.unlinkSync(record.rpaFileId);
      }
    } catch {
      // Ignora erros ao remover arquivos locais
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      driveUploads: {
        pix: pixDriveResult?.fileId,
        rpa: rpaDriveResult?.fileId,
      },
    });
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar e-mail' },
      { status: 500 }
    );
  }
}
