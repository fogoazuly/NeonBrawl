// Compatible with the original _nbpd format. This checksum detects corruption,
// not cheating; local saves are not authoritative for a future public economy.
const KEY = 'Nx9!Br@wL_k3$v7q';
function checksum(text) {
  let value = 0;
  for (let i = 0; i < text.length; i++) value = (value * 31 + text.charCodeAt(i)) >>> 0;
  return value.toString(36);
}
function xor(text) {
  let result = '';
  for (let i = 0; i < text.length; i++) result += String.fromCharCode(text.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length));
  return result;
}
export function encodeSave(progress) {
  const data = JSON.stringify(progress);
  return btoa(xor(JSON.stringify({ d: data, c: checksum(data) })));
}
export function decodeSave(raw) {
  const { d, c } = JSON.parse(xor(atob(raw)));
  if (typeof d !== 'string' || checksum(d) !== c) throw new Error('Salvamento corrompido.');
  return JSON.parse(d);
}
