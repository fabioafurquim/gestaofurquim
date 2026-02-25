import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { uploadFileToDrive, isAuthenticated } from '@/lib/google-drive';
import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'payments');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ month: string }> }
) {
  try {
    const { month } = await params;
    const { fileType } = await request.json();

    if (!fileType || !['rpa', 'nf'].includes(fileType)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo inválido. Use "rpa" ou "nf".' },
        { status: 400 }
      );
    }

    if (!isAuthenticated()) {
      return NextResponse.json(
        { error: 'Google Drive não está autenticado. Configure a integração primeiro.' },
        { status: 401 }
      );
    }

    const [year, monthNum] = month.split('-');
    const monthDir = path.join(UPLOADS_DIR, month);

    if (!fs.existsSync(monthDir)) {
      return NextResponse.json(
        { error: 'Nenhum arquivo encontrado para este mês.' },
        { status: 404 }
      );
    }

    // Buscar fisioterapeutas com o tipo de contrato correspondente
    const contractType = fileType === 'rpa' ? 'RPA' : 'PJ';
    const physiotherapists = await prisma.physiotherapist.findMany({
      where: {
        status: 'ACTIVE',
        contractType: contractType
      },
      select: {
        id: true,
        name: true,
        contractType: true
      }
    });

    let savedCount = 0;
    const results: { name: string; success: boolean; error?: string; fileId?: string }[] = [];

    for (const physio of physiotherapists) {
      const sanitizedName = physio.name.replace(/[^a-zA-Z0-9]/g, '_');
      const filePrefix = fileType.toUpperCase();
      
      // Procurar arquivo correspondente
      const files = fs.readdirSync(monthDir);
      const matchingFile = files.find(f => 
        f.startsWith(`${filePrefix}_${sanitizedName}_${month}`)
      );

      if (!matchingFile) {
        continue; // Arquivo não encontrado para este fisioterapeuta
      }

      const filePath = path.join(monthDir, matchingFile);
      
      try {
        const buffer = fs.readFileSync(filePath);
        const extension = matchingFile.split('.').pop() || 'pdf';
        const mimeType = extension === 'xml' ? 'application/xml' : 'application/pdf';
        
        // Determinar tipo de documento para o Drive
        const documentType: 'RPA' | 'Notas Fiscais' | 'Comprovantes PIX' = fileType === 'rpa' ? 'RPA' : 'Notas Fiscais';
        
        // Upload para o Drive
        const uploadResult = await uploadFileToDrive(
          buffer,
          matchingFile,
          mimeType,
          physio.name,
          year,
          documentType
        );

        if (uploadResult) {
          savedCount++;
          results.push({ name: physio.name, success: true, fileId: uploadResult.fileId });
          
          // Atualizar o registro no banco com o fileId
          const monthlyControl = await prisma.monthlyPaymentControl.findUnique({
            where: { referenceMonth: month }
          });
          
          if (monthlyControl) {
            const updateData = fileType === 'rpa' 
              ? { rpaFileId: uploadResult.fileId, rpaFileName: matchingFile }
              : { nfFileId: uploadResult.fileId, nfFileName: matchingFile };
            
            await prisma.paymentRecord.updateMany({
              where: {
                monthlyControlId: monthlyControl.id,
                physiotherapistId: physio.id
              },
              data: updateData
            });
          }
        }
      } catch (uploadError) {
        console.error(`Erro ao fazer upload para ${physio.name}:`, uploadError);
        results.push({ 
          name: physio.name, 
          success: false, 
          error: uploadError instanceof Error ? uploadError.message : 'Erro desconhecido' 
        });
      }
    }

    return NextResponse.json({
      success: true,
      saved: savedCount,
      total: physiotherapists.length,
      results
    });

  } catch (error) {
    console.error('Erro ao salvar no Drive:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
