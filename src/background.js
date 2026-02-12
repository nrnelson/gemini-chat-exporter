// Background script for handling downloads
// This prevents the popup closing issue that causes download failures

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'download') {
    const { content, filename } = message;

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    browser.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    }).then(() => {
      // Clean up the blob URL after download starts
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      sendResponse({ success: true });
    }).catch((error) => {
      URL.revokeObjectURL(url);
      sendResponse({ success: false, error: error.message });
    });

    return true; // Keep message channel open for async response
  }
});
