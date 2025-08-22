const {
  SlashCommandBuilder,
  MessageEmbed
} = require('discord.js');

// Slash komutu için gerekli olan veriyi oluşturur.
const slashCommandData = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Botun gecikmesini hesaplar.');

module.exports = {
  // Komutun hem slash hem de prefix komutlarında ortak olarak çalışacak olan işlevi.
  // interaction, slash komutlarında, message ise prefix komutlarında kullanılır.
  async execute(interactionOrMessage) {
    // Mesaj veya etkileşimden hangisi olduğunu kontrol et
    const isSlashCommand = interactionOrMessage.isCommand();
    const replyTarget = isSlashCommand ? interactionOrMessage : interactionOrMessage;

    // Ping hesaplama mesajını gönder
    let sentMessage;
    if (isSlashCommand) {
      // Slash komutlarında önce deferred reply (gecikmeli yanıt) kullanılır
      await replyTarget.deferReply({
        ephemeral: false
      });
      sentMessage = await replyTarget.editReply({
        content: '`Ping hesaplanıyor...`'
      });
    } else {
      sentMessage = await replyTarget.reply({
        content: '`Ping hesaplanıyor...`'
      });
    }

    const ping = sentMessage.createdTimestamp - interactionOrMessage.createdTimestamp;
    const apiPing = Math.round(interactionOrMessage.client.ws.ping);

    const embed = new MessageEmbed()
      .setTitle('Gecikme')
      .setDescription(`Bot: **${ping}ms**\nAPI: **${apiPing}ms**`)
      .setColor('#00ff00')
      .setTimestamp();

    // Mesajı düzenle ve gecikme bilgisini gönder
    await sentMessage.edit({
      content: '`Ping hesaplandı:`',
      embeds: [embed]
    });
  },

  // Slash komut verisi
  data: slashCommandData,
};
