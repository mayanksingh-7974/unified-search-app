// require("dotenv").config();
// const express = require("express");
// const axios = require("axios");
// const cors = require("cors");

// const app = express();
// app.use(cors());
// app.use(express.json());
// app.use(express.static("public"));

// const PORT = 3000;

// // 🔥 MAIN SEARCH API (combines everything)
// app.get("/search", async (req, res) => {
//   const query = req.query.q;

//   let results = [];

//   // ===== SLACK =====
//   try {
//     const slackRes = await axios.get(
//       "https://slack.com/api/search.messages",
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.SLACK_TOKEN}`,
//         },
//         params: { query },
//       }
//     );

//     const slackData = slackRes.data.messages.matches.map(item => ({
//       platform: "Slack 💬",
//       text: item.text
//     }));

//     results = results.concat(slackData);
//   } catch (err) {
//     console.log("Slack failed");
//   }

//   // ===== NOTION =====
//   try {
//     const notionRes = await axios.post(
//       "https://api.notion.com/v1/search",
//       { query },
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
//           "Notion-Version": "2022-06-28",
//         },
//       }
//     );

//     const notionData = notionRes.data.results.map(item => ({
//       platform: "Notion 📝",
//       text: item.properties?.title?.title?.[0]?.plain_text || "Untitled"
//     }));

//     results = results.concat(notionData);
//   } catch (err) {
//     console.log("Notion failed");
//   }

//   // ===== FALLBACK (VERY IMPORTANT) =====
//   if (results.length === 0) {
//     results = [
//       { platform: "Slack 💬", text: "Project discussion document" },
//       { platform: "Notion 📝", text: "Project documentation and notes" },
//       { platform: "Drive 📁", text: "Final Report.pdf" }
//     ];
//   }

//   res.json(results);
// });

// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });

// ============================================
// UNIFIED SEARCH PLATFORM - SERVER.JS
// Main backend file - Copy entire content
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// IMPORT CONTROLLERS
// ============================================

const { searchAcrossPlatforms } = require('./backend/controllers/searchController');
const { 
  getSlackChannels, 
  searchSlackMessages,
  getSlackUserInfo 
} = require('./backend/controllers/slackController');
const { 
  getNotionDatabases, 
  searchNotionPages 
} = require('./backend/controllers/notionController');

// ============================================
// API ROUTES - SEARCH
// ============================================

// Main unified search endpoint
app.post('/api/search', async (req, res) => {
  try {
    const { query, platform } = req.body;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Query is required',
        success: false 
      });
    }

    console.log(`\n🔍 Search request: "${query}" (${platform || 'both'})`);
    
    const results = await searchAcrossPlatforms(query, platform || 'both');
    
    console.log(`✅ Found ${results.length} results`);
    
    res.json({
      success: true,
      query,
      results,
      totalResults: results.length,
      platform: platform || 'both',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Search error:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Search failed',
      details: error.message 
    });
  }
});

// ============================================
// API ROUTES - SLACK
// ============================================

app.get('/api/slack/channels', async (req, res) => {
  try {
    console.log('📡 Fetching Slack channels...');
    const channels = await getSlackChannels();
    res.json({ 
      success: true, 
      channels,
      count: channels.length 
    });
  } catch (error) {
    console.error('❌ Error fetching channels:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch Slack channels',
      details: error.message 
    });
  }
});

app.get('/api/slack/status', async (req, res) => {
  try {
    const channels = await getSlackChannels();
    res.json({ 
      success: true,
      status: 'connected',
      channelCount: channels.length
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      status: 'error',
      error: error.message 
    });
  }
});

// ============================================
// API ROUTES - NOTION
// ============================================

app.get('/api/notion/databases', async (req, res) => {
  try {
    console.log('📡 Fetching Notion databases...');
    const databases = await getNotionDatabases();
    res.json({ 
      success: true, 
      databases,
      count: databases.length 
    });
  } catch (error) {
    console.error('❌ Error fetching databases:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch Notion databases',
      details: error.message 
    });
  }
});

app.get('/api/notion/status', async (req, res) => {
  try {
    const databases = await getNotionDatabases();
    res.json({ 
      success: true,
      status: 'connected',
      databaseCount: databases.length
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      status: 'error',
      error: error.message 
    });
  }
});

// ============================================
// API ROUTES - HEALTH & STATUS
// ============================================

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'Server is running ✅',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/status', async (req, res) => {
  try {
    const slackStatus = await getSlackChannels()
      .then(() => 'connected')
      .catch(() => 'error');
    
    const notionStatus = await getNotionDatabases()
      .then(() => 'connected')
      .catch(() => 'error');

    res.json({
      success: true,
      slack: {
        status: slackStatus,
        message: slackStatus === 'connected' ? 'Slack API connected' : 'Slack API error'
      },
      notion: {
        status: notionStatus,
        message: notionStatus === 'connected' ? 'Notion API connected' : 'Notion API error'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Status check failed'
    });
  }
}); 

// ============================================
// API ROUTES - HOME
// ============================================

app.get('/api/', (req, res) => {
  res.json({
    name: 'Unified Search API',
    version: '1.0.0',
    endpoints: {
      search: 'POST /api/search',
      slackChannels: 'GET /api/slack/channels',
      notionDatabases: 'GET /api/notion/databases',
      health: 'GET /api/health',
      status: 'GET /api/status'
    }
  });
});

// ============================================
// SERVE FRONTEND
// ============================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.stack);
  res.status(500).json({ 
    success: false,
    error: 'Internal server error',
    details: err.message 
  });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 UNIFIED SEARCH PLATFORM');
  console.log('='.repeat(50));
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📦 Environment: ${NODE_ENV}`);
  console.log(`🔌 CORS enabled`);
  console.log(`📁 Static files: /public`);
  console.log(`🔍 Search endpoint: POST /api/search`);
  console.log('='.repeat(50) + '\n');
});

module.exports = app;