import { NextRequest, NextResponse } from 'next/server';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.json();

    // Caminho para o template PJ
    const templatePath = path.join(process.cwd(), 'public', 'contratopjtemplate.docx');
    
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { error: 'Template de contrato PJ não encontrado' },
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
    // Usando manipulação direta da string para evitar problemas de timezone
    const formatDate = (dateString: string): string => {
      if (!dateString) return '';
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    };

    // Função para formatar valor monetário
    const formatCurrency = (value: string): string => {
      if (!value) return '';
      // Remove caracteres não numéricos exceto vírgula e ponto
      const cleanValue = value.replace(/[^\d.,]/g, '');
      return `R$ ${cleanValue}`;
    };

    // Preparar dados para substituição no template
    const templateData = {
      nomeempresa: formData.nomeempresa || '',
      cnpjempresa: formData.cnpjempresa || '',
      enderecoempresa: formData.enderecoempresa || '',
      nomerepresentante: formData.nomerepresentante || '',
      cpf: formData.cpf || '',
      rg: formData.rg || '',
      crefito: formData.crefito || '',
      endereco: formData.endereco || '',
      dtInicio: formatDate(formData.dtInicio),
      valorPlantao: formatCurrency(formData.valorPlantao),
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

    // Retornar o arquivo como resposta com extensão DOCX explícita
    const fileName = `contrato_pj_${formData.nomerepresentante?.replace(/\s+/g, '_') || 'documento'}.docx`;
    
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="contrato_pj_${formData.nomerepresentante?.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.docx"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Erro ao gerar contrato PJ:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar contrato PJ' },
      { status: 500 }
    );
  }
}