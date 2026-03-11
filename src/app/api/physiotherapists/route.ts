import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const physiotherapists = await prisma.physiotherapist.findMany({
      include: { 
        teams: {
          include: {
            shiftTeam: true
          }
        }
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(physiotherapists);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar fisioterapeutas' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { error, user } = await requireAuth();
    if (error) return error;

    const data = await request.json();
    const {
      name,
      email,
      phone,
      crefito,
      cpf,
      rg,
      birthDate,
      address,
      startDate,
      contractType,
      teamIds, // Array de IDs das equipes selecionadas
      hourValue, // Renomeado de shiftValue
      additionalValue,
      status,
      exitDate,
      // Novos campos bancários
      banco,
      agencia,
      conta,
      tipoPix,
      chavePix,
      // Novos campos para PJ
      nomeEmpresa,
      cnpjEmpresa,
      enderecoEmpresa,
    } = data;

    if (!name || !email || !crefito || !cpf || !startDate || !contractType) {
      return NextResponse.json({
        error: 'Campos obrigatórios: name, email, crefito, cpf, startDate, contractType',
      }, { status: 400 });
    }

    // Verifica se CPF já existe
    const existingCpf = await prisma.physiotherapist.findUnique({
      where: { cpf },
    });
    if (existingCpf) {
      return NextResponse.json({
        error: 'CPF já cadastrado. Este CPF já está em uso por outro fisioterapeuta.',
      }, { status: 400 });
    }

    // Verifica se CREFITO já existe
    const existingCrefito = await prisma.physiotherapist.findUnique({
      where: { crefito },
    });
    if (existingCrefito) {
      return NextResponse.json({
        error: 'CREFITO já cadastrado. Este número de registro já está em uso por outro fisioterapeuta.',
      }, { status: 400 });
    }

    // Verifica se Email já existe
    const existingEmail = await prisma.physiotherapist.findUnique({
      where: { email },
    });
    if (existingEmail) {
      return NextResponse.json({
        error: 'Email já cadastrado. Este email já está em uso por outro fisioterapeuta.',
      }, { status: 400 });
    }

    const physiotherapist = await prisma.physiotherapist.create({
      data: {
        name,
        email,
        phone: phone ?? null,
        crefito,
        cpf,
        rg: rg ?? null,
        birthDate: birthDate ? new Date(birthDate) : null,
        address: address ?? null,
        startDate: new Date(startDate),
        exitDate: exitDate ? new Date(exitDate) : null,
        contractType,
        hourValue: hourValue !== undefined && hourValue !== null && `${hourValue}` !== '' ? Number(hourValue) : 0,
        additionalValue: additionalValue !== undefined && additionalValue !== null && `${additionalValue}` !== '' ? Number(additionalValue) : 0,
        status: status ?? 'ACTIVE',
        banco: banco ?? null,
        agencia: agencia ?? null,
        conta: conta ?? null,
        tipoPix: tipoPix ?? null,
        chavePix: chavePix ?? null,
        nomeEmpresa: contractType === 'PJ' ? nomeEmpresa : null,
        cnpjEmpresa: contractType === 'PJ' ? cnpjEmpresa : null,
        enderecoEmpresa: contractType === 'PJ' ? enderecoEmpresa : null,
        teams: teamIds && teamIds.length > 0 ? {
          create: teamIds.map((team: number | { teamId: number; customShiftValue?: number | null }) => {
            if (typeof team === 'number') {
              return { shiftTeamId: team };
            }
            const teamData: any = { shiftTeamId: team.teamId };
            if (team.customShiftValue !== undefined && team.customShiftValue !== null) {
              try {
                teamData.customShiftValue = Number(team.customShiftValue);
              } catch (e) {
                // Ignorar se customShiftValue não estiver disponível no schema
              }
            }
            return teamData;
          })
        } : undefined,
      },
    });
    return NextResponse.json(physiotherapist, { status: 201 });
  } catch (error: any) {
    console.error('Erro na API de fisioterapeutas:', error);
    
    // Tratamento específico de erros do Prisma
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0];
      const fieldNames: Record<string, string> = {
        cpf: 'CPF',
        crefito: 'CREFITO',
        email: 'Email',
      };
      const fieldName = fieldNames[field] || 'Campo';
      return NextResponse.json({
        error: `${fieldName} já cadastrado. Este ${fieldName.toLowerCase()} já está em uso por outro fisioterapeuta.`,
      }, { status: 400 });
    }

    if (error.code === 'P2003') {
      return NextResponse.json({
        error: 'Erro de referência: uma ou mais equipes selecionadas não existem.',
      }, { status: 400 });
    }

    if (error.code === 'P2025') {
      return NextResponse.json({
        error: 'Registro não encontrado.',
      }, { status: 404 });
    }

    return NextResponse.json({
      error: 'Erro ao cadastrar fisioterapeuta. Verifique os dados e tente novamente.',
    }, { status: 500 });
  }
}