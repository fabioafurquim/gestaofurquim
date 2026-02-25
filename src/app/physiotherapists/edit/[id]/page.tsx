'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Physiotherapist, ShiftTeam } from '@prisma/client';
import AuthLayout from '@/components/AuthLayout';
import { 
  applyPhoneMask, 
  applyCpfMask, 
  applyCnpjMask, 
  applyCurrencyMask, 
  removeCurrencyMask, 
  validateNumericPixKey 
} from '@/lib/input-masks';

interface PhysiotherapistWithTeams extends Physiotherapist {
  teams?: { shiftTeamId: number; shiftTeam: ShiftTeam }[];
}

export default function EditPhysiotherapistPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [physio, setPhysio] = useState<PhysiotherapistWithTeams | null>(null);
  const [teams, setTeams] = useState<ShiftTeam[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Handlers para aplicar máscaras
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!physio) return;
    const maskedValue = applyPhoneMask(e.target.value);
    setPhysio({ ...physio, phone: maskedValue });
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!physio) return;
    const maskedValue = applyCpfMask(e.target.value);
    setPhysio({ ...physio, cpf: maskedValue });
  };

  const handleCnpjEmpresaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!physio) return;
    const maskedValue = applyCnpjMask(e.target.value);
    setPhysio({ ...physio, cnpjEmpresa: maskedValue } as any);
  };

  const handleHourValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!physio) return;
    const maskedValue = applyCurrencyMask(e.target.value);
    setPhysio({ ...physio, hourValue: maskedValue } as any);
  };

  const handleAdditionalValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!physio) return;
    const maskedValue = applyCurrencyMask(e.target.value);
    setPhysio({ ...physio, additionalValue: maskedValue } as any);
  };

  const handleChavePixChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!physio) return;
    const validatedValue = validateNumericPixKey(e.target.value, (physio as any).tipoPix || '');
    setPhysio({ ...physio, chavePix: validatedValue } as any);
  };

  useEffect(() => {
    fetch('/api/teams')
      .then(res => res.json())
      .then(data => setTeams(data))
      .catch(() => setError('Falha ao carregar equipes'));
  }, []);

  useEffect(() => {
    if (id) {
      fetch(`/api/physiotherapists/${id}`)
        .then(res => res.json())
        .then(data => {
          // Aplicar máscaras aos dados carregados
          const formattedData = {
            ...data,
            phone: data.phone ? applyPhoneMask(data.phone.replace(/\D/g, '')) : '',
            cpf: data.cpf ? applyCpfMask(data.cpf.replace(/\D/g, '')) : '',
            cnpjEmpresa: data.cnpjEmpresa ? applyCnpjMask(data.cnpjEmpresa.replace(/\D/g, '')) : '',
            hourValue: data.hourValue ? applyCurrencyMask((data.hourValue * 100).toString()) : '',
            additionalValue: data.additionalValue ? applyCurrencyMask((data.additionalValue * 100).toString()) : '',
          };
          setPhysio(formattedData);
          // Extrair IDs das equipes associadas
          if (data.teams) {
            setSelectedTeamIds(data.teams.map((t: any) => t.shiftTeamId));
          }
        })
        .catch(() => setError('Falha ao carregar dados do fisioterapeuta'));
    }
  }, [id]);

  const handleTeamChange = (teamId: number, checked: boolean) => {
    if (checked) {
      setSelectedTeamIds(prev => [...prev, teamId]);
    } else {
      setSelectedTeamIds(prev => prev.filter(id => id !== teamId));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!physio) return;

    if (selectedTeamIds.length === 0) {
      setError('Por favor, selecione pelo menos uma equipe.');
      return;
    }

    try {
      const payload: any = {
        name: physio.name,
        email: physio.email,
        phone: physio.phone ?? null,
        crefito: physio.crefito,
        cpf: physio.cpf,
        rg: physio.rg ?? null,
        birthDate: physio.birthDate ? new Date(physio.birthDate).toISOString() : null,
        address: physio.address ?? null,
        startDate: new Date(physio.startDate).toISOString(),
        exitDate: physio.exitDate ? new Date(physio.exitDate).toISOString() : null,
        contractType: physio.contractType,
        status: physio.status,
        hourValue: (physio as any).hourValue ? removeCurrencyMask((physio as any).hourValue) : 0, // Renomeado de shiftValue
        additionalValue: (physio as any).additionalValue ? removeCurrencyMask((physio as any).additionalValue) : 0,
        // Novos campos bancários
        banco: (physio as any).banco || null,
        agencia: (physio as any).agencia || null,
        conta: (physio as any).conta || null,
        tipoPix: (physio as any).tipoPix || null,
        chavePix: (physio as any).chavePix || null,
        // Novos campos para PJ
        nomeEmpresa: physio.contractType === 'PJ' ? (physio as any).nomeEmpresa : null,
        cnpjEmpresa: physio.contractType === 'PJ' ? (physio as any).cnpjEmpresa : null,
        enderecoEmpresa: physio.contractType === 'PJ' ? (physio as any).enderecoEmpresa : null,
        // Equipes selecionadas
        teamIds: selectedTeamIds,
      };

      const response = await fetch(`/api/physiotherapists/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Falha ao atualizar fisioterapeuta');
      }
      router.push('/physiotherapists');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!physio) return;
    
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o fisioterapeuta "${physio.name}"?\n\nEsta ação irá remover permanentemente:\n- Todos os dados do fisioterapeuta\n- Todos os plantões associados a este fisioterapeuta\n\nEsta ação não pode ser desfeita!`
    );
    
    if (!confirmed) return;
    
    try {
      const response = await fetch(`/api/physiotherapists/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        alert('Fisioterapeuta excluído com sucesso!');
        router.push('/physiotherapists');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Falha ao excluir fisioterapeuta');
      }
    } catch (error) {
      console.error('Erro ao excluir fisioterapeuta:', error);
      setError('Falha ao excluir fisioterapeuta');
    }
  };

  if (error) {
    return (
      <AuthLayout title="Editar Fisioterapeuta">
        <div className="alert alert-danger">{error}</div>
      </AuthLayout>
    );
  }

  if (!physio) {
    return (
      <AuthLayout title="Editar Fisioterapeuta">
        <div>Carregando...</div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Editar Fisioterapeuta">
      <div>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="name" className="form-label">Nome Completo</label>
          <input type="text" className="form-control" id="name" value={physio.name} onChange={(e) => setPhysio({ ...physio, name: e.target.value })} required />
        </div>
        <div className="mb-3">
          <label htmlFor="email" className="form-label">Email</label>
          <input type="email" className="form-control" id="email" value={physio.email} onChange={(e) => setPhysio({ ...physio, email: e.target.value })} required />
        </div>
        <div className="mb-3">
          <label htmlFor="phone" className="form-label">Telefone</label>
          <input type="text" className="form-control" id="phone" value={physio.phone ?? ''} onChange={handlePhoneChange} />
        </div>
        <div className="mb-3">
          <label htmlFor="crefito" className="form-label">CREFITO</label>
          <input type="text" className="form-control" id="crefito" value={physio.crefito} onChange={(e) => setPhysio({ ...physio, crefito: e.target.value })} required />
        </div>
        <div className="mb-3">
          <label htmlFor="cpf" className="form-label">CPF</label>
          <input type="text" className="form-control" id="cpf" value={physio.cpf} onChange={handleCpfChange} required />
        </div>
        <div className="mb-3">
          <label htmlFor="rg" className="form-label">RG</label>
          <input type="text" className="form-control" id="rg" value={physio.rg ?? ''} onChange={(e) => setPhysio({ ...physio, rg: e.target.value })} />
        </div>
        <div className="mb-3">
          <label htmlFor="birthDate" className="form-label">Data de Nascimento</label>
          <input type="date" className="form-control" id="birthDate" value={physio.birthDate ? new Date(physio.birthDate).toISOString().slice(0, 10) : ''} onChange={(e) => setPhysio({ ...physio, birthDate: new Date(e.target.value) as any })} />
        </div>
        <div className="mb-3">
          <label htmlFor="address" className="form-label">Endereço</label>
          <input type="text" className="form-control" id="address" value={physio.address ?? ''} onChange={(e) => setPhysio({ ...physio, address: e.target.value })} />
        </div>
        <div className="mb-3">
          <label htmlFor="startDate" className="form-label">Data de Início</label>
          <input type="date" className="form-control" id="startDate" value={physio.startDate ? new Date(physio.startDate).toISOString().slice(0, 10) : ''} onChange={(e) => setPhysio({ ...physio, startDate: new Date(e.target.value) as any })} required />
        </div>
        <div className="mb-3">
          <label htmlFor="exitDate" className="form-label">Data de Saída</label>
          <input type="date" className="form-control" id="exitDate" value={physio.exitDate ? new Date(physio.exitDate).toISOString().slice(0, 10) : ''} onChange={(e) => setPhysio({ ...physio, exitDate: new Date(e.target.value) as any })} />
        </div>
        <div className="mb-3">
          <label htmlFor="contractType" className="form-label">Tipo de Contrato</label>
          <select className="form-select" id="contractType" value={physio.contractType} onChange={(e) => setPhysio({ ...physio, contractType: e.target.value as any })}>
            <option value="PJ">PJ</option>
            <option value="RPA">RPA</option>
            <option value="NO_CONTRACT">Sem vínculo</option>
          </select>
        </div>
        <div className="mb-3">
          <label htmlFor="status" className="form-label">Status</label>
          <select className="form-select" id="status" value={physio.status} onChange={(e) => setPhysio({ ...physio, status: e.target.value as any })}>
            <option value="ACTIVE">Ativo</option>
            <option value="INACTIVE">Inativo</option>
          </select>
        </div>
        <div className="mb-3">
          <label htmlFor="hourValue" className="form-label">Valor por Hora (R$)</label>
          <input 
            type="text" 
            className="form-control" 
            id="hourValue" 
            value={(physio as any).hourValue || ''} 
            onChange={handleHourValueChange} 
          />
        </div>
        <div className="mb-3">
          <label htmlFor="additionalValue" className="form-label">Valor Adicional (R$)</label>
          <input 
            type="text" 
            className="form-control" 
            id="additionalValue" 
            value={(physio as any).additionalValue || ''} 
            onChange={handleAdditionalValueChange} 
          />
        </div>
        
        {/* Seção de Informações Bancárias */}
        <h4 className="mt-4 mb-3">Informações Bancárias</h4>
        <div className="row">
          <div className="col-md-6 mb-3">
            <label htmlFor="banco" className="form-label">Banco</label>
            <input type="text" className="form-control" id="banco" value={(physio as any).banco ?? ''} onChange={(e) => setPhysio({ ...physio, banco: e.target.value } as any)} />
          </div>
          <div className="col-md-3 mb-3">
            <label htmlFor="agencia" className="form-label">Agência</label>
            <input type="text" className="form-control" id="agencia" value={(physio as any).agencia ?? ''} onChange={(e) => setPhysio({ ...physio, agencia: e.target.value } as any)} />
          </div>
          <div className="col-md-3 mb-3">
            <label htmlFor="conta" className="form-label">Conta</label>
            <input type="text" className="form-control" id="conta" value={(physio as any).conta ?? ''} onChange={(e) => setPhysio({ ...physio, conta: e.target.value } as any)} />
          </div>
        </div>
        <div className="row">
          <div className="col-md-6 mb-3">
            <label htmlFor="tipoPix" className="form-label">Tipo PIX</label>
            <select className="form-select" id="tipoPix" value={(physio as any).tipoPix ?? ''} onChange={(e) => setPhysio({ ...physio, tipoPix: e.target.value } as any)}>
              <option value="">Selecione o tipo</option>
              <option value="CPF">CPF</option>
              <option value="CNPJ">CNPJ</option>
              <option value="EMAIL">Email</option>
              <option value="TELEFONE">Telefone</option>
              <option value="CHAVE_ALEATORIA">Chave Aleatória</option>
            </select>
          </div>
          <div className="col-md-6 mb-3">
            <label htmlFor="chavePix" className="form-label">Chave PIX</label>
            <input type="text" className="form-control" id="chavePix" value={(physio as any).chavePix ?? ''} onChange={handleChavePixChange} />
          </div>
        </div>
        
        {/* Seção de Informações da Empresa (apenas para PJ) */}
        {physio.contractType === 'PJ' && (
          <>
            <h4 className="mt-4 mb-3">Informações da Empresa (PJ)</h4>
            <div className="mb-3">
              <label htmlFor="nomeEmpresa" className="form-label">Nome da Empresa *</label>
              <input 
                type="text" 
                className="form-control" 
                id="nomeEmpresa" 
                value={(physio as any).nomeEmpresa ?? ''} 
                onChange={(e) => setPhysio({ ...physio, nomeEmpresa: e.target.value } as any)} 
                required={physio.contractType === 'PJ'}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="cnpjEmpresa" className="form-label">CNPJ da Empresa *</label>
              <input 
                type="text" 
                className="form-control" 
                id="cnpjEmpresa" 
                value={(physio as any).cnpjEmpresa ?? ''} 
                onChange={handleCnpjEmpresaChange} 
                required={physio.contractType === 'PJ'}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="enderecoEmpresa" className="form-label">Endereço da Empresa *</label>
              <input 
                type="text" 
                className="form-control" 
                id="enderecoEmpresa" 
                value={(physio as any).enderecoEmpresa ?? ''} 
                onChange={(e) => setPhysio({ ...physio, enderecoEmpresa: e.target.value } as any)} 
                required={physio.contractType === 'PJ'}
              />
            </div>
          </>
        )}
        <div className="mb-3">
          <label className="form-label">Equipes *</label>
          <div className="border rounded p-3" style={{maxHeight: '200px', overflowY: 'auto'}}>
            {teams.length === 0 ? (
              <p className="text-muted mb-0">Carregando equipes...</p>
            ) : (
              teams.map(team => (
                <div key={team.id} className="form-check mb-2">
                  <input 
                    className="form-check-input" 
                    type="checkbox" 
                    id={`team-${team.id}`}
                    checked={selectedTeamIds.includes(team.id)}
                    onChange={(e) => handleTeamChange(team.id, e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor={`team-${team.id}`}>
                    {team.name}
                  </label>
                </div>
              ))
            )}
          </div>
          {selectedTeamIds.length > 0 && (
            <small className="text-muted">
              {selectedTeamIds.length} equipe(s) selecionada(s)
            </small>
          )}
        </div>
        <button type="submit" className="btn btn-primary">Salvar Alterações</button>
        <button type="button" className="btn btn-secondary ms-2" onClick={() => router.back()}>Cancelar</button>
        <button type="button" className="btn btn-danger ms-2" onClick={handleDelete}>Excluir Fisioterapeuta</button>
      </form>
      </div>
    </AuthLayout>
  );
}
