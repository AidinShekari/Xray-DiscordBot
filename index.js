const { Client, Intents, MessageEmbed, WebhookClient } = require('discord.js');
const client = new Client({
  intents: [1, 2, 1 << 9, 1 << 12]
});
const fs = require('fs');
const moment = require('moment');
const geoip = require('geoip-lite');

moment.suppressDeprecationWarnings = true;

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const API_URL = 'https://yoururl:panelport';

const lastOnline = new Map();

const whitelist = [];

client.once('ready', () => {
  const guildId = 'guildid'; 
  const channelId = 'channelid'; 

  const guild = client.guilds.cache.get(guildId);
  const channel = guild.channels.cache.get(channelId);

  if (!guild) {
    console.log('Could not find the guild');
    return;
  }

  if (!channel) {
    console.log('Could not find the channel');
    return;
  }

  setInterval(() => {
    const lastOnline = new Map(); 
    fs.readFile('/root/vpndb.json', 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading vpndb.json:', err);
        return;
      }

      const vpndb = JSON.parse(data);

      const now = new Date().toLocaleString();

      const embed = new MessageEmbed()
        .setTitle('📃 Last Connection Of Users')
        .setColor('#FFFFFF')
        .setDescription(`🔃 Pending Requests...`)
        .setFooter({ text: `🪐 Powered By Shekari • ${moment(now).format('h:mm A')}` });

        Object.entries(vpndb).forEach(([email, { time, ip }]) => {
          const name = email.split('@')[0];
        
          if (whitelist.includes(name)) {
            return;
          }
        
        let onlineTime;
        const duration = moment.duration(moment().diff(moment(time)));
        if (duration.asSeconds() < 60) {
          onlineTime = `🟢 ${duration.humanize()} (${moment(time).format('DD/MM/YYYY HH:mm:ss')})`;
        } else if (duration.asMinutes() < 60) {
          onlineTime = `🟡 ${duration.humanize()} (${moment(time).format('DD/MM/YYYY HH:mm:ss')})`;
        } else {
          onlineTime = `🔴 ${duration.humanize()} (${moment(time).format('DD/MM/YYYY HH:mm:ss')})`;
        }

        onlineTime = `${onlineTime}`;

        lastOnline.set(email, onlineTime);
      });

      const sortedLastOnline = new Map([...lastOnline.entries()].sort((a, b) => {
        const aTime = moment(a[1].match(/\((.*)\)/)[1], 'DD/MM/YYYY HH:mm:ss');
        const bTime = moment(b[1].match(/\((.*)\)/)[1], 'DD/MM/YYYY HH:mm:ss');

        if (aTime.isAfter(bTime)) {
          return -1; 
        } else if (aTime.isBefore(bTime)) {
          return 1; 
        } else {
          return 0; 
        }
      }));

      sortedLastOnline.forEach((value, key) => {
        const name = key.split('@')[0]; 
        embed.addField(name, value.replace(' (', '\n('), true);
      });
	  
	  const greenGlobeUsers = Array.from(sortedLastOnline.values()).filter(value => {
		return value.includes('🟢');
		}).length;
		client.user.setActivity(`🟢 ${greenGlobeUsers} Active Client`, { type: 'WATCHING' });

      channel.messages.fetch('messagechannelid').then(message => {
        message.edit({ embeds: [embed] });
      }).catch(err => console.log(err));
    });
  }, 30000);
  client.application.commands.create({
    name: 'userstats',
    description: 'Get user statistics',
    options: [
      {
        name: 'username',
        description: 'The username to retrieve stats for',
        type: 'STRING',
        required: true
      }
    ]
  });

  client.application.commands.create({
    name: 'addinbound',
    description: 'Add an inbound',
    options: [
      {
        name: 'inboundid',
        description: 'The ID of the inbound',
        type: 'INTEGER',
        required: true
      },
      {
        name: 'email',
        description: 'The email of the inbound',
        type: 'STRING',
        required: true
      },
      {
        name: 'limitip',
        description: 'The IP limit of the inbound',
        type: 'INTEGER',
        required: true
      },
      {
        name: 'totalgb',
        description: 'The total GB of the inbound',
        type: 'INTEGER',
        required: true
      },
      {
        name: 'expirytime',
        description: 'The expiry time of the inbound',
        type: 'INTEGER',
        required: true
      },
      {
        name: 'enable',
        description: 'The enable status of the inbound',
        type: 'BOOLEAN',
        required: true
      },
      {
        name: 'tgid',
        description: 'The Telegram ID of the inbound',
        type: 'STRING',
        required: true
      },
      {
        name: 'subid',
        description: 'The subscription ID of the inbound',
        type: 'STRING',
        required: true
      }
    ]
  });
});

async function getSessionCookie() {
  try {
    const loginResponse = await axios.post(`${API_URL}/paneldirect/login`, 'username=username&password=password', {
      headers: {
        'Accept-Language': 'en-US',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
    });

    const sessionCookie = loginResponse.headers['set-cookie'][0];
    return sessionCookie;
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = interaction.commandName;
  if (command === 'userstats') {
    const username = interaction.options.getString('username');
    const sessionCookie = await getSessionCookie();

    if (!sessionCookie) {
      interaction.reply('Failed to get session cookie. Please check the login credentials.');
      return;
    }

    const userStats = await getUserStats(username, sessionCookie);

    if (!userStats) {
      interaction.reply(`Failed to get user stats for ${username}.`);
      return;
    }

    interaction.reply({ embeds: [userStats] });
  }
  else if (command === 'addinbound') {  
    const inboundId = interaction.options.getInteger('inboundid');
    const email = interaction.options.getString('email');
    const limitIp = interaction.options.getInteger('limitip');
    const totalGB = interaction.options.getInteger('totalgb');
    const expiryTimeDays = interaction.options.getInteger('expirytime');
    const enable = interaction.options.getBoolean('enable');
    const tgId = interaction.options.getString('tgid');
    const subId = interaction.options.getString('subid');
    
    const expiryTimestamp = moment().add(expiryTimeDays, 'days').valueOf();
  
    const settings = {
      id: inboundId,
      settings: JSON.stringify({
        clients: [{
          id: uuidv4(),
          alterId: 0,
          email: email,
          limitIp: limitIp,
          totalGB: totalGB,
          expiryTime: expiryTimestamp,
          enable: enable,
          tgId: tgId,
          subId: subId
        }]
      })
    };
  
    const sessionCookie = await getSessionCookie();
  
    if (!sessionCookie) {
      interaction.reply('Failed to get session cookie. Please check the login credentials.');
      return;
    }
  
    try {
      const addInboundResponse = await axios.post(`${API_URL}/panel/api/inbounds/addClient`, settings, {
        headers: {
          'Accept-Language': 'en-US',
          'Cookie': sessionCookie,
          'Content-Type': 'application/json'
        }
      });
  
      if (addInboundResponse.data.success) {
        interaction.reply(`Successfully added inbound with ID ${inboundId}`);
      } else {
        interaction.reply('Failed to add inbound. Please check the input parameters.');
      }
    } catch (error) {
      console.error('Add inbound error:', error);
      interaction.reply('Failed to add inbound. An error occurred.');
    }
  }
});

  async function getUserStats(username, sessionCookie) {
    try {
      const userStatsResponse = await axios.get(`${API_URL}/panel/api/inbounds/getClientTraffics/${username}`, {
        headers: {
          'Accept-Language': 'en-US',
          'Cookie': sessionCookie,
        },
      });
  
      const userStatsData = userStatsResponse.data;
      let expiryTime;

      const TotalUsage = ((userStatsData.obj.down + userStatsData.obj.up) / (1024 * 1024 * 1024)).toFixed(2);

      if (userStatsData.obj.expiryTime === 0) {
        expiryTime = 'No Expiry Time';
      } else {
        expiryTime = moment(userStatsData.obj.expiryTime).format('YYYY-MM-DD HH:mm:ss');
      }
  
      if (userStatsData.success && userStatsData.obj) {
        const userStatsEmbed = new MessageEmbed()
          .setColor('#0099ff')
          .setTitle(':bar_chart: User Statistics')
          .setDescription(`User stats for ${userStatsData.obj.email}`)
          .addFields(
            { name: ':email: Email', value: userStatsData.obj.email.toString(), inline: true },
            { name: ':id: ID', value: userStatsData.obj.id.toString(), inline: true },
            { name: ':inbox_tray: Inbound ID', value: userStatsData.obj.inboundId.toString(), inline: true },
            { name: ':lock: Enabled', value: userStatsData.obj.enable ? 'Yes' : 'No', inline: true },
            { name: ':arrow_up: Up', value: `${(userStatsData.obj.up / (1024 * 1024 * 1024)).toFixed(2)} GB`, inline: true },
            { name: ':arrow_down: Down', value: `${(userStatsData.obj.down / (1024 * 1024 * 1024)).toFixed(2)} GB`, inline: true },
            { name: ':chart_with_upwards_trend: Total Usage', value: `${TotalUsage} GB`, inline: true },
            { name: ':alarm_clock: Expiry Time', value: expiryTime, inline: true }
            )
        return userStatsEmbed;
      } else {
        throw new Error(userStatsData.msg || 'User stats not found.');
      }
    } catch (error) {
      console.error('User stats error:', error);
      return null;
    }
  }

client.login('bottoken');