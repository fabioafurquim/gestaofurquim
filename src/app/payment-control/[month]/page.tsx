'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  FiUpload, 
  FiMail, 
  FiCheck, 
  FiX, 
  FiFileText, 
  FiDollarSign,
  FiArrowLeft,
  FiAlertCircle,
  FiLoader
} from 'react-icons/fi';
import AuthLayout from '@/components/AuthLayout';

interface PaymentRecord {
  id: number;
  physiotherapistId: number | null;
  physiotherapist: {
    id: number;
    name: string;
    email: string;
    contractType: 'PJ' | 'RPA' | 'NO_CONTRACT';
    status: string;
  } | null;
  manualName: string | null;
  manualEmail: string | null;
  manualContractType: 'PJ' | 'RPA' | 'NO_CONTRACT' | null;
  grossValue: string;
  netValue: string;
  rpaOutrosDescontos: string | null;
  rpaIss: string | null;
  rpaIrrf: string | null;
  rpaInss: string | null;
  rpaTotalDescontos: string | null;
  rpaFileId: string | null;
  rpaFileName: string | null;
  nfFileId: string | null;
  nfFileName: string | null;
  pixReceiptFileId: string | null;
  pixReceiptFileName: string | null;
  emailStatus: 'PENDING' | 'SENT' | 'FAILED';
  emailSentAt: string | null;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
}

interface PaymentControl {
  id: number;
  referenceMonth: string;
  monthName: string;
  status: 'OPEN' | 'PROCESSING' | 'CLOSED';
  payments: PaymentRecord[];
}

export default function PaymentControlMonthPage() {
  const params = useParams();
  const router = useRouter();
  const month = params.month as string;
  
  const [control, setControl] = useState<PaymentControl | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [sendingEmailId, setSendingEmailId] = useState<number | null>(null);
  const [editingValues, setEditingValues] = useState<Record<number, { grossValue: string; netValue: string }>>({});
  
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    fetchControl();
  }, [month]);

  const fetchControl = async () => {
    try {
      setLoading(true);
      // Primeiro tenta buscar, se não existir, cria
      let response = await fetch(`/api/payment-control/${month}`);
      
      if (response.status === 404) {
        // Cria o controle
        response = await fetch('/api/payment-control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referenceMonth: month }),
        });
        
        if (!response.ok) {
          throw new Error('Erro ao criar controle de pagamento');
        }
        
        // Busca novamente
        response = await fetch(`/api/payment-control/${month}`);
      }
      
      if (!response.ok) {
        throw new Error('Erro ao carregar controle de pagamento');
      }
      
      const data = await response.json();
      setControl(data);
      
      // Inicializa os valores de edição
      const initialValues: Record<number, { grossValue: string; netValue: string }> = {};
      data.payments.forEach((p: PaymentRecord) => {
        initialValues[p.id] = {
          grossValue: p.grossValue,
          netValue: p.netValue,
        };
      });
      setEditingValues(initialValues);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const getName = (record: PaymentRecord) => {
    return record.physiotherapist?.name || record.manualName || 'Sem nome';
  };

  const getEmail = (record: PaymentRecord) => {
    return record.physiotherapist?.email || record.manualEmail || '';
  };

  const getContractType = (record: PaymentRecord) => {
    return record.physiotherapist?.contractType || record.manualContractType || 'NO_CONTRACT';
  };

  const getContractTypeBadge = (type: string) => {
    switch (type) {
      case 'PJ':
        return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">PJ</span>;
      case 'RPA':
        return <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">RPA</span>;
      case 'NO_CONTRACT':
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">Sem Contrato</span>;
      default:
        return null;
    }
  };

  const formatCurrency = (value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numValue || 0);
  };

  const handleValueChange = async (recordId: number, field: 'grossValue' | 'netValue', value: string) => {
    setEditingValues(prev => ({
      ...prev,
      [recordId]: {
        ...prev[recordId],
        [field]: value,
      }
    }));
  };

  const handleValueBlur = async (recordId: number) => {
    const values = editingValues[recordId];
    if (!values) return;

    try {
      await fetch(`/api/payment-control/${month}/records/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grossValue: parseFloat(values.grossValue) || 0,
          netValue: parseFloat(values.netValue) || 0,
        }),
      });
    } catch (error) {
      console.error('Erro ao atualizar valores:', error);
    }
  };

  const handleFileUpload = async (recordId: number, fileType: 'rpa' | 'nf' | 'pix', file: File) => {
    setUploadingId(recordId);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileType', fileType);

      const response = await fetch(`/api/payment-control/${month}/records/${recordId}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao fazer upload');
      }

      const result = await response.json();
      console.log('Resultado do upload:', result);
      
      // Atualiza o registro localmente
      if (control && result.record) {
        setControl({
          ...control,
          payments: control.payments.map(p => 
            p.id === recordId ? { ...p, ...result.record } : p
          ),
        });
        
        // Atualiza os valores de edição se o RPA foi processado
        if (result.rpaData) {
          setEditingValues(prev => ({
            ...prev,
            [recordId]: {
              grossValue: result.record.grossValue,
              netValue: result.record.netValue,
            }
          }));
        }
      }

      // Log de debug para RPA
      if (fileType === 'rpa' && (!result.rpaData || result.rpaData.valorLiquido === 0)) {
        console.log('=== DEBUG DO UPLOAD RPA ===');
        console.log('Erro do parse:', result.debug?.parseError);
        console.log('Texto extraído:', result.debug?.textoExtraido);
      }
    } catch (error) {
      console.error('Erro no upload:', error);
      alert(error instanceof Error ? error.message : 'Erro ao fazer upload');
    } finally {
      setUploadingId(null);
    }
  };

  const handleSendEmail = async (recordId: number) => {
    const record = control?.payments.find(p => p.id === recordId);
    if (!record) return;

    if (!record.pixReceiptFileId && !record.pixReceiptFileName) {
      alert('Anexe o comprovante PIX antes de enviar o e-mail.');
      return;
    }

    if (!getEmail(record)) {
      alert('E-mail do destinatário não encontrado.');
      return;
    }

    setSendingEmailId(recordId);

    try {
      const response = await fetch(`/api/payment-control/${month}/records/${recordId}/send-email`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao enviar e-mail');
      }

      // Atualiza o status do e-mail localmente
      if (control) {
        setControl({
          ...control,
          payments: control.payments.map(p => 
            p.id === recordId ? { ...p, emailStatus: 'SENT', emailSentAt: new Date().toISOString() } : p
          ),
        });
      }

      alert('E-mail enviado com sucesso!');
    } catch (error) {
      console.error('Erro ao enviar e-mail:', error);
      alert(error instanceof Error ? error.message : 'Erro ao enviar e-mail');
    } finally {
      setSendingEmailId(null);
    }
  };

  const triggerFileInput = (recordId: number, fileType: string) => {
    const key = `${recordId}-${fileType}`;
    fileInputRefs.current[key]?.click();
  };

  if (loading) {
    return (
      <AuthLayout title="Controle de Pagamentos">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AuthLayout>
    );
  }

  if (error) {
    return (
      <AuthLayout title="Controle de Pagamentos">
        <div className="text-center py-12">
          <FiAlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <p className="mt-2 text-red-600">{error}</p>
          <button
            onClick={() => router.push('/payment-control')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Voltar
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={`Pagamentos - ${control?.monthName || month}`} fullWidth>
      <div className="mb-6">
        <button
          onClick={() => router.push('/payment-control')}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <FiArrowLeft className="mr-2" />
          Voltar para lista
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {control?.monthName}
              </h2>
              <p className="text-sm text-gray-500">
                {control?.payments.length} fisioterapeutas
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor Bruto
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor Líquido
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  RPA/NF
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Comprovante PIX
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Enviar
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {control?.payments.map((record) => {
                const contractType = getContractType(record);
                const isRPA = contractType === 'RPA';
                const isPJ = contractType === 'PJ';
                const hasRpaData = isRPA && record.rpaFileName;
                
                return (
                  <React.Fragment key={record.id}>
                    <tr className="hover:bg-gray-50">
                      {/* Nome */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{getName(record)}</div>
                        <div className="text-sm text-gray-500">{getEmail(record)}</div>
                      </td>
                      
                      {/* Tipo de Contrato */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        {getContractTypeBadge(contractType)}
                      </td>
                      
                      {/* Valor Bruto */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-gray-500 mr-1">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={editingValues[record.id]?.grossValue || '0'}
                            onChange={(e) => handleValueChange(record.id, 'grossValue', e.target.value)}
                            onBlur={() => handleValueBlur(record.id)}
                            className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </td>
                      
                      {/* Valor Líquido */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-gray-500 mr-1">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={editingValues[record.id]?.netValue || '0'}
                            onChange={(e) => handleValueChange(record.id, 'netValue', e.target.value)}
                            onBlur={() => handleValueBlur(record.id)}
                            className={`w-24 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                              isRPA ? 'border-purple-300 bg-purple-50' : 'border-gray-300'
                            }`}
                            readOnly={isRPA && !!record.rpaFileName}
                          />
                        </div>
                      </td>
                      
                      {/* RPA/NF */}
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        {isRPA && (
                          <>
                            <input
                              type="file"
                              accept=".pdf"
                              ref={(el) => { fileInputRefs.current[`${record.id}-rpa`] = el; }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(record.id, 'rpa', file);
                              }}
                              className="hidden"
                            />
                            <button
                              onClick={() => triggerFileInput(record.id, 'rpa')}
                              disabled={uploadingId === record.id}
                              className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded ${
                                record.rpaFileName
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                              }`}
                            >
                              {uploadingId === record.id ? (
                                <FiLoader className="animate-spin mr-1" />
                              ) : record.rpaFileName ? (
                                <FiCheck className="mr-1" />
                              ) : (
                                <FiUpload className="mr-1" />
                              )}
                              {record.rpaFileName ? 'RPA Anexado' : 'Anexar RPA'}
                            </button>
                          </>
                        )}
                        {isPJ && (
                          <>
                            <input
                              type="file"
                              accept=".pdf"
                              ref={(el) => { fileInputRefs.current[`${record.id}-nf`] = el; }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(record.id, 'nf', file);
                              }}
                              className="hidden"
                            />
                            <button
                              onClick={() => triggerFileInput(record.id, 'nf')}
                              disabled={uploadingId === record.id}
                              className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded ${
                                record.nfFileName
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                              }`}
                            >
                              {uploadingId === record.id ? (
                                <FiLoader className="animate-spin mr-1" />
                              ) : record.nfFileName ? (
                                <FiCheck className="mr-1" />
                              ) : (
                                <FiUpload className="mr-1" />
                              )}
                              {record.nfFileName ? 'NF Anexada' : 'Anexar NF'}
                            </button>
                          </>
                        )}
                        {!isRPA && !isPJ && (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      
                      {/* Comprovante PIX */}
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          ref={(el) => { fileInputRefs.current[`${record.id}-pix`] = el; }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(record.id, 'pix', file);
                          }}
                          className="hidden"
                        />
                        <button
                          onClick={() => triggerFileInput(record.id, 'pix')}
                          disabled={uploadingId === record.id}
                          className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded ${
                            record.pixReceiptFileName
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                        >
                          {uploadingId === record.id ? (
                            <FiLoader className="animate-spin mr-1" />
                          ) : record.pixReceiptFileName ? (
                            <FiCheck className="mr-1" />
                          ) : (
                            <FiDollarSign className="mr-1" />
                          )}
                          {record.pixReceiptFileName ? 'PIX Anexado' : 'Anexar PIX'}
                        </button>
                      </td>
                      
                      {/* E-mail */}
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleSendEmail(record.id)}
                          disabled={sendingEmailId === record.id || !record.pixReceiptFileName}
                          className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded ${
                            record.emailStatus === 'SENT'
                              ? 'bg-green-100 text-green-800'
                              : record.emailStatus === 'FAILED'
                              ? 'bg-red-100 text-red-800 hover:bg-red-200'
                              : 'bg-blue-100 text-blue-800 hover:bg-blue-200 disabled:bg-gray-100 disabled:text-gray-400'
                          }`}
                        >
                          {sendingEmailId === record.id ? (
                            <FiLoader className="animate-spin mr-1" />
                          ) : record.emailStatus === 'SENT' ? (
                            <FiCheck className="mr-1" />
                          ) : record.emailStatus === 'FAILED' ? (
                            <FiX className="mr-1" />
                          ) : (
                            <FiMail className="mr-1" />
                          )}
                          {record.emailStatus === 'SENT' 
                            ? 'Enviado' 
                            : record.emailStatus === 'FAILED'
                            ? 'Reenviar'
                            : 'Enviar E-mail e Drive'}
                        </button>
                      </td>
                    </tr>
                    
                    {/* Linha de detalhes do RPA */}
                    {hasRpaData && (
                      <tr className="bg-purple-50">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-6">
                              <span className="font-medium text-purple-800">Descontos RPA:</span>
                              {record.rpaOutrosDescontos && parseFloat(record.rpaOutrosDescontos) > 0 && (
                                <span className="text-gray-600">
                                  <span className="text-gray-500">Outros:</span> {formatCurrency(record.rpaOutrosDescontos)}
                                </span>
                              )}
                              {record.rpaIss && parseFloat(record.rpaIss) > 0 && (
                                <span className="text-gray-600">
                                  <span className="text-gray-500">ISS:</span> {formatCurrency(record.rpaIss)}
                                </span>
                              )}
                              {record.rpaIrrf && parseFloat(record.rpaIrrf) > 0 && (
                                <span className="text-gray-600">
                                  <span className="text-gray-500">IRRF:</span> {formatCurrency(record.rpaIrrf)}
                                </span>
                              )}
                              {record.rpaInss && parseFloat(record.rpaInss) > 0 && (
                                <span className="text-gray-600">
                                  <span className="text-gray-500">Dedução INSS:</span> {formatCurrency(record.rpaInss)}
                                </span>
                              )}
                              {record.rpaTotalDescontos && (
                                <span className="font-medium text-purple-800">
                                  <span className="text-gray-500">Total:</span> {formatCurrency(record.rpaTotalDescontos)}
                                </span>
                              )}
                            </div>
                            <div className="text-gray-600">
                              <span className="text-gray-500">E-mail:</span> {getEmail(record) || 'Não informado'}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {control?.payments.length === 0 && (
          <div className="text-center py-12">
            <FiFileText className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-gray-500">Nenhum fisioterapeuta encontrado.</p>
            <p className="text-sm text-gray-400">
              Cadastre fisioterapeutas ativos para vê-los aqui.
            </p>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
