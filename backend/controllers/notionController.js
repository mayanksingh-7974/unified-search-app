// ============================================
// NOTION CONTROLLER
// Path: backend/controllers/notionController.js
// Copy entire content
// ============================================

const { Client } = require('@notionhq/client');

const notion = new Client({
  auth: process.env.NOTION_API_KEY
});

// ============================================
// GET ALL DATABASES
// ============================================

async function getNotionDatabases() {
  try {
    console.log('  → Fetching Notion databases...');
    
    const response = await notion.search({
      filter: {
        property: 'object',
        value: 'database'
      },
      page_size: 100
    });

    const databases = response.results
      .map(db => {
        let title = 'Untitled';
        if (db.title && db.title.length > 0) {
          title = db.title[0]?.plain_text || 'Untitled';
        }
        
        return {
          id: db.id,
          title: title,
          icon: db.icon?.emoji || '📊',
          created: db.created_time,
          lastEdited: db.last_edited_time
        };
      });

    console.log(`  ✓ Found ${databases.length} Notion databases`);
    return databases;
  } catch (error) {
    console.error('  ✗ Notion databases error:', error.message);
    return [];
  }
}

// ============================================
// SEARCH NOTION PAGES
// ============================================

async function searchNotionPages(query) {
  try {
    console.log(`  → Searching Notion for: "${query}"`);
    
    const response = await notion.search({
      query: query,
      page_size: 50
    });

    const results = [];

    for (const page of response.results.slice(0, 20)) {
      try {
        if (page.object === 'page' && page.id) {
          const title = extractTitle(page.properties) || page.id;
          const content = await extractPageContent(page.id);

          results.push({
            id: page.id,
            title: title,
            content: content,
            preview: content.substring(0, 300),
            url: page.url || `https://notion.so/${page.id}`,
            timestamp: page.last_edited_time,
            created: page.created_time,
            platform: 'Notion',
            type: 'document',
            icon: page.icon?.emoji || '📄'
          });
        }
      } catch (pageError) {
        console.error(`    ✗ Error processing page ${page.id}:`, pageError.message);
      }
    }

    console.log(`  ✓ Found ${results.length} Notion pages`);
    return results;
  } catch (error) {
    console.error('  ✗ Notion search error:', error.message);
    return [];
  }
}

// ============================================
// GET PAGES FROM DATABASE
// ============================================

async function getNotionPages(databaseId, limit = 100) {
  try {
    console.log(`  → Fetching Notion pages from database...`);
    
    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: limit
    });

    const pages = response.results
      .map(page => {
        try {
          const title = extractTitle(page.properties) || 'Untitled';
          return {
            id: page.id,
            title: title,
            url: page.url,
            created: page.created_time,
            lastEdited: page.last_edited_time,
            properties: page.properties
          };
        } catch (e) {
          return null;
        }
      })
      .filter(p => p !== null);

    console.log(`  ✓ Found ${pages.length} Notion pages`);
    return pages;
  } catch (error) {
    console.error('  ✗ Error fetching Notion pages:', error.message);
    return [];
  }
}

// ============================================
// EXTRACT TITLE FROM PAGE PROPERTIES
// ============================================

function extractTitle(properties) {
  try {
    if (!properties) return 'Untitled';

    // Look for title property
    for (const key in properties) {
      const prop = properties[key];
      if (prop.type === 'title' && prop.title && prop.title.length > 0) {
        return prop.title[0]?.plain_text || 'Untitled';
      }
    }

    // Look for name property
    for (const key in properties) {
      const prop = properties[key];
      if (prop.type === 'rich_text' && prop.rich_text && prop.rich_text.length > 0) {
        const text = prop.rich_text[0]?.plain_text;
        if (text) return text;
      }
    }

    return 'Untitled';
  } catch (error) {
    console.error('  ✗ Error extracting title:', error.message);
    return 'Untitled';
  }
}

// ============================================
// EXTRACT PAGE CONTENT
// ============================================

async function extractPageContent(pageId, limit = 10) {
  try {
    const blocks = await notion.blocks.children.list({
      block_id: pageId,
      page_size: limit
    });

    let content = '';

    for (const block of blocks.results) {
      try {
        switch (block.type) {
          case 'paragraph':
            if (block.paragraph?.rich_text) {
              const text = block.paragraph.rich_text
                .map(t => t.plain_text)
                .join('');
              if (text) content += text + ' ';
            }
            break;
          
          case 'heading_1':
            if (block.heading_1?.rich_text) {
              const text = block.heading_1.rich_text
                .map(t => t.plain_text)
                .join('');
              if (text) content += text + ' ';
            }
            break;
          
          case 'heading_2':
            if (block.heading_2?.rich_text) {
              const text = block.heading_2.rich_text
                .map(t => t.plain_text)
                .join('');
              if (text) content += text + ' ';
            }
            break;
          
          case 'heading_3':
            if (block.heading_3?.rich_text) {
              const text = block.heading_3.rich_text
                .map(t => t.plain_text)
                .join('');
              if (text) content += text + ' ';
            }
            break;
          
          case 'bulleted_list_item':
            if (block.bulleted_list_item?.rich_text) {
              const text = block.bulleted_list_item.rich_text
                .map(t => t.plain_text)
                .join('');
              if (text) content += '• ' + text + ' ';
            }
            break;
          
          case 'numbered_list_item':
            if (block.numbered_list_item?.rich_text) {
              const text = block.numbered_list_item.rich_text
                .map(t => t.plain_text)
                .join('');
              if (text) content += text + ' ';
            }
            break;
          
          case 'to_do':
            if (block.to_do?.rich_text) {
              const text = block.to_do.rich_text
                .map(t => t.plain_text)
                .join('');
              if (text) content += '☐ ' + text + ' ';
            }
            break;
          
          case 'quote':
            if (block.quote?.rich_text) {
              const text = block.quote.rich_text
                .map(t => t.plain_text)
                .join('');
              if (text) content += '"' + text + '" ';
            }
            break;
        }
      } catch (blockError) {
        // Skip blocks that error
      }
    }

    return content.trim().substring(0, 500);
  } catch (error) {
    console.error('  ✗ Error extracting content:', error.message);
    return '';
  }
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

module.exports = {
  getNotionDatabases,
  getNotionPages,
  searchNotionPages,
  extractPageContent,
  extractTitle
};