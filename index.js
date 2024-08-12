const { Client, Intents, MessageEmbed } = require('discord.js');
const fs = require('fs');
const moment = require('moment');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

moment.suppressDeprecationWarnings = true;

const client = new Client({
  intents: [1, 2, 1 << 9, 1 << 12]
});

const API_URL = config.apiUrl;
const DEST = config.destination;
const lastOnline = new Map();
const whitelist = [];
client.once('ready', async () => {
  const guild = client.guilds.cache.get(config.guildId);
  const channel = guild.channels.cache.get(config.channelId);

  if (!guild) {
    console.log('Could not find the guild');
    return;
  }

  if (!channel) {
    console.log('Could not find the channel');
    return;
  }

  if (!config.messageId) {
    const newMessage = await channel.send('📃 Last Connection Of Users');
    
    config.messageId = newMessage.id;
    fs.writeFileSync('config.json', JSON.stringify(config, null, 2), 'utf8');

    console.log(`New message sent and messageId updated to ${newMessage.id}`);
  }

  setInterval(() => {
    fs.readFile(config.vpndbPath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading vpndb.json:', err);
        return;
      }

      const vpndb = JSON.parse(data);
      const now = new Date().toLocaleString();

      const embed = new MessageEmbed()
        .setTitle('📃 Last Connection Of Users')
        .setColor('#FFFFFF')
        .setDescription('🔃 Pending Requests...')
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

        lastOnline.set(email, onlineTime);
      });

      const sortedLastOnline = new Map([...lastOnline.entries()].sort((a, b) => {
        const aTime = moment(a[1].match(/\((.*)\)/)[1], 'DD/MM/YYYY HH:mm:ss');
        const bTime = moment(b[1].match(/\((.*)\)/)[1], 'DD/MM/YYYY HH:mm:ss');

        return aTime.isAfter(bTime) ? -1 : (aTime.isBefore(bTime) ? 1 : 0);
      }));

      sortedLastOnline.forEach((value, key) => {
        const name = key.split('@')[0];
        embed.addField(name, value.replace(' (', '\n('), true);
      });

      const greenGlobeUsers = Array.from(sortedLastOnline.values()).filter(value => value.includes('🟢')).length;
      client.user.setActivity(`🟢 ${greenGlobeUsers} Active Client`, { type: 'WATCHING' });

      channel.messages.fetch(config.messageId).then(message => {
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
    name: 'addclient',
    description: 'Add an client',
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
    const loginResponse = await axios.post(`${API_URL}/${DEST}/login`, {
      username: config.username,
      password: config.password
    }, {
      headers: {
        'Accept-Language': 'en-US',
        'Content-Type': 'application/json'
      },
    });

    const cookies = loginResponse.headers['set-cookie']; 

    const sessionCookies = cookies.filter(cookie => cookie.startsWith('3x-ui='));

    if (sessionCookies.length < 2) {
      console.error('Less than two 3x-ui cookies found.');
      return null;
    }

    const secondSessionCookie = sessionCookies[1];
    const sessionValue = secondSessionCookie ? secondSessionCookie.split(';')[0].split('=')[1] : null;

    if (!sessionValue) {
      console.error('3x-ui cookie not found.');
      return null;
    }

    return sessionValue;

  } catch (error) {
    console.error('Login error:', error.message);
    console.error('Error details:', error.response ? error.response.data : error.message);
    return null;
  }
}

async function getUserStats(username, sessionValue) {
  try {
    const response = await axios.get(
      `${API_URL}/${DEST}/panel/api/inbounds/getClientTraffics/${username}`,
      {
        headers: {
          'Accept': 'application/json',
          'Cookie': `3x-ui=${sessionValue}=; lang=en-US`
        },
      }
    );

    const userStatsData = response.data;
    const { down, up, expiryTime, email, id, inboundId, enable } = userStatsData.obj;

    const TotalUsage = ((down + up) / (1024 * 1024 * 1024)).toFixed(2);
    const formattedExpiryTime = expiryTime === 0 ? 'No Expiry Time' : moment(expiryTime).format('YYYY-MM-DD HH:mm:ss');

    const userStatsEmbed = new MessageEmbed()
      .setColor('#0099ff')
      .setTitle(':bar_chart: User Statistics')
      .setDescription(`User stats for ${email}`)
      .addFields(
        { name: ':email: Email', value: email.toString(), inline: true },
        { name: ':id: ID', value: id.toString(), inline: true },
        { name: ':inbox_tray: Inbound ID', value: inboundId.toString(), inline: true },
        { name: ':lock: Enabled', value: enable ? 'Yes' : 'No', inline: true },
        { name: ':arrow_up: Up', value: `${(up / (1024 * 1024 * 1024)).toFixed(2)} GB`, inline: true },
        { name: ':arrow_down: Down', value: `${(down / (1024 * 1024 * 1024)).toFixed(2)} GB`, inline: true },
        { name: ':chart_with_upwards_trend: Total Usage', value: `${TotalUsage} GB`, inline: true },
        { name: ':alarm_clock: Expiry Time', value: formattedExpiryTime, inline: true }
      );

    return userStatsEmbed;
  } catch (error) {
    console.error('User stats error:', error.message);
    console.error('Error details:', error.response ? error.response.data : error.message);
    return null;
  }
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = interaction.commandName;
  if (command === 'userstats') {
    const username = interaction.options.getString('username');
    const sessionValue = await getSessionCookie();

    if (!sessionValue) {
      interaction.reply('Failed to get session cookie. Please check the login credentials.');
      return;
    }

    const userStats = await getUserStats(username, sessionValue);

    if (!userStats) {
      interaction.reply(`Failed to get user stats for ${username}.`);
      return;
    }

    interaction.reply({ embeds: [userStats] });
  }

  else if (command === 'addclient') {  
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
  
    const sessionValue = await getSessionCookie();
  
    if (!sessionValue) {
      interaction.reply('Failed to get session cookie. Please check the login credentials.');
      return;
    }
  
    try {
      const addInboundResponse = await axios.post(`${API_URL}/${DEST}/panel/api/inbounds/addClient`, settings, {
        headers: {
          'Accept-Language': 'en-US',
          'Cookie': `3x-ui=${sessionValue}=; lang=en-US`,
          'Content-Type': 'application/json'
        }
      });
  
      if (addInboundResponse.data.success) {
        interaction.reply(`Successfully added inbound with ID ${inboundId}\n`);
      } else {
        interaction.reply('Failed to add inbound. Please check the input parameters.');
      }
    } catch (error) {
      console.error('Add inbound error:', error);
      interaction.reply('Failed to add inbound. An error occurred.');
    }
  }
});


client.login(config.token);
