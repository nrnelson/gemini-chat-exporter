# Gemini Chat Exporter

A Firefox browser extension that exports chat sessions from Gemini (gemini.google.com) to Markdown format.

## Features

- Export individual Gemini chat sessions to Markdown files
- Copy chat content directly to clipboard
- Preserves formatting including code blocks, bold, italic, headers, and lists
- Clear visual distinction between user prompts and Gemini responses
- Timestamps and metadata in exported files

## Installation

### Temporary Installation (for development/testing)

1. Open Firefox and navigate to `about:debugging`
2. Click "This Firefox" in the left sidebar
3. Click "Load Temporary Add-on..."
4. Navigate to this extension folder and select `manifest.json`
5. The extension will be installed temporarily (until Firefox restarts)

### Permanent Installation

To install permanently, the extension needs to be signed by Mozilla:

1. Create a `.zip` file of the extension:
   ```bash
   zip -r gemini-exporter.zip manifest.json src/ icons/
   ```
2. Submit to [Firefox Add-ons](https://addons.mozilla.org) for signing
3. Install the signed `.xpi` file

## Usage

1. Navigate to [gemini.google.com](https://gemini.google.com)
2. Open or continue a chat conversation
3. Click the Gemini Chat Exporter icon in your browser toolbar
4. Choose an action:
   - **Export to Markdown**: Downloads a `.md` file with the chat content
   - **Copy to Clipboard**: Copies the Markdown text to your clipboard

## Output Format

The exported Markdown follows this structure:

```markdown
# Chat Title

*Exported from Gemini on January 15, 2025, 2:30 PM*

---

## User

Your question or prompt here

---

## Gemini

The AI response with preserved formatting, including:
- **Bold text**
- *Italic text*
- `code snippets`
- Code blocks with syntax highlighting

---
```

## Development

### Project Structure

```
ai-exporter-plugin/
├── manifest.json      # Extension manifest
├── icons/
│   ├── icon-48.png    # Toolbar icon
│   └── icon-96.png    # High-res icon
├── src/
│   ├── content.js     # Content script for DOM extraction
│   ├── popup.html     # Extension popup UI
│   ├── popup.css      # Popup styles
│   └── popup.js       # Popup logic
└── README.md
```

### Testing Changes

1. Make your code changes
2. Go to `about:debugging` in Firefox
3. Click "Reload" next to the extension
4. Refresh any open Gemini tabs

## Troubleshooting

**"No chat messages found" error**
- Ensure you're on a Gemini page with an active conversation
- Try refreshing the page and waiting for it to fully load
- The DOM structure of Gemini may have changed; please report an issue

**Extension icon not appearing**
- Check that the extension is properly loaded in `about:debugging`
- Try restarting Firefox

**Export button not working**
- Make sure you're on `gemini.google.com`
- Check the browser console for error messages

## License

MIT License
