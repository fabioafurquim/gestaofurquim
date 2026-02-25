import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/gmail-sender';
import { isAuthenticated } from '@/lib/google-drive';
import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'payments');

interface EmailResult {
  physiotherapistId: number;
  name: string;
  email: string;
  success: boolean;
  error?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ month: string }> }
) {
  try {
    const { month } = await params;
    const { physiotherapistIds } = await request.json();

    if (!physiotherapistIds || !Array.isArray(physiotherapistIds) || physiotherapistIds.length === 0) {
      return NextResponse.json(
        { error: 'Lista de IDs de fisioterapeutas é obrigatória' },
        { status: 400 }
      );
    }

    if (!isAuthenticated()) {
      return NextResponse.json(
        { error: 'Google não está autenticado. Configure a integração primeiro.' },
        { status: 401 }
      );
    }

    const [year, monthNum] = month.split('-');
    const monthDir = path.join(UPLOADS_DIR, month);
    
    // Formatar nome do mês
    const monthDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    const monthName = monthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    // Buscar fisioterapeutas
    const physiotherapists = await prisma.physiotherapist.findMany({
      where: {
        id: { in: physiotherapistIds },
        status: 'ACTIVE'
      },
      select: {
        id: true,
        name: true,
        email: true,
        contractType: true
      }
    });

    const results: EmailResult[] = [];

    for (const physio of physiotherapists) {
      if (!physio.email) {
        results.push({
          physiotherapistId: physio.id,
          name: physio.name,
          email: '',
          success: false,
          error: 'E-mail não cadastrado'
        });
        continue;
      }

      try {
        const attachments: { filename: string; content: Buffer; mimeType: string }[] = [];
        const sanitizedName = physio.name.replace(/[^a-zA-Z0-9]/g, '_');

        // Buscar arquivos do fisioterapeuta
        if (fs.existsSync(monthDir)) {
          const files = fs.readdirSync(monthDir);
          
          // Para RPA, anexar o arquivo RPA junto com o comprovante
          if (physio.contractType === 'RPA') {
            const rpaFile = files.find(f => f.startsWith(`RPA_${sanitizedName}_${month}`));
            if (rpaFile) {
              const filePath = path.join(monthDir, rpaFile);
              attachments.push({
                filename: rpaFile,
                content: fs.readFileSync(filePath),
                mimeType: 'application/pdf'
              });
            }
          }

          // Buscar comprovante PIX (se existir)
          const pixFile = files.find(f => f.startsWith(`PIX_${sanitizedName}_${month}`));
          if (pixFile) {
            const filePath = path.join(monthDir, pixFile);
            const extension = pixFile.split('.').pop() || 'pdf';
            const mimeType = extension === 'pdf' ? 'application/pdf' : `image/${extension}`;
            attachments.push({
              filename: pixFile,
              content: fs.readFileSync(filePath),
              mimeType
            });
          }
        }

        // Montar corpo do e-mail
        const subject = `Comprovante de Pagamento - ${monthName}`;
        const body = `
Olá ${physio.name.split(' ')[0]},

Segue em anexo o comprovante de pagamento referente a ${monthName}.

${physio.contractType === 'RPA' ? 'O RPA correspondente também está anexado para sua conferência.\n' : ''}
Qualquer dúvida, estamos à disposição.

Atenciosamente,
Furquim Fisioterapia
        `.trim();

        // Enviar e-mail
        const emailResult = await sendEmail({
          to: physio.email,
          subject,
          body,
          attachments
        });
        
        if (!emailResult.success) {
          throw new Error(emailResult.error || 'Erro ao enviar e-mail');
        }

        results.push({
          physiotherapistId: physio.id,
          name: physio.name,
          email: physio.email,
          success: true
        });

      } catch (emailError) {
        console.error(`Erro ao enviar e-mail para ${physio.name}:`, emailError);
        results.push({
          physiotherapistId: physio.id,
          name: physio.name,
          email: physio.email || '',
          success: false,
          error: emailError instanceof Error ? emailError.message : 'Erro ao enviar e-mail'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failCount,
      total: results.length,
      results
    });

  } catch (error) {
    console.error('Erro ao enviar e-mails:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
