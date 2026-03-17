import { NextResponse } from 'next/server';
import { requireAdminOrManager } from '@/lib/auth-helpers';
import { generatePhysiotherapistFormPdf } from '@/lib/physiotherapist-form-pdf';

export async function GET() {
  const { error } = await requireAdminOrManager();
  if (error) return error;

  try {
    const pdfBytes = await generatePhysiotherapistFormPdf();

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="formulario-cadastro-fisioterapeuta.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (generateError) {
    console.error('Erro ao gerar formulário de fisioterapeuta:', generateError);
    return NextResponse.json({ error: 'Erro ao gerar formulário' }, { status: 500 });
  }
}
