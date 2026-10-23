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

  // 1. Normalize punctuation spacing (myself.I -> myself. I)
  let normalizedText = textToRender.replace(/([a-z0-9\)])\.([A-Z])/g, '$1. $2');
  normalizedText = normalizedText.replace(/([a-z0-9\)])\?([A-Z])/g, '$1? $2');
  normalizedText = normalizedText.replace(/([a-z0-9\)])\!([A-Z])/g, '$1! $2');

  // 2. Separate inline numbered list items that were accidentally on the same line
  normalizedText = normalizedText.replace(/([.:!?])\s+([0-9]+[\.\)])\s+/g, '$1\n$2 ');

  // 3. Separate inline bullet points that were on the same line
  normalizedText = normalizedText.replace(/([.:!?])\s+([•●\-\*])\s+/g, '$1\n$2 ');

  // 4. Separate inline questions
  normalizedText = normalizedText.replace(/([.!?])\s*(Question\s*\d+[:\-]?|Q\d+[:\-]?)\s*/gi, '$1\n\n$2 ');

  const rawLines = normalizedText.split('\n');
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

    // Check for Question format: "Question 1: ...", "Q1: ...", "Q.1: ..."
    const questionMatch = line.match(/^(?:Question\s*(\d+)[:\-]?|Q(\d+)[:\-]?)\s*(.*)$/i);
    // Check for Response format: "Candidate's response: ...", "Response: ...", "Answer: ..."
    const responseMatch = line.match(/^(?:Candidate(?:'s)?\s*Response|Response|Answer|Explanation)[:\-]\s*(.*)$/i);
    // Check for SQL / Code snippet
    const isCodeBlock = /^(?:SELECT\s+|CREATE\s+TABLE|INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM)/i.test(line) ||
                        line.startsWith('```') ||
                        (line.includes('SELECT ') && line.includes(' FROM '));

    // Check for ordered list: "1. ", "1) ", "(1) ", "1- "
    const orderedMatch = line.match(/^(?:([0-9]+)[\.\)\-]|\(([0-9]+)\))\s+(.*)$/);
    // Check for unordered/bullet list: "• ", "- ", "* ", "● "
    const bulletMatch = line.match(/^[-*•●]\s+(.*)$/);
    // Check for explicit heading like "### Heading" or short bold line ending in colon "**Header:**"
    const headingMatch = line.match(/^(?:###\s*(.*)|\*\*([^*:]+):\*\*|([A-Z][a-zA-Z0-9\s]{2,40}):)$/);

    if (questionMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: 'question',
        qNum: questionMatch[1] || questionMatch[2] || '',
        text: questionMatch[3] || line
      });
    } else if (responseMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: 'answer',
        text: responseMatch[1] || line
      });
    } else if (isCodeBlock && line.length > 10) {
      flushParagraph();
      flushList();
      blocks.push({
        type: 'code',
        text: line.replace(/^```[a-z]*\n?|```$/g, '')
      });
    } else if (orderedMatch) {
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
        if (block.type === 'question') {
          return (
            <div
              key={idx}
              className="story-question-item"
              style={{
                marginTop: '0.65rem',
                padding: '0.85rem 1.1rem',
                borderRadius: '10px',
                backgroundColor: 'rgba(59, 130, 246, 0.06)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem'
              }}
            >
              <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#60a5fa', letterSpacing: '0.04em' }}>
                {block.qNum ? `Question ${block.qNum}` : 'Interview Question'}
              </span>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.55 }}>
                {renderInlineWithLinks(block.text)}
              </p>
            </div>
          );
        }
        if (block.type === 'answer') {
          return (
            <div
              key={idx}
              className="story-answer-item"
              style={{
                marginLeft: '0.75rem',
                marginBottom: '0.35rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                borderLeft: '3px solid #10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
              }}
            >
              <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#10b981', letterSpacing: '0.04em' }}>
                Candidate's Response
              </span>
              <p style={{ margin: 0, fontSize: '0.96rem', lineHeight: 1.65, color: 'var(--text-secondary)' }}>
                {renderInlineWithLinks(block.text)}
              </p>
            </div>
          );
        }
        if (block.type === 'code') {
          return (
            <pre
              key={idx}
              className="story-code-block"
              style={{
                margin: '0.5rem 0',
                padding: '0.85rem 1.1rem',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '0.88rem',
                lineHeight: 1.6,
                overflowX: 'auto',
                color: 'var(--text-primary)'
              }}
            >
              <code>{block.text}</code>
            </pre>
          );
        }
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
