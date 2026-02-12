const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Fetch metadata from a URL (Open Graph, Twitter Cards, etc.)
 * @param {String} url - URL to fetch metadata from
 * @returns {Promise<Object>} Metadata object
 */
const fetchLinkMetadata = async (url) => {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const metadata = {
      title: '',
      description: '',
      image: '',
      siteName: '',
      favicon: ''
    };

    // Try Open Graph tags first
    metadata.title = $('meta[property="og:title"]').attr('content') || 
                     $('meta[name="twitter:title"]').attr('content') ||
                     $('title').text() || '';
    
    metadata.description = $('meta[property="og:description"]').attr('content') ||
                          $('meta[name="twitter:description"]').attr('content') ||
                          $('meta[name="description"]').attr('content') || '';
    
    metadata.image = $('meta[property="og:image"]').attr('content') ||
                    $('meta[name="twitter:image"]').attr('content') || '';
    
    metadata.siteName = $('meta[property="og:site_name"]').attr('content') || 
                       new URL(url).hostname.replace('www.', '');

    // Get favicon
    const faviconHref = $('link[rel="icon"]').attr('href') ||
                       $('link[rel="shortcut icon"]').attr('href') ||
                       $('link[rel="apple-touch-icon"]').attr('href') || '';
    
    if (faviconHref) {
      metadata.favicon = faviconHref.startsWith('http') 
        ? faviconHref 
        : new URL(faviconHref, url).href;
    } else {
      // Try default favicon location
      try {
        const baseUrl = new URL(url);
        metadata.favicon = `${baseUrl.protocol}//${baseUrl.host}/favicon.ico`;
      } catch (e) {
        // Ignore
      }
    }

    return metadata;
  } catch (error) {
    console.error('Error fetching link metadata:', error.message);
    // Return basic metadata from URL
    try {
      const urlObj = new URL(url);
      return {
        title: urlObj.hostname.replace('www.', ''),
        description: '',
        image: '',
        siteName: urlObj.hostname.replace('www.', ''),
        favicon: `${urlObj.protocol}//${urlObj.host}/favicon.ico`
      };
    } catch (e) {
      return {
        title: url,
        description: '',
        image: '',
        siteName: '',
        favicon: ''
      };
    }
  }
};

module.exports = { fetchLinkMetadata };
