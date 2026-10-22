import React from 'react';

/**
 * Render inline text with safe, clickable external links
 */
export const renderInlineWithLinks = (text) => {
  if (!text || typeof text !== 'string') return null;

  // Match Markdown links: [title](url) OR raw URLs: https?://...
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)|(https?:\/\/[^\s<>"'\)]+)/g;
  const elements = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index));
    }

    if (match[1] && match[2]) {
      // Markdown formatted link
      elements.push(
        <a
          key={`md-${match.index}`}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="story-inline-link"
          onClick={(e) => e.stopPropagation()}
          title={`Open ${match[1]} in a new tab`}
        >
          {match[1]} ↗
        </a>
      );
    } else if (match[3]) {
      // Raw URL
      const rawUrl = match[3];
      let displayLabel = rawUrl;
      try {
        const parsed = new URL(rawUrl);
        displayLabel = parsed.hostname.replace(/^www\./, '') + (parsed.pathname.length > 25 ? parsed.pathname.substring(0, 22) + '...' : parsed.pathname);
      } catch (e) {}

      elements.push(
        <a
          key={`raw-${match.index}`}
          href={rawUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="story-inline-link"
          onClick={(e) => e.stopPropagation()}
          title={`Open ${rawUrl} in a new tab`}
        >
          {displayLabel} ↗
        </a>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return elements.length > 0 ? elements : text;
};

/**
 * FormattedText Component
 * Renders structured multi-line text into clean paragraphs, ordered lists, and bullet lists.
 */
export const FormattedText = ({ content, text, className = '' }) => {
  const textToRender = content || text || '';
  if (!textToRender || typeof textToRender !== 'string') return null;

  const rawLines = textToRender.split('\n');
  const blocks = [];
  let currentList = null; // { type: 'ol' | 'ul', items: [] }
  let currentParagraph = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const text = currentParagraph.join(' ').trim();
      if (text) {
        blocks.push({ type: 'p', content: text });
      }
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (currentList && currentList.items.length > 0) {
      blocks.push(currentList);
      currentList = null;
    }
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    // Check for ordered list: "1. ", "1) ", "(1) ", "1- "
    const orderedMatch = line.match(/^(?:([0-9]+)[\.\)\-]|\(([0-9]+)\))\s+(.*)$/);
    // Check for unordered/bullet list: "• ", "- ", "* ", "● "
    const bulletMatch = line.match(/^[-*•●]\s+(.*)$/);
    // Check for explicit heading like "### Heading" or short bold line ending in colon "**Header:**"
    const headingMatch = line.match(/^(?:###\s*(.*)|\*\*([^*:]+):\*\*|([A-Z][a-zA-Z0-9\s]{2,40}):)$/);

    if (orderedMatch) {
      flushParagraph();
      const itemText = orderedMatch[3].trim();
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(itemText);
    } else if (bulletMatch) {
      flushParagraph();
      const itemText = bulletMatch[1].trim();
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(itemText);
    } else if (headingMatch && line.length < 70) {
      flushParagraph();
      flushList();
      const hText = (headingMatch[1] || headingMatch[2] || headingMatch[3] || line).trim();
      blocks.push({ type: 'h4', content: hText });
    } else {
      flushList();
      currentParagraph.push(line);
    }
  }

  flushParagraph();
  flushList();

  return (
    <div className={`formatted-story-content ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {blocks.map((block, idx) => {
        if (block.type === 'h4') {
          return (
            <h4
              key={idx}
              style={{
                margin: '0.65rem 0 0.15rem 0',
                fontSize: '1.05rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em'
              }}
            >
              {block.content}
            </h4>
          );
        }
        if (block.type === 'ol') {
          return (
            <ol key={idx} className="story-ordered-list">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx}>{renderInlineWithLinks(item)}</li>
              ))}
            </ol>
          );
        }
        if (block.type === 'ul') {
          return (
            <ul key={idx} className="story-bullet-list">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx}>{renderInlineWithLinks(item)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={idx} style={{ margin: 0, fontSize: '0.98rem', lineHeight: 1.72, color: 'var(--text-secondary)' }}>
            {renderInlineWithLinks(block.content)}
          </p>
        );
      })}
    </div>
  );
};

export default FormattedText;
