import { Children, cloneElement, isValidElement, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Check, Copy, ExternalLink, Github, Globe, Instagram } from 'lucide-react';
import { domainOf, safeUrl } from '../utils/formatters';

function nodeText(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (isValidElement(node)) return nodeText(node.props.children);
  return '';
}

function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);
  const codeEl = Array.isArray(children) ? children[0] : children;
  const className = codeEl?.props?.className || '';
  const lang = (className.match(/language-([\w+-]+)/) || [])[1] || '';
  const text = nodeText(codeEl?.props?.children).replace(/\n$/, '');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="codeblock">
      <div className="codeblock-bar">
        <span className="codeblock-lang">{lang || 'code'}</span>
        <button className="codeblock-copy" onClick={copy} aria-label="Copy code">
          {copied ? <Check size={14} /> : <Copy size={14} />}<span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  );
}

function ImagePreview({ src, alt = 'Image preview' }) {
  const [failed, setFailed] = useState(false);
  return (
    <a className="markdown-image-link" href={src} target="_blank" rel="noopener noreferrer">
      {failed
        ? <span className="markdown-image-fallback">Open image</span>
        : <img className="markdown-image" src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />}
    </a>
  );
}

function SafeLink({ href, children }) {
  const ok = safeUrl(href) || (/^mailto:/i.test(href || '') ? href : null);
  if (!ok) return <span>{children}</span>;
  if (safeUrl(ok) && isImageUrl(ok)) {
    const label = nodeText(children).trim();
    const alt = label && !safeUrl(label) ? label : 'Image preview';
    return <ImagePreview src={ok} alt={alt} />;
  }
  return (
    <a className="markdown-link" href={ok} target="_blank" rel="noopener noreferrer">
      <span>{children}</span><ExternalLink size={13} aria-hidden="true" />
    </a>
  );
}

function MarkdownParagraph({ children }) {
  const blocks = Children.toArray(children).filter(
    (child) => !(typeof child === 'string' && !child.trim())
  );
  const link = blocks.length === 1 && isValidElement(blocks[0]) && blocks[0].type === SafeLink
    ? blocks[0]
    : null;
  const href = link && safeUrl(link.props.href);

  if (!href) return <p>{children}</p>;

  const domain = domainOf(href);
  const label = nodeText(link.props.children).trim() || domain;
  const BrandIcon = /(^|\.)github\.com$/i.test(domain)
    ? Github
    : /(^|\.)instagram\.com$/i.test(domain)
      ? Instagram
      : Globe;

  return (
    <a className="markdown-link-card" href={href} target="_blank" rel="noopener noreferrer">
      <BrandIcon size={19} aria-hidden="true" />
      <span className="markdown-link-card-copy">
        <span className="markdown-link-card-title">{label}</span>
        <span className="markdown-link-card-domain">{domain}</span>
      </span>
      <ExternalLink size={16} aria-hidden="true" />
    </a>
  );
}

function isImageUrl(value) {
  try {
    const url = new URL(value);
    return (
      /\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(url.pathname) ||
      /(^|\.)images\.unsplash\.com$/i.test(url.hostname) ||
      /(^|\.)images\.pexels\.com$/i.test(url.hostname) ||
      /(^|\.)i\.imgur\.com$/i.test(url.hostname) ||
      /(^|\.)media\.giphy\.com$/i.test(url.hostname) ||
      /(^|\.)lh3\.googleusercontent\.com$/i.test(url.hostname) ||
      /(?:^|&)(?:fm|format)=(?:avif|gif|jpe?g|png|webp)(?:&|$)/i.test(url.search.slice(1))
    );
  } catch {
    return false;
  }
}

function SafeImage({ src, alt = '' }) {
  const ok = safeUrl(src);
  if (!ok) return null;
  return <ImagePreview src={ok} alt={alt || 'Image preview'} />;
}

function findImageSource(node) {
  if (Array.isArray(node)) {
    for (const child of node) {
      const src = findImageSource(child);
      if (src) return src;
    }
    return null;
  }
  if (isValidElement(node)) {
    const src = safeUrl(node.props.href) || safeUrl(node.props.src);
    return src || findImageSource(node.props.children);
  }
  return safeUrl(nodeText(node));
}

function MarkdownTable({ children }) {
  const sections = Children.toArray(children);
  const header = sections.find((section) => isValidElement(section) && section.type === 'thead');
  const headerRow = header && Children.toArray(header.props.children).find(isValidElement);
  const imageColumns = new Set(
    (headerRow ? Children.toArray(headerRow.props.children) : [])
      .map((cell, index) => ({ cell, index }))
      .filter(({ cell }) => isValidElement(cell) && /\b(image|photo|picture|thumbnail|preview)\b/i.test(nodeText(cell.props.children)))
      .map(({ index }) => index)
  );
  if (!imageColumns.size) return <div className="table-wrap"><table>{children}</table></div>;

  const renderedSections = sections.map((section) => {
    if (!isValidElement(section) || section.type !== 'tbody') return section;
    const rows = Children.map(section.props.children, (row) => {
      if (!isValidElement(row)) return row;
      const cells = Children.map(row.props.children, (cell, index) => {
        if (!imageColumns.has(index) || !isValidElement(cell)) return cell;
        const src = findImageSource(cell.props.children);
        return src
          ? cloneElement(cell, {}, <ImagePreview src={src} alt={nodeText(cell.props.children).trim() || 'Image preview'} />)
          : cell;
      });
      return cloneElement(row, {}, cells);
    });
    return cloneElement(section, {}, rows);
  });

  return <div className="table-wrap"><table>{renderedSections}</table></div>;
}

const components = {
  p: MarkdownParagraph,
  pre: CodeBlock,
  a: SafeLink,
  img: SafeImage,
  table: MarkdownTable,
};

export default function MarkdownContent({ children }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
