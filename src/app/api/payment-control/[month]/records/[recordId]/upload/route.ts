import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseRPADocument } from '@/lib/rpa-parser';
import fs from 'fs';
import path from 'path';

interface RouteParams {
  params: Promise<{ month: string; recordId: string }>;
}

/**
 * POST /api/payment-control/[month]/records/[recordId]/upload
 * Faz upload de arquivo (RPA, NF ou Comprovante PIX)
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

    // Processa o form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const fileType = formData.get('fileType') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Arquivo não fornecido' },
        { status: 400 }
      );
    }

    if (!fileType || !['rpa', 'nf', 'pix'].includes(fileType)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo inválido. Use: rpa, nf ou pix' },
        { status: 400 }
      );
    }

    // Converte o arquivo para buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Nome do fisioterapeuta
    const physiotherapistName = record.physiotherapist?.name || record.manualName || 'Desconhecido';
    
    // Extrai o ano do mês de referência
    const [year] = month.split('-');

    // Determina o tipo de documento para a pasta
    let documentType: 'RPA' | 'Notas Fiscais' | 'Comprovantes PIX';
    let updateField: string;
    let fileNameField: string;

    switch (fileType) {
      case 'rpa':
        documentType = 'RPA';
        updateField = 'rpaFileId';
        fileNameField = 'rpaFileName';
        break;
      case 'nf':
        documentType = 'Notas Fiscais';
        updateField = 'nfFileId';
        fileNameField = 'nfFileName';
        break;
      case 'pix':
        documentType = 'Comprovantes PIX';
        updateField = 'pixReceiptFileId';
        fileNameField = 'pixReceiptFileName';
        break;
      default:
        return NextResponse.json(
          { error: 'Tipo de arquivo inválido' },
          { status: 400 }
        );
    }

    // Gera nome do arquivo
    const originalName = file.name;
    const extension = originalName.split('.').pop() || 'pdf';
    const fileName = `${physiotherapistName.replace(/[^a-zA-Z0-9\s]/g, '')}_${month}_${fileType.toUpperCase()}.${extension}`;

    let rpaData = null;

    // Salva o arquivo localmente (upload para Drive será feito ao enviar e-mail)
    const uploadsDir = path.join(process.cwd(), 'uploads', month, recordId.toString());
    fs.mkdirSync(uploadsDir, { recursive: true });
    const localFilePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(localFilePath, buffer);
    console.log('Arquivo salvo localmente:', localFilePath);

    // Se for RPA, extrai os dados do documento
    let parseError: string | null = null;
    if (fileType === 'rpa') {
      try {
        console.log('Iniciando parse do RPA...');
        rpaData = await parseRPADocument(buffer);
        console.log('RPA parseado:', JSON.stringify(rpaData, null, 2));
      } catch (err) {
        console.error('Erro ao parsear RPA:', err);
        parseError = err instanceof Error ? err.message : 'Erro desconhecido';
      }
    }

    // Atualiza o registro no banco (salva o caminho local, não o ID do Drive)
    const updateData: Record<string, unknown> = {};
    updateData[fileNameField] = fileName;
    // Salva o caminho local para upload posterior
    updateData[updateField] = localFilePath;

    // Se for RPA e conseguiu extrair os dados, atualiza os valores
    if (rpaData) {
      updateData.rpaOutrosDescontos = rpaData.outrosDescontos;
      updateData.rpaIss = rpaData.iss;
      updateData.rpaIrrf = rpaData.irrf;
      updateData.rpaInss = rpaData.inss;
      updateData.rpaTotalDescontos = rpaData.totalDescontos;
      updateData.netValue = rpaData.valorLiquido;
      
      // Se o valor bruto ainda não foi definido, usa o valor do serviço prestado
      if (Number(record.grossValue) === 0) {
        updateData.grossValue = rpaData.valorServicoPrestado;
      }
    }

    const updatedRecord = await prisma.paymentRecord.update({
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

    return NextResponse.json({
      success: true,
      record: updatedRecord,
      rpaData,
      localFile: true,
      debug: {
        textoExtraido: rpaData?.textoExtraido || null,
        parseError: parseError,
      },
    });
  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    return NextResponse.json(
      { error: 'Erro ao fazer upload do arquivo' },
      { status: 500 }
    );
  }
}
