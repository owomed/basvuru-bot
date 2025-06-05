const { Client, Intents, Permissions, MessageEmbed } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_INTEGRATIONS,
  ],
});

// BOT BAĞLANDIĞINDA
client.once('ready', () => {
  client.user.setPresence({
    status: 'dnd',
    activities: [{ name: 'Başvuruları kontrol ediyor', type: 'WATCHING' }],
  });
  console.log(`${client.user.tag} olarak giriş yapıldı ve DND moduna geçildi.`);
});

// INTERACTION BUTTON EVENT
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  let replied = false;
  try {
    await interaction.deferReply({ ephemeral: true });
    replied = true;
  } catch (err) {
    console.error('Interaction yanıtlanamadı, zaman aşımına uğramış olabilir.', err);
    return;
  }

  const { user, customId, guild } = interaction;
  const categoryId = '1268509251911811175';

  // Başvuru türüne göre yapılandırma
  const başvuruConfig = {
    yetkiliBaşvuru: {
      name: `yetkili-${user.username.toLowerCase()}`,
      questions: [
        'İsim ve yaşınız nedir?',
        'Neden bu pozisyona başvuruyorsunuz?',
        'Bir deneyiminiz var mı? Varsa anlatın.',
        'Sunucuda ne kadar aktif olabilirsiniz?',
        'Neden sizi seçmeliyiz?',
      ],
      channelId: '1268544826727600168',
    },
    helperBaşvuru: {
      name: `helper-${user.username.toLowerCase()}`,
      questions: [
        'İsim ve yaşınız nedir?',
        'Helper deneyiminiz var mı? Varsa anlatın.',
        'Sunucuda ne kadar aktif olabilirsiniz?',
        'OwO bot bilginiz nasıl?',
        'Takım metaları bilginiz nedir?',
      ],
      channelId: '1268544982768160788',
    },
  };

  const config = başvuruConfig[customId];
  if (!config) {
    return replied && interaction.editReply({ content: 'Geçersiz buton etkileşimi.' });
  }

  const existingChannel = guild.channels.cache.find((c) => c.name === config.name);
  if (existingChannel) {
    return replied && interaction.editReply({ content: `Zaten bir başvuru kanalınız var: <#${existingChannel.id}>` });
  }

  const newChannel = await guild.channels.create(config.name, {
    type: 'GUILD_TEXT',
    parent: categoryId,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [Permissions.FLAGS.VIEW_CHANNEL] },
      { id: user.id, allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES] },
    ],
  });

  await newChannel.send(`Merhaba ${user}! Başvuru formunu buradan doldurabilirsiniz.\n**Lütfen cevapları sırayla teker teker yazınız.**`);
  for (const q of config.questions) {
    await newChannel.send(`**${q}**`);
  }
  await newChannel.send('Kanal 3 dakika boyunca bir mesaj gönderilmezse kapatılacaktır.');

  if (replied) {
    await interaction.editReply({ content: `Başvuru kanalınız oluşturuldu: ${newChannel}` });
  }

  const filter = (m) => m.author.id === user.id;
  const collector = newChannel.createMessageCollector({ filter, time: 180000 });
  const responses = [];

  collector.on('collect', (m) => responses.push(m.content));

  collector.on('end', async () => {
    if (responses.length === 0) {
      try {
        await user.send('Başvuru formunuzu doldurmadığınız için başvuru kanalınız kapatılacaktır.');
      } catch (e) {
        console.error(`DM gönderilemedi: ${e.message}`);
      }
      await newChannel.send('Kanal 3 dakika içinde yanıt alınmadığı için kapatılmıştır.');
      setTimeout(() => newChannel.delete().catch(() => {}), 30000);
      return;
    }

    const embed = new MessageEmbed()
      .setTitle(customId === 'yetkiliBaşvuru' ? 'Yetkili Başvuru' : 'Helper Başvuru')
      .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
      .setDescription(`**Başvuru yapan:** ${user}`)
      .addFields(
        config.questions.map((q, i) => ({
          name: `❓ ${q}`,
          value: responses[i] || 'Cevap verilmedi',
          inline: false,
        }))
      )
      .setColor('#0099ff')
      .setFooter({ text: guild.name, iconURL: guild.iconURL() })
      .setThumbnail(user.displayAvatarURL())
      .setTimestamp();

    const resultChannel = client.channels.cache.get(config.channelId);
    if (!resultChannel) return console.error('Sonuç kanalı bulunamadı.');

    const sentMessage = await resultChannel.send({ content: '<@&1243478734078742579>', embeds: [embed] });

    await sentMessage.react('<:med_onaylandi:1284130169417764907>');
    await sentMessage.react('<:med_reddedildi:1284130046902145095>');

    const reactionFilter = (reaction, reactor) =>
      ['1284130169417764907', '1284130046902145095'].includes(reaction.emoji.id) &&
      guild.members.cache.get(reactor.id)?.roles.cache.hasAny(
        '1243478734078742579',
        '1216094391060529393',
        '1188389290292551740'
      );

    const reactionCollector = sentMessage.createReactionCollector({ filter: reactionFilter, max: 1, time: 600000 });

    reactionCollector.on('collect', async (reaction, reactor) => {
      const onay = reaction.emoji.id === '1284130169417764907';
      const başvuruTürü = customId === 'yetkiliBaşvuru' ? 'Yetkili' : 'Helper';

      const sonuçEmbed = new MessageEmbed()
        .setTitle('Başvurunuz sonuçlandı')
        .setAuthor('MED Başvuru')
        .setDescription(
          `\`Başvuru yapan:\` \n${user}\n` +
          `${başvuruTürü} başvurunuz <@${reactor.id}> kişisi tarafından ${onay ? 'onaylandı <:med_onaylandi:1284130169417764907>' : 'reddedildi <:med_reddedildi:1284130046902145095>'}`
        )
        .setColor(onay ? '#00ff00' : '#ff0000')
        .setFooter({ text: `${guild.name} 🤍 | ${başvuruTürü} Başvurusu`, iconURL: guild.iconURL() });

      const sonuçKanalı = client.channels.cache.get('1277638999464214558');
      if (sonuçKanalı) {
        await sonuçKanalı.send({ embeds: [sonuçEmbed] });
      } else {
        console.error('Sonuç kanalı bulunamadı.');
      }
    });

    await newChannel.send('Başvurunuz alınmıştır. Kanal 5 saniye içinde siliniyor.');
    setTimeout(() => newChannel.delete().catch(() => {}), 5000);
  });
});

client.login(process.env.TOKEN);
