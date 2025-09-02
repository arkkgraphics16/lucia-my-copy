async function callOpenAI(prompt) {
  // Dev-safe stub. Replace with real OpenAI client call in prod.
  return `Echo: ${prompt.slice(0, 200)}`;
}
module.exports = { callOpenAI };
