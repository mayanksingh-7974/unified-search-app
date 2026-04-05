// ============================================
// SLACK CONTROLLER
// Path: backend/controllers/slackController.js
// Copy entire content
// ============================================

const { WebClient } = require('@slack/web-api');

const slack = new WebClient(process.env.SLACK_TOKEN);

// ============================================
// GET ALL SLACK CHANNELS
// ============================================

async function getSlackChannels() {
  try {
    console.log('  → Fetching Slack channels...');
    
    const result = await slack.conversations.list({
      types: 'public_channel,private_channel',
      limit: 100
    });

    if (!result.channels) {
      return [];
    }

    const channels = result.channels
      .filter(c => !c.is_archived)
      .map(channel => ({
        id: channel.id,
        name: channel.name,
        isPrivate: channel.is_private,
        memberCount: channel.num_members || 0,
        topic: channel.topic?.value || '',
        created: new Date(channel.created * 1000)
      }));

    console.log(`  ✓ Found ${channels.length} Slack channels`);
    return channels;
  } catch (error) {
    console.error('  ✗ Slack channels error:', error.message);
    throw error;
  }
}

// ============================================
// SEARCH SLACK MESSAGES
// ============================================

async function searchSlackMessages(query) {
  try {
    console.log(`  → Searching Slack for: "${query}"`);
    
    const result = await slack.search.messages({
      query: query,
      count: 50,
      sort: 'timestamp',
      sort_dir: 'desc'
    });

    if (!result.messages || !result.messages.matches) {
      console.log('  ✓ No Slack results found');
      return [];
    }

    const messages = result.messages.matches
      .slice(0, 20) // Limit to 20 results
      .map(msg => {
        try {
          return {
            id: msg.ts || `slack-${Date.now()}`,
            title: msg.text?.substring(0, 100) || 'Slack Message',
            text: msg.text || '',
            content: msg.text?.substring(0, 300) || '',
            channel: msg.channel?.name || 'unknown',
            channelId: msg.channel?.id || '',
            user: msg.user || 'unknown',
            username: msg.username || 'unknown',
            timestamp: new Date(parseInt(msg.ts) * 1000),
            platform: 'Slack',
            type: 'message',
            url: msg.permalink || '#',
            reactions: msg.reactions?.length || 0,
            score: (msg.text?.match(new RegExp(query, 'gi')) || []).length
          };
        } catch (e) {
          console.error('  ✗ Error mapping message:', e.message);
          return null;
        }
      })
      .filter(m => m !== null);

    console.log(`  ✓ Found ${messages.length} Slack messages`);
    return messages;
  } catch (error) {
    console.error('  ✗ Slack search error:', error.message);
    // Return empty array instead of throwing
    return [];
  }
}

// ============================================
// GET MESSAGES FROM SPECIFIC CHANNEL
// ============================================

async function getSlackMessages(channelName, limit = 50) {
  try {
    console.log(`  → Fetching messages from #${channelName}...`);
    
    // Get channel ID from name
    const channels = await slack.conversations.list();
    const channel = channels.channels.find(c => c.name === channelName);

    if (!channel) {
      throw new Error(`Channel "#${channelName}" not found`);
    }

    // Get messages from channel
    const result = await slack.conversations.history({
      channel: channel.id,
      limit: limit
    });

    const messages = result.messages
      .map(msg => ({
        id: msg.ts,
        text: msg.text || '(no text)',
        user: msg.user,
        timestamp: new Date(parseInt(msg.ts) * 1000),
        reactions: msg.reactions || [],
        threadTs: msg.thread_ts,
        replyCount: msg.reply_count || 0
      }))
      .reverse();

    console.log(`  ✓ Found ${messages.length} messages in #${channelName}`);
    return messages;
  } catch (error) {
    console.error('  ✗ Error fetching channel messages:', error.message);
    throw error;
  }
}

// ============================================
// GET USER INFO
// ============================================

async function getSlackUserInfo(userId) {
  try {
    const result = await slack.users.info({
      user: userId
    });

    return {
      id: result.user.id,
      name: result.user.name,
      displayName: result.user.real_name || result.user.name,
      email: result.user.profile?.email || '',
      avatar: result.user.profile?.image_72 || '',
      status: result.user.profile?.status_text || ''
    };
  } catch (error) {
    console.error('  ✗ Error fetching user info:', error.message);
    return null;
  }
}

// ============================================
// GET WORKSPACE INFO
// ============================================

async function getWorkspaceInfo() {
  try {
    const result = await slack.team.info();
    
    return {
      id: result.team.id,
      name: result.team.name,
      domain: result.team.domain,
      icon: result.team.icon?.image_132 || ''
    };
  } catch (error) {
    console.error('  ✗ Error fetching workspace info:', error.message);
    return null;
  }
}

module.exports = {
  getSlackChannels,
  getSlackMessages,
  searchSlackMessages,
  getSlackUserInfo,
  getWorkspaceInfo
};