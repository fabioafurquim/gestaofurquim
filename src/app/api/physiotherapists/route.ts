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
        hourValue: hourValue !== undefined && hourValue !== null && `${hourValue}` !== '' ? Number(hourValue) : 0, // Renomeado
        additionalValue: additionalValue !== undefined && additionalValue !== null && `${additionalValue}` !== '' ? Number(additionalValue) : 0,
        status: status ?? 'ACTIVE',
        // Novos campos bancários
        banco: banco ?? null,
        agencia: agencia ?? null,
        conta: conta ?? null,
        tipoPix: tipoPix ?? null,
        chavePix: chavePix ?? null,
        // Novos campos para PJ (obrigatórios apenas se contractType for 'PJ')
        nomeEmpresa: contractType === 'PJ' ? nomeEmpresa : null,
        cnpjEmpresa: contractType === 'PJ' ? cnpjEmpresa : null,
        enderecoEmpresa: contractType === 'PJ' ? enderecoEmpresa : null,
        // Criar relações com as equipes selecionadas
        // teamIds pode ser um array simples [1, 2, 3] ou um array de objetos [{teamId: 1, customShiftValue: 100}, ...]
        teams: teamIds && teamIds.length > 0 ? {
          create: teamIds.map((team: number | { teamId: number; customShiftValue?: number | null }) => {
            if (typeof team === 'number') {
              return { shiftTeamId: team, customShiftValue: null };
            }
            return {
              shiftTeamId: team.teamId,
              customShiftValue: team.customShiftValue !== undefined && team.customShiftValue !== null 
                ? Number(team.customShiftValue) 
                : null
            };
          })
        } : undefined,
      },
    });
    return NextResponse.json(physiotherapist, { status: 201 });
  } catch (error) {
    console.error('Erro na API de fisioterapeutas:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}