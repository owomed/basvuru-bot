const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');

module.exports = {
  name: 'şikayet',
  aliases: ['ticket'],
  async execute(client, message, args) {
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

    const targetChannel = client.channels.cache.get('1243477348746268734');
    if (targetChannel) {
      await targetChannel.send({ content: textMessage, components: [row] });
    } else {
      return message.reply('Hedef kanal bulunamadı.');
    }
  }
};
