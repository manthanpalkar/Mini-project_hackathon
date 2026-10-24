import { useEffect } from 'react';
import BRAND from '../constants/branding';

const SITE_URL = BRAND.portalUrl;
const DEFAULT_TITLE = `${BRAND.fullName} | ${BRAND.collegeShort}`;
const DEFAULT_DESCRIPTION = `${BRAND.tagline} ${BRAND.shortDescription}`;
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

function setMetaTag(name, content, attributeName = 'name') {
  if (!content) return;
  let element = document.querySelector(`meta[${attributeName}="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attributeName, name);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setCanonical(url) {
  if (!url) return;
  let element = document.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', url);
}

export default function SEOHead({
  title,
  description = DEFAULT_DESCRIPTION,
  canonicalUrl,
  ogType = 'website',
  ogImage = DEFAULT_IMAGE,
  keywords,
  noIndex = false,
  structuredData,
  breadcrumbs
}) {
  const fullTitle = title ? (title.includes('LOOP') ? title : `${title} | LOOP SPIT`) : DEFAULT_TITLE;
  const canonical = canonicalUrl ? (canonicalUrl.startsWith('http') ? canonicalUrl : `${SITE_URL}${canonicalUrl}`) : SITE_URL;
  const fullOgImage = ogImage.startsWith('http') ? ogImage : `${SITE_URL}${ogImage.startsWith('/') ? '' : '/'}${ogImage}`;

  useEffect(() => {
    // 1. Primary document title
    document.title = fullTitle;

    // 2. Standard Meta Tags
    setMetaTag('title', fullTitle, 'name');
    setMetaTag('description', description, 'name');
    if (keywords) {
      setMetaTag('keywords', keywords, 'name');
    }
    setMetaTag('robots', noIndex ? 'noindex, nofollow' : 'index, follow', 'name');

    // 3. Canonical Link
    setCanonical(canonical);

    // 4. Open Graph Meta Tags
    setMetaTag('og:title', fullTitle, 'property');
    setMetaTag('og:description', description, 'property');
    setMetaTag('og:url', canonical, 'property');
    setMetaTag('og:type', ogType, 'property');
    setMetaTag('og:image', fullOgImage, 'property');
    setMetaTag('og:site_name', BRAND.fullName, 'property');
    setMetaTag('og:locale', 'en_US', 'property');

    // 5. Twitter Card Meta Tags
    setMetaTag('twitter:card', 'summary_large_image', 'name');
    setMetaTag('twitter:title', fullTitle, 'name');
    setMetaTag('twitter:description', description, 'name');
    setMetaTag('twitter:image', fullOgImage, 'name');
    setMetaTag('twitter:url', canonical, 'name');

    // 6. Schema.org JSON-LD Structured Data
    const existingScript = document.getElementById('loop-seo-structured-data');
    if (existingScript) {
      existingScript.remove();
    }

    const schemasToInject = [];

    // Optional breadcrumb list generator
    if (breadcrumbs && Array.isArray(breadcrumbs) && breadcrumbs.length > 0) {
      schemasToInject.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((crumb, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: crumb.name,
          item: crumb.url.startsWith('http') ? crumb.url : `${SITE_URL}${crumb.url}`
        }))
      });
    }

    if (structuredData) {
      if (Array.isArray(structuredData)) {
        schemasToInject.push(...structuredData);
      } else {
        schemasToInject.push(structuredData);
      }
    }

    if (schemasToInject.length > 0) {
      const scriptTag = document.createElement('script');
      scriptTag.id = 'loop-seo-structured-data';
      scriptTag.type = 'application/ld+json';
      scriptTag.textContent = JSON.stringify(schemasToInject.length === 1 ? schemasToInject[0] : schemasToInject);
      document.head.appendChild(scriptTag);
    }

    return () => {
      const cleanupScript = document.getElementById('loop-seo-structured-data');
      if (cleanupScript) {
        cleanupScript.remove();
      }
    };
  }, [fullTitle, description, canonical, ogType, fullOgImage, keywords, noIndex, structuredData, breadcrumbs]);

  return null;
}
