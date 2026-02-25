import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

/**
 * API para criar dump do banco de dados PostgreSQL
 * Gera um arquivo SQL completo com estrutura e dados
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Verificar se é administrador
    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem criar backups.' },
        { status: 403 }
      );
    }

    // Gerar nome do arquivo com timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `plantaofisio-backup-${timestamp}.json`;
    const tempDir = path.join(process.cwd(), 'temp');
    const filePath = path.join(tempDir, fileName);

    // Criar diretório temp se não existir
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    console.log('Iniciando backup dos dados do PostgreSQL...');
    
    // Buscar todos os dados do banco
    const [shiftTeams, physiotherapists, users, shifts] = await Promise.all([
      prisma.shiftTeam.findMany({
        orderBy: { id: 'asc' }
      }),
      prisma.physiotherapist.findMany({
        include: {
          teams: true,
          user: true
        },
        orderBy: { id: 'asc' }
      }),
      prisma.user.findMany({
        include: {
          physiotherapist: true
        },
        orderBy: { id: 'asc' }
      }),
      prisma.shift.findMany({
        include: {
          physiotherapist: true
        },
        orderBy: { id: 'asc' }
      })
    ]);

    // Criar estrutura do backup
    const backupData = {
      metadata: {
        version: '1.0',
        timestamp: new Date().toISOString(),
        database: 'postgresql',
        tables: ['ShiftTeam', 'Physiotherapist', 'User', 'Shift']
      },
      data: {
        shiftTeams,
        physiotherapists,
        users,
        shifts
      },
      counts: {
        shiftTeams: shiftTeams.length,
        physiotherapists: physiotherapists.length,
        users: users.length,
        shifts: shifts.length
      }
    };

    // Salvar dados em arquivo JSON
    const jsonData = JSON.stringify(backupData, null, 2);
    fs.writeFileSync(filePath, jsonData, 'utf8');

    const fileSize = fs.statSync(filePath).size;
    console.log(`Backup criado com sucesso: ${fileName} (${fileSize} bytes)`);
    console.log(`Dados exportados: ${backupData.counts.shiftTeams} equipes, ${backupData.counts.physiotherapists} fisioterapeutas, ${backupData.counts.users} usuários, ${backupData.counts.shifts} plantões`);

    // Ler o arquivo para enviar como resposta
    const fileBuffer = fs.readFileSync(filePath);

    // Limpar arquivo temporário após um delay
    setTimeout(() => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Arquivo temporário removido: ${fileName}`);
        }
      } catch (error) {
        console.error('Erro ao remover arquivo temporário:', error);
      }
    }, 5000); // 5 segundos de delay

    // Retornar o arquivo como download
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileSize.toString(),
      },
    });

  } catch (error) {
    console.error('Erro ao criar dump:', error);
    
    // Verificar se é erro de conexão com o banco
    if (error instanceof Error) {
      if (error.message.includes('connection') || error.message.includes('ECONNREFUSED')) {
        return NextResponse.json(
          { error: 'Erro de conexão com o banco de dados PostgreSQL. Verifique se o servidor está rodando.' },
          { status: 500 }
        );
      }
      
      if (error.message.includes('authentication') || error.message.includes('password')) {
        return NextResponse.json(
          { error: 'Erro de autenticação no banco de dados. Verifique as credenciais.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor ao criar backup' },
      { status: 500 }
    );
  }
}