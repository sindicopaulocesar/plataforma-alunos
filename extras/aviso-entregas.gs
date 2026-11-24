// Aviso de entregas · Formação de Síndicos
// Envia para formacaodesindicos@gmail.com um e-mail com o trabalho do aluno ANEXADO.
// Cole este código inteiro no Google Apps Script (conta formacaodesindicos@gmail.com).

var PARA = 'formacaodesindicos@gmail.com';
var CHAVE = 'fs-entregas-2027';

function doPost(e) {
  var d = JSON.parse(e.postData.contents);
  if (d.chave !== CHAVE) return ContentService.createTextOutput('recusado');
  var corpo = 'Nova entrega na plataforma\n\n' +
    'Aluno: ' + d.aluno + '\n' +
    'E-mail do aluno: ' + d.email + '\n' +
    'Turma: ' + d.turma + '\n' +
    'Atividade: ' + d.atividade + '\n' +
    'Arquivo: ' + d.arquivo + '\n' +
    'Enviado em: ' + d.quando + '\n\n' +
    (d.base64 ? 'O trabalho está anexado a este e-mail.\n\n' : 'O arquivo é grande demais para anexar: baixe pela plataforma.\n\n') +
    'Para lançar a nota e a devolutiva: ' + d.link + ' (menu Notas e entregas).';
  var opcoes = { name: 'Plataforma Formação de Síndicos' };
  if (d.email) opcoes.replyTo = d.email;
  if (d.base64) opcoes.attachments = [Utilities.newBlob(Utilities.base64Decode(d.base64), d.tipo || 'application/octet-stream', d.arquivo)];
  MailApp.sendEmail(PARA, d.assunto, corpo, opcoes);
  return ContentService.createTextOutput('ok');
}
