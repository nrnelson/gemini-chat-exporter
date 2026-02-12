// Content script for extracting Gemini chat data

(function() {
  'use strict';

  /**
   * Create a simple hash of content for deduplication
   * @param {string} content - Content to hash
   * @returns {string} Hash string
   */
  function hashContent(content) {
    if (!content) return '';
    // Use first 100 chars + length as a simple hash
    return content.substring(0, 100).trim() + '|' + content.length;
  }

  /**
   * Remove duplicate messages based on content similarity
   * @param {Array} messages - Array of messages
   * @returns {Array} Deduplicated messages
   */
  function deduplicateMessages(messages) {
    const seen = new Set();
    const result = [];

    for (const msg of messages) {
      const hash = hashContent(msg.content);
      if (!seen.has(hash)) {
        seen.add(hash);
        result.push(msg);
      }
    }

    return result;
  }

  /**
   * Extract text content from a message element, preserving formatting
   * @param {Element} el - DOM element
   * @returns {string} Message content
   */
  function extractMessageContent(el) {
    // Clone to avoid modifying the actual DOM
    const clone = el.cloneNode(true);

    // Remove UI elements we don't want
    const unwantedSelectors = [
      'button',
      '[class*="action"]',
      '[class*="toolbar"]',
      '[class*="copy"]',
      '[class*="feedback"]',
      '[class*="icon"]',
      '[class*="avatar"]',
      '[aria-hidden="true"]',
      'mat-icon',
      '.material-icons',
      '[class*="thumb"]',
      '[class*="rating"]',
      '[class*="menu"]',
      '[class*="label"]',
      '[class*="header"]',
      '[class*="sender"]',
      '[class*="author"]'
    ];

    unwantedSelectors.forEach(selector => {
      clone.querySelectorAll(selector).forEach(u => u.remove());
    });

    // Remove elements containing "You said" or "Gemini said" labels
    clone.querySelectorAll('*').forEach(node => {
      const text = node.textContent.trim();
      if (text === 'You said' || text === 'Gemini said' ||
          text === 'You' || text === 'Gemini') {
        // Only remove if it's a small label element, not the whole message
        if (text.length < 20 && node.children.length === 0) {
          node.remove();
        }
      }
    });

    // Process code blocks specially - find pre > code structures
    const codeBlocks = clone.querySelectorAll('pre');
    codeBlocks.forEach(pre => {
      const codeEl = pre.querySelector('code') || pre;
      const language = detectCodeLanguage(codeEl) || detectCodeLanguage(pre);
      const codeText = codeEl.textContent;

      // Replace with markdown code block
      const marker = document.createElement('div');
      marker.textContent = `\n\`\`\`${language}\n${codeText}\n\`\`\`\n`;
      pre.replaceWith(marker);
    });

    // Handle inline code that's not in a pre block
    clone.querySelectorAll('code:not(pre code)').forEach(code => {
      const marker = document.createElement('span');
      marker.textContent = `\`${code.textContent}\``;
      code.replaceWith(marker);
    });

    // Convert to markdown
    return htmlToMarkdown(clone);
  }

  /**
   * Detect programming language from code block
   * @param {Element} codeBlock - Code block element
   * @returns {string} Language identifier
   */
  function detectCodeLanguage(codeBlock) {
    if (!codeBlock) return '';
    const classNames = codeBlock.className || '';

    // Common language class patterns
    const langMatch = classNames.match(/language-(\w+)|lang-(\w+)|(\w+)-code/);
    if (langMatch) {
      return langMatch[1] || langMatch[2] || langMatch[3];
    }

    // Check data attributes
    const dataLang = codeBlock.getAttribute('data-language') ||
                     codeBlock.getAttribute('data-lang');
    if (dataLang) return dataLang;

    return '';
  }

  /**
   * Convert HTML content to Markdown
   * @param {Element} el - DOM element
   * @returns {string} Markdown text
   */
  function htmlToMarkdown(el) {
    let html = el.innerHTML;

    // Bold
    html = html.replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**');

    // Italic
    html = html.replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, '*$2*');

    // Links
    html = html.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

    // Headers
    html = html.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
    html = html.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
    html = html.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
    html = html.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');
    html = html.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n');
    html = html.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n');

    // Lists - handle nested lists better
    html = html.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
    html = html.replace(/<\/?[uo]l[^>]*>/gi, '\n');

    // Paragraphs and line breaks
    html = html.replace(/<br\s*\/?>/gi, '\n');
    html = html.replace(/<\/p>/gi, '\n\n');
    html = html.replace(/<p[^>]*>/gi, '');

    // Divs as line breaks
    html = html.replace(/<\/div>/gi, '\n');
    html = html.replace(/<div[^>]*>/gi, '');

    // Spans (just remove tags, keep content)
    html = html.replace(/<\/?span[^>]*>/gi, '');

    // Remove remaining HTML tags
    html = html.replace(/<[^>]+>/g, '');

    // Decode HTML entities using DOMParser (safer than innerHTML)
    const doc = new DOMParser().parseFromString(html, 'text/html');
    html = doc.body.textContent || '';

    // Clean up extra whitespace
    html = html.replace(/\n{3,}/g, '\n\n');
    html = html.replace(/[ \t]+$/gm, ''); // Remove trailing spaces

    // Remove "You said" / "Gemini said" labels that may have been captured
    html = html.replace(/^You said\s*/i, '');
    html = html.replace(/^Gemini said\s*/i, '');
    html = html.replace(/\nYou said\s*/gi, '\n');
    html = html.replace(/\nGemini said\s*/gi, '\n');

    html = html.trim();

    return html;
  }

  /**
   * Get the chat title/topic
   * @returns {string} Chat title or default
   */
  function getChatTitle() {
    // Try to find title in sidebar or header
    const titleSelectors = [
      '[class*="conversation-title"]',
      '[class*="chat-title"]',
      '.title',
      'h1'
    ];

    for (const selector of titleSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim() && el.textContent.trim().length < 200) {
        const text = el.textContent.trim();
        // Skip generic titles that are just "Gemini" or similar
        if (!text.toLowerCase().includes('gemini')) {
          return text;
        }
      }
    }

    // Fall back to page title
    const pageTitle = document.title;
    if (pageTitle && !pageTitle.toLowerCase().includes('gemini')) {
      return pageTitle;
    }

    return 'Gemini Chat Export';
  }

  /**
   * Format messages as Markdown
   * @param {Array} messages - Array of message objects
   * @param {string} title - Chat title
   * @returns {string} Formatted Markdown
   */
  function formatAsMarkdown(messages, title) {
    const now = new Date();
    const date = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Get timezone abbreviation (e.g., "PST", "EST", "UTC")
    const timezone = now.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();

    // Count messages by role
    const userCount = messages.filter(m => m.role === 'user').length;
    const geminiCount = messages.filter(m => m.role === 'assistant').length;
    const totalCount = messages.length;

    let markdown = `# ${title}\n\n`;
    markdown += `*Exported from Gemini on ${date} ${timezone}*\n\n`;
    markdown += `**Messages:** ${totalCount} total (👤 User: ${userCount}, 🤖 Gemini: ${geminiCount})\n\n`;
    markdown += `---\n\n`;

    messages.forEach((msg, index) => {
      if (msg.role === 'user') {
        markdown += `## 👤 User\n\n`;
      } else {
        markdown += `## 🤖 Gemini\n\n`;
      }

      markdown += `${msg.content}\n\n`;

      if (index < messages.length - 1) {
        markdown += `---\n\n`;
      }
    });

    return markdown;
  }

  /**
   * Find the scrollable chat container (main pane, not sidebar)
   * @returns {Element|null} The scrollable container element
   */
  function findScrollContainer() {

    // Try to find elements that contain the conversation messages
    // Gemini uses user-query and model-response custom elements
    const turnElements = document.querySelectorAll(
      'user-query, model-response, conversation-turn, [class*="conversation-turn"], [data-turn-id]'
    );

    if (turnElements.length > 0) {
      // Find the scrollable parent of the first turn
      let el = turnElements[0].parentElement;
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el);
        const isScrollable = (
          el.scrollHeight > el.clientHeight + 20 &&
          (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay')
        );

        if (isScrollable) {
          return el;
        }
        el = el.parentElement;
      }
    }

    // Try looking for common chat container patterns
    const chatSelectors = [
      '[class*="response-container"]',
      '[class*="chat-history"]',
      '[class*="message-list"]',
      '[class*="conversation-content"]',
      '[class*="chat-content"]'
    ];

    for (const selector of chatSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        // Check if this element or a parent is scrollable
        let current = el;
        while (current && current !== document.body) {
          if (current.scrollHeight > current.clientHeight + 20) {
            return current;
          }
          current = current.parentElement;
        }
      }
    }

    // Look for any element with significant scroll that's in the right portion of screen
    const candidates = [];
    document.querySelectorAll('*').forEach(el => {
      if (el.scrollHeight > el.clientHeight + 100 && el.clientHeight > 300) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);

        // Must be scrollable
        if (style.overflowY !== 'auto' && style.overflowY !== 'scroll' && style.overflowY !== 'overlay') {
          return;
        }

        // Exclude elements on far left (sidebar) - sidebar is usually < 300px wide and starts at 0
        if (rect.left < 50 && rect.width < 350) {
          return;
        }

        candidates.push({
          el,
          rect,
          scrollHeight: el.scrollHeight,
          area: rect.width * rect.height
        });
      }
    });

    // Sort by area (largest first)
    candidates.sort((a, b) => b.area - a.area);

    if (candidates.length > 0) {
      return candidates[0].el;
    }

    // Last resort: use window scrolling
    return null;
  }

  /**
   * Extract messages from currently visible content
   * @param {Array} messages - Messages array to append to
   * @param {Set} seenContent - Set of seen content hashes for deduplication
   * @param {boolean} prepend - Whether to prepend messages (for older content when scrolling up)
   */
  function extractVisibleMessages(messages, seenContent, prepend = false) {
    // Gemini uses custom Angular elements: <user-query> and <model-response>
    // These are siblings in the DOM, not nested in a container together
    const messageElements = document.querySelectorAll('user-query, model-response');

    const newMessages = [];

    messageElements.forEach((el) => {
      const isUserQuery = el.tagName === 'USER-QUERY';
      const isModelResponse = el.tagName === 'MODEL-RESPONSE';

      if (isUserQuery) {
        // Extract user message content
        const content = extractMessageContent(el);
        const hash = hashContent(content);
        if (content && content.trim() && !seenContent.has(hash)) {
          seenContent.add(hash);
          newMessages.push({ role: 'user', content: content.trim() });
        }
      } else if (isModelResponse) {
        // Extract model response content
        const modelTextEl = el.querySelector(
          '.model-response-text message-content, ' +
          '.model-response-text .markdown, ' +
          '.model-response-text'
        );

        const contentEl = modelTextEl || el;
        const content = extractMessageContent(contentEl);
        const hash = hashContent(content);

        if (content && content.trim() && !seenContent.has(hash)) {
          seenContent.add(hash);
          newMessages.push({ role: 'assistant', content: content.trim() });
        }
      }
    });

    // If prepending, add new messages to the beginning (they're older)
    // If appending, add to the end (default behavior)
    if (prepend && newMessages.length > 0) {
      messages.unshift(...newMessages);
    } else {
      messages.push(...newMessages);
    }
  }

  /**
   * Auto-scroll through the conversation to load all messages
   * Extracts messages during scrolling to handle virtual scrolling
   * @param {Array} messages - Messages array to populate
   * @param {Set} seenContent - Set of seen content hashes for deduplication
   * @returns {Promise} Resolves when scrolling is complete
   */
  async function autoScrollConversation(messages, seenContent) {
    const container = findScrollContainer();

    // Disable scroll anchoring which can interfere with programmatic scrolling
    if (container) {
      container.style.overflowAnchor = 'none';
    }

    // Helper functions for scrolling (works with element or window)
    const getScrollTop = () => {
      if (container) return container.scrollTop;
      return window.scrollY || document.documentElement.scrollTop;
    };

    const getScrollHeight = () => {
      if (container) return container.scrollHeight;
      return document.documentElement.scrollHeight;
    };

    const getClientHeight = () => {
      if (container) return container.clientHeight;
      return window.innerHeight;
    };

    const scrollBy = (amount) => {
      if (container) {
        container.scrollTop += amount;
      } else {
        window.scrollBy(0, amount);
      }
    };

    const setScrollTop = (value) => {
      if (container) {
        container.scrollTop = value;
      } else {
        window.scrollTo(0, value);
      }
    };

    // Gemini uses virtual scrolling - extract messages during scroll
    // Start at the bottom to ensure we capture newest messages first

    // Jump to bottom first and wait for content to stabilize
    setScrollTop(getScrollHeight());
    await sleep(200);

    // Extract at current position (bottom) - these are the newest messages
    extractVisibleMessages(messages, seenContent, false);

    // Wait and extract again in case more content loaded
    await sleep(100);
    extractVisibleMessages(messages, seenContent, false);

    // Use 70% of viewport height to ensure good overlap between scroll positions
    const scrollStep = Math.max(400, Math.floor(getClientHeight() * 0.7));
    let stuckCount = 0;
    let scrollCount = 0;
    const maxScrolls = 500;

    // Scroll UP through the conversation to load older messages
    while (scrollCount < maxScrolls) {
      const previousScrollTop = getScrollTop();
      const previousScrollHeight = getScrollHeight();
      const previousMessageCount = messages.length;

      // Scroll UP (negative direction)
      scrollBy(-scrollStep);

      // Wait for content to load - short base delay, adaptive logic will extend if needed
      await sleep(50);

      // Extract visible messages - prepend since we're scrolling up (older messages)
      extractVisibleMessages(messages, seenContent, true);

      let currentScrollTop = getScrollTop();
      let currentScrollHeight = getScrollHeight();

      // Adaptive waiting: if content changed, Gemini may still be loading more
      // Wait and check again in a loop until content stabilizes
      let adaptiveLoops = 0;
      while (adaptiveLoops < 5) {
        await sleep(75);
        extractVisibleMessages(messages, seenContent, true);
        const newScrollHeight = getScrollHeight();
        const newMessageCount = messages.length;

        if (newScrollHeight === currentScrollHeight && newMessageCount === messages.length) {
          // Content has stabilized
          break;
        }

        // Content still changing - update and continue waiting
        currentScrollHeight = newScrollHeight;
        adaptiveLoops++;
      }

      // Check if scrollHeight changed (new content loaded)
      if (currentScrollHeight > previousScrollHeight) {
        stuckCount = 0;
      }

      // Check if we've reached the top or are stuck
      if (Math.abs(currentScrollTop - previousScrollTop) < 10) {
        stuckCount++;
        if (stuckCount >= 3) {
          break;
        }
      } else {
        stuckCount = 0;
      }

      // Check if at top
      if (currentScrollTop <= 10) {
        break;
      }

      scrollCount++;
    }

    // One final extraction at the top
    extractVisibleMessages(messages, seenContent, true);

    // Scroll to absolute top and wait for content to load
    setScrollTop(0);
    await sleep(300);
    extractVisibleMessages(messages, seenContent, true);

    // Wait a bit more and extract again - Gemini can be slow loading oldest messages
    await sleep(200);
    extractVisibleMessages(messages, seenContent, true);

    // One more scroll to 0 in case content shifted
    setScrollTop(0);
    await sleep(200);
    extractVisibleMessages(messages, seenContent, true);
  }

  /**
   * Sleep helper
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise}
   */
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Listen for messages from popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractChat') {
      // Handle async extraction with auto-scroll
      (async () => {
        try {
          // Extract messages during scroll to handle virtual scrolling
          const messages = [];
          const seenContent = new Set();
          await autoScrollConversation(messages, seenContent);

          // Deduplicate messages (already in chronological order due to prepend logic)
          const dedupedMessages = deduplicateMessages(messages);
          const title = getChatTitle();

          if (dedupedMessages.length === 0) {
            sendResponse({
              success: false,
              error: 'No chat messages found. Make sure you are on a Gemini chat page with an active conversation.'
            });
            return;
          }

          const markdown = formatAsMarkdown(dedupedMessages, title);

          sendResponse({
            success: true,
            markdown: markdown,
            title: title,
            messageCount: dedupedMessages.length
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: `Failed to extract chat: ${error.message}`
          });
        }
      })();

      return true; // Keep the message channel open for async response
    }
  });
})();
