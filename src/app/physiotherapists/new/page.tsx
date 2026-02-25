'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShiftTeam } from '@prisma/client';
import AuthLayout from '@/components/AuthLayout';
import { 
  applyPhoneMask, 
  applyCpfMask, 
  applyCnpjMask, 
  applyCurrencyMask, 
  removeCurrencyMask, 
  validateNumericPixKey 
} from '@/lib/input-masks';

export default function NewPhysiotherapistPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [crefito, setCrefito] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [address, setAddress] = useState('');
  const [startDate, setStartDate] = useState('');
  const [exitDate, setExitDate] = useState('');
  const [contractType, setContractType] = useState('PJ');
  const [userType, setUserType] = useState('COMMON');
  const [status, setStatus] = useState('ACTIVE');
  const [shiftValue, setShiftValue] = useState('');
  const [additionalValue, setAdditionalValue] = useState('');
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
  const [teams, setTeams] = useState<ShiftTeam[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Novos campos bancários
  const [banco, setBanco] = useState('');
  const [agencia, setAgencia] = useState('');
  const [conta, setConta] = useState('');
  const [tipoPix, setTipoPix] = useState('');
  const [chavePix, setChavePix] = useState('');
  
  // Novos campos para PJ
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [cnpjEmpresa, setCnpjEmpresa] = useState('');
  const [enderecoEmpresa, setEnderecoEmpresa] = useState('');

  // Handlers para aplicar máscaras
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const maskedValue = applyPhoneMask(e.target.value);
    setPhone(maskedValue);
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const maskedValue = applyCpfMask(e.target.value);
    setCpf(maskedValue);
  };

  const handleCnpjEmpresaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const maskedValue = applyCnpjMask(e.target.value);
    setCnpjEmpresa(maskedValue);
  };

  const handleShiftValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const maskedValue = applyCurrencyMask(e.target.value);
    setShiftValue(maskedValue);
  };

  const handleAdditionalValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const maskedValue = applyCurrencyMask(e.target.value);
    setAdditionalValue(maskedValue);
  };

  const handleChavePixChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const validatedValue = validateNumericPixKey(e.target.value, tipoPix);
    setChavePix(validatedValue);
  };

  useEffect(() => {
    fetch('/api/teams')
      .then(res => res.json())
      .then(data => setTeams(data))
      .catch(() => console.error('Falha ao buscar equipes'));
  }, []);

  const handleTeamChange = (teamId: number, checked: boolean) => {
    if (checked) {
      setSelectedTeamIds(prev => [...prev, teamId]);
    } else {
      setSelectedTeamIds(prev => prev.filter(id => id !== teamId));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userType !== 'ADMIN' && selectedTeamIds.length === 0) {
      setError('Por favor, selecione pelo menos uma equipe.');
      return;
    }
    setError(null);

    try {
      const response = await fetch('/api/physiotherapists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          crefito,
          cpf,
          rg,
          birthDate: birthDate || null,
          address,
          startDate,
          exitDate: exitDate || null,
          contractType,
          userType,
          status,
          hourValue: shiftValue !== '' ? Number(removeCurrencyMask(shiftValue)) : undefined, // Renomeado para hourValue
          additionalValue: additionalValue !== '' ? Number(removeCurrencyMask(additionalValue)) : undefined,
          // Novos campos bancários
          banco: banco || null,
          agencia: agencia || null,
          conta: conta || null,
          tipoPix: tipoPix || null,
          chavePix: chavePix || null,
          // Novos campos para PJ
          nomeEmpresa: contractType === 'PJ' ? nomeEmpresa : null,
          cnpjEmpresa: contractType === 'PJ' ? cnpjEmpresa : null,
          enderecoEmpresa: contractType === 'PJ' ? enderecoEmpresa : null,
          // Equipes selecionadas
          teamIds: userType !== 'ADMIN' ? selectedTeamIds : [],
        }),
      });

      if (!response.ok) {
        const j = await response.json();
        throw new Error(j.error || 'Falha ao criar fisioterapeuta');
      }

      router.push('/physiotherapists');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <AuthLayout title="Novo Fisioterapeuta">
      {error && <div className="alert alert-danger">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="name" className="form-label">Nome Completo</label>
          <input type="text" className="form-control" id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="mb-3">
          <label htmlFor="email" className="form-label">Email</label>
          <input type="email" className="form-control" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="mb-3">
          <label htmlFor="phone" className="form-label">Telefone</label>
          <input type="text" className="form-control" id="phone" value={phone} onChange={handlePhoneChange} />
        </div>
        <div className="mb-3">
          <label htmlFor="crefito" className="form-label">CREFITO</label>
          <input type="text" className="form-control" id="crefito" value={crefito} onChange={(e) => setCrefito(e.target.value)} required />
        </div>
        <div className="mb-3">
          <label htmlFor="cpf" className="form-label">CPF</label>
          <input type="text" className="form-control" id="cpf" value={cpf} onChange={handleCpfChange} required />
        </div>
        <div className="mb-3">
          <label htmlFor="rg" className="form-label">RG</label>
          <input type="text" className="form-control" id="rg" value={rg} onChange={(e) => setRg(e.target.value)} />
        </div>
        <div className="mb-3">
          <label htmlFor="birthDate" className="form-label">Data de Nascimento</label>
          <input type="date" className="form-control" id="birthDate" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </div>
        <div className="mb-3">
          <label htmlFor="address" className="form-label">Endereço</label>
          <input type="text" className="form-control" id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="mb-3">
          <label htmlFor="startDate" className="form-label">Data de Início</label>
          <input type="date" className="form-control" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
        <div className="mb-3">
          <label htmlFor="exitDate" className="form-label">Data de Saída</label>
          <input type="date" className="form-control" id="exitDate" value={exitDate} onChange={(e) => setExitDate(e.target.value)} />
        </div>
        <div className="mb-3">
          <label htmlFor="contractType" className="form-label">Tipo de Contrato</label>
          <select className="form-select" id="contractType" value={contractType} onChange={(e) => setContractType(e.target.value)}>
            <option value="PJ">PJ</option>
            <option value="RPA">RPA</option>
            <option value="NO_CONTRACT">Sem vínculo</option>
          </select>
        </div>
        <div className="mb-3">
          <label htmlFor="userType" className="form-label">Tipo de Usuário</label>
          <select className="form-select" id="userType" value={userType} onChange={(e) => setUserType(e.target.value)}>
            <option value="COMMON">Comum</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <div className="mb-3">
          <label htmlFor="status" className="form-label">Status</label>
          <select className="form-select" id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ACTIVE">Ativo</option>
            <option value="INACTIVE">Inativo</option>
          </select>
        </div>
        <div className="mb-3">
          <label htmlFor="shiftValue" className="form-label">Valor da Hora (R$)</label>
          <input type="text" className="form-control" id="shiftValue" value={shiftValue} onChange={handleShiftValueChange} />
        </div>
        <div className="mb-3">
          <label htmlFor="additionalValue" className="form-label">Valor Adicional (R$)</label>
          <input type="text" className="form-control" id="additionalValue" value={additionalValue} onChange={handleAdditionalValueChange} />
        </div>
        
        {/* Seção de Informações Bancárias */}
        <h4 className="mt-4 mb-3">Informações Bancárias</h4>
        <div className="row">
          <div className="col-md-6 mb-3">
            <label htmlFor="banco" className="form-label">Banco</label>
            <input type="text" className="form-control" id="banco" value={banco} onChange={(e) => setBanco(e.target.value)} />
          </div>
          <div className="col-md-3 mb-3">
            <label htmlFor="agencia" className="form-label">Agência</label>
            <input type="text" className="form-control" id="agencia" value={agencia} onChange={(e) => setAgencia(e.target.value)} />
          </div>
          <div className="col-md-3 mb-3">
            <label htmlFor="conta" className="form-label">Conta</label>
            <input type="text" className="form-control" id="conta" value={conta} onChange={(e) => setConta(e.target.value)} />
          </div>
        </div>
        <div className="row">
          <div className="col-md-6 mb-3">
            <label htmlFor="tipoPix" className="form-label">Tipo PIX</label>
            <select className="form-select" id="tipoPix" value={tipoPix} onChange={(e) => setTipoPix(e.target.value)}>
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
            <input type="text" className="form-control" id="chavePix" value={chavePix} onChange={handleChavePixChange} />
          </div>
        </div>
        
        {/* Seção de Informações da Empresa (apenas para PJ) */}
        {contractType === 'PJ' && (
          <>
            <h4 className="mt-4 mb-3">Informações da Empresa (PJ)</h4>
            <div className="mb-3">
              <label htmlFor="nomeEmpresa" className="form-label">Nome da Empresa *</label>
              <input 
                type="text" 
                className="form-control" 
                id="nomeEmpresa" 
                value={nomeEmpresa} 
                onChange={(e) => setNomeEmpresa(e.target.value)} 
                required={contractType === 'PJ'}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="cnpjEmpresa" className="form-label">CNPJ da Empresa *</label>
              <input 
                type="text" 
                className="form-control" 
                id="cnpjEmpresa" 
                value={cnpjEmpresa} 
                onChange={handleCnpjEmpresaChange} 
                required={contractType === 'PJ'}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="enderecoEmpresa" className="form-label">Endereço da Empresa *</label>
              <input 
                type="text" 
                className="form-control" 
                id="enderecoEmpresa" 
                value={enderecoEmpresa} 
                onChange={(e) => setEnderecoEmpresa(e.target.value)} 
                required={contractType === 'PJ'}
              />
            </div>
          </>
        )}
        {userType !== 'ADMIN' && (
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
        )}
        <button type="submit" className="btn btn-primary">Salvar</button>
        <button type="button" className="btn btn-secondary ms-2" onClick={() => router.back()}>
          Cancelar
        </button>
      </form>
    </AuthLayout>
  );
}
