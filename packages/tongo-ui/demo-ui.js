async function runStep(step) {
  const output = document.getElementById('output');
  output.textContent = `Running step: ${step}...`;

  try {
    const result = await window.demoSteps[step]();
    output.textContent = `✅ Step "${step}" complete:\n` + (result || '');
  } catch (err) {
    output.textContent = `❌ Error running "${step}":\n` + err.toString();
  }
}

// Attach your logic here (you'll replace these with real calls)
window.demoSteps = {
  fund: async () => 'Funded!',
  transfer: async () => 'Transferred!',
  rollover: async () => 'Rolled over!',
  withdraw: async () => 'Withdrawn!',
  audit: async () => 'Audited!',
};
