// Popup script for Gemini Chat Exporter

(function() {
  'use strict';

  const exportBtn = document.getElementById('export-btn');
  const copyBtn = document.getElementById('copy-btn');
  const statusEl = document.getElementById('status');
  const resultEl = document.getElementById('result');
  const errorEl = document.getElementById('error');
  const notGeminiEl = document.getElementById('not-gemini');
  const controlsEl = document.getElementById('controls');

  /**
   * Show status message
   * @param {string} message - Status message
   * @param {boolean} loading - Whether to show loading state
   */
  function showStatus(message, loading = false) {
    statusEl.textContent = message;
    statusEl.className = loading ? 'status loading' : 'status';
  }

  /**
   * Show success result
   * @param {string} message - Success message
   */
  function showSuccess(message) {
    resultEl.querySelector('.success-msg').textContent = message;
    resultEl.classList.remove('hidden');
    errorEl.classList.add('hidden');
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  function showError(message) {
    errorEl.querySelector('.error-msg').textContent = message;
    errorEl.classList.remove('hidden');
    resultEl.classList.add('hidden');
  }

  /**
   * Generate a safe filename from chat title
   * @param {string} title - Chat title
   * @returns {string} Safe filename
   */
  function generateFilename(title) {
    const date = new Date().toISOString().split('T')[0];
    const safeTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);

    return `gemini-${safeTitle}-${date}.md`;
  }

  /**
   * Download markdown as file via background script
   * Using background script prevents popup close from killing the download
   * @param {string} markdown - Markdown content
   * @param {string} filename - Filename
   * @returns {Promise} Promise resolving when download starts
   */
  function downloadMarkdown(markdown, filename) {
    return browser.runtime.sendMessage({
      action: 'download',
      content: markdown,
      filename: filename
    });
  }

  /**
   * Extract chat from current tab
   * @returns {Promise} Promise resolving to extraction result
   */
  async function extractChat() {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (!tab.url.includes('gemini.google.com')) {
      return { success: false, notGemini: true };
    }

    return new Promise((resolve) => {
      browser.tabs.sendMessage(tab.id, { action: 'extractChat' })
        .then((response) => {
          resolve(response);
        })
        .catch((err) => {
          resolve({
            success: false,
            error: 'Could not communicate with the page. Please refresh the Gemini page and try again. Error: ' + err.message
          });
        });
    });
  }

  /**
   * Handle export button click
   */
  async function handleExport() {
    exportBtn.disabled = true;
    copyBtn.disabled = true;
    showStatus('Scrolling through conversation...', true);
    resultEl.classList.add('hidden');
    errorEl.classList.add('hidden');

    try {
      const result = await extractChat();

      if (result.notGemini) {
        controlsEl.classList.add('hidden');
        notGeminiEl.classList.remove('hidden');
        showStatus('');
        return;
      }

      if (!result.success) {
        showError(result.error);
        showStatus('');
        return;
      }

      const filename = generateFilename(result.title);
      downloadMarkdown(result.markdown, filename);

      showStatus('');
      showSuccess(`Exported ${result.messageCount} messages to ${filename}`);
    } catch (err) {
      showError(`Export failed: ${err.message}`);
      showStatus('');
    } finally {
      exportBtn.disabled = false;
      copyBtn.disabled = false;
    }
  }

  /**
   * Handle copy button click
   */
  async function handleCopy() {
    exportBtn.disabled = true;
    copyBtn.disabled = true;
    showStatus('Scrolling through conversation...', true);
    resultEl.classList.add('hidden');
    errorEl.classList.add('hidden');

    try {
      const result = await extractChat();

      if (result.notGemini) {
        controlsEl.classList.add('hidden');
        notGeminiEl.classList.remove('hidden');
        showStatus('');
        return;
      }

      if (!result.success) {
        showError(result.error);
        showStatus('');
        return;
      }

      await navigator.clipboard.writeText(result.markdown);

      showStatus('');
      showSuccess(`Copied ${result.messageCount} messages to clipboard!`);
    } catch (err) {
      showError(`Copy failed: ${err.message}`);
      showStatus('');
    } finally {
      exportBtn.disabled = false;
      copyBtn.disabled = false;
    }
  }

  // Initialize
  async function init() {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (!tab.url || !tab.url.includes('gemini.google.com')) {
      controlsEl.classList.add('hidden');
      notGeminiEl.classList.remove('hidden');
    }
  }

  // Event listeners
  exportBtn.addEventListener('click', handleExport);
  copyBtn.addEventListener('click', handleCopy);

  // Run init
  init();
})();
