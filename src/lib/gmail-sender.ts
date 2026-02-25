import { google } from 'googleapis';
import { getAuthenticatedClient } from './google-drive';

interface EmailAttachment {
  filename: string;
  content: Buffer;
  mimeType: string;
}

interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
}

/**
 * Retorna a saudação apropriada baseada no horário
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return 'Bom dia';
  } else if (hour >= 12 && hour < 18) {
    return 'Boa tarde';
  } else {
    return 'Boa noite';
  }
}

/**
 * Retorna o nome do mês em português
 */
export function getMonthName(month: number): string {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return months[month - 1] || '';
}

/**
 * Gera o assunto do e-mail
 */
export function generateEmailSubject(referenceMonth: string): string {
  const [year, month] = referenceMonth.split('-');
  const monthName = getMonthName(parseInt(month));
  return `Comprovante ${monthName}/${year}`;
}

/**
 * Gera o corpo do e-mail
 */
export function generateEmailBody(referenceMonth: string): string {
  const [year, month] = referenceMonth.split('-');
  const monthName = getMonthName(parseInt(month));
  const greeting = getGreeting();
  
  return `${greeting},

Segue anexo comprovante de pagamento referente aos serviços prestados no mês de ${monthName}/${year}.

Obrigada
Att`;
}

/**
 * Codifica o e-mail no formato RFC 2822 com suporte a anexos
 */
function createMimeMessage(params: SendEmailParams): string {
  const boundary = `boundary_${Date.now()}`;
  
  let message = '';
  
  // Headers
  message += `To: ${params.to}\r\n`;
  message += `Subject: =?UTF-8?B?${Buffer.from(params.subject).toString('base64')}?=\r\n`;
  message += `MIME-Version: 1.0\r\n`;
  
  if (params.attachments && params.attachments.length > 0) {
    message += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
    
    // Corpo do e-mail
    message += `--${boundary}\r\n`;
    message += `Content-Type: text/plain; charset="UTF-8"\r\n`;
    message += `Content-Transfer-Encoding: base64\r\n\r\n`;
    message += `${Buffer.from(params.body).toString('base64')}\r\n`;
    
    // Anexos
    for (const attachment of params.attachments) {
      message += `--${boundary}\r\n`;
      message += `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"\r\n`;
      message += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
      message += `Content-Transfer-Encoding: base64\r\n\r\n`;
      message += `${attachment.content.toString('base64')}\r\n`;
    }
    
    message += `--${boundary}--`;
  } else {
    message += `Content-Type: text/plain; charset="UTF-8"\r\n`;
    message += `Content-Transfer-Encoding: base64\r\n\r\n`;
    message += Buffer.from(params.body).toString('base64');
  }
  
  return message;
}

/**
 * Envia um e-mail usando a API do Gmail
 */
export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const auth = await getAuthenticatedClient();
    const gmail = google.gmail({ version: 'v1', auth });
    
    const rawMessage = createMimeMessage(params);
    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });
    
    return {
      success: true,
      messageId: response.data.id || undefined,
    };
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao enviar e-mail',
    };
  }
}

/**
 * Envia o comprovante de pagamento por e-mail
 */
export async function sendPaymentReceipt(
  recipientEmail: string,
  referenceMonth: string,
  pixReceiptBuffer: Buffer,
  pixReceiptFileName: string,
  rpaBuffer?: Buffer,
  rpaFileName?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const attachments: EmailAttachment[] = [
    {
      filename: pixReceiptFileName,
      content: pixReceiptBuffer,
      mimeType: 'application/pdf',
    },
  ];
  
  // Adiciona RPA se fornecido
  if (rpaBuffer && rpaFileName) {
    attachments.push({
      filename: rpaFileName,
      content: rpaBuffer,
      mimeType: 'application/pdf',
    });
  }
  
  return sendEmail({
    to: recipientEmail,
    subject: generateEmailSubject(referenceMonth),
    body: generateEmailBody(referenceMonth),
    attachments,
  });
}
