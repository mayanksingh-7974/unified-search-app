// ============================================
// SEARCH CONTROLLER
// Path: backend/controllers/searchController.js
// Copy entire content
// ============================================

const { searchSlackMessages } = require('./slackController');
const { searchNotionPages } = require('./notionController');

// ============================================
// UNIFIED SEARCH ACROSS ALL PLATFORMS
// ============================================

async function searchAcrossPlatforms(query, platform = 'both') {
  try {
    let results = [];
    const startTime = Date.now();

    console.log(`\n📊 STARTING UNIFIED SEARCH`);
    console.log(`   Query: "${query}"`);
    console.log(`   Platform: ${platform}`);

    // Search Slack
    if (platform === 'slack' || platform === 'both') {
      try {
        const slackResults = await searchSlackMessages(query);
        results = [...results, ...slackResults];
      } catch (error) {
        console.error('  ⚠️  Slack search failed:', error.message);
      }
    }

    // Search Notion
    if (platform === 'notion' || platform === 'both') {
      try {
        const notionResults = await searchNotionPages(query);
        results = [...results, ...notionResults];
      } catch (error) {
        console.error('  ⚠️  Notion search failed:', error.message);
      }
    }

    // Sort results by relevance and date
    results = sortResultsByRelevance(results, query);

    const duration = Date.now() - startTime;
    console.log(`\n📈 SEARCH RESULTS`);
    console.log(`   Total Results: ${results.length}`);
    console.log(`   Duration: ${duration}ms`);
    console.log('');

    return results;
  } catch (error) {
    console.error('❌ Unified search error:', error.message);
    return [];
  }
}

// ============================================
// SORT RESULTS BY RELEVANCE
// ============================================

function sortResultsByRelevance(results, query) {
  return results
    .map(result => ({
      ...result,
      relevanceScore: calculateRelevanceScore(result, query)
    }))
    .sort((a, b) => {
      // Sort by relevance score first
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }

      // Then by date (newest first)
      const dateA = new Date(a.timestamp || a.lastEdited || 0);
      const dateB = new Date(b.timestamp || b.lastEdited || 0);
      return dateB - dateA;
    })
    .map(({ relevanceScore, ...result }) => result); // Remove score from result
}

// ============================================
// CALCULATE RELEVANCE SCORE
// ============================================

function calculateRelevanceScore(result, query) {
  if (!query || !result) return 0;

  let score = 0;
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0);

  // Combine all searchable text
  const title = (result.title || '').toLowerCase();
  const text = (result.text || '').toLowerCase();
  const content = (result.content || '').toLowerCase();
  const allText = `${title} ${text} ${content}`;

  // Title match = highest score
  if (title.includes(queryLower)) {
    score += 50;
  }

  // Exact phrase in text = high score
  if (text.includes(queryLower) || content.includes(queryLower)) {
    score += 30;
  }

  // Individual word matches
  for (const word of queryWords) {
    if (word.length > 1) {
      const matches = (allText.match(new RegExp(word, 'g')) || []).length;
      score += matches * 5;
    }
  }

  // Boost Slack results slightly (more recent usually)
  if (result.platform === 'Slack') {
    score += 2;
  }

  return score;
}

// ============================================
// FILTER RESULTS BY TYPE
// ============================================

function filterResultsByType(results, type) {
  if (!type) return results;
  return results.filter(r => r.type === type);
}

// ============================================
// FILTER RESULTS BY DATE RANGE
// ============================================

function filterResultsByDate(results, startDate, endDate) {
  if (!startDate || !endDate) return results;

  const start = new Date(startDate);
  const end = new Date(endDate);

  return results.filter(r => {
    const date = new Date(r.timestamp || r.lastEdited);
    return date >= start && date <= end;
  });
}

// ============================================
// GROUP RESULTS BY PLATFORM
// ============================================

function groupResultsByPlatform(results) {
  return results.reduce((grouped, result) => {
    const platform = result.platform;
    if (!grouped[platform]) {
      grouped[platform] = [];
    }
    grouped[platform].push(result);
    return grouped;
  }, {});
}

// ============================================
// FORMAT RESULTS FOR FRONTEND
// ============================================

function formatResults(results) {
  return results.map(result => ({
    id: result.id,
    title: result.title || 'Untitled',
    platform: result.platform,
    type: result.type,
    url: result.url || '#',
    timestamp: result.timestamp || result.lastEdited,
    preview: (result.content || result.text || 'No preview available').substring(0, 300),
    channel: result.channel || null,
    user: result.user || result.username || null,
    reactions: result.reactions || 0,
    icon: result.icon || (result.platform === 'Slack' ? '💬' : '📄')
  }));
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

module.exports = {
  searchAcrossPlatforms,
  sortResultsByRelevance,
  calculateRelevanceScore,
  filterResultsByType,
  filterResultsByDate,
  groupResultsByPlatform,
  formatResults
};