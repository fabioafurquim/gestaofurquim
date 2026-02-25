import { NextRequest, NextResponse } from 'next/server';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.json();

    // Caminho para o template RPA
    const templatePath = path.join(process.cwd(), 'public', 'contratotemplate.docx');
    
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { error: 'Template de contrato RPA não encontrado' },
        { status: 404 }
      );
    }

    // Ler o template
    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Função para formatar data de YYYY-MM-DD para DD/MM/YYYY
    // Usando UTC para evitar problemas de timezone
    const formatDate = (dateString: string) => {
      if (!dateString) return '';
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    };

    // Função para formatar valor monetário
    const formatCurrency = (value: string) => {
      if (!value) return '';
      // Remove caracteres não numéricos exceto vírgula e ponto
      const cleanValue = value.replace(/[^\d.,]/g, '');
      return `R$ ${cleanValue}`;
    };

    // Preparar dados para substituição no template
    const templateData = {
      nome: formData.nomeCompleto || formData.nome || '',
      nomeCompleto: formData.nomeCompleto || formData.nome || '',
      cpf: formData.cpf || '',
      rg: formData.rg || '',
      nacionalidade: formData.nacionalidade || 'Brasileira',
      estadocivil: (formData.estadocivil || '').toLowerCase(),
      crefito: formData.crefito || '',
      endereco: formData.endereco || '',
      telefone: formData.telefone || '',
      email: formData.email || '',
      dtInicio: formatDate(formData.dtInicio) || '',
      valorPlantao: formatCurrency(formData.valorPlantao) || '',
      banco: formData.banco || '',
      agencia: formData.agencia || '',
      conta: formData.conta || '',
      tipoPix: formData.tipoPix || '',
      chavePix: formData.chavePix || '',
      anoassinatura: formData.anoassinatura || new Date().getFullYear().toString(),
      // Adicionar data atual formatada
      dataAtual: new Date().toLocaleDateString('pt-BR'),
      // Adicionar mês e ano por extenso
      mesAno: new Date().toLocaleDateString('pt-BR', { 
        month: 'long', 
        year: 'numeric' 
      })
    };

    // Substituir as tags no template
    doc.render(templateData);

    // Gerar o documento
    const buffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    // Retornar o arquivo como resposta
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="contrato_rpa_${formData.nomeCompleto?.replace(/\s+/g, '_') || 'documento'}.docx"`,
      },
    });
  } catch (error) {
    console.error('Erro ao gerar contrato RPA:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar contrato RPA' },
      { status: 500 }
    );
  }
}