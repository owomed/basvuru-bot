const {
  MessageActionRow,
  MessageButton,
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');

// Slash komutu için gerekli olan veriyi oluşturur.
const slashCommandData = new SlashCommandBuilder()
  .setName('şikayet')
  .setDescription('Üst yetkililere iletmek için bir şikayet butonu gönderir.');

module.exports = {
  // Komutun hem slash hem de prefix komutlarında ortak olarak çalışacak olan işlevi.
  async execute(interactionOrMessage) {
    const isSlashCommand = interactionOrMessage.isCommand();
    const replyTarget = isSlashCommand ? interactionOrMessage : interactionOrMessage;

    // Hedef kanal ID'sini buraya ekleyin
    const targetChannelId = '1243477348746268734';
    const targetChannel = interactionOrMessage.client.channels.cache.get(targetChannelId);

    if (!targetChannel) {
      return replyTarget.reply({
        content: 'Hedef kanal bulunamadı.',
        ephemeral: true
      });
    }

    const textMessage = `
\`\`\`diff
- Bir yetkilinin size gereksiz bir şekilde ceza verdiğini veya yanlış anladığını mı düşünüyorsunuz?
\`\`\`
\`\`\`yaml
=> Ya da bir konu hakkında şikayetiniz mi var?
\`\`\`
\`\`\`diff
+ Bunu üst kademedeki yetkililere iletmek için aşağıdan \`Üst Yetkiliyle Görüş\` butonuna basabilirsiniz.
\`\`\`
    `;

    const row = new MessageActionRow()
      .addComponents(
        new MessageButton()
        .setCustomId('görüş')
        .setLabel('Üst Yetkiliyle Görüş')
        .setStyle('DANGER')
      );

    try {
      await targetChannel.send({
        content: textMessage,
        components: [row]
      });

      if (isSlashCommand) {
        await replyTarget.reply({
          content: `Mesaj başarıyla ${targetChannel} kanalına gönderildi.`,
          ephemeral: true
        });
      } else {
        await replyTarget.react('✅');
      }

    } catch (error) {
      console.error('Mesaj gönderme hatası:', error);
      replyTarget.reply({
        content: 'Mesaj gönderilirken bir hata oluştu.',
        ephemeral: true
      });
    }
  },

  // Slash komut verisi
  data: slashCommandData,
};
