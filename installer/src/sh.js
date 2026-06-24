// POSIX single-quote shell escaping + strict IPv4 validation.
function shQuote(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

function isIpv4(s) {
  if (typeof s !== 'string') return false;
  var m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  for (var i = 1; i <= 4; i++) { var n = Number(m[i]); if (n < 0 || n > 255) return false; }
  return true;
}

module.exports = { shQuote: shQuote, isIpv4: isIpv4 };
