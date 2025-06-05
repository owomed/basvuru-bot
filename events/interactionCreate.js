const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.isButton()) return;

    const { customId, guild, user, channel } = interaction;

    const supportRoleId = '1236317902295138304';
    const logChannelId = '1234964469340438590';

    const sendLog = async (title, description) => {
      const logChannel = guild.channels.cache.get(logChannelId);
      if (!logChannel) return;
      const logEmbed = new MessageEmbed()
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();
      await logChannel.send({ embeds: [logEmbed] });
    };

    const createTicket = async () => {
      const existingChannel = guild.channels.cache.find(c =>
        c.name === `soru-talep-${user.username.toLowerCase()}`
      );

      if (existingChannel) {
        return interaction.reply({
          content: `Zaten açık bir ticket'iniz var: <#${existingChannel.id}>`,
          ephemeral: true
        });
      }

      try {
        const ticketChannel = await guild.channels.create(`soru-talep-${user.username.toLowerCase()}`, {
          type: 'GUILD_TEXT',
          permissionOverwrites: [
            { id: guild.roles.everyone, deny: ['VIEW_CHANNEL'] },
            { id: user.id, allow: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'ATTACH_FILES'] },
            { id: supportRoleId, allow: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY'] },
          ]
        });

        await ticketChannel.send(`<a:med_1arrowok:1235316502824226888> ${user} soru veya talep için burada <@&${supportRoleId}>`);

        const welcomeEmbed = new MessageEmbed()
          .setTitle('Soru/Talep')
          .setColor('#ef610c')
          .setDescription(
            'Hoş geldiniz!\nNe sorunuz veya sorununuz varsa sormaktan çekinmeyin.\n' +
            '**Personeller size en kısa sürede yardımcı olacaktır! Lütfen sabırlı olun.**\n\n' +
            'Ticket\'ı kapatmak için aşağıdaki "Kapat" butonunu kullanabilirsiniz.'
          )
          .setFooter(`by hicckimse | ${guild.name}`, guild.iconURL())
          .setTimestamp();

        const closeButton = new MessageActionRow().addComponents(
          new MessageButton()
            .setCustomId('soruKapat') // <-- Değiştirildi
            .setLabel('Kapat')
            .setStyle('DANGER')
        );

        await ticketChannel.send({ embeds: [welcomeEmbed], components: [closeButton] });

        await sendLog('Ticket Açıldı', `**Kullanıcı:** ${user.tag} \`(${user.id})\`\n**Kanal:** ${ticketChannel}`);

        await interaction.reply({
          content: `🎫 Ticket kanalınız oluşturuldu: ${ticketChannel}`,
          ephemeral: true
        });

      } catch (err) {
        console.error('Ticket oluşturulamadı:', err);
        if (!interaction.replied) {
          await interaction.reply({
            content: 'Bir hata oluştu. Lütfen tekrar deneyin.',
            ephemeral: true
          });
        }
      }
    };

    const confirmCloseTicket = async () => {
      const confirmRow = new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId('soruOnayla') // <-- Değiştirildi
          .setLabel('Evet')
          .setStyle('SUCCESS'),
        new MessageButton()
          .setCustomId('soruIptal') // <-- Değiştirildi
          .setLabel('Hayır')
          .setStyle('DANGER')
      );

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Ticket **silinecektir**. Emin misiniz?',
            components: [confirmRow],
            ephemeral: true
          });
        }
      } catch (err) {
        console.error('Kapatma onayı gönderilemedi:', err);
      }
    };

    const deleteTicket = async () => {
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Ticket siliniyor... <a:med_onay:1240943849795489812>',
            ephemeral: true
          });
        }

        await sendLog('Ticket Silindi',
          `**Kullanıcı:** ${user.tag}\n**Kanal:** ${channel.name}\n**Kapatan:** ${user}`
        );

        setTimeout(() => {
          channel.delete().catch(err => console.error('Kanal silinemedi:', err));
        }, 3000);

      } catch (err) {
        console.error('Ticket silme hatası:', err);
      }
    };

    const cancelTicketClose = async () => {
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Ticket kapatma işlemi iptal edildi. <a:med_hayir:1240942589977559081>',
            ephemeral: true
          });
        }
      } catch (err) {
        console.error('İptal mesajı gönderilemedi:', err);
      }
    };

    // === Buton İşlemleri ===
    switch (customId) {
      case 'görüş':
        await createTicket();
        break;

      case 'soruKapat':
        await confirmCloseTicket();
        break;

      case 'soruOnayla':
        await deleteTicket();
        break;

      case 'soruIptal':
        await cancelTicketClose();
        break;
    }
  }
};
