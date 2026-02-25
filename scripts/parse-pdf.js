// Script para parsear PDF - executado como processo separado
// Redireciona stderr para /dev/null antes de carregar qualquer módulo
process.stderr.write = () => true;

const fs = require('fs');

// Suprime TODOS os outputs antes de carregar pdf2json
const noop = () => {};
console.log = noop;
console.warn = noop;
console.info = noop;
console.error = noop;
console.debug = noop;

const PDFParser = require('pdf2json');

// Guarda referência ao write original do stdout
const originalStdoutWrite = process.stdout.write.bind(process.stdout);

function parsePDF(filePath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, 1); // verbosity = 1 (silent)
    
    pdfParser.on('pdfParser_dataError', errData => {
      reject(new Error(errData.parserError || 'Erro ao processar PDF'));
    });
    
    pdfParser.on('pdfParser_dataReady', pdfData => {
      try {
        // Extrai texto de todas as páginas
        let text = '';
        if (pdfData && pdfData.Pages) {
          for (const page of pdfData.Pages) {
            if (page.Texts) {
              for (const textItem of page.Texts) {
                if (textItem.R) {
                  for (const r of textItem.R) {
                    if (r.T) {
                      // Decodifica o texto URL-encoded
                      text += decodeURIComponent(r.T) + ' ';
                    }
                  }
                }
              }
            }
            text += '\n';
          }
        }
        resolve(text.trim());
      } catch (error) {
        reject(error);
      }
    });
    
    pdfParser.loadPDF(filePath);
  });
}

// Recebe o caminho do arquivo como argumento
const filePath = process.argv[2];

// Função para escrever diretamente no stdout
function output(obj) {
  originalStdoutWrite(JSON.stringify(obj) + '\n');
}

if (!filePath) {
  output({ error: 'Caminho do arquivo não fornecido' });
  process.exit(1);
}

parsePDF(filePath)
  .then(text => {
    output({ success: true, text });
  })
  .catch(error => {
    output({ error: error.message });
    process.exit(1);
  });
