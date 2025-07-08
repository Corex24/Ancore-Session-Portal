function generateSessionId(input) {
  if (input && /^[a-zA-Z0-9]{3,20}$/.test(input)) {
    return `ANCORE_${input}`;
  }
  return `ANCORE_${Math.random().toString(36).substr(2, 12)}`;
}

module.exports = generateSessionId;