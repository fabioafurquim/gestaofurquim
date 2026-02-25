import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseRPADocument } from '@/lib/rpa-parser';
import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'payments');

// Garante que o diretório de uploads existe
function ensureUploadsDir(subDir: string) {
  const dir = path.join(UPLOADS_DIR, subDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ month: string }> }
) {
  try {
    const { month } = await params;
    const formData = await request.formData();
    
    const file = formData.get('file') as File;
    const fileType = formData.get('fileType') as string;
    const physiotherapistId = formData.get('physiotherapistId') as string;

    if (!file || !fileType || !physiotherapistId) {
      return NextResponse.json(
        { error: 'Arquivo, tipo e ID do fisioterapeuta são obrigatórios' },
        { status: 400 }
      );
    }

    const physioId = parseInt(physiotherapistId);
    
    // Buscar fisioterapeuta
    const physiotherapist = await prisma.physiotherapist.findUnique({
      where: { id: physioId },
      select: { id: true, name: true, contractType: true }
    });

    if (!physiotherapist) {
      return NextResponse.json(
        { error: 'Fisioterapeuta não encontrado' },
        { status: 404 }
      );
    }

    // Criar diretório para o mês
    const monthDir = ensureUploadsDir(month);
    
    // Gerar nome do arquivo
    const sanitizedName = physiotherapist.name.replace(/[^a-zA-Z0-9]/g, '_');
    const extension = file.name.split('.').pop() || 'pdf';
    const fileName = `${fileType.toUpperCase()}_${sanitizedName}_${month}.${extension}`;
    const filePath = path.join(monthDir, fileName);

    // Salvar arquivo localmente
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    let rpaData = null;
    let grossValue = null;
    let netValue = null;

    // Se for RPA, processar o PDF
    if (fileType === 'rpa') {
      try {
        rpaData = await parseRPADocument(buffer);
        if (rpaData) {
          grossValue = rpaData.valorServicoPrestado;
          netValue = rpaData.valorLiquido;
        }
      } catch (parseError) {
        console.error('Erro ao processar RPA:', parseError);
      }
    }

    // Retornar dados do upload
    return NextResponse.json({
      success: true,
      fileName,
      filePath,
      physiotherapistId: physioId,
      fileType,
      rpaData: rpaData ? {
        valorBruto: rpaData.valorServicoPrestado,
        valorLiquido: rpaData.valorLiquido,
        outrosDescontos: rpaData.outrosDescontos,
        iss: rpaData.iss,
        irrf: rpaData.irrf,
        inss: rpaData.inss,
        totalDescontos: rpaData.totalDescontos,
      } : null,
    });

  } catch (error) {
    console.error('Erro no upload:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
