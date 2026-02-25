'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  FiUpload, 
  FiCheck, 
  FiX, 
  FiFileText, 
  FiArrowLeft,
  FiAlertCircle,
  FiLoader,
  FiDownload,
  FiSave,
  FiMail,
  FiAlertTriangle
} from 'react-icons/fi';
import AuthLayout from '@/components/AuthLayout';

interface PaymentData {
  physiotherapistId: number;
  name: string;
  email: string;
  contractType: 'PJ' | 'RPA' | 'NO_CONTRACT';
  totalShifts: number;
  totalShiftValue: number;
  additionalValue: number;
  grossValue: number;
  netValue: number;
  rpaFileName: string | null;
  rpaFileId: string | null;
  rpaFilePath: string | null;
  rpaValorServico: number | null;
  rpaOutrosDescontos: number | null;
  rpaIss: number | null;
  rpaIrrf: number | null;
  rpaInss: number | null;
  rpaTotalDescontos: number | null;
  nfFileName: string | null;
  nfFileId: string | null;
  nfFilePath: string | null;
  approved: boolean;
  emailStatus: 'PENDING' | 'SENT' | 'FAILED';
  emailSentAt: string | null;
}

interface PaymentResponse {
  month: string;
  monthName: string;
  payments: PaymentData[];
}

interface EmailResult {
  physiotherapistId: number;
  name: string;
  email: string;
  success: boolean;
  error?: string;
}

export default function PaymentProcessPage() {
  const params = useParams();
  const router = useRouter();
  const month = params.month as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentResponse | null>(null);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [savingToDrive, setSavingToDrive] = useState<'rpa' | 'nf' | null>(null);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailResults, setEmailResults] = useState<EmailResult[] | null>(null);
  const [showEmailReport, setShowEmailReport] = useState(false);
  const [downloadingCnab, setDownloadingCnab] = useState(false);
  
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Contadores para pendências
  const pendingNFs = payments.filter(p => p.contractType === 'PJ' && !p.nfFileName).length;
  const pendingRPAs = payments.filter(p => p.contractType === 'RPA' && !p.rpaFileName).length;
  const allApproved = payments.every(p => p.approved);
  const hasApprovedPayments = payments.some(p => p.approved);

  useEffect(() => {
    fetchPaymentData();
  }, [month]);

  const fetchPaymentData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/payments/${month}`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar dados de pagamento');
      }
      
      const data: PaymentResponse = await response.json();
      setPaymentData(data);
      setPayments(data.payments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const getContractTypeBadge = (type: string) => {
    switch (type) {
      case 'PJ':
        return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">PJ</span>;
      case 'RPA':
        return <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">RPA</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">-</span>;
    }
  };

  const savePaymentsToServer = async (paymentsToSave: PaymentData[]) => {
    try {
      await fetch(`/api/payments/${month}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payments: paymentsToSave })
      });
    } catch (error) {
      console.error('Erro ao salvar pagamentos:', error);
    }
  };

  const updatePaymentField = (index: number, field: keyof PaymentData, value: number | boolean) => {
    const updated = [...payments];
    updated[index] = { ...updated[index], [field]: value };
    
    // Recalcular grossValue
    if (field === 'totalShiftValue' || field === 'additionalValue') {
      updated[index].grossValue = updated[index].totalShiftValue + updated[index].additionalValue;
    }
    
    setPayments(updated);
    
    // Salvar no servidor quando aprovar/desaprovar
    if (field === 'approved') {
      savePaymentsToServer(updated);
    }
  };

  const triggerFileInput = (physiotherapistId: number, fileType: string) => {
    const key = `${physiotherapistId}-${fileType}`;
    fileInputRefs.current[key]?.click();
  };

  const handleFileUpload = async (physiotherapistId: number, fileType: 'rpa' | 'nf', file: File) => {
    setUploadingId(physiotherapistId);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileType', fileType);
      formData.append('physiotherapistId', physiotherapistId.toString());

      const response = await fetch(`/api/payments/${month}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao fazer upload');
      }

      const result = await response.json();
      
      // Atualizar o pagamento localmente
      setPayments(prev => prev.map(p => {
        if (p.physiotherapistId === physiotherapistId) {
          if (fileType === 'rpa') {
            const rpaValorServico = result.rpaData?.valorBruto || 0;
            const valorBrutoDivergente = rpaValorServico > 0 && Math.abs(rpaValorServico - p.grossValue) > 0.01;
            
            // Alerta se houver divergência
            if (valorBrutoDivergente) {
              setTimeout(() => {
                alert(`⚠️ ATENÇÃO: Divergência de valores!\n\nValor do Serviço no RPA: ${formatCurrency(rpaValorServico)}\nValor Bruto calculado: ${formatCurrency(p.grossValue)}\n\nDiferença: ${formatCurrency(Math.abs(rpaValorServico - p.grossValue))}\n\nAjuste os valores de plantões ou adicional manualmente se necessário.`);
              }, 100);
            }
            
            return {
              ...p,
              rpaFileName: result.fileName,
              rpaFilePath: result.filePath,
              rpaValorServico: rpaValorServico,
              netValue: result.rpaData?.valorLiquido || p.netValue,
              rpaOutrosDescontos: result.rpaData?.outrosDescontos || null,
              rpaIss: result.rpaData?.iss || null,
              rpaIrrf: result.rpaData?.irrf || null,
              rpaInss: result.rpaData?.inss || null,
              rpaTotalDescontos: result.rpaData?.totalDescontos || null,
            };
          } else {
            return {
              ...p,
              nfFileName: result.fileName,
              nfFilePath: result.filePath,
            };
          }
        }
        return p;
      }));
      
      // Salvar no servidor após atualizar o estado local
      setTimeout(() => {
        setPayments(current => {
          savePaymentsToServer(current);
          return current;
        });
      }, 100);
    } catch (error) {
      console.error('Erro no upload:', error);
      alert(error instanceof Error ? error.message : 'Erro ao fazer upload');
    } finally {
      setUploadingId(null);
    }
  };

  const handleDownloadCnab = async () => {
    const approvedPayments = payments.filter(p => p.approved);
    
    if (approvedPayments.length === 0) {
      alert('Nenhum pagamento aprovado para gerar o arquivo CNAB.');
      return;
    }

    setDownloadingCnab(true);
    try {
      const paymentDataForCnab = approvedPayments.map(p => ({
        physiotherapistId: p.physiotherapistId,
        totalShiftValue: p.totalShiftValue,
        additionalValue: p.additionalValue,
        rpaDiscount: p.rpaTotalDescontos || 0,
        totalValue: p.netValue || p.grossValue
      }));

      const response = await fetch(`/api/payments/${month}/cnab`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payments: paymentDataForCnab })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao gerar arquivo CNAB');
      }

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `CNAB_${month.replace('-', '_')}.REM`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao baixar CNAB:', error);
      alert(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setDownloadingCnab(false);
    }
  };

  const handleSaveRPAsToDrive = async () => {
    const rpasToSave = payments.filter(p => p.contractType === 'RPA' && p.rpaFileName && !p.rpaFileId);
    
    if (rpasToSave.length === 0) {
      alert('Nenhum RPA pendente para salvar no Drive.');
      return;
    }

    setSavingToDrive('rpa');
    try {
      const response = await fetch(`/api/payments/${month}/save-to-drive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileType: 'rpa' })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao salvar RPAs no Drive');
      }

      const result = await response.json();
      alert(`${result.saved} RPA(s) salvos no Google Drive com sucesso!`);
      fetchPaymentData(); // Recarregar dados
    } catch (error) {
      console.error('Erro ao salvar RPAs:', error);
      alert(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setSavingToDrive(null);
    }
  };

  const handleSaveNFsToDrive = async () => {
    const nfsToSave = payments.filter(p => p.contractType === 'PJ' && p.nfFileName && !p.nfFileId);
    
    if (nfsToSave.length === 0) {
      alert('Nenhuma NF pendente para salvar no Drive.');
      return;
    }

    setSavingToDrive('nf');
    try {
      const response = await fetch(`/api/payments/${month}/save-to-drive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileType: 'nf' })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao salvar NFs no Drive');
      }

      const result = await response.json();
      alert(`${result.saved} NF(s) salvas no Google Drive com sucesso!`);
      fetchPaymentData();
    } catch (error) {
      console.error('Erro ao salvar NFs:', error);
      alert(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setSavingToDrive(null);
    }
  };

  const handleSendEmails = async () => {
    const approvedPayments = payments.filter(p => p.approved && p.email);
    
    if (approvedPayments.length === 0) {
      alert('Nenhum pagamento aprovado com e-mail para enviar.');
      return;
    }

    setSendingEmails(true);
    setEmailResults(null);
    
    try {
      const response = await fetch(`/api/payments/${month}/send-emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          physiotherapistIds: approvedPayments.map(p => p.physiotherapistId) 
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao enviar e-mails');
      }

      const result = await response.json();
      setEmailResults(result.results);
      setShowEmailReport(true);
      fetchPaymentData();
    } catch (error) {
      console.error('Erro ao enviar e-mails:', error);
      alert(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setSendingEmails(false);
    }
  };

  if (loading) {
    return (
      <AuthLayout title="Pagamentos" fullWidth>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AuthLayout>
    );
  }

  if (error) {
    return (
      <AuthLayout title="Pagamentos" fullWidth>
        <div className="text-center py-12">
          <FiAlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <p className="mt-2 text-red-600">{error}</p>
          <button
            onClick={() => router.push('/payments')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Voltar
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={`Pagamentos - ${paymentData?.monthName || month}`} fullWidth>
      {/* Cabeçalho */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/payments')}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <FiArrowLeft className="mr-2" />
          Voltar para lista
        </button>
      </div>

      {/* Alertas de pendências */}
      {(pendingNFs > 0 || pendingRPAs > 0) && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center">
            <FiAlertTriangle className="text-yellow-600 mr-2" />
            <span className="text-yellow-800 font-medium">Pendências:</span>
          </div>
          <ul className="mt-2 text-sm text-yellow-700">
            {pendingRPAs > 0 && <li>• {pendingRPAs} RPA(s) não anexados</li>}
            {pendingNFs > 0 && <li>• {pendingNFs} Nota(s) Fiscal(is) não anexadas</li>}
          </ul>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{paymentData?.monthName}</h2>
              <p className="text-sm text-gray-500">{payments.length} fisioterapeutas</p>
            </div>
          </div>
        </div>

        {/* Tabela de pagamentos */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Plantões</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Plantões</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Adicional</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Bruto</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">RPA/NF</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Líquido</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aprovado</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.map((payment, index) => {
                const isRPA = payment.contractType === 'RPA';
                const isPJ = payment.contractType === 'PJ';
                const hasRpaData = isRPA && payment.rpaFileName;
                
                return (
                  <React.Fragment key={payment.physiotherapistId}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{payment.name}</div>
                        <div className="text-xs text-gray-500">{payment.email}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {getContractTypeBadge(payment.contractType)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                        {payment.totalShifts}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={payment.totalShiftValue}
                          onChange={(e) => updatePaymentField(index, 'totalShiftValue', parseFloat(e.target.value) || 0)}
                          className="w-28 px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={payment.additionalValue}
                          onChange={(e) => updatePaymentField(index, 'additionalValue', parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                        {formatCurrency(payment.grossValue)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        {isRPA && (
                          <>
                            <input
                              type="file"
                              accept=".pdf"
                              ref={(el) => { fileInputRefs.current[`${payment.physiotherapistId}-rpa`] = el; }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(payment.physiotherapistId, 'rpa', file);
                              }}
                              className="hidden"
                            />
                            <button
                              onClick={() => triggerFileInput(payment.physiotherapistId, 'rpa')}
                              disabled={uploadingId === payment.physiotherapistId}
                              className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded ${
                                payment.rpaFileName
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                              }`}
                            >
                              {uploadingId === payment.physiotherapistId ? (
                                <FiLoader className="animate-spin mr-1" />
                              ) : payment.rpaFileName ? (
                                <FiCheck className="mr-1" />
                              ) : (
                                <FiUpload className="mr-1" />
                              )}
                              {payment.rpaFileName ? 'RPA Anexado' : 'Anexar RPA'}
                            </button>
                          </>
                        )}
                        {isPJ && (
                          <>
                            <input
                              type="file"
                              accept=".pdf,.xml"
                              ref={(el) => { fileInputRefs.current[`${payment.physiotherapistId}-nf`] = el; }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(payment.physiotherapistId, 'nf', file);
                              }}
                              className="hidden"
                            />
                            <button
                              onClick={() => triggerFileInput(payment.physiotherapistId, 'nf')}
                              disabled={uploadingId === payment.physiotherapistId}
                              className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded ${
                                payment.nfFileName
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                              }`}
                            >
                              {uploadingId === payment.physiotherapistId ? (
                                <FiLoader className="animate-spin mr-1" />
                              ) : payment.nfFileName ? (
                                <FiCheck className="mr-1" />
                              ) : (
                                <FiUpload className="mr-1" />
                              )}
                              {payment.nfFileName ? 'NF Anexada' : 'Anexar NF'}
                            </button>
                          </>
                        )}
                        {!isRPA && !isPJ && <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <span className={`text-sm font-medium ${isRPA && payment.rpaFileName ? 'text-purple-700' : 'text-gray-900'}`}>
                          {formatCurrency(payment.netValue || payment.grossValue)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <input
                          type="checkbox"
                          checked={payment.approved}
                          onChange={(e) => updatePaymentField(index, 'approved', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                    </tr>
                    
                    {/* Linha de detalhes do RPA */}
                    {hasRpaData && (() => {
                      const valorServico = payment.rpaValorServico || 0;
                      const hasDivergencia = valorServico > 0 && Math.abs(valorServico - payment.grossValue) > 0.01;
                      
                      return (
                        <tr className={hasDivergencia ? "bg-red-50" : "bg-purple-50"}>
                          <td colSpan={9} className="px-4 py-3">
                            <div className="flex flex-col gap-2">
                              {/* Valor do Serviço e alerta de divergência */}
                              <div className="flex items-center gap-4">
                                <span className={`font-medium ${hasDivergencia ? 'text-red-800' : 'text-purple-800'}`}>
                                  Valor do Serviço (RPA): {formatCurrency(valorServico)}
                                </span>
                                {hasDivergencia && (
                                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded border border-red-300">
                                    <FiAlertTriangle className="mr-1" />
                                    Divergência: {formatCurrency(Math.abs(valorServico - payment.grossValue))} 
                                    {valorServico > payment.grossValue ? ' a mais' : ' a menos'} que o Total Bruto
                                  </span>
                                )}
                                {!hasDivergencia && valorServico > 0 && (
                                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                                    <FiCheck className="mr-1" /> Valores conferem
                                  </span>
                                )}
                              </div>
                              
                              {/* Descontos */}
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-6">
                                  <span className="font-medium text-purple-800">Descontos:</span>
                                  {payment.rpaOutrosDescontos && payment.rpaOutrosDescontos > 0 && (
                                    <span className="text-gray-600">
                                      <span className="text-gray-500">Outros:</span> {formatCurrency(payment.rpaOutrosDescontos)}
                                    </span>
                                  )}
                                  {payment.rpaIss && payment.rpaIss > 0 && (
                                    <span className="text-gray-600">
                                      <span className="text-gray-500">ISS:</span> {formatCurrency(payment.rpaIss)}
                                    </span>
                                  )}
                                  {payment.rpaIrrf && payment.rpaIrrf > 0 && (
                                    <span className="text-gray-600">
                                      <span className="text-gray-500">IRRF:</span> {formatCurrency(payment.rpaIrrf)}
                                    </span>
                                  )}
                                  {payment.rpaInss && payment.rpaInss > 0 && (
                                    <span className="text-gray-600">
                                      <span className="text-gray-500">INSS:</span> {formatCurrency(payment.rpaInss)}
                                    </span>
                                  )}
                                  {payment.rpaTotalDescontos && (
                                    <span className="font-medium text-purple-800">
                                      <span className="text-gray-500">Total:</span> {formatCurrency(payment.rpaTotalDescontos)}
                                    </span>
                                  )}
                                </div>
                                {payment.rpaFileId && (
                                  <span className="text-green-600 text-xs flex items-center">
                                    <FiCheck className="mr-1" /> Salvo no Drive
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })()}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {payments.length === 0 && (
          <div className="text-center py-12">
            <FiFileText className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-gray-500">Nenhum fisioterapeuta encontrado.</p>
          </div>
        )}

        {/* Botões de ação */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-3">
              {/* Salvar RPAs no Drive */}
              <button
                onClick={handleSaveRPAsToDrive}
                disabled={savingToDrive === 'rpa' || payments.filter(p => p.contractType === 'RPA' && p.rpaFileName && !p.rpaFileId).length === 0}
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {savingToDrive === 'rpa' ? (
                  <FiLoader className="animate-spin mr-2" />
                ) : (
                  <FiSave className="mr-2" />
                )}
                Salvar RPAs no Drive
              </button>

              {/* Salvar NFs no Drive */}
              <button
                onClick={handleSaveNFsToDrive}
                disabled={savingToDrive === 'nf' || payments.filter(p => p.contractType === 'PJ' && p.nfFileName && !p.nfFileId).length === 0}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {savingToDrive === 'nf' ? (
                  <FiLoader className="animate-spin mr-2" />
                ) : (
                  <FiSave className="mr-2" />
                )}
                Salvar NFs no Drive
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              {/* Baixar CNAB */}
              <button
                onClick={handleDownloadCnab}
                disabled={!hasApprovedPayments || downloadingCnab}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {downloadingCnab ? (
                  <FiLoader className="animate-spin mr-2" />
                ) : (
                  <FiDownload className="mr-2" />
                )}
                Baixar CNAB
              </button>

              {/* Enviar E-mails */}
              <button
                onClick={handleSendEmails}
                disabled={sendingEmails || !hasApprovedPayments}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {sendingEmails ? (
                  <FiLoader className="animate-spin mr-2" />
                ) : (
                  <FiMail className="mr-2" />
                )}
                Enviar E-mails com Comprovantes
              </button>
            </div>
          </div>
          
          {!hasApprovedPayments && (
            <p className="mt-3 text-sm text-gray-500">
              Aprove pelo menos um pagamento para habilitar as ações.
            </p>
          )}
        </div>
      </div>

      {/* Modal de Relatório de E-mails */}
      {showEmailReport && emailResults && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Relatório de Envio de E-mails</h3>
            </div>
            <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">E-mail</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {emailResults.map((result) => (
                    <tr key={result.physiotherapistId}>
                      <td className="px-4 py-2 text-sm text-gray-900">{result.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{result.email}</td>
                      <td className="px-4 py-2 text-center">
                        {result.success ? (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                            <FiCheck className="mr-1" /> Enviado
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded" title={result.error}>
                            <FiX className="mr-1" /> Falhou
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 text-sm text-gray-600">
                <p>
                  <strong>Enviados:</strong> {emailResults.filter(r => r.success).length} | 
                  <strong className="ml-2">Falhas:</strong> {emailResults.filter(r => !r.success).length}
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowEmailReport(false)}
                className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}