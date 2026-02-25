# -*- coding: utf-8 -*-
import datetime
import re

# --- FUNÇÕES AUXILIARES DE FORMATAÇÃO ---
def remover_acentos_e_especiais(texto):
    """Remove acentos e caracteres especiais de uma string."""
    if not isinstance(texto, str):
        return ''
    # Normaliza para o formato NFD e remove caracteres não-ASCII
    texto = ''.join(c for c in texto if c.isalnum() or c.isspace())
    return texto.upper()

def formatar_alfa(valor, tamanho):
    """Formata um campo alfanumérico com espaços à direita."""
    valor_str = remover_acentos_e_especiais(str(valor or ''))
    return valor_str.ljust(tamanho, ' ')[:tamanho]

def formatar_num(valor, tamanho):
    """Formata um campo numérico com zeros à esquerda."""
    valor_str = str(valor or '0')
    # Remove qualquer caracter não numérico
    valor_str = re.sub(r'\D', '', valor_str)
    return valor_str.zfill(tamanho)[-tamanho:]

def formatar_chave_pix(chave, tamanho):
    """Formata a chave Pix, preservando caracteres especiais e sem converter para maiúsculas."""
    if not isinstance(chave, str):
        chave = ''
    # Para chaves PIX, não removemos acentos/especiais nem convertemos para maiúsculo
    return chave.ljust(tamanho, ' ')[:tamanho]

def gerar_cnab_pix(dados_empresa, pagamentos, numero_sequencial_arquivo):
    """
    Gera um arquivo CNAB 240 para pagamentos via Pix com base no manual do Inter.

    :param dados_empresa: Dicionário com informações da empresa pagadora.
    :param pagamentos: Lista de dicionários, onde cada um representa um pagamento.
    :param numero_sequencial_arquivo: Número sequencial do arquivo de remessa.
    :return: Nome do arquivo gerado.
    """
    
    # Mapeamento do tipo de chave para o código do CNAB, conforme manual [cite: 231]
    mapa_tipo_chave = {
        'CELULAR': '01',
        'EMAIL': '02',
        'CPF': '03',
        'CNPJ': '03', # CPF e CNPJ usam o mesmo código de tipo
        'ALEATORIA': '04',
        'DADOS_BANCARIOS': '05'
    }

    # Data e hora da geração do arquivo
    agora = datetime.datetime.now()
    data_geracao = agora.strftime('%d%m%Y')
    hora_geracao = agora.strftime('%H%M%S')

    linhas_cnab = []

    # --- 1. HEADER DO ARQUIVO (OBRIGATÓRIO) --- [cite: 173]
    header_arquivo = ''
    header_arquivo += formatar_num('077', 3)       # 1. Código do Banco na Compensação ('077' para Inter) [cite: 178]
    header_arquivo += formatar_num('0000', 4)      # 2. Lote de Serviço [cite: 178]
    header_arquivo += formatar_num('0', 1)         # 3. Tipo de Registro ('0') [cite: 178]
    header_arquivo += formatar_alfa('', 9)         # 4. Uso Exclusivo FEBRABAN/CNAB [cite: 178]
    header_arquivo += formatar_num('2', 1)         # 5. Tipo de Inscrição da Empresa ('2' para CNPJ) [cite: 178]
    header_arquivo += formatar_num(dados_empresa['cnpj'], 14) # 6. Número de Inscrição da Empresa [cite: 178]
    header_arquivo += formatar_alfa('', 20)        # 7. Código do Convênio no Banco (Brancos) [cite: 178]
    header_arquivo += formatar_num('0001', 5)      # 8. Agência Mantenedora da Conta ('0001') [cite: 178]
    header_arquivo += formatar_alfa('9', 1)          # 9. DV da Agência ('9') [cite: 178]
    header_arquivo += formatar_num(dados_empresa['conta'], 12) # 10. Número da Conta [cite: 178]
    header_arquivo += formatar_num(dados_empresa['conta_dv'], 1) # 11. DV da Conta [cite: 178]
    header_arquivo += formatar_alfa('', 1)         # 12. DV da Ag/Conta [cite: 178]
    header_arquivo += formatar_alfa(dados_empresa['nome'], 30) # 13. Nome da Empresa [cite: 178]
    header_arquivo += formatar_alfa('BANCO INTER', 30) # 14. Nome do Banco [cite: 178]
    header_arquivo += formatar_alfa('', 10)        # 15. Uso Exclusivo FEBRABAN/CNAB [cite: 178]
    header_arquivo += formatar_num('1', 1)         # 16. Código Remessa/Retorno ('1' para Remessa) [cite: 178]
    header_arquivo += formatar_num(data_geracao, 8) # 17. Data de Geração do Arquivo [cite: 178]
    header_arquivo += formatar_num(hora_geracao, 6) # 18. Hora de Geração do Arquivo [cite: 178]
    header_arquivo += formatar_num(numero_sequencial_arquivo, 6) # 19. Número Sequencial do Arquivo [cite: 178]
    header_arquivo += formatar_num('107', 3)       # 20. Nº da Versão do Layout do Arquivo [cite: 178]
    header_arquivo += formatar_num('01600', 5)     # 21. Densidade de Gravação do Arquivo [cite: 178]
    header_arquivo += formatar_alfa('', 20)        # 22. Para uso Reservado do Banco [cite: 178]
    header_arquivo += formatar_alfa('', 20)        # 23. Para uso Reservado da Empresa [cite: 178]
    header_arquivo += formatar_alfa('', 29)        # 24. Uso Exclusivo FEBRABAN/CNAB [cite: 178]
    
    linhas_cnab.append(header_arquivo)

    # --- 2. HEADER DE LOTE - TRANSFERÊNCIAS VIA PIX --- [cite: 218]
    header_lote = ''
    header_lote += formatar_num('077', 3)       # 1. Código do Banco na Compensação [cite: 220]
    header_lote += formatar_num('0001', 4)      # 2. Lote de Serviço (sempre 1 neste script) [cite: 220]
    header_lote += formatar_num('1', 1)         # 3. Tipo de Registro ('1') [cite: 220]
    header_lote += formatar_alfa('C', 1)        # 4. Tipo da Operação ('C' para Crédito) [cite: 220]
    # Usando '30' (Pagamento Salários) como padrão. Mude se necessário. [cite: 281]
    header_lote += formatar_num('30', 2)        # 5. Tipo do Serviço (ver nota 02 no manual) [cite: 220]
    header_lote += formatar_num('45', 2)        # 6. Forma de Lançamento ('45' para Transferência via Pix) [cite: 220]
    header_lote += formatar_num('046', 3)       # 7. Nº da Versão do Layout do Lote [cite: 220]
    header_lote += formatar_alfa('', 1)         # 8. Uso Exclusivo FEBRABAN/CNAB [cite: 220]
    header_lote += formatar_num('2', 1)         # 9. Tipo de Inscrição da Empresa ('2' para CNPJ) [cite: 220]
    header_lote += formatar_num(dados_empresa['cnpj'], 14) # 10. Número de Inscrição da Empresa [cite: 220]
    header_lote += formatar_alfa('', 20)        # 11. Código do Convênio no Banco (Brancos) [cite: 220]
    header_lote += formatar_num('0001', 5)      # 12. Agência Mantenedora da Conta [cite: 220]
    header_lote += formatar_num('9', 1)         # 13. DV da Agência [cite: 220]
    header_lote += formatar_num(dados_empresa['conta'], 12) # 14. Número da Conta [cite: 220]
    header_lote += formatar_num(dados_empresa['conta_dv'], 1) # 15. DV da Conta [cite: 220]
    header_lote += formatar_alfa('', 1)         # 16. DV da Ag/Conta [cite: 220]
    header_lote += formatar_alfa(dados_empresa['nome'], 30) # 17. Nome da Empresa [cite: 220]
    header_lote += formatar_alfa('', 40)        # 18. Mensagem (Informação) [cite: 220]
    # Endereço da Empresa
    header_lote += formatar_alfa(dados_empresa['logradouro'], 30) # 19. Logradouro [cite: 220]
    header_lote += formatar_num(dados_empresa['numero'], 5)       # 20. Número [cite: 220]
    header_lote += formatar_alfa(dados_empresa['complemento'], 15) # 21. Complemento [cite: 220]
    header_lote += formatar_alfa(dados_empresa['cidade'], 20)      # 22. Cidade [cite: 220]
    header_lote += formatar_num(dados_empresa['cep'], 8)[:5]       # 23. CEP [cite: 220]
    header_lote += formatar_num(dados_empresa['cep'], 8)[5:]       # 24. Complemento CEP [cite: 220]
    header_lote += formatar_alfa(dados_empresa['estado'], 2)       # 25. Estado [cite: 220]
    header_lote += formatar_alfa('', 8)         # 26. Uso Exclusivo FEBRABAN/CNAB [cite: 220]
    header_lote += formatar_alfa('', 10)        # 27. Códigos de Ocorrência para Retorno [cite: 220]

    linhas_cnab.append(header_lote)
    
    soma_valores_lote = 0
    numero_sequencial_registro = 0

    # --- 3. REGISTROS DE DETALHE (SEGMENTOS A e B) ---
    for pagamento in pagamentos:
        numero_sequencial_registro += 1
        soma_valores_lote += pagamento['valor']
        
        # --- SEGMENTO A (OBRIGATÓRIO) --- [cite: 223]
        segmento_a = ''
        segmento_a += formatar_num('077', 3)    # 1. Código do Banco [cite: 224]
        segmento_a += formatar_num('0001', 4)   # 2. Lote de Serviço [cite: 224]
        segmento_a += formatar_num('3', 1)      # 3. Tipo de Registro ('3') [cite: 224]
        segmento_a += formatar_num(numero_sequencial_registro * 2 - 1, 5) # 4. Nº Sequencial do Registro no Lote [cite: 224]
        segmento_a += formatar_alfa('A', 1)     # 5. Cód. Segmento do Registro Detalhe ('A') [cite: 224]
        segmento_a += formatar_num('0', 1)      # 6. Tipo de Movimento [cite: 224]
        segmento_a += formatar_num('00', 2)     # 7. Código da Instrução para Movimento [cite: 224]
        segmento_a += formatar_num('000', 3)    # 8. Código da Câmara Centralizadora [cite: 224]
        # Como é Pix por chave, os dados bancários do favorecido são zerados [cite: 224]
        segmento_a += formatar_num('0', 3)      # 9. [Favorecido] Código do Banco [cite: 224]
        segmento_a += formatar_num('0', 5)      # 10. [Favorecido] Agência [cite: 224]
        segmento_a += formatar_num('0', 1)      # 11. [Favorecido] DV Agência [cite: 224]
        segmento_a += formatar_num('0', 12)     # 12. [Favorecido] Conta Corrente [cite: 224]
        segmento_a += formatar_num('0', 1)      # 13. [Favorecido] DV Conta [cite: 224]
        segmento_a += formatar_alfa('', 1)      # 14. [Favorecido] DV Ag/Conta [cite: 224]
        segmento_a += formatar_alfa(pagamento['nome'], 30) # 15. [Favorecido] Nome [cite: 224]
        segmento_a += formatar_alfa(f"PAG-{numero_sequencial_registro}", 20) # 16. Nº do Docum. Atribuído pela Empresa [cite: 224]
        segmento_a += formatar_num(data_geracao, 8) # 17. Data do Pagamento [cite: 224]
        segmento_a += formatar_alfa('BRL', 3)   # 18. Tipo da Moeda [cite: 224]
        segmento_a += formatar_num('0', 15)     # 19. Quantidade da Moeda [cite: 224]
        valor_pagamento_str = f"{pagamento['valor']:.2f}".replace('.', '')
        segmento_a += formatar_num(valor_pagamento_str, 15) # 20. Valor do Pagamento [cite: 227]
        segmento_a += formatar_alfa('', 20)     # 21. Nº do Docum. Atribuído pelo Banco [cite: 227]
        segmento_a += formatar_alfa('', 8)      # 22. Data Real da Efetivação Pagto [cite: 227]
        segmento_a += formatar_num('0', 15)     # 23. Valor Real da Efetivação Pagto [cite: 227]
        segmento_a += formatar_alfa('', 40)     # 24. Informação 2 [cite: 227]
        segmento_a += formatar_alfa('', 3)      # 25. Código Finalidade DOC [cite: 227]
        segmento_a += formatar_alfa('', 10)     # 26. Complemento de Finalidade [cite: 227]
        segmento_a += formatar_alfa('', 10)     # 27. Uso Exclusivo FEBRABAN/CNAB [cite: 227]
        segmento_a += formatar_alfa('', 10)     # 28. Cód. Ocorrências p/ Retorno [cite: 227]
        
        linhas_cnab.append(segmento_a)

        # --- SEGMENTO B (OBRIGATÓRIO) --- [cite: 230]
        segmento_b = ''
        segmento_b += formatar_num('077', 3)    # 1. Código do Banco [cite: 231]
        segmento_b += formatar_num('0001', 4)   # 2. Lote de Serviço [cite: 231]
        segmento_b += formatar_num('3', 1)      # 3. Tipo de Registro ('3') [cite: 231]
        segmento_b += formatar_num(numero_sequencial_registro * 2, 5) # 4. Nº Sequencial do Registro no Lote [cite: 231]
        segmento_b += formatar_alfa('B', 1)     # 5. Cód. Segmento do Registro Detalhe ('B') [cite: 231]
        
        tipo_chave_pagamento = pagamento['tipo_chave'].upper()
        codigo_chave = mapa_tipo_chave.get(tipo_chave_pagamento)
        
        segmento_b += formatar_alfa(codigo_chave, 3) # 6. Forma de Iniciação (Tipo de Chave) [cite: 231]
        
        tipo_inscricao = '2' if tipo_chave_pagamento == 'CNPJ' else '1'
        segmento_b += formatar_num(tipo_inscricao, 1) # 7. [Favorecido] Tipo de Inscrição [cite: 231]
        
        # Preenche o CPF/CNPJ apenas se a chave for do tipo CPF/CNPJ [cite: 231]
        cpf_cnpj_favorecido = pagamento['chave'] if tipo_chave_pagamento in ['CPF', 'CNPJ'] else ''
        segmento_b += formatar_num(cpf_cnpj_favorecido, 14) # 8. [Favorecido] CPF/CNPJ [cite: 231]
        segmento_b += formatar_alfa('', 35)      # 9. TX ID (Opcional) [cite: 231]
        segmento_b += formatar_alfa('', 60)      # 10. Brancos [cite: 231]
        
        # Preenche a chave apenas se NÃO for CPF/CNPJ [cite: 231]
        chave_pix = pagamento['chave'] if tipo_chave_pagamento not in ['CPF', 'CNPJ'] else ''
        segmento_b += formatar_chave_pix(chave_pix, 99) # 11. Chave Pix [cite: 231]
        segmento_b += formatar_alfa('', 6)       # 12. Brancos [cite: 231]
        segmento_b += formatar_num('0', 8)       # 13. [Favorecido] Código ISPB (opcional) [cite: 231]
        segmento_b += formatar_alfa('', 10)      # 14. Uso Exclusivo FEBRABAN/CNAB [cite: 231]
        
        linhas_cnab.append(segmento_b)

    # --- 4. TRAILER DE LOTE --- [cite: 235]
    total_registros_lote = len(pagamentos) * 2 + 2 # (Seg A + Seg B) * N + Header + Trailer
    trailer_lote = ''
    trailer_lote += formatar_num('077', 3)      # 1. Código do Banco [cite: 236]
    trailer_lote += formatar_num('0001', 4)     # 2. Lote de Serviço [cite: 236]
    trailer_lote += formatar_num('5', 1)        # 3. Tipo de Registro ('5') [cite: 236]
    trailer_lote += formatar_alfa('', 9)        # 4. Uso Exclusivo FEBRABAN/CNAB [cite: 236]
    trailer_lote += formatar_num(total_registros_lote, 6) # 5. Quantidade de Registros do Lote [cite: 236]
    soma_valores_lote_str = f"{soma_valores_lote:.2f}".replace('.', '')
    trailer_lote += formatar_num(soma_valores_lote_str, 18) # 6. Somatória dos Valores [cite: 236]
    trailer_lote += formatar_num('0', 18)       # 7. Somatória de Quantidade de Moedas [cite: 236]
    trailer_lote += formatar_alfa('', 6)        # 8. Número Aviso Débito [cite: 236]
    trailer_lote += formatar_alfa('', 165)      # 9. Uso Exclusivo FEBRABAN/CNAB [cite: 236]
    trailer_lote += formatar_alfa('', 10)       # 10. Códigos das Ocorrências para Retorno [cite: 236]
    
    linhas_cnab.append(trailer_lote)

    # --- 5. TRAILER DO ARQUIVO --- [cite: 194]
    total_registros_arquivo = len(linhas_cnab) + 1 # Todos os registros + este trailer
    trailer_arquivo = ''
    trailer_arquivo += formatar_num('077', 3)    # 1. Código do Banco [cite: 195]
    trailer_arquivo += formatar_num('9999', 4)   # 2. Lote de Serviço [cite: 195]
    trailer_arquivo += formatar_num('9', 1)      # 3. Tipo de Registro ('9') [cite: 195]
    trailer_arquivo += formatar_alfa('', 9)      # 4. Uso Exclusivo FEBRABAN/CNAB [cite: 195]
    trailer_arquivo += formatar_num('1', 6)      # 5. Quantidade de Lotes do Arquivo (sempre 1 neste script) [cite: 195]
    trailer_arquivo += formatar_num(total_registros_arquivo, 6) # 6. Quantidade de Registros do Arquivo [cite: 195]
    trailer_arquivo += formatar_alfa('', 211)    # 7. Uso Exclusivo FEBRABAN/CNAB [cite: 195]
    
    linhas_cnab.append(trailer_arquivo)

    # --- 6. GERAR ARQUIVO FÍSICO ---
    # Formato do nome do arquivo [cite: 132]
    nome_arquivo = f"C1240_001_{formatar_num(numero_sequencial_arquivo, 7)}.REM"
    
    with open(nome_arquivo, 'w', encoding='ascii', newline='') as f:
        for linha in linhas_cnab:
            # Garantir que cada linha tenha exatamente 240 caracteres
            linha_formatada = linha[:240].ljust(240)
            f.write(linha_formatada + '\n')
            
    return nome_arquivo

# --- DADOS DE ENTRADA (PREENCHA AQUI!) ---
if __name__ == '__main__':
    
    # IMPORTANTE: Altere todos os dados abaixo com as informações da sua empresa
    DADOS_EMPRESA = {
        'cnpj': '12345678000199',
        'nome': 'MINHA EMPRESA LTDA',
        'agencia': '0001', # Agência é sempre 0001 no Inter [cite: 178]
        'agencia_dv': '9', # DV da agência é sempre 9 no Inter [cite: 178]
        'conta': '12345678',
        'conta_dv': '0',
        'logradouro': 'AV BRASIL',
        'numero': '1000',
        'complemento': 'SALA 50',
        'cidade': 'SAO PAULO',
        'cep': '01000123',
        'estado': 'SP'
    }

    # IMPORTANTE: Adicione aqui a lista de pagamentos que deseja realizar.
    PAGAMENTOS = [
        {
            'nome': 'JOAO DA SILVA',
            'tipo_chave': 'CPF', # Tipos: CPF, CNPJ, EMAIL, CELULAR, ALEATORIA
            'chave': '11122233344',
            'valor': 1500.50
        },
        {
            'nome': 'MARIA PEREIRA',
            'tipo_chave': 'EMAIL',
            'chave': 'maria.pereira@email.com',
            'valor': 250.00
        },
        {
            'nome': 'FORNECEDOR XYZ',
            'tipo_chave': 'CNPJ',
            'chave': '98765432000111',
            'valor': 3499.99
        },
        {
            'nome': 'PEDRO SOUZA',
            'tipo_chave': 'ALEATORIA',
            'chave': '123e4567-e89b-12d3-a456-426614174000',
            'valor': 80.75
        }
    ]

    # IMPORTANTE: Defina o número sequencial do arquivo. Deve ser incrementado a cada novo arquivo. 
    NUMERO_SEQUENCIAL_ARQUIVO = 1

    try:
        arquivo_gerado = gerar_cnab_pix(DADOS_EMPRESA, PAGAMENTOS, NUMERO_SEQUENCIAL_ARQUIVO)
        print(f"Sucesso! Arquivo '{arquivo_gerado}' foi gerado.")
        print("Próximo passo: envie este arquivo para o Banco Inter através do Internet Banking.")
    except Exception as e:
        print(f"Ocorreu um erro ao gerar o arquivo: {e}")